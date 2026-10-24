# Broad exterior performance correction — 24 October 2026

The earlier hero benchmark in `hero-performance.md` concentrated on progress .3–.8. It missed the user's bottleneck: the broad exterior at the beginning. This pass measures progress .01–.28, with the complete house and planting visible, before the door opens.

## Rendering changes

The scene, textures, mesh density, HDR precision, shadow dimensions and scene MSAA settings are retained. The following work was removed or reordered:

1. The final lens/portal pass now also performs the same ACES tone mapping and sRGB output conversion, using Three's shader chunks. The separate full-screen output pass is removed. This also avoids an intermediate half-float colour rounding step.
2. The final pass sets `needsSwap=false`: it writes to the canvas, so swapping the composer's read/write targets afterwards served no purpose. The hero now keeps one active HDR/MSAA scene target instead of alternating between two full-size targets. The unused second target is not GPU-allocated during the approach.
3. Canvas/default-framebuffer MSAA is disabled. Model edges still receive the same four-sample MSAA in the scene target. The final full-screen triangle has no interior geometric edges requiring a second layer of MSAA.
4. A closed door cannot expose the portal. Door-mask rendering and its full-screen multisample resolve are skipped until the leaf opens. The depth-tested scene remains identical. The portal shader and complete detailed leaf mask are retained once the door opens.
5. During the closed-door approach, the scene uses its raster depth buffer for visibility but does not resolve or preserve multisample depth afterwards. Depth resolve/preservation is restored for open-door frames before the portal samples scene depth. The door mask only consumes colour, so its depth is never resolved.
6. Opaque meshes are drawn front to back, retaining explicit group/render order. Hero instance matrices and their matching colours are ordered along the fixed world -Z camera axis once at initialization. Transparent objects retain their existing sorting. No instance or triangle is removed.
7. Vegetation and its shadow shaders compile a variant with wind arithmetic completely excluded while wind is off. Previously the vertex shader still evaluated powers and trigonometry before multiplying the displacement by zero. Enabling wind or changing reduced-motion preferences switches both visible and shadow materials to the matching variant.

At a 2400 × 1350 scene buffer, eliminating one HDR/MSAA scene target avoids approximately 194 MB of attachment storage, before driver compression/overhead (RGBA16F colour: four samples plus resolve; depth: four samples plus texture). At a 4800 × 2700 buffer that one redundant target alone is approximately 778 MB. Skipping the closed-door mask and default-framebuffer MSAA removes additional storage and bandwidth. These are attachment-layout estimates, not GPU-memory telemetry.

## Measurements

Temporary original/optimized viewer routes use identical assets, camera positions and fixed dimensions. The original scene and landscape were copied before this correction; current reference framing is shared. An eight-second forward/reverse sweep calls `scroll(progress,true)` with `p = .01 + .27 * (.5 - .5 * cos(elapsed / 8000 * PI * 4))`. Initial runs warm the shaders; FPS is rendered-frame count divided by elapsed time. The existing CSS canvas treatment is shared by both test routes. Timing is local development-browser evidence, not a guarantee for another PC, browser, GPU, or display size.

For 1920 × 1080 CSS pixels / 2400 × 1350 rendering pixels, the warmed original run measured 24.47 fps. Two optimized runs measured 36.47 and 33.48 fps. This isolates the broad beginning, unlike the earlier door benchmark. Cold/first-sweep samples varied substantially and are excluded from that comparison.

## Visual comparison

Raw 2400 × 1350 PNG captures avoid the viewport-size screenshot crop and exclude CSS treatment/DOM overlays. Comparison assets are in `artifacts/hero-wide-performance/`.

| Pose | Mean absolute RGB channel difference, 0–255 | Channels differing by more than 10 |
| --- | ---: | ---: |
| Full initial house, progress 0 | 0.0221 | 0.0196% |
| Broad approach, progress .1 | 0.0190 | 0.0123% |

At the initial pose, 99.961% of RGB channels differ by at most one. Differences are concentrated around sampling/depth ties and the removed intermediate colour rounding; this is not a claim of pixel identity. Full-frame inspection retains the facade, foliage, ironwork, paving, glazing and shadows. A separate open-door capture at progress .65 verifies the restored depth/portal path. The PNG's transparent opening appears black when previewed without the DOM collection behind it.

The world/instance ordering test checks that every original transform and its exact matching instance colour survive the ordering, including transformed groups; transparent instances are excluded. Existing camera, geometry, cached-shadow and entrance-data tests continue to apply. Temporary profiling modes, capture hooks and comparison routes are removed before delivery.
