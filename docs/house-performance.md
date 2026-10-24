# House renderer performance — 24 October 2026

The optimization preserves the modeled architecture, street, plants, texture image bytes and resolutions, shadow resolution, glass transmission, reflection probe and GTAO settings. The 1,620 facade bricks, 2,142 curved roof tiles and 27,492 street pavers remain. These were already GPU instances, rather than separate draw calls per stone.

## Measurements

Measured the original source and optimized source in the same in-app browser using temporary comparison routes, removed after verification. Counters reset once per complete composed frame and include transmission, sun-shadow, normal/depth, AO and output passes. Runtime averages use the most recent 60 rendered frames with wind enabled and a stationary front camera. Shadow refresh frequency affects these averages. These are recorded optimization-stage snapshots, not permanent scene budgets: parallel work subsequently refined the door and planting in the shared workspace. Those edits are preserved and validated with the optimized pipeline. The architecture-buffer comparison and screenshot pair predate those refinements; runtime samples can also vary with scene revisions.

| Measurement | Original | Optimized | Change |
| --- | ---: | ---: | ---: |
| Architectural geometry buffers, including indices | 11,737,072 bytes | 3,589,100 bytes | −69.4% |
| Architectural vertices, excluding instance multiplication | 366,770 | 89,227 | −75.7% |
| Architectural triangles, including instances | 270,194 | 270,194 | Preserved |
| Triangle submissions/frame, compact test | 5,292,838 | 3,259,165 | −38.4% |
| Triangle submissions/frame, desktop test | 7,773,388 | 5,079,485 | −34.7% |
| Rendered frames/second, desktop test | 6.48 | 8.07 | +24.5% |
| Five plant models plus their unique texture files | 35,623,436 bytes | 29,761,013 bytes | −5,862,423 bytes / −16.5% |

The compact comparison used a 468px browser viewport. The desktop comparison forced identical 1,240 × 758 CSS-pixel scene dimensions in that same browser, with a 1,984 × 1,212 drawing buffer and the desktop tree variant. Frame rate is specific to this browser/test environment, is affected by GPU/driver behavior and other machine activity, and is not a device-wide benchmark. The pre-existing 30fps cap is retained. The scene remains substantial; the table does not claim universal smoothness or a matching percentage reduction in GPU time.

Spatial culling trades additional, smaller draw calls for fewer submitted triangles. The desktop sample averaged 211 original versus 295 optimized calls/frame. The measured frame-rate improvement supports that tradeoff in this test. Static scenes with wind disabled stop rendering, as before; a development frame counter was checked to remain unchanged at rest.

## Changes

- Keep indexed architectural geometry when merging by material. Index matching positions, normals and UVs at a tolerance of 0.000001 local units; reuse repeated box geometries and their indexed forms during construction. Every triangle is retained.
- Partition street pavers and generated foliage into spatial instance batches. Partition scanned tree foliage by triangle centroid, retaining original triangle indices, vertex attributes and material/shadow behavior. Bounds include padding for the vertex-shader wind displacement. Each render camera can reject batches outside its frustum, including the reflection and shadow cameras.
- Cache GTAO until camera movement or resize invalidates it. This is valid for the current renderer because GTAO's MeshNormalMaterial override does not use the plant wind shaders; its input was already independent of the wind animation. A future animated object or wind-aware normal pass must invalidate or replace this cache.
- Refresh the sun-shadow map on wind-state changes and at the existing wind cadence. Camera-only movement no longer invalidates a world-space, fixed-sun shadow map. Future moving lights or geometry must invalidate this cache too.
- Freeze static object matrices; wind still animates in vertex shaders. Release instance buffers as well as shared scene resources when disposing the viewer. React to changes in the system reduced-motion preference.
- Load a repeated model URL only once per viewer. On compact screens the two tree slots share the same prepared source model. Desktop tree variants share verified identical source materials/textures before preparing their independent wind uniforms.
- Extract embedded JPEGs into content-addressed local files with `node scripts/optimize-house-models.mjs`. All image bytes, mesh/accessor buffers, materials and sampler settings were compared with the originals. Both tree variants had identical images, materials and samplers. Re-running the script leaves already optimized files unchanged.

## Validation

- `npm test`: 62 tests passed, including exact instance matrix/color preservation, exact foliage triangle/attribute preservation and AO cache invalidation after camera/viewport changes.
- `npm run typecheck`: passed.
- Front, angled and door views, zoom, wind toggle and paused rendering checked in the browser; no WebGL errors observed.
- Before/after compact screenshots with wind disabled are in `artifacts/house-performance/`. In the 428 × 262 scene crop, mean absolute channel difference was 0.92 on the 0–255 scale; 0.109% of channels differed by more than 10. Rendering order and shadow sampling can differ, so this is not a claim of pixel-identical output. Visual inspection showed no missing detail.
- Development builds expose counters in `canvas[data-scene].dataset.renderStats`; production does not collect these metrics. This includes the complete frame's triangle/call counts, a rolling average, rendered-frame counter, frame rate and whether sun shadows were refreshed.

The previous route-level lazy loading, hidden/offscreen rendering pause, compact-screen density choices and pixel-ratio caps are retained. No additional dependency was introduced.
