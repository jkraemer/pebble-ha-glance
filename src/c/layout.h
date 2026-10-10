// Where things go on the screen: up to four values stacked on the left, each
// with a small caption above its reading, and a column of three button labels
// along the right edge, next to the buttons they belong to.
#pragma once
#include <stdbool.h>
#include <stdint.h>

// A rectangle in screen pixels.
typedef struct {
  int16_t x, y, w, h;
} Box;

#define LAYOUT_MAX_VALUES 4
#define LAYOUT_BUTTONS 3

// The part of the button column next to the given button, counted from the top.
Box layout_button(Box screen, int index);

// The row of one of `count` values, counted from the top.
Box layout_value(Box screen, int count, int index);

// The strip at the top of a value's row that holds its caption.
Box layout_caption(Box row);

// The room in a value's row for the reading itself.
Box layout_reading(Box row, bool has_caption);
