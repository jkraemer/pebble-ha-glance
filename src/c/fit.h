// Sizes text so that it fills the room it is given.
#pragma once
#include "ink.h"
#include "layout.h"

// For text that may grow as large as its box allows.
#define FIT_ANY_SIZE INT32_MAX

// The largest em height, in 1/16 pixel, at which the ink fills the box without
// exceeding it or `max_em`. 0 when there is no ink or no room.
int32_t fit_em(Ink ink, Box box, int32_t max_em);

// A point of a text in its font units.
typedef struct {
  int32_t x, y;
} Anchor;

// The point of the ink that belongs on the centre of the box it is drawn in.
Anchor fit_centre(Ink ink);

// A value with its unit. The unit follows the value at half its size, on the
// same baseline, so that the value itself can be as large as possible.
typedef struct {
  // The extent of both together, in the value's font units.
  Ink ink;
  // The points of the value and of the unit that belong on the centre of the
  // box, the unit's in its own font units, to be drawn at half the em height.
  Anchor value_anchor;
  Anchor unit_anchor;
} Reading;

Reading fit_reading(Ink value, Ink unit);
