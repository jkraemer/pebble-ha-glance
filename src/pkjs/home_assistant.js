// Talks to Home Assistant's REST API: reads entity states and triggers
// entities. Callbacks get an error first, as text, or null.

var TIMEOUT_MS = 10000;

// The service that makes an entity "go", by its domain. Everything not listed
// is toggled.
var TRIGGER_SERVICES = {
  automation: 'trigger',
  script: 'turn_on',
  scene: 'turn_on',
  button: 'press',
  input_button: 'press'
};

function connect(url, token, XMLHttpRequest) {
  var base = url.replace(/\/+$/, '');

  // Calls back with the body of a successful answer.
  function request(method, path, body, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, base + path, true);
    xhr.timeout = TIMEOUT_MS;
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function () {
      if (xhr.status < 200 || xhr.status >= 300) {
        callback('HTTP ' + xhr.status);
        return;
      }
      callback(null, xhr.responseText);
    };
    xhr.onerror = function () { callback('unreachable'); };
    xhr.ontimeout = function () { callback('no answer in time'); };
    xhr.send(body ? JSON.stringify(body) : null);
  }

  return {
    // Calls back with { state, unit }, the unit empty when the entity has none.
    read: function (entity, callback) {
      request('GET', '/api/states/' + entity, null, function (error, body) {
        if (error) {
          callback(error);
          return;
        }
        var entityState;
        try {
          entityState = JSON.parse(body);
        } catch (e) {
          callback('unreadable answer');
          return;
        }
        var attributes = entityState.attributes || {};
        callback(null, { state: String(entityState.state), unit: attributes.unit_of_measurement || '' });
      });
    },

    // Runs a script or scene, triggers an automation, presses a button entity
    // and toggles anything else.
    trigger: function (entity, callback) {
      var domain = entity.split('.')[0];
      var service = TRIGGER_SERVICES[domain] || 'toggle';
      request('POST', '/api/services/' + domain + '/' + service, { entity_id: entity }, function (error) {
        callback(error || null);
      });
    }
  };
}

module.exports = { connect: connect };
