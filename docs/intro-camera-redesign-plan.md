# Intro camera redesign — proposed, 27 October 2026

Status: implemented, with review corrections below. The earlier storyboard remains as the planning record.

## Review corrections incorporated

The house must remain sharp throughout: review rejected an initial house blur followed by a second letter blur. Only the approaching letters defocus, starting within 1.1 m of their plane and increasing monotonically until passage. The world-space geometry, forward camera axis, pitch/yaw, fourteen-second timing and development motion study are implemented. The lettering is rendered as a small independent layer with the house camera and depth occlusion; Gaussian colour/coverage filtering replaces sparse full-scene depth-of-field gathering. See `docs/house-camera.md` for the current implementation and constraints.

## What the current version gets wrong

The lettering flight is essential to LOTHUUS and must stay. The seven-second timing was rejected as rushed; fourteen seconds is the current working duration.

The present implementation still treats lettering as a separate screen-space composition. `HouseEntryWordmark` changes an SVG group scale and shifts its origin toward the O. It does not use the house camera's full world/view/projection matrices. The house moves laterally by 2.4 metres, while pitch is explicitly zero. Focus is a CSS blur of the entire house canvas; the lettering remains perfectly sharp, including at the lens. These are separate visual tricks rather than a coherent filmed scene. Removing the opacity fade solved one symptom but did not produce convincing depth.

The existing tests encode several now-rejected choices, including a permanently level gaze. Their passing result verifies those choices mathematically; it does not establish the quality of the shot.

## Direction

One restrained forward camera take through the LOTHUUS lettering, into the real opening door, and onto the existing live collection. The lettering belongs to the same world as the architecture. Camera orientation, perspective, focus and speed describe one physical passage.

- Remove the lateral sweep. Start from a doorway-aligned travel axis; pitch and yaw direct attention without a conspicuous side-to-side move.
- Keep the brand readable before approach. A restrained yaw follows the whole wordmark toward the O as the camera advances; the graphic itself never slides to chase screen centre.
- Solve lettering position and aperture clearance with the camera poses. Do not add rotation to the old screen-space composition. The camera must physically fit through the counter and settle onto the doorway axis.
- Let slight pitch express a change of attention from lettering to entrance. Settle before the threshold. Avoid a repeated up/down nod, roll, orbit, bounce or a diving camera.
- Keep the existing Manrope outlines, heavy LO/light THUUS and restrained white finish. Test only enough extrusion to show a near edge; avoid a chunky or glossy 3D logo.
- Use a fixed lens through the take, with viewport-specific composition. Preserve comfortable pace rather than forcing beat timings to a predetermined duration.

## Shot and focus storyboard

Times are a first fourteen-second working layout, to be judged in motion rather than treated as final values.

| Beat | Camera and composition | Focus and depth |
| --- | --- | --- |
| Recognition, roughly 0–2.5 s | Complete wordmark readable; house already legible as the destination. Forward movement starts gently. | Lettering is sharp. The more distant facade is softly separated. |
| Letter passage, roughly 2.5–5.5 s | Forward travel with restrained yaw toward the real O counter. The letter plane changes perspective relative to the facade. Slow enough to perceive the passage without stopping in front of it. | Focus transfers continuously from lettering toward the doorway. Near letter edges become progressively defocused and expand past the lens; the house resolves through the opening. No premature opacity fade, sharp-edged cutout or clipping pop. |
| Approach, roughly 5.5–10 s | A gentle change in pitch directs the gaze toward the entrance, then settles. Travel remains aligned; the opening door gets a readable reveal. | The doorway carries focus. Lettering is behind the camera, not a surviving overlay. |
| Entry and arrival, roughly 10–14 s | Carry forward through the opening, then brake naturally into the existing collection. | Focus resolves before the transparent portal exposes DOM products. End at the exact untransformed collection geometry. |

## Technical approach to prototype

1. Convert the already-extracted Manrope outline paths into world-space geometry, including the O counter, and place them in the house scene. Use one camera and its actual projection for both. In the installed Three.js version, prefer `ShapePath.toShapes()`; `SVGLoader.createShapes()` is deprecated.
2. Define position, orientation and focus distance together. Use continuous angular and translational velocity. Fix the aperture in world space and derive the required yaw/clearance rather than animating an arbitrary screen offset. Adjust pitch through a camera target or orientation curve with no roll.
3. Replace the whole-canvas CSS focus trick for this phase with depth-aware optical defocus. Foreground letters must be able to blur independently of the background. Their defocus must spread beyond the sharp silhouette, with correct coverage around the O; blurring a pre-cut mask is insufficient.
4. Investigate reusing the existing color/depth scene target. Depth resolve is currently enabled only while the portal is open, so a focus pass also needs valid depth during the lettering phase. The installed stock `BokehPass` performs another full scene geometry render for depth; do not add it blindly to this already-heavy scene. Start with a small, bounded focus pipeline and measure it.
5. End the defocus treatment before the door reveals the actual DOM collection. Preserve the door coverage mask, exact product alignment, one live grid, skip, pause, hidden-tab suspension, reduced motion and scene disposal.
6. Keep the loading identity matched to the scene lettering at handoff. No double logo, sudden change of weight, outline, brightness flash or visible jump.

A slightly extruded wordmark is a prototype option, not a prerequisite for success. Shared projection and a convincing focus transfer are the first requirements. Depth of field is also an artistic choice: use an aperture that gives believable separation and readability rather than claiming one uniquely realistic amount of blur.

## Delivery and review order

First build a separate development motion study of only the first five to six seconds. Use the real font geometry, house composition and proposed focus; omit unrelated polish. Preserve the current implementation for comparison.

Review that study at normal speed and quarter speed on desktop and portrait layouts. Compare it with the original lettering flight and the current version. The review must show movement; still images cannot establish angular continuity, focus timing or the sense of crossing a plane.

Integrate with the full fourteen-second take only after the lettering passage works visually. Then verify the door/collection handoff and profile the final renderer on desktop and a real iPhone. Viewport emulation checks composition, not device performance.

## Acceptance criteria

- LOTHUUS is readable before it becomes a passage.
- The camera advances with intentional pitch/yaw, without a lateral sweep or repetitive nodding.
- The logo's perspective changes consistently with the facade because they share a camera.
- Near letter edges visibly lose focus as the house gains focus, without an abrupt blur change or focus pumping.
- There is no opacity shortcut, O recentering trick, near-plane pop, solid-white flash or background leakage through foreground blur.
- Crossing feels continuous, with enough time to perceive depth and no sudden acceleration after the letters.
- The doorway has a deliberate reveal and the live collection arrives without a scale, focus or position jump.
- Reduced motion retains a direct static route to the collection, and controls remain usable.
- Review frame-time and memory against the current baseline; reduce focus cost before sacrificing the shot's continuity. Do not claim achieved performance without measurement.
