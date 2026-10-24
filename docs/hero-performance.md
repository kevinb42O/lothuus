# Hero performance — 24 October 2026

This pass optimizes the current scroll-through-door homepage. It follows the earlier explorer work in `house-performance.md`; those older FPS measurements describe a different scene revision and workload.

## What changed

- Cache the fixed sun's static depth buffer at the existing 2048/4096 shadow resolution. Copy it on the GPU and rasterize the complete moving door over it. Camera movement does not rebuild the landscape's shadows. Wind uses the original complete shadow update and invalidates the static cache. The cache adds one depth render target (approximately 16 MiB compact / 64 MiB desktop, plus driver overhead). Moving lights or additional animated geometry must invalidate or extend this cache.
- Index previously unindexed small meshes using exactly equal vertex attributes. A representative rounded street stone uses 95 stored vertices instead of 324, with all 108 triangles, their order, normals and UVs retained. Thousands of instances reuse these vertex results. Already indexed meshes are retained.
- Partition the remaining botanical instance batches into smaller spatial groups, retaining every instance and its matrix/material. Offscreen groups can be culled independently.
- Load the accepted entrance as a gzip-compressed binary ObjectLoader document. A small JSON manifest references typed array blocks; positions, indices and texture pixels are stored without quantization. The bake command writes both the legacy JSON and binary assets; tests compare the entire reconstructed document. The original procedural builder remains the fallback.
- Update the DOM collection projection only with the corresponding rendered hero frame. Retain pending changes until the next GPU frame so the final spring pose cannot be skipped when frame limiting is active.

Textures, environment/reflections, shadow dimensions, antialiasing, pixel ratio, authored details, camera path, door swing and portal behavior retain their existing settings. No dependency was added.

## Measurements

All browser comparisons used the same in-app browser and temporary comparison routes, subsequently removed. Original scene/landscape modules were copied before editing. Both versions used the current accepted assets. The controlled eight-second camera sweep used `p = .3 + .5 * (.5 - .5 * cos(elapsed / 8000 * PI * 4))`, including forward and reverse movement. It called the immediate scroll API to isolate rendering from the camera spring and the rest of the homepage. The desktop scene measured 1240 × 758 CSS pixels with a 1550 × 947 render buffer. Compact scenes used 468 × 804 for both CSS and rendering. These are local development samples, not device-wide FPS guarantees or Core Web Vitals measurements.

| Measurement | Before | After |
| --- | ---: | ---: |
| Desktop camera sweep, rendered frames / elapsed time | 32.53 fps | 45.00 fps |
| Compact camera sweep, existing 30 fps cap | 28.71 fps | 28.98 fps |
| Compact frame at progress .6, complete composed triangle submissions | 4,525,356 | 1,851,901 |
| Compact frame at progress .6, draw calls | 314 | 85 |
| Compressed entrance transfer | 8,555,166 bytes | 4,834,098 bytes |
| Decompressed entrance document | 70,089,367 bytes | 16,583,400 bytes |
| Local median document parsing, five measured samples after two warmups | 126.57 ms | 0.88 ms |

Desktop FPS improved approximately 38% in this run. The compact test was already close to its cap; its benefit is reduced rendering work and more headroom, rather than a large FPS increase. The .6 frame submits 59% fewer triangles and 73% fewer calls. Neither percentage represents an equal reduction in total GPU time. Parsing timings are Node measurements of JSON decoding versus binary manifest decoding; they exclude download, decompression, Three ObjectLoader construction, GPU uploads and shader compilation. Reproduce these asset measurements with `npx tsx scripts/measure-house-assets.ts`.

## Quality and validation

- The 468 × 690 comparison crop at progress .6 is pixel-identical in the captured run: mean absolute channel difference 0, no changed channels. Captures are in `artifacts/hero-performance/before-door-crop.png` and `after-door-crop.png`. This validates that view, rather than claiming every possible camera/device is pixel-identical.
- Tests reconstruct every binary geometry/texture property and compare it with the JSON document. Every triangle's vertex attributes are checked after exact indexing. Shadow tests verify reuse, moving-door world transforms, resolution/type preservation, state restoration and invalidation after wind.
- `npm test`: 86 passed. `npm run typecheck` and the production build pass. Browser verification includes the actual homepage and its live collection handoff.
- The design detector reports only the existing botanical material colours; those colours are preserved.

The full scene remains substantial. The fixed-resolution shadow cache trades memory for less repeated geometry work. First-use shader compilation, procedural landscape construction and loading the remaining botanical models still contribute to startup; the measurements above do not imply those costs have disappeared.
