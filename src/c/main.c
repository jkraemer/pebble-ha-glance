// A Home Assistant dashboard for the wrist: up to four values, drawn as large
// as the screen allows, and three buttons that trigger actions. The phone
// side (src/pkjs) talks to Home Assistant; the watch only asks it for the
// dashboard, reports button presses and shows what comes back.
#include <pebble.h>
#include <pebble-fctx/ffont.h>
#include "dashboard.h"
#include "draw.h"
#include "text.h"

// How often the phone is asked for fresh values, and how soon again while it
// has not answered at all yet.
#define REFRESH_INTERVAL_MS 30000
#define FIRST_ANSWER_RETRY_MS 3000
// Values count as stale once two refreshes in a row went unanswered.
#define STALE_AFTER_S 75

// How long a pressed button waits for the phone to report the outcome, and
// how long the outcome stays on the button.
#define PRESS_TIMEOUT_MS 15000
#define SUCCESS_SHOWN_MS 2000
#define FAILURE_SHOWN_MS 4000

// The dashboard message at its largest: a dictionary header of one byte,
// 7 bytes of header per tuple, the value count as int32, and the texts with
// their terminators. The outbox only ever carries one int32.
#define INBOX_SIZE (1 + 7 * (1 + 3 * LAYOUT_MAX_VALUES + LAYOUT_BUTTONS) + 4 \
                    + LAYOUT_MAX_VALUES * (CAPTION_SIZE + VALUE_SIZE + UNIT_SIZE) \
                    + LAYOUT_BUTTONS * BUTTON_LABEL_SIZE)
#define OUTBOX_SIZE 64

static Window *s_window;
static Layer *s_layer;
static FFont *s_font;
static Dashboard s_dashboard;
static time_t s_loaded_at;
// The phone has no settings to fetch a dashboard with.
static bool s_setup_needed;
static AppTimer *s_button_timers[LAYOUT_BUTTONS];

// Messages waiting to go to the phone, which takes one at a time.
static bool s_sending;
static bool s_refresh_wanted;
static bool s_press_wanted[LAYOUT_BUTTONS];

static void prv_button_timer_fired(void *data);

static void prv_redraw(void) {
  layer_mark_dirty(s_layer);
}

// Buttons

static void prv_show_on_button(int button, ButtonState state, uint32_t for_ms) {
  s_dashboard.button_states[button] = state;
  if (s_button_timers[button]) {
    app_timer_cancel(s_button_timers[button]);
  }
  s_button_timers[button] = app_timer_register(for_ms, prv_button_timer_fired, (void *)(intptr_t)button);
  prv_redraw();
}

static void prv_button_finished(int button, bool succeeded) {
  if (button < 0 || button >= LAYOUT_BUTTONS || s_dashboard.button_states[button] != ButtonBusy) {
    return;
  }
  if (succeeded) {
    vibes_short_pulse();
    prv_show_on_button(button, ButtonSucceeded, SUCCESS_SHOWN_MS);
  } else {
    vibes_double_pulse();
    prv_show_on_button(button, ButtonFailed, FAILURE_SHOWN_MS);
  }
}

static void prv_button_timer_fired(void *data) {
  int button = (int)(intptr_t)data;
  s_button_timers[button] = NULL;
  if (s_dashboard.button_states[button] == ButtonBusy) {
    // The phone never reported back.
    s_press_wanted[button] = false;
    prv_button_finished(button, false);
  } else {
    s_dashboard.button_states[button] = ButtonIdle;
    prv_redraw();
  }
}

// Messages to the phone

static bool prv_send(uint32_t key, int32_t value) {
  DictionaryIterator *message;
  if (app_message_outbox_begin(&message) != APP_MSG_OK) {
    return false;
  }
  dict_write_int32(message, key, value);
  return app_message_outbox_send() == APP_MSG_OK;
}

// Sends the next waiting message, presses before refreshes. What cannot be
// sent now stays waiting for the next call.
static void prv_send_next(void) {
  if (s_sending) {
    return;
  }
  for (int button = 0; button < LAYOUT_BUTTONS; button++) {
    if (s_press_wanted[button]) {
      s_sending = prv_send(MESSAGE_KEY_PRESS, button);
      s_press_wanted[button] = !s_sending;
      return;
    }
  }
  if (s_refresh_wanted) {
    s_sending = prv_send(MESSAGE_KEY_REFRESH, 1);
    s_refresh_wanted = !s_sending;
  }
}

static void prv_outbox_sent(DictionaryIterator *message, void *context) {
  s_sending = false;
  prv_send_next();
}

static void prv_outbox_failed(DictionaryIterator *message, AppMessageResult reason, void *context) {
  s_sending = false;
  Tuple *press = dict_find(message, MESSAGE_KEY_PRESS);
  if (press) {
    prv_button_finished(press->value->int32, false);
  }
  prv_send_next();
}

// Messages from the phone

static const char *prv_text(DictionaryIterator *message, uint32_t key) {
  Tuple *tuple = dict_find(message, key);
  return tuple && tuple->type == TUPLE_CSTRING ? tuple->value->cstring : NULL;
}

