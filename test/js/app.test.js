'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { KEYS, CONFIG, network, pebble, clock } = require('./harness');
const app = require('../../src/pkjs/app');

function start(config) {
  const world = { net: network(), watch: pebble(), time: clock() };
  world.app = app.start({
    config: config === undefined ? CONFIG : config,
    keys: KEYS,
    Pebble: world.watch,
    XMLHttpRequest: world.net.XMLHttpRequest,
    setTimeout: world.time.setTimeout,
  });
  return world;
}

function answerStates(net, alarm, battery) {
  net.take('/api/states/alarm_control_panel.home').respond(200, { state: alarm, attributes: {} });
  net.take('/api/states/sensor.battery').respond(200, { state: battery, attributes: { unit_of_measurement: '%' } });
}

const DASHBOARD = {
  [KEYS.VALUE_COUNT]: 2,
  [KEYS.CAPTION]: 'Alarm', [KEYS.VALUE]: 'disarmed', [KEYS.UNIT]: '',
  [KEYS.CAPTION + 1]: 'Battery', [KEYS.VALUE + 1]: '96', [KEYS.UNIT + 1]: '%',
  [KEYS.BUTTON]: 'Movie', [KEYS.BUTTON + 1]: 'Water', [KEYS.BUTTON + 2]: 'Fan',
};

test('the watch gets the dashboard once the app has started', () => {
  const { net, watch } = start();
  watch.ready();

  answerStates(net, 'disarmed', '96');

  assert.deepEqual(watch.sent, [DASHBOARD]);
});

test('nothing is sent while values are still being read', () => {
  const { net, watch } = start();
  watch.ready();

  net.take('/api/states/sensor.battery').respond(200, { state: '96', attributes: {} });

  assert.deepEqual(watch.sent, []);
});

test('the watch gets the dashboard again whenever it asks', () => {
  const { net, watch } = start();
  watch.ready();
  answerStates(net, 'disarmed', '96');

  watch.receive({ REFRESH: 1 });
  answerStates(net, 'armed_away', '95');

  assert.equal(watch.sent.length, 2);
  assert.equal(watch.sent[1][KEYS.VALUE], 'armed_away');
  assert.equal(watch.sent[1][KEYS.VALUE + 1], '95');
});

test('a value that cannot be read shows as a question mark', () => {
  const { net, watch } = start();
  watch.ready();

  net.take('/api/states/alarm_control_panel.home').respond(404, { message: 'Entity not found.' });
  net.take('/api/states/sensor.battery').respond(200, { state: '96', attributes: { unit_of_measurement: '%' } });

  assert.equal(watch.sent[0][KEYS.VALUE], '?');
  assert.equal(watch.sent[0][KEYS.UNIT], '');
  assert.equal(watch.sent[0][KEYS.VALUE + 1], '96');
});

test('a state can be shown as a text of its own', () => {
  const values = [{ label: 'Alarm', entity: 'alarm_control_panel.home', shown_as: { disarmed: 'OFF', armed_away: 'AWAY' } }];
  const { net, watch } = start({ ...CONFIG, values });
  watch.ready();

  net.take('/api/states/alarm_control_panel.home').respond(200, { state: 'armed_away', attributes: {} });

  assert.equal(watch.sent[0][KEYS.VALUE], 'AWAY');
});

test('a state without a text of its own is shown as it is', () => {
  const values = [{ label: 'Alarm', entity: 'alarm_control_panel.home', shown_as: { disarmed: 'OFF' } }];
  const { net, watch } = start({ ...CONFIG, values });
  watch.ready();

  net.take('/api/states/alarm_control_panel.home').respond(200, { state: 'unavailable', attributes: {} });

  assert.equal(watch.sent[0][KEYS.VALUE], 'unavailable');
});

test('a state is not mistaken for something every object has', () => {
  const values = [{ label: 'Mode', entity: 'sensor.mode', shown_as: { eco: 'ECO' } }];
  const { net, watch } = start({ ...CONFIG, values });
  watch.ready();

  net.take('/api/states/sensor.mode').respond(200, { state: 'constructor', attributes: {} });

  assert.equal(watch.sent[0][KEYS.VALUE], 'constructor');
});

test('up to four values are shown', () => {
  const values = ['a', 'b', 'c', 'd', 'e'].map((name) => ({ label: name.toUpperCase(), entity: 'sensor.' + name }));
  const { net, watch } = start({ ...CONFIG, values });
  watch.ready();

  assert.deepEqual(net.requests.map((request) => request.url.split('/').pop()),
    ['sensor.a', 'sensor.b', 'sensor.c', 'sensor.d']);
  net.requests.splice(0).forEach((request) => request.respond(200, { state: '1', attributes: {} }));

  assert.equal(watch.sent[0][KEYS.VALUE_COUNT], 4);
  assert.equal(watch.sent[0][KEYS.CAPTION + 3], 'D');
});

