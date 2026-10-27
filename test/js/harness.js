// Stand-ins for what surrounds the phone side of the app: the Pebble runtime
// that connects it to the watch, the network towards Home Assistant, and time.
'use strict';

// The numbers behind the message keys. The real ones are assigned by the
// Pebble SDK at build time; array keys take as many numbers as they have entries.
const KEYS = {
  CAPTION: 100, VALUE: 104, UNIT: 108, BUTTON: 112,
  REFRESH: 115, PRESS: 116, VALUE_COUNT: 117, SUCCEEDED: 118, FAILED: 119, SETUP_NEEDED: 120,
};

const CONFIG = {
  url: 'https://ha.example',
  token: 'secret-token',
  values: [
    { label: 'Alarm', entity: 'alarm_control_panel.home' },
    { label: 'Battery', entity: 'sensor.battery' },
  ],
  buttons: [
    { label: 'Movie', entity: 'script.movie_night' },
    { label: 'Water', entity: 'automation.water_garden' },
    { label: 'Fan', entity: 'switch.fan' },
  ],
};

// Requests to Home Assistant wait in `requests` until a test answers them.
function network() {
  const requests = [];
  function XMLHttpRequest() {
    this.headers = {};
  }
  XMLHttpRequest.prototype = {
    open(method, url) { this.method = method; this.url = url; },
    setRequestHeader(name, value) { this.headers[name] = value; },
    send(body) { this.body = body; requests.push(this); },
    // What a test does to a waiting request.
    respond(status, body) {
      this.status = status;
      this.responseText = typeof body === 'string' ? body : JSON.stringify(body);
      this.onload();
    },
    fail() { this.onerror(); },
    timeOut() { this.ontimeout(); },
  };
  return {
    XMLHttpRequest,
    requests,
    // The waiting request for the given path, removed from the queue.
    take(path) {
      const index = requests.findIndex((request) => request.url.endsWith(path));
      if (index < 0) {
        throw new Error('no request for ' + path + ' among ' + requests.map((r) => r.url).join(', '));
      }
      return requests.splice(index, 1)[0];
    },
  };
}

// The Pebble object the app talks to the watch through.
function pebble() {
  const listeners = {};
  const sent = [];
  const failures = [];
  return {
    addEventListener(name, listener) { listeners[name] = listener; },
    sendAppMessage(message, onSuccess, onFailure) { sent.push({ ...message }); failures.push(onFailure); },
    // Messages sent to the watch, oldest first.
    sent,
    // The app has started on the phone.
    ready() { listeners.ready({}); },
    // The watch sends a message.
    receive(payload) { listeners.appmessage({ payload }); },
    // The watch does not take the last message sent.
    refuse(error) { failures[failures.length - 1]({ transactionId: failures.length }, error); },
  };
}

// Timers that run when a test says time has passed.
function clock() {
  const timers = [];
  return {
    setTimeout(callback, delay) { timers.push({ callback, delay }); },
    // Runs everything that was due within the given milliseconds.
    advance(ms) {
      const due = timers.filter((timer) => timer.delay <= ms);
      due.forEach((timer) => timers.splice(timers.indexOf(timer), 1));
      timers.forEach((timer) => { timer.delay -= ms; });
      due.forEach((timer) => timer.callback());
    },
  };
}

module.exports = { KEYS, CONFIG, network, pebble, clock };
