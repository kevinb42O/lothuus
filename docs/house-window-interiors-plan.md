# Window interiors — proposed fix, 27 October 2026

Status: implemented on 27 October 2026 after user approval. The original direction below is retained; the implementation and validation notes at the end record the smaller final atlas and measured budget. Camera/timing work and the authored entrance are preserved.

## Diagnosis

`windowAt()` currently puts a shallow dark box behind each window and adds two narrow folded curtain planes. Curtain height is 80% of the opening and its centre is at 43%: it ends at 83% of the window height, leaving an unintended 17% gap at the top. The neutral exterior glass makes these incomplete layers easier to see. More transparent glass alone amplifies the problem.

## Direction

Use a restrained hybrid: real frames, glass and simple folded curtains in front of a recessed, static interior image. Generate two coordinated interior source compositions, one per floor, then prepare four quiet window crops in one shared opaque texture atlas. Avoid stretching a single panorama across the facade: each opening needs a suitable crop and camera perspective. These images suggest depth, rather than document an unknown actual interior.

Ground floor: subdued cultural/vintage setting, light plaster, subtle timber, a few indistinct furnishings well back from the glass. Upper floor: quieter room with soft walls and sparse furnishings. No exterior window frame, glazing, curtain or sky reflections baked into the interior artwork: the actual model supplies those. Match both floors' daylight direction and subdued exposure; the rooms must read darker than the exterior.

The physical foreground layers provide the parallax. A flat interior image cannot give correct room parallax from every angle. Validate against the real entrance camera and its lateral movement before deciding whether a second, very simple room-side surface is necessary. Do not introduce interior-mapping shaders or modeled rooms by default.

## Work order

1. Correct curtains to hang from a plausible concealed rail high behind the upper frame, reaching the sill. Vary opening widths slightly. Simplify the current 20×8 curtain tessellation to a small number of vertical folds, preserving silhouettes. Use one shared curtain material where practical.
2. Prototype one ground-floor and one upper-floor window using interior crops on the existing backing geometry, moved farther inside. Keep the frames, glass, curtains and image as separate spatial layers. Match colour, contrast, perspective and daylight in the actual moving shot.
3. Tilt one lower casement inward, under its fixed transom, using a modest 5–8 degree opening. Pivot the complete glazed leaf and its timber frame around its bottom edge. Set the pose during construction and bake it into the existing merged geometry, preserving static shadow/reflection caching and avoiding an animation loop. Recess the curtain enough to clear the tilted leaf. Prefer the right leaf of the ground-floor window immediately left of the entrance, subject to the camera review.
4. Pack the approved window crops into one shared atlas with mip gutters. Target a maximum 1024px atlas on desktop and 512px on mobile; final resolution depends on actual screen coverage. Reuse it across all windows, with restrained variation rather than thirteen unrelated rooms. Resize/crop source artwork to exact UV proportions; generation alone cannot guarantee a perfect fit.
5. Inspect the complete facade, near view, tilted leaf and open entrance on desktop and mobile. Validate that curtains have no visible top gap, the tilted frame and pane agree, interior images do not appear self-lit, and the static illusion holds during camera movement.

## Performance acceptance

No new render passes, lights, real-time reflection updates, transparency layers, interior shaders or continuous animation. Reuse existing window backing meshes. Remove/simplify curtain geometry and consolidate its materials to offset the atlas material; verify total draw calls rather than assuming that sharing a texture makes new materials free.

A new atlas does add texture memory and a texture sample on the interior surface. A full RGBA atlas including mipmaps is approximately 5.33 MiB at 1024² or 1.33 MiB at 512², before browser/driver overhead and decoded CPU copies. WebP compression reduces transfer, not decoded GPU storage. This tradeoff must be measured alongside geometry savings; do not describe it as zero-cost or assume fewer vertices offset texture memory.

