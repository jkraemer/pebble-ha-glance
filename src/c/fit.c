#include "fit.h"

// 1/16 pixel, the unit of em heights.
#define SUBPIXELS 16

// The unit is drawn at one UNIT_SHRINK-th of the value's size, after a gap of
// about an eighth of the value's em.
#define UNIT_SHRINK 2
#define UNIT_GAP 138

int32_t fit_em(Ink ink, Box box, int32_t max_em) {
  if (ink_is_empty(ink) || box.w <= 0 || box.h <= 0) {
    return 0;
  }
  // Ink without width or height, such as a lone dash, still needs a size.
  int64_t ink_w = ink.right - ink.left > 0 ? ink.right - ink.left : 1;
  int64_t ink_h = ink.top - ink.bottom > 0 ? ink.top - ink.bottom : 1;
  int64_t by_width = (int64_t)box.w * SUBPIXELS * INK_EM / ink_w;
  int64_t by_height = (int64_t)box.h * SUBPIXELS * INK_EM / ink_h;
  int64_t em = by_width < by_height ? by_width : by_height;
  return em < max_em ? (int32_t)em : max_em;
}

Anchor fit_centre(Ink ink) {
  return (Anchor){(ink.left + ink.right) / 2, (ink.bottom + ink.top) / 2};
}

Reading fit_reading(Ink value, Ink unit) {
  if (ink_is_empty(unit)) {
    return (Reading){.ink = value, .value_anchor = fit_centre(value)};
  }
  // Where the unit's ink begins, in the value's font units.
  int32_t unit_left = ink_is_empty(value) ? 0 : value.right + UNIT_GAP;
  Ink shrunk_unit = {
    .left = unit_left,
    .right = unit_left + (unit.right - unit.left) / UNIT_SHRINK,
    .bottom = unit.bottom / UNIT_SHRINK,
    .top = unit.top / UNIT_SHRINK,
  };
  Reading reading = {.ink = ink_union(value, shrunk_unit)};
  reading.value_anchor = fit_centre(reading.ink);
  reading.unit_anchor = (Anchor){
    .x = unit.left - UNIT_SHRINK * (unit_left - reading.value_anchor.x),
    .y = UNIT_SHRINK * reading.value_anchor.y,
  };
  return reading;
}
