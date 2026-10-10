#include "layout.h"
#include "check.h"

static const Box SCREEN = {0, 0, 200, 228};

static void buttons_share_a_column_on_the_right_edge(void) {
  CHECK_BOX(layout_button(SCREEN, 0), 170, 0, 30, 76);
  CHECK_BOX(layout_button(SCREEN, 1), 170, 76, 30, 76);
  CHECK_BOX(layout_button(SCREEN, 2), 170, 152, 30, 76);
}

static void a_single_value_gets_everything_left_of_the_buttons(void) {
  CHECK_BOX(layout_value(SCREEN, 1, 0), 0, 0, 170, 228);
}

static void values_are_stacked_in_equal_rows(void) {
  CHECK_BOX(layout_value(SCREEN, 2, 0), 0, 0, 170, 114);
  CHECK_BOX(layout_value(SCREEN, 2, 1), 0, 114, 170, 114);
  CHECK_BOX(layout_value(SCREEN, 4, 3), 0, 171, 170, 57);
}

static void rows_cover_the_whole_height_when_it_does_not_divide_evenly(void) {
  const Box screen = {0, 0, 200, 230};
  Box first = layout_value(screen, 3, 0), second = layout_value(screen, 3, 1), third = layout_value(screen, 3, 2);
  CHECK_EQ(first.y, 0);
  CHECK_EQ(second.y, first.y + first.h);
  CHECK_EQ(third.y, second.y + second.h);
  CHECK_EQ(third.y + third.h, 230);
}

static void a_caption_takes_a_strip_at_the_top_of_its_row(void) {
  // A sixth of the row, but never too small to read or larger than a caption needs.
  CHECK_BOX(layout_caption((Box){0, 0, 170, 228}), 4, 3, 162, 24);
  CHECK_BOX(layout_caption((Box){0, 114, 170, 114}), 4, 117, 162, 19);
  CHECK_BOX(layout_caption((Box){0, 171, 170, 57}), 4, 174, 162, 14);
}

static void the_reading_fills_the_row_below_its_caption(void) {
  CHECK_BOX(layout_reading((Box){0, 114, 170, 114}, true), 4, 138, 162, 87);
}

static void the_reading_fills_the_whole_row_without_a_caption(void) {
  CHECK_BOX(layout_reading((Box){0, 114, 170, 114}, false), 4, 117, 162, 108);
}

int main(void) {
  buttons_share_a_column_on_the_right_edge();
  a_single_value_gets_everything_left_of_the_buttons();
  values_are_stacked_in_equal_rows();
  rows_cover_the_whole_height_when_it_does_not_divide_evenly();
  a_caption_takes_a_strip_at_the_top_of_its_row();
  the_reading_fills_the_row_below_its_caption();
  the_reading_fills_the_whole_row_without_a_caption();
  return check_result("layout");
}
