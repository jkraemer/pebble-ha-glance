#include "text.h"
#include <string.h>

// Bytes 10xxxxxx continue a character that started earlier.
static int prv_continues_character(char byte) {
  return ((unsigned char)byte & 0xC0) == 0x80;
}

void text_copy(char *destination, size_t size, const char *source) {
  size_t length = source ? strlen(source) : 0;
  if (length >= size) {
    length = size - 1;
    while (length > 0 && prv_continues_character(source[length])) {
      length--;
    }
  }
  memcpy(destination, source, length);
  destination[length] = '\0';
}