test('a dashboard without values still shows its buttons', () => {
  const { watch } = start({ ...CONFIG, values: [] });
  watch.ready();

  assert.deepEqual(watch.sent, [{
    [KEYS.VALUE_COUNT]: 0,
    [KEYS.BUTTON]: 'Movie', [KEYS.BUTTON + 1]: 'Water', [KEYS.BUTTON + 2]: 'Fan',
  }]);
});

test('a value without a label has an empty caption', () => {
  const { net, watch } = start({ ...CONFIG, values: [{ entity: 'sensor.battery' }] });
  watch.ready();

  net.take('/api/states/sensor.battery').respond(200, { state: '96', attributes: {} });

  assert.equal(watch.sent[0][KEYS.CAPTION], '');
});

test('a long value is cut to what the watch has room for', () => {
  const { net, watch } = start({ ...CONFIG, values: [{ entity: 'sensor.forecast' }] });
  watch.ready();

  net.take('/api/states/sensor.forecast').respond(200, { state: 'Rain in the afternoon, then clear skies', attributes: {} });

  assert.equal(watch.sent[0][KEYS.VALUE], 'Rain in the afternoon, then');
});

test('a long caption is cut as well', () => {
  const { net, watch } = start({ ...CONFIG, values: [{ label: 'Temperature outside now', entity: 'sensor.outside' }] });
  watch.ready();

  net.take('/api/states/sensor.outside').respond(200, { state: '31.4', attributes: {} });

  assert.equal(watch.sent[0][KEYS.CAPTION], 'Temperature outside');
});

test('a long unit is cut as well', () => {
  const { net, watch } = start({ ...CONFIG, values: [{ entity: 'sensor.outside' }] });
  watch.ready();

  net.take('/api/states/sensor.outside').respond(200, { state: '31.4', attributes: { unit_of_measurement: 'degrees Celsius' } });

  assert.equal(watch.sent[0][KEYS.UNIT], 'degrees C');
});

test('a long button label is cut as well', () => {
  const { watch } = start({ ...CONFIG, values: [], buttons: [{ label: 'Back door lights on', entity: 'switch.back' }] });
  watch.ready();

  assert.equal(watch.sent[0][KEYS.BUTTON], 'Back door light');
});

test('texts are cut by their bytes, not their characters', () => {
  // Ten euro signs take 30 bytes; nine fit into the 27 of a value.
  const { net, watch } = start({ ...CONFIG, values: [{ entity: 'sensor.a' }] });
  watch.ready();

  net.take('/api/states/sensor.a').respond(200, { state: '€€€€€€€€€€', attributes: {} });

  assert.equal(watch.sent[0][KEYS.VALUE], '€€€€€€€€€');
});

test('a cut never leaves half a character', () => {
  // 26 letters leave one byte, which is not enough for the degree sign's two.
  const { net, watch } = start({ ...CONFIG, values: [{ entity: 'sensor.a' }] });
  watch.ready();

  net.take('/api/states/sensor.a').respond(200, { state: 'abcdefghijklmnopqrstuvwxyz°', attributes: {} });

  assert.equal(watch.sent[0][KEYS.VALUE], 'abcdefghijklmnopqrstuvwxyz');
});

test('a character of two code units is kept or dropped as a whole', () => {
  // 23 letters and a four-byte character fill 27 bytes; with one letter more the character has to go.
  const { net, watch } = start({ ...CONFIG, values: [{ entity: 'sensor.a' }, { entity: 'sensor.b' }] });
  watch.ready();

  net.take('/api/states/sensor.a').respond(200, { state: 'abcdefghijklmnopqrstuvw😀', attributes: {} });
  net.take('/api/states/sensor.b').respond(200, { state: 'abcdefghijklmnopqrstuvwx😀', attributes: {} });

  assert.equal(watch.sent[0][KEYS.VALUE], 'abcdefghijklmnopqrstuvw😀');
  assert.equal(watch.sent[0][KEYS.VALUE + 1], 'abcdefghijklmnopqrstuvwx');
});

test('pressing a button triggers its entity and reports success', () => {
  const { net, watch } = start();

  watch.receive({ PRESS: 1 });
  assert.deepEqual(watch.sent, []);
  net.take('/api/services/automation/trigger').respond(200, []);

  assert.deepEqual(watch.sent, [{ [KEYS.SUCCEEDED]: 1 }]);
});

test('the top button is number zero', () => {
  const { net, watch } = start();

  watch.receive({ PRESS: 0 });
  net.take('/api/services/script/turn_on').respond(200, []);

  assert.deepEqual(watch.sent, [{ [KEYS.SUCCEEDED]: 0 }]);
});

test('a press is understood when the runtime passes keys as numbers', () => {
  const { net, watch } = start();

  watch.receive({ [KEYS.PRESS]: 2 });
  net.take('/api/services/switch/toggle').respond(200, []);

  assert.deepEqual(watch.sent, [{ [KEYS.SUCCEEDED]: 2 }]);
});

