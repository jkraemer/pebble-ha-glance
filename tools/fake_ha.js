#!/usr/bin/env node
// A stand-in for Home Assistant, for trying the app in the emulator without
// touching the real house. It serves the entities of dev/settings.json and
// logs every request.
//
//   node tools/fake_ha.js
//   GLANCE_SETTINGS=dev/settings.json pebble build && tools/emu.sh install
//
// Triggering anything whose name contains "fail" is refused. A state can be
// set as with Home Assistant's own API: POST /api/states/ENTITY with
// {"state": ...}.
'use strict';
const http = require('node:http');

const PORT = 8377;
const TOKEN = 'dev-token';

const states = {
  'alarm_control_panel.home_alarm': { state: 'disarmed', attributes: {} },
  'sensor.battery': { state: '96', attributes: { unit_of_measurement: '%' } },
  'sensor.solar_power': { state: '3412', attributes: { unit_of_measurement: 'W' } },
  'sensor.outside_temperature': { state: '31.4', attributes: { unit_of_measurement: '°C' } },
};

function answer(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

http.createServer((request, response) => {
  let body = '';
  request.on('data', (chunk) => { body += chunk; });
  request.on('end', () => {
    console.log(request.method, request.url, body);
    if (request.headers.authorization !== 'Bearer ' + TOKEN) {
      return answer(response, 401, { message: 'Unauthorized' });
    }
    const state = /^\/api\/states\/(.+)$/.exec(request.url);
    if (request.method === 'GET' && state) {
      return states[state[1]] ? answer(response, 200, states[state[1]]) : answer(response, 404, { message: 'Entity not found.' });
    }
    if (request.method === 'POST' && state) {
      const given = JSON.parse(body);
      states[state[1]] = { state: given.state, attributes: given.attributes || {} };
      return answer(response, 200, states[state[1]]);
    }
    if (request.method === 'POST' && request.url.startsWith('/api/services/')) {
      const entity = JSON.parse(body).entity_id;
      if (entity.includes('fail')) {
        return answer(response, 500, { message: 'refused' });
      }
      return answer(response, 200, []);
    }
    return answer(response, 404, { message: 'Not found' });
  });
}).listen(PORT, '127.0.0.1', () => console.log('stand-in Home Assistant on http://127.0.0.1:' + PORT));
