"""Extract the existing Manrope identity as viewport-clipped vectors for entry.

Requires fontTools. Generated paths retain the shipped font's heavy LO and light
THUUS; no new typeface or raster asset is introduced.
"""
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

root = Path(__file__).resolve().parents[1]
font = TTFont(root / 'public/fonts/manrope.ttf')
fonts = {weight: instantiateVariableFont(font, {'wght': weight}, inplace=False) for weight in [800, 300]}
units = font['head'].unitsPerEm
height = font['OS/2'].sCapHeight
paths, advance, portal = [], 0, None
for index, letter in enumerate('LOTHUUS'):
    face = fonts[800 if index < 2 else 300]
    glyphs = face.getGlyphSet()
    glyph = glyphs[face.getBestCmap()[ord(letter)]]
    pen = SVGPathPen(glyphs, ntos=lambda value: format(value, '.3f').rstrip('0').rstrip('.') if value else '0')
    glyph.draw(TransformPen(pen, (1, 0, 0, -1, advance, height)))
    paths.append(pen.getCommands())
    if letter == 'O':
        bounds = BoundsPen(glyphs)
        glyph.draw(bounds)
        x0, y0, x1, y1 = bounds.bounds
        portal = {'x': advance + (x0 + x1) / 2, 'y': height - (y0 + y1) / 2}
    advance += glyph.width - units * .04
result = {'units': units, 'width': advance, 'height': height, 'portal': portal, 'paths': paths}
(root / 'src/components/house-entry-wordmark-data.ts').write_text(
    '// Generated from public/fonts/manrope.ttf by scripts/build-entrance-wordmark.py.\n'
    '// Heavy LO (the font maximum, 800), light THUUS (300), tracking -0.04em.\n'
    'export const HOUSE_ENTRY_WORDMARK = ' + json.dumps(result, separators=(',', ':')) + ' as const;\n'
)
print({key: value for key, value in result.items() if key != 'paths'})