test('values are read again a second after a button did its work', () => {
  const { net, watch, time } = start();
  watch.receive({ PRESS: 0 });
  net.take('/api/services/script/turn_on').respond(200, []);
  assert.equal(net.requests.length, 0);

  time.advance(1000);
  answerStates(net, 'arming', '96');

  assert.equal(watch.sent.length, 2);
  assert.equal(watch.sent[1][KEYS.VALUE], 'arming');
});

test('a button whose action fails reports failure and reads nothing', () => {
  const { net, watch, time } = start();

  watch.receive({ PRESS: 0 });
  net.take('/api/services/script/turn_on').respond(500, 'Server got itself in trouble');
  time.advance(1000);

  assert.deepEqual(watch.sent, [{ [KEYS.FAILED]: 0 }]);
  assert.equal(net.requests.length, 0);
});

test('a button without an entity reports failure', () => {
  const { net, watch } = start({ ...CONFIG, buttons: [{ label: 'Movie', entity: 'script.movie_night' }] });

  watch.receive({ PRESS: 2 });

  assert.deepEqual(watch.sent, [{ [KEYS.FAILED]: 2 }]);
  assert.equal(net.requests.length, 0);
});

test('buttons that are not configured have empty labels', () => {
  const { watch } = start({ ...CONFIG, values: [], buttons: [{ label: 'Movie', entity: 'script.movie_night' }] });
  watch.ready();

  assert.deepEqual(watch.sent, [{
    [KEYS.VALUE_COUNT]: 0,
    [KEYS.BUTTON]: 'Movie', [KEYS.BUTTON + 1]: '', [KEYS.BUTTON + 2]: '',
  }]);
});

test('a message the watch did not take is logged', () => {
  const { watch } = start({ ...CONFIG, values: [] });
  const lines = [];
  const log = console.log;
  console.log = (line) => lines.push(line);
  try {
    watch.ready();
    watch.refuse('inbox full');
  } finally {
    console.log = log;
  }

  assert.deepEqual(lines, ['The watch did not take a message: "inbox full"']);
});

test('without settings the watch is told to get them set up', () => {
  const { net, watch } = start(null);
  watch.ready();

  assert.deepEqual(watch.sent, [{ [KEYS.SETUP_NEEDED]: 1 }]);
  assert.equal(net.requests.length, 0);
});

test('settings without an address or a token count as none', () => {
  [{ ...CONFIG, url: '' }, { ...CONFIG, token: '' }].forEach((config) => {
    const { net, watch } = start(config);
    watch.ready();

    assert.deepEqual(watch.sent, [{ [KEYS.SETUP_NEEDED]: 1 }]);
    assert.equal(net.requests.length, 0);
  });
});

test('without settings the watch is told so whenever it asks', () => {
  const { watch } = start(null);
  watch.ready();

  watch.receive({ REFRESH: 1 });

  assert.deepEqual(watch.sent, [{ [KEYS.SETUP_NEEDED]: 1 }, { [KEYS.SETUP_NEEDED]: 1 }]);
});

test('without settings a press reports failure', () => {
  const { net, watch } = start(null);

  watch.receive({ PRESS: 0 });

  assert.deepEqual(watch.sent, [{ [KEYS.FAILED]: 0 }]);
  assert.equal(net.requests.length, 0);
});

test('new settings are used at once', () => {
  const { app: running, net, watch } = start(null);
  watch.ready();

  running.configure({ ...CONFIG, url: 'https://other.example', values: [{ label: 'Solar', entity: 'sensor.solar' }] });
  const request = net.take('/api/states/sensor.solar');
  request.respond(200, { state: '2.4', attributes: { unit_of_measurement: 'kW' } });

  assert.equal(request.url, 'https://other.example/api/states/sensor.solar');
  assert.equal(watch.sent.length, 2);
  assert.equal(watch.sent[1][KEYS.VALUE_COUNT], 1);
  assert.equal(watch.sent[1][KEYS.CAPTION], 'Solar');
  assert.equal(watch.sent[1][KEYS.VALUE], '2.4');
});

test('values read under old settings are not shown under new ones', () => {
  const { app: running, net, watch } = start();
  watch.ready();

  running.configure({ ...CONFIG, values: [{ label: 'Solar', entity: 'sensor.solar' }] });
  answerStates(net, 'disarmed', '96');
  net.take('/api/states/sensor.solar').respond(200, { state: '2.4', attributes: {} });

  assert.deepEqual(watch.sent.map((message) => message[KEYS.CAPTION]), ['Alarm', 'Solar']);
  assert.equal(watch.sent[0][KEYS.CAPTION + 1], 'Battery');
  assert.equal(watch.sent[1][KEYS.VALUE_COUNT], 1);
});
