// Assertions for the host tests. A failed check prints where it failed and what
// it found; the test program then exits non-zero through check_result().
#pragma once
#include <stdio.h>
#include <string.h>

static int check_failures;

#define CHECK_EQ(actual, expected) do { \
    long actual_ = (long)(actual), expected_ = (long)(expected); \
    if (actual_ != expected_) { \
      printf("%s:%d: %s is %ld, expected %ld\n", __FILE__, __LINE__, #actual, actual_, expected_); \
      check_failures++; \
    } \
  } while (0)

#define CHECK_STR(actual, expected) do { \
    const char *actual_ = (actual), *expected_ = (expected); \
    if (strcmp(actual_, expected_) != 0) { \
      printf("%s:%d: %s is \"%s\", expected \"%s\"\n", __FILE__, __LINE__, #actual, actual_, expected_); \
      check_failures++; \
    } \
  } while (0)

#define CHECK_BOX(actual, ex, ey, ew, eh) do { \
    Box box_ = (actual); \
    if (box_.x != (ex) || box_.y != (ey) || box_.w != (ew) || box_.h != (eh)) { \
      printf("%s:%d: %s is {%d, %d, %d, %d}, expected {%d, %d, %d, %d}\n", __FILE__, __LINE__, #actual, \
             box_.x, box_.y, box_.w, box_.h, (ex), (ey), (ew), (eh)); \
      check_failures++; \
    } \
  } while (0)

static inline int check_result(const char *name) {
  if (check_failures == 0) {
    printf("ok - %s\n", name);
  }
  return check_failures != 0;
}
