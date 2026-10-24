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
