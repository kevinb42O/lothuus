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
