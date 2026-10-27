// Entry point of the phone side: hands the app the runtime it runs in and the
// settings, and shows the settings page. preset.json is written by the build:
// the settings of a development build (GLANCE_SETTINGS), null otherwise.
var Clay = require('@rebble/clay');
var settings = require('./settings');

var clay = new Clay(settings.form, null, { autoHandleEvents: false });

var app = require('./app').start({
  config: settings.load(localStorage, require('./preset.json')),
  keys: require('message_keys'),
  Pebble: Pebble,
  XMLHttpRequest: XMLHttpRequest,
  // Browser-based runtimes refuse a setTimeout called on another object.
  setTimeout: function (callback, delay) { return setTimeout(callback, delay); }
});

Pebble.addEventListener('showConfiguration', function () {
  Pebble.openURL(clay.generateUrl());
});

Pebble.addEventListener('webviewclosed', function (event) {
  // The page was closed without saving.
  if (!event || !event.response) {
    return;
  }
  // Clay keeps the answers too, to fill the page with them next time.
  var config = settings.fromForm(clay.getSettings(event.response, false));
  settings.save(localStorage, config);
  app.configure(config);
});
