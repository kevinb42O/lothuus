# LOTHUUS solid 3D exterior

The scene in `src/components/house-scene.ts` contains true modeled geometry, PBR materials, 3D vegetation and independent lighting. The supplied house photograph is a visual reference only. The renderer does not load it, project it, use an inferred depth photograph, or use an image-generated background plate.

## Geometry

`house-architecture.ts`: estimated architectural proportions, actual openings and masonry reveals, individual staggered front bricks, stone plinth slabs, cornice layers and corbels, separate curved roof tiles and ridge caps, chimney, roof windows, downpipes, stepped window profiles, separate glazing, curtains with folds, door panels and curved mouldings, hardware, lanterns and balcony ironwork. Static detail is merged by material; repeated detail is instanced.

`house-door.ts`, `house-door-tracing.ts` and `house-bell-tracing.ts`: the user's entrance close-up supersedes the older facade photo for this detail. Real extruded ironwork and gilt contours, separate textured privacy glass, the old-fashioned pull bell with seven sculpted gilt birds on a vertically aligned helix, the original 89 numeral outlines, and a precisely mirrored limestone surround. No door photograph is loaded by the renderer. The source and reconstruction boundaries are recorded in `docs/house-door-reference.md`.

`house-landscape.ts`: assembles the street, planting and surrounding context. The paved side street on the right continues behind the house, with a narrow pavement and drainage edge, a low brick garden wall, hedge and background trees. The left frontage is built independently in `house-left-context.ts`. Side-street width, gardens and hidden elevations remain estimates from the single photograph. The main house and foreground tree-root positions are preserved.

`house-ground.ts`: a continuous, shadow-receiving ground surface under and beyond the individual pavers. World-space staggered joints use the same 231 × 118 mm module as the modeled street; existing local paving textures supply surface detail at a physical scale. The square, side street and garden zones continue beyond the foreground geometry. Subpixel joints fade to their mean coverage to limit distant moiré. The ground fades between 32 and 58 metres from the scene origin into the existing HDR panorama, projected onto a `GroundedSkybox` (14 m capture-height estimate, 160 m radius). This fills the lower hemisphere without a flat grey horizon or an additional image download. The ground remains separate from static solid merging so it receives shadows without becoming a shadow caster. The background is generic scenery, not a survey or photograph of the actual village.

`house-streetscape.ts`: the foreground is rebuilt from the colour reference, aligned to the unchanged facade. Road blocks measure an estimated 118 × 231 mm with their long axes towards the facade, staggered half-length bonds, rounded edges, narrow joints and restrained ash/sand colour variation. The small-block footpath replaces the former large slab apron; it continues between the planting beds to the door and turns into the right-hand street. The left bed is shallower and shifted towards the entrance; its two long edges slope together. The right bed widens towards its right end. Both have low, segmented, bevelled kerbs (105 mm estimated exposed height), separate soil and flush header/drainage courses. The painted comb marking begins alongside the left bed and extends diagonally towards the foreground, with nine transverse strokes and small procedural wear. Plant placement uses these same sloping footprints; tree roots and the main architecture remain unchanged. Reference measurements and limits are recorded in `docs/house-ground-reference.md`.

`house-left-context.ts`: reconstructs the visible left-hand frontage from the colour reference, with the entrance floor roughly four metres behind the main facade. A low beige plaster face has a real doorway opening, deep reveals, stepped grey architrave, blue-black panelled leaf, a separate glazed transom, ironwork and stone threshold. The narrow service leaf to the left, two shallow metal canopy edges at different heights, and the downpipe between the two bays follow the visible reference. Fine individual stretcher-bond red bricks form the blind wall above. Its visible right rake is aligned to the photograph; the off-frame peak and wall returns are inferred. The large neighbouring roof and the previously invented separate cottage roof are omitted. Source landmarks and visual checks are recorded in `docs/house-left-reference.md`.

## External assets — downloaded 24 October 2026

Poly Haven assets are CC0: https://polyhaven.com/license

