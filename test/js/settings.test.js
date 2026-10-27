'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const settings = require('../../src/pkjs/settings');

// The answers as the settings page hands them back: each field by its key,
// with what was typed into it.
function answers(typed) {
  const result = {};
  Object.keys(typed).forEach((key) => { result[key] = { value: typed[key] }; });
  return result;
}

// The phone's localStorage.
function storage() {
  const items = {};
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(items, key) ? items[key] : null; },
    setItem(key, value) { items[key] = String(value); },
  };
}

// The keys of all fields on the settings page, in page order.
function fieldKeys(items) {
  return items.reduce((keys, item) => keys
    .concat(item.messageKey ? [item.messageKey] : [])
    .concat(item.items ? fieldKeys(item.items) : []), []);
}

test('the address and the token are taken without surrounding spaces', () => {
  const config = settings.fromForm(answers({ url: ' https://ha.example ', token: 'secret\n' }));

  assert.equal(config.url, 'https://ha.example');
  assert.equal(config.token, 'secret');
});

test('a value is taken when it names an entity', () => {
  const config = settings.fromForm(answers({
    value_label_0: 'Alarm', value_entity_0: 'alarm_control_panel.home',
    value_label_1: 'Unused', value_entity_1: ' ',
    value_label_2: '', value_entity_2: 'sensor.battery',
  }));

  assert.deepEqual(config.values, [
    { label: 'Alarm', entity: 'alarm_control_panel.home', shown_as: {} },
    { label: '', entity: 'sensor.battery', shown_as: {} },
  ]);
});

test('texts for states are written as state=text pairs', () => {
  const config = settings.fromForm(answers({
    value_entity_0: 'alarm_control_panel.home',
    value_shown_as_0: 'disarmed=OFF, armed_away = AWAY,',
  }));

  assert.deepEqual(config.values[0].shown_as, { disarmed: 'OFF', armed_away: 'AWAY' });
});

test('a pair without an equals sign is left out', () => {
  const config = settings.fromForm(answers({ value_entity_0: 'sensor.mode', value_shown_as_0: 'eco, boost=MAX' }));

  assert.deepEqual(config.values[0].shown_as, { boost: 'MAX' });
});

test('a text may contain an equals sign of its own', () => {
  const config = settings.fromForm(answers({ value_entity_0: 'sensor.mode', value_shown_as_0: 'on=I=O' }));

  assert.deepEqual(config.values[0].shown_as, { on: 'I=O' });
});

test('buttons keep their places when one is left empty', () => {
  const config = settings.fromForm(answers({
    button_label_0: 'Movie', button_entity_0: 'script.movie_night',
    button_label_2: 'Fan', button_entity_2: 'switch.fan',
  }));

  assert.deepEqual(config.buttons, [
    { label: 'Movie', entity: 'script.movie_night' },
    { label: '', entity: '' },
    { label: 'Fan', entity: 'switch.fan' },
  ]);
});

test('the page asks for everything the settings are made of', () => {
  const typed = {};
  fieldKeys(settings.form).forEach((key) => { typed[key] = key; });

  const config = settings.fromForm(answers(typed));

  assert.equal(config.url, 'url');
  assert.equal(config.token, 'token');
  assert.deepEqual(config.values.map((value) => [value.label, value.entity]),
    [0, 1, 2, 3].map((i) => ['value_label_' + i, 'value_entity_' + i]));
  assert.deepEqual(config.buttons, [0, 1, 2].map((i) => ({ label: 'button_label_' + i, entity: 'button_entity_' + i })));
  // Without an equals sign the field's key is no pair, so only its presence is checked here.
  assert.equal(fieldKeys(settings.form).filter((key) => key.indexOf('value_shown_as_') === 0).length, 4);
});

test('the page ends with a button that saves', () => {
  assert.equal(settings.form[settings.form.length - 1].type, 'submit');
});

test('saved settings are loaded', () => {
  const phone = storage();
  const config = settings.fromForm(answers({ url: 'https://ha.example', token: 'secret' }));

  settings.save(phone, config);

  assert.deepEqual(settings.load(phone, null), config);
});

test('saved settings win over the preset', () => {
  const phone = storage();
  settings.save(phone, { url: 'https://ha.example', token: 'secret', values: [], buttons: [] });

  assert.equal(settings.load(phone, { url: 'http://127.0.0.1:8377', token: 'dev-token' }).url, 'https://ha.example');
});

test('without saved settings the preset is used', () => {
  const preset = { url: 'http://127.0.0.1:8377', token: 'dev-token' };

  assert.deepEqual(settings.load(storage(), preset), preset);
});

test('without saved settings or a preset there are none', () => {
  assert.equal(settings.load(storage(), null), null);
});
