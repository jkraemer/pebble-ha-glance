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

typedef struct {
  char caption[20];
  char value[28];
  char unit[10];
} Value;

typedef struct {
  // Whether the phone has sent the dashboard since the app was opened.
  bool loaded;
  // Set when the values are older than the refresh interval allows for.
  bool stale;
  uint8_t value_count;
  Value values[LAYOUT_MAX_VALUES];
  char button_labels[LAYOUT_BUTTONS][16];
  ButtonState button_states[LAYOUT_BUTTONS];
} Dashboard;
