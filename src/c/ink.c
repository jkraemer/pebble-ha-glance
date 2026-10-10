#include "ink.h"
#include <pebble-utf8/pebble-utf8.h>

bool ink_is_empty(Ink ink) {
  return ink.left > ink.right;
}

Ink ink_union(Ink a, Ink b) {
  return (Ink){
    .left = a.left < b.left ? a.left : b.left,
    .right = a.right > b.right ? a.right : b.right,
    .bottom = a.bottom < b.bottom ? a.bottom : b.bottom,
    .top = a.top > b.top ? a.top : b.top,
  };
}

// The number of points that follow a draw command, or -1 for one this font
// format does not produce.
static int prv_point_count(uint16_t command) {
  switch (command) {
    case 'Z': return 0;
    case 'M': return 1;
    case 'L': return 1;
    case 'Q': return 2;
    case 'C': return 3;
    default: return -1;
  }
}

// Control points count as well: they lie on or outside the curve, so the
// result is never too small, and fonts place points at the extremes anyway.
Ink ink_of_outline(const void *commands, uint16_t length, int32_t x) {
  Ink ink = INK_NONE;
  const int16_t *word = commands;
  const int16_t *end = word + length / sizeof(int16_t);
  while (word < end) {
    int points = prv_point_count((uint16_t)*word++);
    if (points < 0 || word + 2 * points > end) {
      break;
    }
    for (; points > 0; points--, word += 2) {
      ink = ink_union(ink, (Ink){x + word[0], x + word[0], word[1], word[1]});
    }
  }
  return ink;
}

Ink ink_of_text(FFont *font, const char *text) {
  Ink ink = INK_NONE;
  int32_t x = 0;
  uint16_t code_point = 0;
  uint16_t decode_state = 0;
  for (const char *byte = text; *byte; byte++) {
    if (utf8_decode_byte((uint8_t)*byte, &decode_state, &code_point) != 0) {
      continue;
    }
    FGlyph *glyph = ffont_glyph_info(font, code_point);
    if (!glyph) {
      continue;
    }
    ink = ink_union(ink, ink_of_outline(ffont_glyph_outline(font, glyph), glyph->path_data_length, x));
    x += glyph->horiz_adv_x;
  }
  return ink;
}
