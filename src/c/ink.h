// Measures text: the area its glyphs actually cover, which is what has to fit
// when a text is scaled to fill a box.
#pragma once
#include <stdbool.h>
#include <stdint.h>
#include <pebble-fctx/ffont.h>

// Font units to the em, as stored in the font resource.
#define INK_EM 1152

// The extent of drawn shapes in font units: x runs right from where the text
// starts, y runs up from the baseline.
typedef struct {
  int32_t left, right, bottom, top;
} Ink;

// The extent of nothing: text without any visible glyph.
#define INK_NONE ((Ink){INT32_MAX, INT32_MIN, INT32_MAX, INT32_MIN})

bool ink_is_empty(Ink ink);

// The extent covering both.
Ink ink_union(Ink a, Ink b);

// The extent of one glyph outline, given as `length` bytes of fctx draw
// commands, when it is drawn `x` font units along the line.
Ink ink_of_outline(const void *commands, uint16_t length, int32_t x);

// The extent of a UTF-8 text set in the font.
Ink ink_of_text(FFont *font, const char *text);
