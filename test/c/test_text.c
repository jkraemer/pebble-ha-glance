#include "text.h"
#include "check.h"

static void text_that_fits_is_copied_whole(void) {
  char buffer[8] = "earlier";
  text_copy(buffer, sizeof(buffer), "abc");
  CHECK_STR(buffer, "abc");
}

static void longer_text_is_cut_to_the_room_there_is(void) {
  char buffer[4];
  text_copy(buffer, sizeof(buffer), "abcdefgh");
  CHECK_STR(buffer, "abc");
}

static void a_character_of_several_bytes_is_never_cut_in_half(void) {
  // The degree sign takes two bytes, of which only one would fit.
  char buffer[3];
  text_copy(buffer, sizeof(buffer), "9\xC2\xB0");
  CHECK_STR(buffer, "9");

  // The euro sign takes three.
  char longer[5];
  text_copy(longer, sizeof(longer), "12\xE2\x82\xAC");
  CHECK_STR(longer, "12");
}

static void a_character_of_several_bytes_is_kept_when_it_fits(void) {
  char buffer[4];
  text_copy(buffer, sizeof(buffer), "9\xC2\xB0");
  CHECK_STR(buffer, "9\xC2\xB0");
}

static void missing_text_is_empty(void) {
  char buffer[4] = "abc";
  text_copy(buffer, sizeof(buffer), NULL);
  CHECK_STR(buffer, "");
}

int main(void) {
  text_that_fits_is_copied_whole();
  longer_text_is_cut_to_the_room_there_is();
  a_character_of_several_bytes_is_never_cut_in_half();
  a_character_of_several_bytes_is_kept_when_it_fits();
  missing_text_is_empty();
  return check_result("text");
}