- `materials/daylight.hdr`: Kloofendal 48d Partly Cloudy, Greg Zaal — https://polyhaven.com/a/kloofendal_48d_partly_cloudy . 1K HDR used for lighting, with a separate 4K skybox on desktop and 2K skybox on compact screens, reused for the ground-projected surroundings. A local reflection probe additionally captures modeled trees and surrounding geometry for the windows.
- `materials/yellow_bricks-*.webp`: https://polyhaven.com/a/yellow_bricks . 2K diffuse, OpenGL normal and roughness; locally converted to WebP quality 88. The color map was locally remapped to restrained ochre (RGB 172, 133, 77 with luminance variation) to approximate the reference facade. Normal and roughness maps retain the source detail.
- `materials/grey_roof_tiles-*.webp`: https://polyhaven.com/a/grey_roof_tiles . 1K diffuse, OpenGL normal and roughness, locally converted to WebP quality 88. Curved tiles themselves are actual authored geometry.
- `models/tree_small_02.glb` and `tree_small_02-low.glb`: https://polyhaven.com/a/tree_small_02 . Broadleaf tree with separate trunk, branch and leaf geometry and PBR maps. Geometry simplified offline using glTF Transform and meshoptimizer; high and reduced detail variants for foreground/secondary trees and compact screens. Scaled and positioned to follow the reference; this is not a scan of the actual LOTHUUS tree.
- `models/shrub_02.glb`: https://polyhaven.com/a/shrub_02
- `models/shrub_03.glb`: https://polyhaven.com/a/shrub_03
- `models/grass_medium_02.glb`: https://polyhaven.com/a/grass_medium_02

The plant GLBs reference local, content-addressed JPEGs in `models/textures/`. These are the exact original embedded image bytes, extracted without recompression by `scripts/optimize-house-models.mjs`. Identical tree textures share URLs and source materials across both tree variants. Runtime does not contact Poly Haven. Shrubs and grass are instanced.

ambientCG assets are CC0: https://docs.ambientcg.com/license/

- `materials/paving-*.webp`: https://ambientcg.com/a/PavingStones036 . 1K color, OpenGL normal and roughness maps, converted locally to WebP quality 86. Used with separately modeled paving and stone.

## Rendering

Three.js WebGL2, ACES filmic output, HDR image-based lighting, direct sunlight, dynamic canopy shadows, local window reflection probe, physical transmission/reflection in glazing, GTAO contact shading, multisampled HDR render targets on desktop, and custom vegetation shaders with matching depth/shadow deformation. Wind respects reduced motion; rendering pauses when hidden and caps pixel ratio and frame rate. Static architectural geometry uses indexed buffers; street and leaf instances and scanned tree foliage have spatial bounds for per-pass culling. GTAO is cached until the camera or viewport changes (its normal override does not animate wind). Sun shadows refresh for wind and wind-state changes, rather than camera movement. Geometry, texture resolutions, shadow resolutions and postprocessing quality are preserved. See `docs/house-performance.md` for measurements and validation.

The previous, rejected image-based experiment and its derived/generated assets have been removed. No generated building image or photograph substitutes for this geometry.


## Window interior atlas — 27 October 2026

`materials/window-interiors.webp` and its identical mobile sibling are a 256 × 128 opaque atlas generated with the built-in image_gen tool, then prepared with `scripts/prepare-window-interiors.mjs`. Four coordinated interior crops suggest two ground-floor and two upper-floor views. These are imagined furnishings, not photographs or a reconstruction of the actual interior. The exact generation prompt is retained in `docs/window-interior-generation-prompt.txt`.

The image sits on recessed planes behind real folded curtains and glazing; it does not substitute for or project a photograph onto the exterior architecture. One lower casement, including its frame and handle, has a fixed seven-degree inward tilt. Clear exterior glazing does not cast an opaque shadow onto the curtains. Two unused roof color/roughness images are no longer requested; the existing roof normal map remains. See `docs/house-window-interiors-plan.md` for the implementation budget and verification.
