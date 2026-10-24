# Social sharing cover

`lothuus-social-v1.jpg` is the default Open Graph and Twitter/X large-image cover, configured in `src/app/layout.tsx`. It is a 1200 × 630 progressive JPEG generated with the built-in ImageGen tool on 24 October 2026, then resized and compressed with Sharp.

The actual house photograph in `public/house/lothuus-today-restored.png` was used as the architectural reference. This is an art-directed generated derivative, not documentary photography.

The absolute image URL uses `APP_ORIGIN` when configured, then the Vercel deployment's `VERCEL_URL`, then the intended domain `https://www.lothuus.be`. Set `APP_ORIGIN` to the public website origin when connecting the production domain.

## Generation prompt

Use case: ads-marketing
Asset type: premium website social-sharing / Open Graph cover, landscape aspect ratio 1.90476:1, ideally 1200x630 or a larger equivalent.
Primary request: Create a beautiful, finished editorial social cover for LOTHUUS, a Belgian house for culture, encounters and a vintage collection.
Input images: the referenced photo is the actual LOTHUUS house, use as identity and architectural reference. Preserve its recognizable ochre brick facade, charcoal tall windows, slate tiled roof, central ornate black door with pale stone surround and iron balcony, leafy tree at right. Do not invent a different building.
Composition: a sophisticated single editorial composition. Left approximately 48% is warm off-white paper (#fafaf7), meeting the image through a crisp vertical edge, no gradients. Right approximately 52% is a beautifully art-directed natural architectural photograph of this actual house, cropped with the ornate doorway and balcony as focal point, with warm late-afternoon sunlight, some green leaves and exquisite tactile masonry. No objects obstructing the door. The house image bleeds to top, right and bottom. All text on the cream panel, with generous safe margins of at least 65 pixels at 1200 width. The wordmark is bold clean dark charcoal geometric sans, first two letters LO heavy and THUUS lighter, on ONE single line, large and immediately readable, but fits entirely within the left cream panel. Under it, the Dutch tagline in a beautiful restrained dark charcoal italic editorial serif, arranged across three short lines. Add a short fine muted berry (#b52f62) horizontal rule above the tagline, with ample breathing room. Confident typography, beautiful spacing. No frames, no badges, no icons, no extra slogans, no watermark. Tactile, cultured, warm, understated European art publication.
Text (verbatim), only these two blocks:
"LOTHUUS"
"Een huis voor
cultuur en
ontmoeting"
Constraints: text must be spelled exactly as provided. No other text. Render as a final polished complete cover, not a mockup. Keep main text comfortably within the middle 75% of vertical area to tolerate social crops.
