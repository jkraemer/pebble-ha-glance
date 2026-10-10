# Host-side tasks. The watch app itself is built with `pebble build`.

FONT_SOURCE ?= /usr/share/fonts/TTF/FiraSansCondensed-Bold.ttf

HOST_CFLAGS = -std=gnu11 -g -Itest/c -Itest/c/host -Isrc/c -Isrc/c/vendor
HOST_BUILD = build/host

# Code without watch behaviour of its own, tested on the host.
HOST_SOURCES = src/c/layout.c src/c/ink.c src/c/fit.c src/c/text.c test/c/host/pebble.c
VENDOR_SOURCES = src/c/vendor/pebble-fctx/ffont.c src/c/vendor/pebble-utf8/pebble-utf8.c
C_TESTS = $(patsubst test/c/test_%.c,%,$(wildcard test/c/test_*.c))

.PHONY: test test-c test-js test-emulator font

test: test-c test-js

test-c: $(addprefix $(HOST_BUILD)/test_,$(C_TESTS))
	@for test in $^; do ./$$test || exit 1; done

$(HOST_BUILD)/vendor.o: $(VENDOR_SOURCES)
	@mkdir -p $(HOST_BUILD)
	@$(CC) $(HOST_CFLAGS) -w -r -o $@ $^

$(HOST_BUILD)/test_%: test/c/test_%.c $(HOST_SOURCES) $(HOST_BUILD)/vendor.o $(wildcard src/c/*.h test/c/*.h test/c/host/*.h)
	@mkdir -p $(HOST_BUILD)
	@$(CC) $(HOST_CFLAGS) -Wall -Wextra -Werror -o $@ $< $(HOST_SOURCES) $(HOST_BUILD)/vendor.o

test-js:
	@node --test "test/js/*.test.js"

# The whole app in the emulator; takes about a minute.
test-emulator:
	@test/emulator.sh

# Regenerates the vector font resource from the TrueType font.
font:
	uv run --with fonttools tools/make_font.py $(FONT_SOURCE) resources/fonts/text.ffont
