# Cinematic entrance — current production

The new take is sixteen seconds at 60 fps. The homepage plays video and never initializes the 3D renderer. The authored house is rendered offline in a dedicated Three.js film profile; this production uses raster PBR with HDR environment lighting, depth-derived GTAO and shadow maps, not Blender/Cycles or path tracing.

LOTHUUS occupies roughly 74% of the desktop opening and 82% of the portrait opening. The camera frames the angular bounds of the full word, keeping the real O counter on the later travel axis. The Manrope heavy LO/light THUUS outlines have 64 curve segments, 620 font units of extrusion and eight bevel segments. Satin physical materials, self-shadow, a directional key and cool rim light make the letter volume readable. The optical lettering target has 4× MSAA; defocus preserves the sharp house.

The sixteen-second camera uses quintic Hermite timing with shared velocity and acceleration at joins, plus C2 yaw and height/pitch transitions. It holds the complete brand first, turns toward the O, descends once toward the doorway and settles before crossing. The same pure functions drive the recorded camera and the lightweight live collection projection.

Both compositions use full-quality model/texture sources, 8192px sun shadows, 512px local reflection capture and per-frame contact occlusion derived from the actual scene depth. Wind has independent per-plant phase and an exact seconds-based clock. Wind shadows update at each recorded frame. AO does not swap away the scene depth needed by the lettering and the door aperture. The reflection probe captures the authored environment at setup; it is not a ray-traced or per-frame reflection simulation.

Desktop is rendered at 2880 × 1800 and filtered to a 1920 × 1200 delivery. Portrait is rendered at 1080 × 2340 and filtered to 720 × 1560. The scene and lettering use 4× MSAA before the spatial downsample. There are 960 encoded frames; frame 960 is the exact endpoint reference. Narrow desktop windows also select the portrait composition to preserve the full title.

The alpha aperture exposes the current live DOM collection. Product photos are never baked into the movie. `requestVideoFrameCallback` follows presented frames. Skip, pause/resume, hidden-tab suspension, retry, autoplay rejection and reduced motion keep their existing behavior. Apple browsers use HEVC-alpha `.mov`; other browsers use VP9-alpha `.webm`.

## Reproduce

1. Start the development server on `127.0.0.1:3001`, or set `INTRO_RENDER_ORIGIN`. The render route and frame endpoint are development-only.
2. Run `PLAYWRIGHT_PATH=/absolute/path/to/playwright node scripts/render-intro-video.mjs`. `CHROME_PATH` can select another Chrome executable. GPU capture runs sequentially for desktop and mobile. The automated driver serves immutable local house assets and writes filtered frames directly through Playwright routing; manual browser capture uses the development frame endpoint. The frame endpoint writes filtered RGBA PNGs under `os.tmpdir()/lothuus-cinematic-render/{desktop,mobile}`.
3. On a connection interruption, the driver retries the affected batch. To restart the driver, add `--resume`; the scene signature must match. Avoid changing source during capture. `render.json` records provenance, source hashes, timings and sampled projections. Batches can be rerendered deterministically without changing wind phase.
4. Run `FFMPEG_PATH=/absolute/path/to/ffmpeg npm run house:encode-video`. The encoder requires a complete, matching capture and validates all 960 frames per composition. It produces all four files in staging before installing them in `public/house/video`. `sources.json` records the real renderer, dimensions, source hashes and bytes.
5. Verify source and compressed letter contours, the opening, full door coverage and the final live collection alignment. Check pause/resume, skip, reduced motion, autoplay rejection and errors. Run relevant tests, typecheck and production build. Confirm HEVC alpha using Apple's decoder and WebM alpha using a VP9 alpha-capable decoder/browser.

The original fourteen-second videos are preserved locally in `/tmp/lothuus-video-before-cinematic` as comparison material. See `intro-cinematic-render-plan.md` for the requested direction and its original offline-render alternatives.

## Verification of this export

The complete 211-test suite, TypeScript check and optimized production build pass. The final files were exercised on the local production page at 1440 × 900 and an emulated 390 × 844 phone viewport. Both report 16-second playback at the expected delivery dimensions. Pause/resume, desktop natural completion, mobile skip, the live collection aperture and exact untransformed arrival were checked without page errors. The homepage created zero WebGL contexts. Reduced motion requested no video and exposed the collection directly. Native Apple AVFoundation decoding confirmed transparent aperture pixels and opaque facade/door pixels in both HEVC-alpha files. Render source hashes match the final manifest. Physical iPhone playback has not been tested. Captures and a machine-readable verification report are in `artifacts/intro-cinematic/`.
