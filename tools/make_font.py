#!/usr/bin/env python3
"""Converts a TrueType/OpenType font into the vector font resource the watch
app draws its text with (the .ffont format of the vendored pebble-fctx).

    uv run --with fonttools tools/make_font.py FONT.ttf resources/fonts/text.ffont

Layout of the output, all little endian:
    header   units_per_em, ascent, descent, cap_height (fixed16), then the
             number of code point ranges and the number of glyphs (uint16)
    ranges   begin, end (uint16, end exclusive), ascending
    glyphs   path offset, path length (uint16), advance width (fixed16), in
             code point order
    paths    draw commands: a uint16 letter (M, L, Q, C, Z) followed by its
             coordinates (fixed16)
Coordinates keep the font's y-up orientation and are scaled so that one em is
72 units; fixed16 is that value times 16.
"""
import struct
import sys

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont

EM = 72
FIXED = 16

# Basic Latin and Latin-1, plus the few other characters Home Assistant states
# and units commonly contain: en dash, ellipsis, euro, mu, ohm, subscript two.
CODE_POINTS = sorted(
    set(range(0x20, 0x7F)) | set(range(0xA0, 0x100))
    | {0x2013, 0x2026, 0x20AC, 0x03BC, 0x03A9, 0x2082})


class CommandPen(BasePen):
    """Records a glyph outline as fctx draw commands."""

    def __init__(self, glyph_set, fixed):
        super().__init__(glyph_set)
        self.fixed = fixed
        self.data = bytearray()

    def _emit(self, letter, *points):
        self.data += struct.pack('<H', ord(letter))
        for x, y in points:
            self.data += struct.pack('<hh', self.fixed(x), self.fixed(y))

    def _moveTo(self, pt):
        self._emit('M', pt)

    def _lineTo(self, pt):
        self._emit('L', pt)

    def _qCurveToOne(self, control, pt):
        self._emit('Q', control, pt)

    def _curveToOne(self, control1, control2, pt):
        self._emit('C', control1, control2, pt)

    def _closePath(self):
        self._emit('Z')


def ranges_of(code_points):
    """Consecutive runs of code points as (begin, end) pairs, end exclusive."""
    ranges = []
    for cp in code_points:
        if ranges and ranges[-1][1] == cp:
            ranges[-1][1] = cp + 1
        else:
            ranges.append([cp, cp + 1])
    return ranges


def convert(font_path):
    font = TTFont(font_path)
    scale = EM / font['head'].unitsPerEm

    def fixed(value):
        result = round(value * scale * FIXED)
        if not -32768 <= result <= 32767:
            raise ValueError(f'coordinate {value} does not fit the format')
        return result

    cmap = font.getBestCmap()
    glyph_set = font.getGlyphSet()
    code_points = [cp for cp in CODE_POINTS if cp in cmap]

    table = bytearray()
    paths = bytearray()
    for cp in code_points:
        glyph = glyph_set[cmap[cp]]
        pen = CommandPen(glyph_set, fixed)
        glyph.draw(pen)
        table += struct.pack('<HHh', len(paths), len(pen.data), fixed(glyph.width))
        paths += pen.data
    if len(paths) > 0xFFFF:
        raise ValueError('the outlines exceed the 64 KiB the format can address')

    ranges = ranges_of(code_points)
    header = struct.pack(
        '<hhhhHH', EM * FIXED, fixed(font['hhea'].ascent), fixed(font['hhea'].descent),
        fixed(font['OS/2'].sCapHeight), len(ranges), len(code_points))
    index = b''.join(struct.pack('<HH', begin, end) for begin, end in ranges)
    return header + index + bytes(table) + bytes(paths), len(code_points)


def main():
    font_path, out_path = sys.argv[1:]
    data, glyphs = convert(font_path)
    with open(out_path, 'wb') as out:
        out.write(data)
    print(f'{out_path}: {glyphs} glyphs, {len(data)} bytes')


if __name__ == '__main__':
    main()