static void prv_load_dashboard(DictionaryIterator *message, int32_t value_count) {
  if (value_count < 0) {
    value_count = 0;
  } else if (value_count > LAYOUT_MAX_VALUES) {
    value_count = LAYOUT_MAX_VALUES;
  }
  s_dashboard.value_count = (uint8_t)value_count;
  for (int i = 0; i < value_count; i++) {
    Value *value = &s_dashboard.values[i];
    text_copy(value->caption, sizeof(value->caption), prv_text(message, MESSAGE_KEY_CAPTION + i));
    text_copy(value->value, sizeof(value->value), prv_text(message, MESSAGE_KEY_VALUE + i));
    text_copy(value->unit, sizeof(value->unit), prv_text(message, MESSAGE_KEY_UNIT + i));
  }
  for (int i = 0; i < LAYOUT_BUTTONS; i++) {
    text_copy(s_dashboard.button_labels[i], sizeof(s_dashboard.button_labels[i]),
              prv_text(message, MESSAGE_KEY_BUTTON + i));
  }
  s_dashboard.loaded = true;
  s_dashboard.stale = false;
  s_loaded_at = time(NULL);
  s_setup_needed = false;
}

static void prv_inbox_received(DictionaryIterator *message, void *context) {
  Tuple *value_count = dict_find(message, MESSAGE_KEY_VALUE_COUNT);
  if (value_count) {
    prv_load_dashboard(message, value_count->value->int32);
  }
  if (dict_find(message, MESSAGE_KEY_SETUP_NEEDED)) {
    s_setup_needed = true;
    s_dashboard.loaded = false;
    // Without settings the buttons do nothing.
    memset(s_dashboard.button_labels, 0, sizeof(s_dashboard.button_labels));
  }
  Tuple *succeeded = dict_find(message, MESSAGE_KEY_SUCCEEDED);
  if (succeeded) {
    prv_button_finished(succeeded->value->int32, true);
  }
  Tuple *failed = dict_find(message, MESSAGE_KEY_FAILED);
  if (failed) {
    prv_button_finished(failed->value->int32, false);
  }
  prv_redraw();
}

static void prv_inbox_dropped(AppMessageResult reason, void *context) {
  // Seen with `pebble logs` when the dashboard never arrives.
  APP_LOG(APP_LOG_LEVEL_ERROR, "A message from the phone was dropped: %d", reason);
}

// Refreshing

static void prv_refresh_timer_fired(void *data) {
  s_dashboard.stale = s_dashboard.loaded && time(NULL) - s_loaded_at > STALE_AFTER_S;
  s_refresh_wanted = true;
  prv_send_next();
  prv_redraw();
  bool answered = s_dashboard.loaded || s_setup_needed;
  app_timer_register(answered ? REFRESH_INTERVAL_MS : FIRST_ANSWER_RETRY_MS, prv_refresh_timer_fired, NULL);
}

// Input and screen

static void prv_pressed(ClickRecognizerRef recognizer, void *context) {
  int button = (int)(intptr_t)context;
  if (s_dashboard.button_states[button] == ButtonBusy) {
    return;
  }
  prv_show_on_button(button, ButtonBusy, PRESS_TIMEOUT_MS);
  if (!connection_service_peek_pebble_app_connection()) {
    // Nothing can reach the phone: say so at once instead of after the wait.
    prv_button_finished(button, false);
    return;
  }
  s_press_wanted[button] = true;
  prv_send_next();
}

static void prv_click_config_provider(void *context) {
  window_single_click_subscribe(BUTTON_ID_UP, prv_pressed);
  window_set_click_context(BUTTON_ID_UP, (void *)(intptr_t)0);
  window_single_click_subscribe(BUTTON_ID_SELECT, prv_pressed);
  window_set_click_context(BUTTON_ID_SELECT, (void *)(intptr_t)1);
  window_single_click_subscribe(BUTTON_ID_DOWN, prv_pressed);
  window_set_click_context(BUTTON_ID_DOWN, (void *)(intptr_t)2);
}

static void prv_draw(Layer *layer, GContext *ctx) {
  const char *notice = !connection_service_peek_pebble_app_connection() ? "No phone"
                       : s_setup_needed ? "Set up on phone"
                       : "Loading…";
  draw_dashboard(ctx, layer_get_bounds(layer), s_font, &s_dashboard, notice);
}

static void prv_window_load(Window *window) {
  Layer *root = window_get_root_layer(window);
  s_layer = layer_create(layer_get_bounds(root));
  layer_set_update_proc(s_layer, prv_draw);
  layer_add_child(root, s_layer);
}

static void prv_window_unload(Window *window) {
  layer_destroy(s_layer);
}

int main(void) {
  s_font = ffont_create_from_resource(RESOURCE_ID_FONT_TEXT);

  s_window = window_create();
  window_set_click_config_provider(s_window, prv_click_config_provider);
  window_set_window_handlers(s_window, (WindowHandlers){
    .load = prv_window_load,
    .unload = prv_window_unload,
  });
  window_stack_push(s_window, true);

  app_message_register_inbox_received(prv_inbox_received);
  app_message_register_inbox_dropped(prv_inbox_dropped);
  app_message_register_outbox_sent(prv_outbox_sent);
  app_message_register_outbox_failed(prv_outbox_failed);
  app_message_open(INBOX_SIZE, OUTBOX_SIZE);
  prv_refresh_timer_fired(NULL);

  app_event_loop();

  window_destroy(s_window);
  ffont_destroy(s_font);
}
