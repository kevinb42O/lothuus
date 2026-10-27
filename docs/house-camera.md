# Photographic house camera

The house viewer uses an eye-level camera with vertical lens rise, rather than raising and tilting the camera toward the upper facade. The main front pose is at 1.78 m height and z=22.2 m; the facade is around z=4 m. The closer front and angled compositions follow the user's feedback. The base vertical field of view is 36 degrees, fitted to the viewport; this is not a fixed 40 mm lens on every aspect ratio.

`house-camera.ts` owns the camera rig. Exact critically damped springs carry position, target and vertical framing through interrupted preset changes. Zoom buttons dolly the camera with the same rig. Naar binnen starts at the current camera pose and runs a single 14-second entrance take: six seconds to align with the doorway, four seconds to approach while the door opens in response to camera proximity, then four seconds to cross the threshold. The camera remains at eye level and rises slightly over the steps. The entire metal-and-glass door rotates inward on its left hinge, including the upper ornamental glazing and all ironwork. Only the stone surround, bell and threshold stay fixed. The scene fades into darkness at the threshold; no interior is added. Pause preserves progress, replay starts a fresh take from the front view, and dragging or choosing a preset cancels it. It starts automatically unless reduced motion is requested; that preference uses an immediate entrance outcome on explicit activation. Hidden/offscreen scenes do not advance camera time. Door movement invalidates cached AO and sun shadows; static architecture remains merged by material, separately from the moving leaf.

The surrounding photo now occupies a fixed distant world plane, with mirrored horizontal extension to avoid an exposed side edge in angled views. Nearby modeled street, planting and architecture provide actual depth parallax. Distant scenery is still an approximate photographic backdrop, not a complete reconstructed neighborhood.

The output adds only subtle optical edge falloff. **There is no motion blur, depth-of-field blur, temporal accumulation or softening filter**, including during camera travel and zoom. This follows the user's explicit preference for a sharp image. ACES exposure and environment intensity are slightly reduced. Desktop HDR targets use four MSAA samples to smooth geometric edges; texture resolution and model geometry remain unchanged.

Desktop animation permits up to 60 fps and compact devices up to 30 fps. These are limits, not achieved frame rates: the detailed scene remains GPU intensive. The earlier performance document records historical measurements, not a benchmark of this camera revision.

Validation: camera tests cover refresh-rate independence, parallel facade verticals and inverse projection, retargeting, pause/resume, and accumulated dolly with distance bounds. The full project test suite, TypeScript and production build are checked separately. Browser inspection verifies front/angled framing and film/preset controls; no WebGL errors were observed during those checks.


## Homepage scroll entrance

The homepage now uses the actual 3D house as its hero. `house-entry.ts` defines a continuous reversible path from z=23.4 to z=-1; a single critically damped progress spring in the camera rig tracks native scroll across 2.4 viewport heights. Door angle, lens framing and the reveal all sample that same progress, so reversing scroll reverses the complete sequence. The door begins opening at z=10.8 and is fully open at z=7.5. The collection appears as the camera reaches the doorway; the explorer's dark ending is disabled in the hero. No interior or duplicate product grid is created.

The existing collection remains the live world behind the hero during the native sticky entrance and continues in normal flow afterward. Fast flings settle at the boundary, collection links reach the end of the entrance, and the keyboard skip link releases/focuses the actual collection. Reduced motion keeps a static, unpinned house above the collection. The navigation header retains the brand; the model has no logo or invitation overlay and fills the full desktop browser width. Exterior glazing retains its authored tint, procedural privacy textures and local reflections, with screen-space refraction disabled to prevent black window panes and missing door-glass shading in the cached multipass renderer. The separate embedded explorer is replaced by a link to /huis to avoid building a second copy of the scene on the same page.

Hero rendering uses a bounded DPR (1 on compact screens, up to 1.25 on desktop), physical materials and sun shadows, with the extra GTAO geometry pass disabled. Wind and autoplay are off; rendering stops when the spring rests and while hidden/offscreen. The full explorer keeps its own AO and quality settings. These are budgets, not an achieved-frame-rate claim.

The accepted entrance is prebuilt with `npx tsx scripts/bake-house-entrance.ts` into `public/house/models/entrance.json.gz`. This stores the exact indexed geometry and procedural textures after material batching, so a visitor does not need to triangulate the refined contours. The authored builder is the fallback. `house-entrance-cache.test.ts` checks its source digest against the current door/ornament/bell files and verifies the loaded hinge clears the camera path.


## Live collection through the doorway

The hero now cuts a transparent opening into the rendered scene as soon as the door moves, so the actual DOM collection behind the canvas is visible through the entrance. It no longer presents the modeled interior and then fades the entire house away. The entrance plane is tested in world space against the main scene depth, preserving the stone reveal and threshold. A separate coverage render of just the complete moving door preserves its ironwork and privacy glazing even after it swings behind the entrance plane. Both passes use the same camera, projection and door transform. The canvas/output retain alpha; the stage background becomes transparent after loading. The single product grid remains aligned with the viewport during entry and resumes normal flow afterward.

The standalone /huis explorer retains its existing opaque scene. The hero's extra coverage pass renders only the door, not a second copy of the house or landscape.


The live collection occupies a separate virtual plane at z=-6, well beyond the inward door swing. The camera continues past the threshold to z=-1. Its actual projection drives the DOM grid's scale and screen position: the products remain visibly distant when the door opens, then grow toward their normal size as the visitor approaches. At the final pose the grid is exactly at its normal scale and position, and its transform is removed so native sticky controls work normally. This is the same live grid, not a duplicate or a screenshot.


