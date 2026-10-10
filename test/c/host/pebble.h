// Stands in for the Pebble SDK header when code that has no watch behaviour of
// its own is compiled for the host tests. It declares only what the vendored
// font code needs; resources are read from the project's resources directory.
#pragma once
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>

typedef struct GContext GContext;
typedef struct GBitmap GBitmap;

typedef struct { int16_t x, y; } GPoint;
#define GPoint(x, y) ((GPoint){(x), (y)})
typedef struct { int16_t w, h; } GSize;
typedef struct { GPoint origin; GSize size; } GRect;
typedef struct { uint8_t argb; } GColor;
typedef enum { GTextAlignmentLeft, GTextAlignmentCenter, GTextAlignmentRight } GTextAlignment;

typedef const char *ResHandle;
#define RESOURCE_ID_FONT_TEXT 1
ResHandle resource_get_handle(uint32_t resource_id);
size_t resource_size(ResHandle handle);
size_t resource_load(ResHandle handle, uint8_t *buffer, size_t max_length);

enum {
  APP_LOG_LEVEL_ERROR = 1,
  APP_LOG_LEVEL_WARNING = 50,
  APP_LOG_LEVEL_INFO = 100,
  APP_LOG_LEVEL_DEBUG = 200,
  APP_LOG_LEVEL_DEBUG_VERBOSE = 255,
};
#define APP_LOG(level, fmt, ...) ((void)0)