Freeze the same camera, renderer settings and viewport for before/after comparisons: concurrent camera changes previously invalidated comparison runs. Compare asset bytes, texture/buffer memory, draw calls and frame-time distributions on desktop and mobile. Require no measurable runtime regression. If strict total-memory neutrality cannot be achieved by replacing existing resources, reduce the atlas or omit it rather than silently increasing the budget. Physical-phone verification remains necessary for device-specific memory behaviour.


## Implemented result and verification

- Real folded curtains cover the full opening, with their upper ends concealed behind the frame. Their mesh grid is 8 × 1 rather than 20 × 8. All curtains share one material.
- Four generated room crops share a single opaque 256 × 128 WebP atlas, identical on mobile and desktop. Each tile has extruded 2px mip gutters, and UV crops preserve room proportions. The exact prompt is in `docs/window-interior-generation-prompt.txt`; asset preparation is in `scripts/prepare-window-interiors.mjs`. Source artwork and browser captures are retained locally in `artifacts/window-interiors/`.
- The right lower casement of the window directly left of the entrance has a fixed 7° inward tilt, including four timber edges, pane and handle. The folded curtain stays at least 15 cm behind the tilted leaf. The pose is merged into the architecture at construction time.
- Exterior glazing is less opaque and no longer casts a solid opaque shadow onto the curtains. No transmission pass, lights, reflection updates or animation loop was added. The room backplates use one unlit opaque material, replacing the former per-window dark boxes.
- The renderer no longer requests the unused roof colour and roughness images. Only the existing roof normal map is used by the house and neighbouring roofs; its image and appearance are retained.

The comparison baseline is the material-polished architecture immediately before the window fix, with the accepted baked entrance included. Unique typed-array buffers are counted once, including instance matrices/colours.

| Architecture resource | Before | After |
| --- | ---: | ---: |
| Meshes after material merging | 39 | 39 |
| Materials | 31 | 31 |
| Triangles, including instances | 483,358 | 474,124 |
| Geometry/instance buffer bytes | 19,899,940 | 19,668,728 |

The new atlas occupies an estimated 174,764 RGBA bytes including all mip levels. Buffer savings are 231,212 bytes, so the combined buffer/texture allocation estimate falls by 56,448 bytes. This is a resource-layout calculation, not device VRAM telemetry; driver overhead and browser copies are not measured. Atlas transfer is 5,440 bytes. Removing the two unused roof image requests reduces net source-image transfer by 379,190 bytes on desktop and 69,354 bytes on mobile, and avoids decoding 8 MiB / 2 MiB of unused RGBA source images respectively.

A temporary browser harness pins the same camera/entry source on both sides, at a 1280 × 780 desktop host or a 390 × 700 mobile host. At progress 0, .25 and .32, steady-frame draw calls stay 289/221/193 on desktop and 129/96/90 on mobile. Triangle submissions decrease by 9,234 at each tested pose. Five frames warm each fixed pose; twenty renders then measure synchronous wall time around render plus `gl.finish()`. This measures the local submission/synchronization path, not isolated GPU time or interactive FPS. Mobile median samples were 3.4/2.3/1.2 ms before and 1.4/1.1/1.1 ms after. Desktop wall times varied strongly between control runs under concurrent host activity, so no desktop FPS improvement or timing-based non-regression is claimed. Raw samples and harness snapshots remain in the ignored local artifacts directory; no profiling code or review route ships.

Visual checks cover the desktop near facade, mobile facade and open doorway; no browser warnings or errors were observed. Geometry regression tests cover curtain height, leaf/frame/handle pivoting, curtain clearance, fixed transom, crop proportions, atlas gutters and the shipped asset budget. Physical-phone verification remains outside the local browser check.

Final checks: all 196 repository tests passed, TypeScript validation passed after regenerating stale temporary-route types, and the isolated `.next-window-check` production build passed. The Impeccable detector reported only 12 advisory physical-material colours outside the interface palette; those colours intentionally belong to the 3D scene, as permitted by the house surface brief. Temporary review modules/routes and measurement hooks were archived outside shipped source.
