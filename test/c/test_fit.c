// Sizes are em heights in 1/16 pixel; ink is in font units, 1152 to the em.
#include "fit.h"
#include "check.h"

static const Ink ONE_EM_SQUARE = {0, 1152, 0, 1152};

static void text_grows_until_its_height_fills_the_box(void) {
  CHECK_EQ(fit_em(ONE_EM_SQUARE, (Box){0, 0, 100, 50}, FIT_ANY_SIZE), 50 * 16);
}

static void text_grows_until_its_width_fills_the_box(void) {
  CHECK_EQ(fit_em(ONE_EM_SQUARE, (Box){0, 0, 20, 50}, FIT_ANY_SIZE), 20 * 16);
}

static void smaller_ink_is_drawn_at_a_larger_size(void) {
  // Digits about 0.7 em tall fill a 70 pixel box at a 100 pixel em height.
  CHECK_EQ(fit_em((Ink){0, 576, 0, 806}, (Box){0, 0, 170, 70}, FIT_ANY_SIZE), 70 * 16 * 1152 / 806);
}

static void only_the_ink_counts_not_where_it_sits(void) {
  CHECK_EQ(fit_em((Ink){100, 1252, -200, 952}, (Box){30, 40, 100, 50}, FIT_ANY_SIZE), 50 * 16);
}

static void text_never_exceeds_the_largest_size_asked_for(void) {
  CHECK_EQ(fit_em(ONE_EM_SQUARE, (Box){0, 0, 100, 50}, 19 * 16), 19 * 16);
}

static void nothing_is_drawn_without_ink_or_room(void) {
  CHECK_EQ(fit_em(INK_NONE, (Box){0, 0, 100, 50}, FIT_ANY_SIZE), 0);
  CHECK_EQ(fit_em(ONE_EM_SQUARE, (Box){0, 0, 0, 50}, FIT_ANY_SIZE), 0);
}

static void a_value_alone_is_centred_on_its_ink(void) {
  Reading reading = fit_reading((Ink){0, 1000, 0, 800}, INK_NONE);
  CHECK_EQ(reading.ink.left, 0);
  CHECK_EQ(reading.ink.right, 1000);
  CHECK_EQ(reading.value_anchor.x, 500);
  CHECK_EQ(reading.value_anchor.y, 400);
}

static void a_unit_follows_its_value_at_half_size_on_the_same_baseline(void) {
  // The unit's ink, 400 wide and 800 tall, takes 200 by 400 after a gap of 138.
  Reading reading = fit_reading((Ink){0, 1000, 0, 800}, (Ink){40, 440, -100, 800});
  CHECK_EQ(reading.ink.left, 0);
  CHECK_EQ(reading.ink.right, 1000 + 138 + 200);
  CHECK_EQ(reading.ink.bottom, -50);
  CHECK_EQ(reading.ink.top, 800);
  CHECK_EQ(reading.value_anchor.x, 669);
  CHECK_EQ(reading.value_anchor.y, 375);
  // In the unit's own halved scale: its left edge, 40, sits 469 value units
  // right of the centre, and its baseline 375 below it.
  CHECK_EQ(reading.unit_anchor.x, 40 - 2 * 469);
  CHECK_EQ(reading.unit_anchor.y, 2 * 375);
}

static void a_unit_without_a_value_starts_at_the_left(void) {
  Reading reading = fit_reading(INK_NONE, (Ink){40, 440, 0, 800});
  CHECK_EQ(reading.ink.left, 0);
  CHECK_EQ(reading.ink.right, 200);
  CHECK_EQ(reading.ink.top, 400);
  CHECK_EQ(reading.unit_anchor.x, 40 + 2 * 100);
  CHECK_EQ(reading.unit_anchor.y, 2 * 200);
}

int main(void) {
  text_grows_until_its_height_fills_the_box();
  text_grows_until_its_width_fills_the_box();
  smaller_ink_is_drawn_at_a_larger_size();
  only_the_ink_counts_not_where_it_sits();
  text_never_exceeds_the_largest_size_asked_for();
  nothing_is_drawn_without_ink_or_room();
  a_value_alone_is_centred_on_its_ink();
  a_unit_follows_its_value_at_half_size_on_the_same_baseline();
  a_unit_without_a_value_starts_at_the_left();
  return check_result("fit");
}
