// The phone side of the watch app. It sends the watch its dashboard, the
// configured values with their current states and the labels of the three
// buttons, and triggers a button's entity when the watch reports a press.

var homeAssistant = require('./home_assistant');

var MAX_VALUES = 4;
var BUTTONS = 3;

// Shown for a value whose state could not be read.
var UNREADABLE = '?';

// Room the watch keeps for each text, in bytes of UTF-8 without the
// terminator (src/c/dashboard.h). Texts are cut to it here, so that the
// dashboard always fits the watch's inbox.
var CAPTION_BYTES = 19;
var VALUE_BYTES = 27;
var UNIT_BYTES = 9;
var BUTTON_BYTES = 15;

// The longest start of a text that takes at most `bytes` of UTF-8, with no
// character cut in half.
function cut(text, bytes) {
  var end = 0;
  var used = 0;
  while (end < text.length) {
    var code = text.charCodeAt(end);
    var next = text.charCodeAt(end + 1);
    var units = 1;
    var size = code < 0x80 ? 1 : code < 0x800 ? 2 : 3;
    // A character beyond the basic plane is a pair of code units, four bytes.
    if (code >= 0xD800 && code < 0xDC00 && next >= 0xDC00 && next < 0xE000) {
      units = 2;
      size = 4;
    }
    if (used + size > bytes) {
      break;
    }
    used += size;
    end += units;
  }
  return text.substring(0, end);
}

// Home Assistant needs a moment before a triggered action shows in the states.
var REFRESH_AFTER_PRESS_MS = 1000;

// options: config (see settings.js; null when there is none), keys (the
// numbers of the message keys), and the runtime's Pebble, XMLHttpRequest and
// setTimeout. Returns configure(config), which puts other settings to use.
function start(options) {
  var keys = options.keys;
  var Pebble = options.Pebble;
  // Without an address and a token there is no Home Assistant to talk to.
  var home = null;
  var values = [];
  var buttons = [];

  function configure(config) {
    var usable = config && config.url && config.token;
    home = usable ? homeAssistant.connect(config.url, config.token, options.XMLHttpRequest) : null;
    values = usable ? (config.values || []).slice(0, MAX_VALUES) : [];
    buttons = usable ? config.buttons || [] : [];
  }

  // The text for a state: the one the value's shown_as gives it, or the state itself.
  function shown(value, state) {
    var texts = value.shown_as || {};
    return Object.prototype.hasOwnProperty.call(texts, state) ? texts[state] : state;
  }

  // A failure is only logged, for `pebble logs`: there is nothing better to
  // do with it. Runtimes differ in how they describe it.
  function send(message) {
    Pebble.sendAppMessage(message, function () {}, function (data, error) {
      console.log('The watch did not take a message: ' + JSON.stringify(error || data));
    });
  }

  function sendDashboard(shownValues, readings) {
    var message = {};
    message[keys.VALUE_COUNT] = shownValues.length;
    shownValues.forEach(function (value, i) {
      message[keys.CAPTION + i] = cut(value.label || '', CAPTION_BYTES);
      message[keys.VALUE + i] = cut(readings[i] ? shown(value, readings[i].state) : UNREADABLE, VALUE_BYTES);
      message[keys.UNIT + i] = cut(readings[i] ? readings[i].unit : '', UNIT_BYTES);
    });
    for (var i = 0; i < BUTTONS; i++) {
      message[keys.BUTTON + i] = cut((buttons[i] && buttons[i].label) || '', BUTTON_BYTES);
    }
    send(message);
  }

  // Reads all values and sends the dashboard once the last one has answered.
  // Readings are shown with the values they were asked for, even when the
  // settings change meanwhile.
  function refresh() {
    if (!home) {
      report(keys.SETUP_NEEDED, 1);
      return;
    }
    var asked = values;
    var readings = [];
    var waiting = asked.length;
    if (waiting === 0) {
      sendDashboard(asked, readings);
    }
    asked.forEach(function (value, i) {
      home.read(value.entity, function (error, reading) {
        readings[i] = error ? null : reading;
        waiting--;
        if (waiting === 0) {
          sendDashboard(asked, readings);
        }
      });
    });
  }

  function report(key, number) {
    var message = {};
    message[key] = number;
    send(message);
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

  configure(options.config);
  return {
    configure: function (config) {
      configure(config);
      refresh();
    }
  };
}

module.exports = { start: start };
