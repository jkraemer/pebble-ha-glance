// What the watch shows: the values the phone last sent and the three buttons
// with the progress of whatever they triggered.
#pragma once
#include <stdbool.h>
#include <stdint.h>
#include "layout.h"

typedef enum {
  ButtonIdle,
  // Pressed, and the phone has not reported the outcome yet.
  ButtonBusy,
  ButtonSucceeded,
  ButtonFailed,
} ButtonState;

// Room for each text, in bytes including the terminator. The phone cuts texts
// to these sizes (src/pkjs/app.js), so that the dashboard message always fits
// the watch's inbox.
#define CAPTION_SIZE 20
#define VALUE_SIZE 28
#define UNIT_SIZE 10
#define BUTTON_LABEL_SIZE 16

typedef struct {
  char caption[CAPTION_SIZE];
  char value[VALUE_SIZE];
  char unit[UNIT_SIZE];
} Value;

typedef struct {
  // Whether the phone has sent the dashboard since the app was opened.
  bool loaded;
  // Set when the values are older than the refresh interval allows for.
  bool stale;
  uint8_t value_count;
  Value values[LAYOUT_MAX_VALUES];
  char button_labels[LAYOUT_BUTTONS][BUTTON_LABEL_SIZE];
  ButtonState button_states[LAYOUT_BUTTONS];
} Dashboard;
