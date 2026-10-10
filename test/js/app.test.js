'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { KEYS, CONFIG, network, pebble, clock } = require('./harness');
const app = require('../../src/pkjs/app');

function start(config) {
  const world = { net: network(), watch: pebble(), time: clock() };
  app.start({
    config: config || CONFIG,
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
