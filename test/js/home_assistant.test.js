'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { network } = require('./harness');
const homeAssistant = require('../../src/pkjs/home_assistant');

function client(net, url) {
  return homeAssistant.connect(url || 'https://ha.example', 'secret-token', net.XMLHttpRequest);
}

// Collects what a callback was called with.
function outcome() {
  const calls = [];
  const callback = (error, result) => calls.push({ error, result });
  callback.calls = calls;
  return callback;
}

test('reading an entity asks Home Assistant for its state with the access token', () => {
  const net = network();
  client(net).read('sensor.battery', outcome());

  const request = net.take('/api/states/sensor.battery');
  assert.equal(request.method, 'GET');
  assert.equal(request.url, 'https://ha.example/api/states/sensor.battery');
  assert.equal(request.headers.Authorization, 'Bearer secret-token');
});

test('a reading is the state with its unit', () => {
  const net = network();
  const done = outcome();
  client(net).read('sensor.battery', done);

  net.take('/api/states/sensor.battery').respond(200, { state: '96', attributes: { unit_of_measurement: '%' } });

  assert.deepEqual(done.calls, [{ error: null, result: { state: '96', unit: '%' } }]);
});

test('a state without a unit reads with an empty one', () => {
  const net = network();
  const done = outcome();
  client(net).read('alarm_control_panel.home', done);

  net.take('/api/states/alarm_control_panel.home').respond(200, { state: 'disarmed', attributes: {} });

  assert.deepEqual(done.calls, [{ error: null, result: { state: 'disarmed', unit: '' } }]);
});

test('a slash at the end of the address makes no difference', () => {
  const net = network();
  client(net, 'https://ha.example/').read('sensor.battery', outcome());

  assert.equal(net.requests[0].url, 'https://ha.example/api/states/sensor.battery');
});

for (const [name, answer] of [
  ['a rejected token', (request) => request.respond(401, '401: Unauthorized')],
  ['an unknown entity', (request) => request.respond(404, { message: 'Entity not found.' })],
  ['an answer that is not JSON', (request) => request.respond(200, '<html>gateway error</html>')],
  ['an unreachable Home Assistant', (request) => request.fail()],
  ['no answer in time', (request) => request.timeOut()],
]) {
  test('reading fails with ' + name, () => {
    const net = network();
    const done = outcome();
    client(net).read('sensor.battery', done);

    answer(net.take('/api/states/sensor.battery'));

    assert.equal(done.calls.length, 1);
    assert.ok(done.calls[0].error, 'expected an error');
    assert.equal(done.calls[0].result, undefined);
  });
}

test('requests give up after ten seconds', () => {
  const net = network();
  client(net).read('sensor.battery', outcome());

  assert.equal(net.requests[0].timeout, 10000);
});

for (const [entity, service] of [
  ['script.movie_night', 'script/turn_on'],
  ['scene.evening', 'scene/turn_on'],
  ['automation.water_garden', 'automation/trigger'],
  ['button.restart', 'button/press'],
  ['input_button.doorbell', 'input_button/press'],
  ['switch.fan', 'switch/toggle'],
  ['light.kitchen', 'light/toggle'],
]) {
  test('triggering ' + entity + ' calls ' + service, () => {
    const net = network();
    client(net).trigger(entity, outcome());

    const request = net.take('/api/services/' + service);
    assert.equal(request.method, 'POST');
    assert.equal(request.headers.Authorization, 'Bearer secret-token');
    assert.equal(request.headers['Content-Type'], 'application/json');
    assert.equal(request.body, JSON.stringify({ entity_id: entity }));
  });
}

test('triggering succeeds when Home Assistant accepts the call', () => {
  const net = network();
  const done = outcome();
  client(net).trigger('script.movie_night', done);

  net.take('/api/services/script/turn_on').respond(200, []);

  assert.deepEqual(done.calls, [{ error: null, result: undefined }]);
});

test('triggering succeeds whatever Home Assistant answers with', () => {
  const net = network();
  const done = outcome();
  client(net).trigger('script.movie_night', done);

  net.take('/api/services/script/turn_on').respond(200, '');

  assert.deepEqual(done.calls, [{ error: null, result: undefined }]);
});

test('triggering fails when Home Assistant refuses the call', () => {
  const net = network();
  const done = outcome();
  client(net).trigger('script.movie_night', done);

  net.take('/api/services/script/turn_on').respond(500, 'Server got itself in trouble');

  assert.equal(done.calls.length, 1);
  assert.ok(done.calls[0].error, 'expected an error');
});
