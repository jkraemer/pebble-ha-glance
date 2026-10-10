#include "layout.h"

#define BUTTON_COLUMN_WIDTH 30

// Space kept free around the texts of a row.
#define MARGIN_X 4
#define MARGIN_Y 3
#define CAPTION_GAP 2

// Captions take a sixth of their row, within what stays readable and what
// still looks like a caption.
#define CAPTION_MIN_HEIGHT 14
#define CAPTION_MAX_HEIGHT 24

// The pixel at which the given share of a length begins, so that neighbouring
// shares meet without gaps whatever the rounding.
static int16_t prv_share(int16_t length, int index, int count) {
  return (int16_t)(length * index / count);
}

static int16_t prv_caption_height(Box row) {
  int16_t height = row.h / 6;
  if (height < CAPTION_MIN_HEIGHT) {
    return CAPTION_MIN_HEIGHT;
  }
  return height > CAPTION_MAX_HEIGHT ? CAPTION_MAX_HEIGHT : height;
}

Box layout_button(Box screen, int index) {
  int16_t top = prv_share(screen.h, index, LAYOUT_BUTTONS);
  int16_t bottom = prv_share(screen.h, index + 1, LAYOUT_BUTTONS);
  return (Box){
    .x = screen.x + screen.w - BUTTON_COLUMN_WIDTH,
    .y = screen.y + top,
    .w = BUTTON_COLUMN_WIDTH,
    .h = bottom - top,
  };
}

Box layout_value(Box screen, int count, int index) {
  int16_t top = prv_share(screen.h, index, count);
  int16_t bottom = prv_share(screen.h, index + 1, count);
  return (Box){
    .x = screen.x,
    .y = screen.y + top,
    .w = screen.w - BUTTON_COLUMN_WIDTH,
    .h = bottom - top,
  };
}

Box layout_caption(Box row) {
  return (Box){
    .x = row.x + MARGIN_X,
    .y = row.y + MARGIN_Y,
    .w = row.w - 2 * MARGIN_X,
    .h = prv_caption_height(row),
  };
}

Box layout_reading(Box row, bool has_caption) {
  int16_t top = MARGIN_Y + (has_caption ? prv_caption_height(row) + CAPTION_GAP : 0);
  return (Box){
    .x = row.x + MARGIN_X,
    .y = row.y + top,
    .w = row.w - 2 * MARGIN_X,
    .h = row.h - top - MARGIN_Y,
  };
}
