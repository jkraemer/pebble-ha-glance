#include "draw.h"
#include <pebble-fctx/fctx.h>
#include "fit.h"

// 1/16 pixel, the unit of em heights and of fctx coordinates.
#define SUBPIXELS 16

// Button labels run down the column, turned a quarter clockwise.
#define SIDEWAYS (TRIG_MAX_ANGLE / 4)
#define UPRIGHT 0

// Space kept free between a button label and the edges of its part of the column.
#define LABEL_MARGIN 4

#define NOTICE_MAX_EM (30 * SUBPIXELS)

static GRect prv_grect(Box box) {
  return GRect(box.x, box.y, box.w, box.h);
}

// A box as its text sees it when the text is drawn sideways.
static Box prv_turned(Box box) {
  return (Box){box.x, box.y, box.h, box.w};
}

static Box prv_shrunk(Box box, int16_t margin) {
  return (Box){box.x + margin, box.y + margin, box.w - 2 * margin, box.h - 2 * margin};
}

// Draws text so that `anchor`, a point in its font units, lands on the centre
// of the box.
static void prv_draw_text(FContext *fctx, FFont *font, const char *text, Anchor anchor, int32_t em,
                          Box box, uint32_t rotation, GColor color) {
  if (em <= 0) {
    return;
  }
  fctx_begin_fill(fctx);
  fctx_set_fill_color(fctx, color);
  fctx_set_pivot(fctx, FPoint(anchor.x, anchor.y));
  // Font coordinates run up, screen coordinates run down.
  fctx_set_scale(fctx, FPoint(INK_EM, -INK_EM), FPoint(em, em));
  fctx_set_rotation(fctx, rotation);
  fctx_set_offset(fctx, FPoint(box.x * SUBPIXELS + box.w * SUBPIXELS / 2,
                               box.y * SUBPIXELS + box.h * SUBPIXELS / 2));
  fctx_draw_string(fctx, text, font, GTextAlignmentLeft, FTextAnchorBaseline);
  fctx_end_fill(fctx);
}

static GColor prv_button_colour(ButtonState state) {
  switch (state) {
    case ButtonBusy: return GColorChromeYellow;
    case ButtonSucceeded: return GColorGreen;
    case ButtonFailed: return GColorRed;
    default: return GColorBlack;
  }
}

static GColor prv_label_colour(ButtonState state) {
  return state == ButtonBusy || state == ButtonSucceeded ? GColorBlack : GColorWhite;
}

static void prv_draw_button_backgrounds(GContext *ctx, Box screen, const Dashboard *dashboard) {
  for (int i = 0; i < LAYOUT_BUTTONS; i++) {
    Box box = layout_button(screen, i);
    graphics_context_set_fill_color(ctx, prv_button_colour(dashboard->button_states[i]));
    graphics_fill_rect(ctx, prv_grect(box), 0, GCornerNone);
    if (i > 0) {
      graphics_context_set_stroke_color(ctx, GColorWhite);
      graphics_draw_line(ctx, GPoint(box.x, box.y), GPoint(box.x + box.w - 1, box.y));
    }
  }
}

// Draws texts that belong together at one size: that of the text with the
// least room, and no taller than a line of that room.
static void prv_draw_alike(FContext *fctx, FFont *font, int count, const char *const texts[], const Box rooms[],
                           uint32_t rotation, const GColor colours[]) {
  Ink inks[LAYOUT_MAX_VALUES];
  int32_t em = FIT_ANY_SIZE;
  for (int i = 0; i < count; i++) {
    Box room = rotation == SIDEWAYS ? prv_turned(rooms[i]) : rooms[i];
    inks[i] = ink_of_text(font, texts[i]);
    int32_t fitting = fit_em(inks[i], room, room.h * SUBPIXELS);
    if (fitting > 0 && fitting < em) {
      em = fitting;
    }
  }
  for (int i = 0; i < count; i++) {
    if (!ink_is_empty(inks[i])) {
      prv_draw_text(fctx, font, texts[i], fit_centre(inks[i]), em, rooms[i], rotation, colours[i]);
    }
  }
}

static void prv_draw_button_labels(FContext *fctx, FFont *font, Box screen, const Dashboard *dashboard) {
  const char *texts[LAYOUT_BUTTONS];
  Box rooms[LAYOUT_BUTTONS];
  GColor colours[LAYOUT_BUTTONS];
  for (int i = 0; i < LAYOUT_BUTTONS; i++) {
    texts[i] = dashboard->button_labels[i];
    rooms[i] = prv_shrunk(layout_button(screen, i), LABEL_MARGIN);
    colours[i] = prv_label_colour(dashboard->button_states[i]);
  }
  prv_draw_alike(fctx, font, LAYOUT_BUTTONS, texts, rooms, SIDEWAYS, colours);
}

static void prv_draw_captions(FContext *fctx, FFont *font, Box screen, const Dashboard *dashboard) {
  const char *texts[LAYOUT_MAX_VALUES];
  Box rooms[LAYOUT_MAX_VALUES];
  GColor colours[LAYOUT_MAX_VALUES];
  for (int i = 0; i < dashboard->value_count; i++) {
    texts[i] = dashboard->values[i].caption;
    rooms[i] = layout_caption(layout_value(screen, dashboard->value_count, i));
    colours[i] = GColorBlack;
  }
  prv_draw_alike(fctx, font, dashboard->value_count, texts, rooms, UPRIGHT, colours);
}

static void prv_draw_readings(FContext *fctx, FFont *font, Box screen, const Dashboard *dashboard) {
  GColor colour = dashboard->stale ? GColorLightGray : GColorBlack;
  for (int i = 0; i < dashboard->value_count; i++) {
    const Value *value = &dashboard->values[i];
    bool has_caption = !ink_is_empty(ink_of_text(font, value->caption));
    Box room = layout_reading(layout_value(screen, dashboard->value_count, i), has_caption);
    Reading reading = fit_reading(ink_of_text(font, value->value), ink_of_text(font, value->unit));
    int32_t em = fit_em(reading.ink, room, FIT_ANY_SIZE);
    prv_draw_text(fctx, font, value->value, reading.value_anchor, em, room, UPRIGHT, colour);
    prv_draw_text(fctx, font, value->unit, reading.unit_anchor, em / 2, room, UPRIGHT, colour);
  }
}

static void prv_draw_notice(FContext *fctx, FFont *font, Box screen, const char *notice) {
  Box room = layout_reading(layout_value(screen, 1, 0), false);
  Ink ink = ink_of_text(font, notice);
  prv_draw_text(fctx, font, notice, fit_centre(ink), fit_em(ink, room, NOTICE_MAX_EM), room, UPRIGHT, GColorBlack);
}

void draw_dashboard(GContext *ctx, GRect bounds, FFont *font, const Dashboard *dashboard, const char *notice) {
  Box screen = {bounds.origin.x, bounds.origin.y, bounds.size.w, bounds.size.h};
  graphics_context_set_fill_color(ctx, GColorWhite);
  graphics_fill_rect(ctx, bounds, 0, GCornerNone);
  prv_draw_button_backgrounds(ctx, screen, dashboard);

  FContext fctx;
  fctx_init_context(&fctx, ctx);
  prv_draw_button_labels(&fctx, font, screen, dashboard);
  if (dashboard->loaded) {
    prv_draw_captions(&fctx, font, screen, dashboard);
    prv_draw_readings(&fctx, font, screen, dashboard);
  } else {
    prv_draw_notice(&fctx, font, screen, notice);
  }
  fctx_deinit_context(&fctx);
}
