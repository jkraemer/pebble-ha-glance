// The settings: the page they are entered on (a Clay form), how its answers
// become the configuration the app runs with, and keeping that on the phone.

var VALUES = 4;
var BUTTON_NAMES = ['Top button', 'Middle button', 'Bottom button'];

// Where the configuration is kept in the phone's localStorage.
var STORAGE_KEY = 'config';

function input(key, label, description) {
  var item = { type: 'input', messageKey: key, label: label, defaultValue: '' };
  if (description) {
    item.description = description;
  }
  return item;
}

function section(heading, items) {
  return { type: 'section', items: [{ type: 'heading', defaultValue: heading }].concat(items) };
}

var form = [
  { type: 'heading', defaultValue: 'HA Glance' },
  section('Home Assistant', [
    input('url', 'Address', 'For example https://homeassistant.local:8123'),
    input('token', 'Access token',
      'A long-lived access token, created in Home Assistant under your profile, Security tab.')
  ])
];
for (var v = 0; v < VALUES; v++) {
  form.push(section('Value ' + (v + 1), [
    input('value_label_' + v, 'Caption'),
    input('value_entity_' + v, 'Entity', 'For example sensor.battery. Leave empty to show fewer values.'),
    input('value_shown_as_' + v, 'Texts for states',
      'Optional, for example disarmed=OFF, armed_away=AWAY. Other states are shown as they are.')
  ]));
}
BUTTON_NAMES.forEach(function (name, b) {
  form.push(section(name, [
    input('button_label_' + b, 'Label'),
    input('button_entity_' + b, 'Entity',
      'Scripts and scenes run, automations trigger, buttons are pressed, everything else toggles.')
  ]));
});
form.push({ type: 'submit', defaultValue: 'Save' });

// "disarmed=OFF, armed_away=AWAY" as { disarmed: 'OFF', armed_away: 'AWAY' }.
function stateTexts(pairs) {
  var texts = {};
  pairs.split(',').forEach(function (pair) {
    var equals = pair.indexOf('=');
    if (equals > 0) {
      texts[pair.substring(0, equals).trim()] = pair.substring(equals + 1).trim();
    }
  });
  return texts;
}

// The configuration from the page's answers, which hold each field as { value }.
function fromForm(answers) {
  function field(key) {
    var answer = answers[key];
    return answer && typeof answer.value === 'string' ? answer.value.trim() : '';
  }

  var values = [];
  for (var i = 0; i < VALUES; i++) {
    if (field('value_entity_' + i)) {
      values.push({
        label: field('value_label_' + i),
        entity: field('value_entity_' + i),
        shown_as: stateTexts(field('value_shown_as_' + i))
      });
    }
  }
  return {
    url: field('url'),
    token: field('token'),
    values: values,
    buttons: BUTTON_NAMES.map(function (name, b) {
      return { label: field('button_label_' + b), entity: field('button_entity_' + b) };
    })
  };
}

// The saved configuration, or else the preset the app was built with, or null.
function load(storage, preset) {
  var saved = storage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : preset;
}

function save(storage, config) {
  storage.setItem(STORAGE_KEY, JSON.stringify(config));
}

module.exports = { form: form, fromForm: fromForm, load: load, save: save };
