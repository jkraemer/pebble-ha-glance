// The phone side of the watch app. It sends the watch its dashboard, the
// configured values with their current states and the labels of the three
// buttons, and triggers a button's entity when the watch reports a press.

var homeAssistant = require('./home_assistant');

var MAX_VALUES = 4;
var BUTTONS = 3;

// Shown for a value whose state could not be read.
var UNREADABLE = '?';

// Home Assistant needs a moment before a triggered action shows in the states.
var REFRESH_AFTER_PRESS_MS = 1000;

// options: config (see settings.json, plus the token), keys (the numbers of
// the message keys), and the runtime's Pebble, XMLHttpRequest and setTimeout.
function start(options) {
  var config = options.config;
  var keys = options.keys;
  var Pebble = options.Pebble;
  var home = homeAssistant.connect(config.url, config.token, options.XMLHttpRequest);
  var values = (config.values || []).slice(0, MAX_VALUES);
  var buttons = config.buttons || [];

  // The text for a state: the one the value's shown_as gives it, or the state itself.
  function shown(value, state) {
    var texts = value.shown_as || {};
    return Object.prototype.hasOwnProperty.call(texts, state) ? texts[state] : state;
  }

  function sendDashboard(readings) {
    var message = {};
    message[keys.VALUE_COUNT] = values.length;
    values.forEach(function (value, i) {
      message[keys.CAPTION + i] = value.label || '';
      message[keys.VALUE + i] = readings[i] ? shown(value, readings[i].state) : UNREADABLE;
      message[keys.UNIT + i] = readings[i] ? readings[i].unit : '';
    });
    for (var i = 0; i < BUTTONS; i++) {
      message[keys.BUTTON + i] = (buttons[i] && buttons[i].label) || '';
    }
    Pebble.sendAppMessage(message);
  }

  // Reads all values and sends the dashboard once the last one has answered.
  function refresh() {
    var readings = [];
    var waiting = values.length;
    if (waiting === 0) {
      sendDashboard(readings);
    }
    values.forEach(function (value, i) {
      home.read(value.entity, function (error, reading) {
        readings[i] = error ? null : reading;
        waiting--;
        if (waiting === 0) {
          sendDashboard(readings);
        }
      });
    });
  }

  function report(key, button) {
    var message = {};
    message[key] = button;
    Pebble.sendAppMessage(message);
  }

  function press(button) {
    if (!buttons[button] || !buttons[button].entity) {
      report(keys.FAILED, button);
      return;
    }
    home.trigger(buttons[button].entity, function (error) {
      if (error) {
        report(keys.FAILED, button);
        return;
      }
      report(keys.SUCCEEDED, button);
      options.setTimeout(refresh, REFRESH_AFTER_PRESS_MS);
    });
  }

  // Runtimes differ in whether they name a message's keys or number them.
  function received(payload, name) {
    return payload[name] !== undefined ? payload[name] : payload[keys[name]];
  }

  Pebble.addEventListener('ready', refresh);
  Pebble.addEventListener('appmessage', function (event) {
    var pressed = received(event.payload, 'PRESS');
    if (pressed !== undefined) {
      press(pressed);
    } else if (received(event.payload, 'REFRESH') !== undefined) {
      refresh();
    }
  });
}

module.exports = { start: start };
