// Measures text with the font the watch app ships. Expected numbers are the
// glyph bounds of Fira Sans Condensed Bold in the font resource's units:
// 1152 to the em, so its 693/1000 cap height is 798.
#include "ink.h"
#include "check.h"
#include <pebble-fctx/ffont.h>

static FFont *s_font;

#define CHECK_INK(actual, eleft, eright, ebottom, etop) do { \
    Ink ink_ = (actual); \
    if (ink_.left != (eleft) || ink_.right != (eright) || ink_.bottom != (ebottom) || ink_.top != (etop)) { \
      printf("%s:%d: %s is {%d..%d, %d..%d}, expected {%d..%d, %d..%d}\n", __FILE__, __LINE__, #actual, \
             (int)ink_.left, (int)ink_.right, (int)ink_.bottom, (int)ink_.top, (eleft), (eright), (ebottom), (etop)); \
      check_failures++; \
    } \
  } while (0)

static void an_outline_extends_over_all_its_points(void) {
  // M 10 20, L 30 -5, Q 50 60 40 10, C 0 0 5 5 12 70, Z
  const int16_t commands[] = {'M', 10, 20, 'L', 30, -5, 'Q', 50, 60, 40, 10, 'C', 0, 0, 5, 5, 12, 70, 'Z'};
  CHECK_INK(ink_of_outline(commands, sizeof(commands), 0), 0, 50, -5, 70);
}

static void an_outline_can_be_measured_further_along_the_line(void) {
  const int16_t commands[] = {'M', 10, 20, 'L', 30, -5, 'Z'};
  CHECK_INK(ink_of_outline(commands, sizeof(commands), 100), 110, 130, -5, 20);
}

static void an_outline_without_points_has_no_ink(void) {
  CHECK_EQ(ink_is_empty(ink_of_outline(NULL, 0, 0)), true);
}

static void a_capital_reaches_from_the_baseline_to_the_cap_height(void) {
  CHECK_INK(ink_of_text(s_font, "H"), 63, 631, 0, 798);
}

static void a_descender_reaches_below_the_baseline(void) {
  CHECK_INK(ink_of_text(s_font, "p"), 60, 589, -255, 631);
}

static void letters_follow_each_other_by_their_advance_width(void) {
  // H advances 694, so the p starts there.
  CHECK_INK(ink_of_text(s_font, "Hp"), 63, 694 + 589, -255, 798);
}

static void spaces_advance_without_adding_ink(void) {
  CHECK_INK(ink_of_text(s_font, "H "), 63, 631, 0, 798);
  CHECK_INK(ink_of_text(s_font, " H"), 240 + 63, 240 + 631, 0, 798);
  CHECK_EQ(ink_is_empty(ink_of_text(s_font, " ")), true);
  CHECK_EQ(ink_is_empty(ink_of_text(s_font, "")), true);
}

static void characters_beyond_ascii_are_single_glyphs(void) {
  // 9 advances 596; the degree sign is two bytes in UTF-8.
  CHECK_INK(ink_of_text(s_font, "9\xC2\xB0"), 25, 596 + 414, -32, 818);
}

static void characters_missing_from_the_font_are_skipped(void) {
  CHECK_INK(ink_of_text(s_font, "H\xE4\xB8\xAD"), 63, 631, 0, 798);
}

static void ink_of_two_texts_is_their_common_extent(void) {
  CHECK_INK(ink_union((Ink){0, 10, 0, 10}, (Ink){5, 30, -4, 6}), 0, 30, -4, 10);
  CHECK_INK(ink_union(INK_NONE, (Ink){5, 30, -4, 6}), 5, 30, -4, 6);
  CHECK_INK(ink_union((Ink){5, 30, -4, 6}, INK_NONE), 5, 30, -4, 6);
}

int main(void) {
  s_font = ffont_create_from_resource(RESOURCE_ID_FONT_TEXT);
  an_outline_extends_over_all_its_points();
  an_outline_can_be_measured_further_along_the_line();
  an_outline_without_points_has_no_ink();
  a_capital_reaches_from_the_baseline_to_the_cap_height();
  a_descender_reaches_below_the_baseline();
  letters_follow_each_other_by_their_advance_width();
  spaces_advance_without_adding_ink();
  characters_beyond_ascii_are_single_glyphs();
  characters_missing_from_the_font_are_skipped();
  ink_of_two_texts_is_their_common_extent();
  ffont_destroy(s_font);
  return check_result("ink");
}
