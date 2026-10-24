# Mobile memory correction — 24 October 2026

The iPhone 13 mini still reloads during entry after the lettering scale limit
and full-screen blur removal. Neither earlier change confirmed the cause.
There is no physical-device crash trace available in this environment.

Phones now load separately generated 512px material and botanical image sources,
instead of decoding the desktop 1024/2048px sources and resizing them afterwards.
The mobile sun shadow is 1024 square instead of 2048 square. Coarse pointers
select the mobile renderer in landscape as well. Desktop assets are unchanged.
The hero no longer constructs its disabled GTAO pass. The reflection cube target
and HDR source GPU texture are released after their prefiltered maps are ready.
The scene geometry, camera choreography and portal remain intact.

Regenerate the committed mobile images with `node scripts/prepare-house-mobile.mjs`.
Across all generated images, RGBA source storage is 162.0 → 28.5 MiB. This includes
unused image variants and excludes mipmaps, duplicate GPU textures, browser copies
and driver overhead; it is not measured scene memory or a crash diagnosis.

Validation: all 28 mobile material/GLB image references exist and fit 512px;
89 tests, typecheck and production build pass. Local browser control is disabled.
Real-device confirmation and, if still failing, a Safari/WebKit crash trace are
still required to establish the cause and resolution.

## iOS containment after continued full-page reloads

The user confirms the whole page still reloads on an iPhone 13 mini. iOS now
uses a photo entrance and normal-flow collection. Device guards run before the
dynamic Three import, photo-atlas observer and GSAP camera setup. The photo is
a 960px WebP derived from the existing restored house image, without a new
visual source. iPad desktop user agents with touch also use this path; desktop
Macs and Windows keep the live entrance. This is a temporary feature fallback,
not evidence that the underlying live 3D crash is fixed. Browser control remains
disabled, so no physical-device or browser runtime validation is claimed.

## Collection correction after the photo entrance also reloads

The user confirms testing `https://www.lothuus.be` with the photo entrance visible,
and still seeing full-page reloads. The homepage failure therefore occurs without
initializing the live 3D scene. The public catalogue endpoint returns the supplied
195-object collection. The iOS fallback remains during this isolated correction.

The mosaic now uses one IntersectionObserver to mount image elements only within
240px of the viewport, and removes offscreen image elements again. Unlike native
lazy loading alone, scrolling does not leave every visited image mounted. Tile
geometry and buttons remain present. Responsive image sizes follow actual tile
widths in both the grid and filter preloading. Scroll-time `will-change` applies
only to tiles with mounted photographs, instead of promoting the whole collection.

This fixes concrete unbounded image retention/layer-promotion behavior, but no
device memory trace or crash reproduction is available to prove causality.

## Native iOS grid after reloads when scrolling below the collection

The next user report locates the reload when scrolling below the grid. iOS now
selects `NativeMosaic` before either grid mounts. It uses a regular CSS grid with
square tiles in document flow. It never mounts the desktop Motion tiles, animated
container height, filter snapshots, hover expansion or elastic scroll listener.
Category filters update the ordinary grid; photos retain the 240px visibility
window, and product details, selection and keyboard product navigation remain.
Desktop continues to use `AnimatedMosaic`.

A native-render regression checks all 195 product controls, saved state and the
absence of tile transforms/canvas/startup image requests. The full suite,
typecheck and production build pass. Physical iPhone confirmation remains pending.

## Confirmed native-grid result and restored mobile entrance

The user confirms the native-grid deployment stops the iPhone crash. At their
request, the live 3D opener and 7px-to-sharp focus effect are restored on mobile.
The iOS native grid remains; the device policy now explicitly names that choice
`needsNativeGrid`, independently of the opener.

The entrance atlas accepts both grid variants, with native tiles exposing their
actual row/column and category layout metadata. At automatic arrival, the scene
effect disposes the renderer and the atlas effect disconnects its observers and
revokes its image URL. Collection scrolling therefore retains neither the hero's
GPU resources nor its photo-atlas rebuilding. Reduced-motion behavior remains.

The restored opener uses the shared 10-second timing, including its accelerated
doorway approach and short final brake, on mobile as well as desktop.

## Stable portal photographs and gentler phone focus

During the pinned flight, the photo visibility hook keeps exactly the first
eight grid rows mounted (24 photos in the three-column phone layout), independent
of camera projection. At arrival it resumes the 240px viewport window. This avoids
image mounting/unmounting and atlas reconstruction as the transformed grid crosses
IntersectionObserver bounds. New atlas blobs decode before replacing the painted
CSS background. The mobile focus effect is reduced from 7px/3.5% overscan to
3px/1.5%; desktop remains unchanged. The ten-second timing and native iOS grid stay.

95 tests, typecheck and production build pass; device visual verification remains
with the user because browser control is unavailable in this environment.
