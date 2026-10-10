#include <pebble.h>
#include <stdio.h>

// Resources are the files the watch app is built with.
ResHandle resource_get_handle(uint32_t resource_id) {
  return resource_id == RESOURCE_ID_FONT_TEXT ? "resources/fonts/text.ffont" : NULL;
}

size_t resource_size(ResHandle handle) {
  FILE *file = fopen(handle, "rb");
  if (!file) {
    return 0;
  }
  fseek(file, 0, SEEK_END);
  size_t size = (size_t)ftell(file);
  fclose(file);
  return size;
}

size_t resource_load(ResHandle handle, uint8_t *buffer, size_t max_length) {
  FILE *file = fopen(handle, "rb");
  if (!file) {
    return 0;
  }
  size_t loaded = fread(buffer, 1, max_length, file);
  fclose(file);
  return loaded;
}
