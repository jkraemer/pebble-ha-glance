#pragma once
#include <pebble.h>
#include <pebble-fctx/ffont.h>
#include "dashboard.h"

// Draws the whole screen. While the dashboard has not been loaded, `notice`
// is shown in place of the values.
void draw_dashboard(GContext *ctx, GRect bounds, FFont *font, const Dashboard *dashboard, const char *notice);