The hero entrance begins directly in front of the doorway at x=0, z=23.4 m and an elevated 3.6 m eye position. The closer starting distance follows the supplied facade reference, with viewport-adaptive framing. A continuous straight approach descends smoothly to walking height before the door opens. The same reversible progress spring drives the entire shot; there are no camera cuts or separate timed phases. The complete opening door and distant live collection remain unchanged.


## Photo wall coverage during entry

The doorway no longer exposes the scaled page's blank margins, heading or toolbar. A photo-only atlas is drawn from the actual mosaic's current images using the same centered crops, tile size, gutters and origin. It repeats across a viewport-sized layer behind the transparent 3D canvas and follows the same collection projection. This extends the distant photo wall beyond the live page bounds without building another interactive grid or rendering oversized DOM layers. At arrival the atlas dissolves into the geometrically aligned live mosaic; collection chrome appears only over the final part of the approach, after the doorway has been crossed. The layer is decorative, inert and hidden from assistive technology. Resize and category changes rebuild the atlas; stale jobs and old blob URLs are discarded.


AUTOMATIC ENTRANCE — supersedes the scroll-driven homepage journey: Once the scene has rendered, the camera starts immediately while the white surface dissolves over 2.4 seconds. The 10-second take follows the existing lettering, focus, tilt, opening door and projected collection path. A continuous timing curve starts moving immediately, preserves a readable facade approach and accelerates through the open door. The door is fully open around 7.6 seconds, leaving about 2.4 seconds to reach the live grid. Only the final half-second brakes to zero velocity; position and velocity stay continuous at the join. There is no additional delay before movement. The page itself stays at scrollY=0; no visitor scroll input or programmatic document scrolling drives the take. At arrival the stage collapses and the same live collection returns to ordinary flow at its existing screen coordinates, with header space already reserved. Small Pause/Continue and Skip controls are available; hidden tabs pause the clock without skipping ahead, and a manual pause persists. Reduced motion keeps the static house and ordinary collection, without autoplay. ScrollTrigger no longer drives the homepage hero. Immediate camera samples retain the static shadow cache until the door actually changes angle.


## World-space homepage passage — 27 October 2026

The current fourteen-second take replaces the earlier lateral approach, screen-space SVG flight and whole-canvas focus effect. `/huis` retains its separate fourteen-second explorer film.

The camera travels on the doorway axis, with no horizontal sweep. The initial pose is (0, 3.6, 23.4); it passes through the actual O counter at (0, 3.6, 18), then settles toward walking height and the door. `houseEntryFraming` fits a fixed 40–50 degree viewport lens and derives the initial yaw toward the full wordmark. The yaw settles before the counter crossing; restrained positive and negative pitch guide attention toward the lettering and then entrance. Both rotations settle before the doorway. The live collection still reaches exact unit scale at z=-1.

`buildEntryLettering` converts the existing Manrope outlines to opaque geometry with a small bevel and roughly centimetre-scale thickness. `scripts/build-entrance-wordmark.py` regenerates these outlines from the shipped font. The world transform changes only for viewport fitting, never to chase screen centre. The original loading SVG remains static and retires over 300 ms while the white loading surface dissolves over 1.1 seconds.

The house stays at native resolution and remains sharp throughout. `houseEntryFocus` permits defocus only within 1.1 m of the letter plane, increasing continuously until passage. Review explicitly rejected an initial house blur followed by another foreground blur. There is no reverse focus pulse or opacity shortcut. `HouseEntryFocusPass` renders just the small lettering layer with the same camera; its materials compare against the existing house depth so foreground occlusion remains correct. A cropped overscan projection is equivalent to the house camera within the viewport. Two dense Gaussian passes filter linear premultiplied colour and coverage together, avoiding sharp cutouts, dark fringes and sparse-sampling ghosts. Blurred targets use half resolution; the sharp lettering uses its full-resolution source. No second render of the house geometry is added. Focus targets, lettering geometry and the scene are released on arrival.

The development-only `/intro-study` page isolates the first 5.8 seconds with normal/quarter-speed replay, a scrubber and five composition stops. It uses the actual homepage camera and renderer; production returns a 404. Reduced motion skips the moving lettering and leaves the static house and normal collection accessible.

Tests verify monotonic camera timing and rest at arrival; pitch/yaw alignment; actual O clearance and opaque geometry; focus staying zero at a distance and increasing only once; overscan projection equivalence; full doorway framing; and exact collection projection. Browser review checks the real shot on desktop and phone viewport sizes. Viewport emulation does not establish physical iPhone performance.

## Homepage video, 27 October 2026

The homepage now uses a recorded version of this camera take instead of initializing the live scene. Its transparent opening preserves the live collection. `/huis` and the development study still use the original rig. See [intro-video.md](intro-video.md) for offline capture, codecs, synchronization and regeneration.


## Cinematic recorded entrance, 27 October 2026

The homepage now records a sixteen-second take with a much larger centred sculptural wordmark. `houseEntryFraming` fits the angular bounds of the full brand; `houseEntryYaw` is shared by the 3D rig and the lightweight video projection. Camera timing uses quintic Hermite segments with shared speed and acceleration. The camera stays level while reading/passing the letters, then descends once from 3.6 m to 2.03 m, with a single gentle downward pitch that settles before the doorway. The exact endpoint is unchanged. Capture takes both progress and real elapsed seconds, so wind does not follow camera acceleration. See `intro-video.md` for the film profile and regeneration procedure.
