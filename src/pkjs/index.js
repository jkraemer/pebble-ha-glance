// Entry point of the phone side: hands the app the runtime it runs in and the
// configuration it was built with. config.json is written by the build from
// settings.json and the access token.
require('./app').start({
  config: require('./config.json'),
  keys: require('message_keys'),
  Pebble: Pebble,
  XMLHttpRequest: XMLHttpRequest,
  // Browser-based runtimes refuse a setTimeout called on another object.
  setTimeout: function (callback, delay) { return setTimeout(callback, delay); }
});
