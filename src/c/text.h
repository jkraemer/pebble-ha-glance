#pragma once
#include <stddef.h>

// Copies as much of a UTF-8 text as fits into `size` bytes, never leaving half
// a character at the end. A missing text is copied as an empty one.
void text_copy(char *destination, size_t size, const char *source);
