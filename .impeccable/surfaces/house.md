# House exterior viewer

MODE: Experience.
PRIMARY TARGET: src/app/huis/page.tsx
RELATED TARGETS: src/components/house-explorer.tsx, src/components/house-explorer.css, src/components/house-scene.ts, src/components/house-architecture.ts, src/components/house-landscape.ts

THESIS: Reconstruct the visible LOTHUUS exterior and its immediate street/planting context as actual, detailed 3D geometry, using the supplied color photograph solely as visual reference.
OWN-WORLD: Inherit the existing LOTHUUS paper/charcoal/raspberry interface, Manrope typography, square framing and fine rules. Architectural and plant colors belong to the physical scene, not to new interface tokens.
STORY: Recognize the house; explore genuine spatial depth; inspect masonry, tiles, glazing, door, balcony, paving and planting at close range.
FIRST VIEWPORT: Restrained existing wordmark and return link, the house heading, a large live 3D scene and simple controls. Default view follows the reference camera. A dedicated /huis route and the home-page house section share the viewer.
FORM: User explicitly requested a much more detailed version of the original geometric model. The photograph is reference only. Do not replace the model with photo projection, a depth-warped photo, image-based parallax, a generated render or a photographic placeholder. Author the architecture and street as solids; use real 3D vegetation, independently lit PBR surfaces, HDR lighting/sky, local reflections, shadowing and restrained plant shaders.

IMPLEMENTATION: Individual facade bricks and curved roof tiles, actual window openings and layered profiles, separate panes/curtains, detailed door and hardware, balcony scrollwork, street pavers/kerbs, continuous world-scale paving and gardens blended into ground-projected HDR surroundings, estimated neighbouring brick volume and garden wall/hedge, raised beds, instanced boxwood and broadleaf canopy geometry, sourced 3D botanical models. Static solids are indexed and merged by material, with repeated box geometries reused during construction; repetition is instanced. Street/leaf instances and scanned foliage use spatial batches for culling without removing triangles. Identical tree textures share local content-addressed JPEGs and source materials. GTAO reuses its result until camera/viewport changes; wind-state changes invalidate sun shadows, while camera-only movement reuses them. Performance evidence lives in docs/house-performance.md. Compact screens use reduced tree/leaf detail. Reduced motion disables wind; hidden/offscreen scenes stop rendering. Zoom, preset views, drag orbit, wind and fullscreen are available.

TRUTH: Dimensions, non-visible elevations and exact tree species remain estimated. Sources and rendering boundaries are recorded in public/house/SOURCES-3D.md. Preserve the original house photographs in the existing editorial section; the WebGL renderer never loads or projects them.
