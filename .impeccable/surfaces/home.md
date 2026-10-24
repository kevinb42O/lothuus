# Home / living archive

MODE: Experience.
FORM: seed:19233368784e273a. User-pinned contemporary European archive; light paper, neutral charcoal, raspberry actions and petrol selection feedback, oversize Swiss lettering and fine editorial contrast. User explicitly requested independent creative decisions and immediate implementation. Code-led implementation follows the supplied reference world. No generated design comp is an approval reference.

FIRST VIEWPORT: A clear LOTHUUS wordmark, restrained navigation, oversized two-line Dutch introduction, and the beginning of a dense object wall. Objects remain the principal visual material. Light paper, clean rules, intentionally contrasting density and whitespace.

SIGNATURE: 195 actual LOTHUUS product groups with 808 photographs. Container-responsive 8/6/4/3 columns. One active product grows into a rectangular footprint matching its photograph’s natural aspect ratio, with a separate caption. Portraits start at two columns wide; landscape and square images at three. Thumbnails fill their square cells with a centre crop. Every other product compacts around the actual rectangle, with columns resuming directly below its caption. All positions and dimensions animate simultaneously through one interruptible spring, with no staged movement queue. Real pointer movement controls hover; layout-generated enter events do not. Collection scroll adds Codrops variant 01 outer-column lag: symmetric native-scroll translation, with faster central columns and more delayed outer columns. Offsets return to zero at rest, compact devices have a smaller amplitude, and reduced motion disables the lag. Hover resets on scroll start and remains suspended during appreciable displacement. Touch opens details directly. Keyboard navigation, reduced motion, filtering, galleries and saved selections remain.

CONTENT: Actual supplied product photographs grouped by source folder and material. Neutral import titles; no invented prices or product facts. House photographs retain restored, uncropped facades.


REVIEW VIEWPORTS: 1440 desktop full page; 390 phone viewport and active/detail/empty states; 768 tablet viewport; 311 in-app viewport. Phone full-page capture from browser tooling was invalid (blank after introduction); viewport captures are the evidence instead.

FILTERING: Category selection opens a roomier 6/4/3/2-column composition with 14/10px gutters. Keep the current collection visible until arriving photos decode; retain motion identity only for photographs visible in both compositions. Shared photos move together over 560ms, outgoing photos fade over 160ms and new photos appear 18px from their destination. Never animate offscreen objects across the viewport. Pause hover enlargement and column lag during filtering; respect reduced motion and rapidly superseded requests. All filters retain their category counts.

CATEGORY SWITCHES: Switching directly between categories uses a single 680ms directional reveal instead of independent tile fades. The previously painted viewport stays opaque above the decoded, stationary new collection until one continuous clipping edge passes over it. Direction follows filter order. Captured walls retain photo positions, captions, saved markers and any partly revealed previous wall, so rapid interruptions continue from the visible composition. Decorative snapshots are inert and hidden from assistive technology; product interaction resumes after the reveal. Reduced motion replaces the wall immediately without the wipe.

## Direction contract — doorkijk hero, 24 October 2026
THESIS: Enter an approachable house of discoveries through a photographic doorway, then continue into the actual collection in one native scroll.
OWN-WORLD: Existing paper, charcoal, raspberry and petrol; square architectural photography, the preserved object-letter VINTAGE image and existing Manrope/editorial typography.
STORY: Recognize vintage immediately, feel invited, explore the collection or jump directly to it. The generated interior is an imagined atmosphere; the real house remains documented below.
FIRST VIEWPORT: Large VINTAGE artwork in a light left column, an invitation and collection link below; a deep, daylight doorway occupies the right half. Phone stacks the artwork and a generous doorway with the action visible.
FORM: User-approved local extension, code-led; inherit seed:19233368784e273a. One reversible scroll-linked photographic expansion, followed by the grid rising through a paper transition. No scroll interception. Reduced motion keeps the composition static and removes the extended travelned travel.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Superseding direction contract — transparent portal v2
THESIS: The user rejected the earlier photo zoom. Match https://codepen.io/GreenSock/full/YzbPYMx structurally: opaque photographic foreground with an actual alpha aperture; a single live collection behind it; scroll through the hole.
OWN-WORLD: Pale tactile sculptural wall, organic oval ceramic rim, cobalt vintage objects, preserved object-letter VINTAGE foreground artwork. Full viewport scene; overlay navigation.
STORY: See real products through the opening from arrival, approach the hole, pass its rim, then explore those same products with no duplicated grid or gradient handoff.
FIRST VIEWPORT: Full photographic wall, oval aperture right of center, VINTAGE left. Mobile uses a separately authored portrait plate, artwork above the hole.
FORM: Explicit user-approved local replacement, code-led; GSAP ScrollTrigger pin and scrub, foreground scales about the measured aperture, grid has restrained independent depth. Endpoint derived from corner coverage. Reduced motion uses unpinned static foreground then collection.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Superseding direction contract — opposite-house window
THESIS: User explicitly requests the real existing colour house photograph as hero, seen through a generated transparent window photographed from inside the house across the street. The oval and initial product-grid view are rejected.
OWN-WORLD: Actual restored LOTHUUS facade as independent background; imagined pale grey-blue interior, dark timber window, linen curtains and understated vintage objects. Preserve original VINTAGE image on the panel below the sill.
STORY: Look from across the street at the real house, scroll through the window, see the full house photograph, then reach the collection below it.
FIRST VIEWPORT: Large clear rectangular window frames the actual facade; VINTAGE and invitation below the sill, restrained header above. Phone crops the same broad window around the real front door.
FORM: User-directed local replacement, code-led; inherit seed:19233368784e273a. GSAP foreground expansion around measured rectangular alpha aperture, independent slow house-photo scale. Reduced motion scrolls the static layered scene normally.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance


## Superseding direction contract — real 3D house entrance
THESIS: The actual authored 3D house replaces the rejected window/photo hero. Native scroll moves an eye-level camera through its opening front door directly into the one existing live product grid. No interior is added.
FORM: Full viewport 3D scene above the same collection, with a 2.4-viewport native sticky stage, tracked by GSAP. One critically damped progress spring drives camera, early-opening door and threshold reveal together, including reverse scroll. There is no autoplay, time-based film or orbit control in the hero. The standalone /huis viewer retains those controls. Reduced motion removes the extended travel and keeps a static house above the normal collection. Collection links and keyboard skip access reach the actual grid.
TRUTH: Hero loads the current accepted detailed iron-and-glass door from the shared builder's baked geometry, retaining its hinge and all refined contours. The entire metal-and-glass door opens, including the upper ornamented pane; only masonry, bell and threshold remain fixed. A source digest test prevents shipping a stale entrance. Sun shadows and PBR materials remain; hero uses bounded pixel density and omits the additional AO geometry pass while preserving the authored geometry. The separate photographic house/history section remains below the collection. The house hero fills the full browser width, including screens wider than 1680px; the product grid retains its width limit. The logo/invitation overlay has been removed.


DOORWAY VIEW: The opening shows the actual live DOM grid immediately behind the moving door, rather than the modeled interior. A world-space aperture, scene depth and a door-only coverage render preserve the facade, stone threshold, full moving ironwork and privacy glass. Alpha grows with the projected opening; there is no whole-facade crossfade.


The hero entrance begins directly in front of the doorway at x=0, z=23.4 m and an elevated 3.6 m eye position. The closer starting distance follows the supplied facade reference, with viewport-adaptive framing. A continuous straight approach descends smoothly to walking height before the door opens. The same reversible progress spring drives the entire shot; there are no camera cuts or separate timed phases. The complete opening door and distant live collection remain unchanged.


PHOTO WALL COVERAGE: Fill the whole doorway with the actual product photography, including above and alongside the scaled live grid. A decorative repeating atlas of the mosaic's current images follows its exact pitch, origin and camera projection, then dissolves into the aligned live mosaic at arrival. Title/filters are hidden until the camera is inside. Avoid blank scaled-page margins or a miniature webpage floating in the doorway.


LOADING ENTRANCE: An opaque full-viewport paper surface covers the scene and collection from the server-rendered first view. Centred heavy-LO/light-THUUS lettering, the existing “Een huis voor cultuur en ontmoeting.” slogan and one 200px hairline are the entire loading identity. The bar follows actual initialization milestones, without a percentage counter. After the first complete WebGL frame and the final fill, the paper surface dissolves over 2400ms into the house; the header returns with it. Reduced motion switches directly. Collection/keyboard skip links dismiss the loader; a failed scene offers retry and collection access. The wordmark remains over the revealed house and becomes part of the scroll entrance.

The entrance always initializes at the facade, including reloads with a remembered scroll position or #collectie hash. Scroll is locked while loading. The live collection and decorative photo wall stay explicitly hidden until the rendered camera opens the door; reversing back before the opening hides them again. Explicit collection links remain available.


LETTERING FLIGHT — requested experiment: The white loading surface dissolves independently over 2.4 seconds; its slogan, hairline and skip label retire over 600ms. The same LOTHUUS lettering stays in place without a duplicate or a handoff. A virtual billboard at z=18 uses the existing camera distance and field of view to grow in perspective. It stays on the optical axis as the architectural lens descends, settles the original 36px upward offset onto the centre of the flight, and retires only at the plane crossing. Reverse scrolling restores the lettering. The grid remains hidden until the doorway opens. Reduced motion removes the lettering flight and slow dissolve.


LETTERING FLIGHT REFINEMENT: The white outline was rejected and removed; the charcoal letters retain their original clean edges. The camera briefly holds its starting elevation, tilts upward to 1.8 degrees toward the wordmark, then settles through a restrained 0.8-degree downward pitch and returns to level by 60% progress, before the doorway. The lettering centre aligns with the flight as the camera reaches its plane, rather than escaping toward the top of the viewport. The entrance remains driven by the same reversible progress spring.


FOCUS REFINEMENT: The house starts with a restrained 7px optical defocus, while LOTHUUS stays sharp and has no outline. Focus resolves continuously with the rendered camera progress, from 1.5% to 28% of the entrance: the facade comes into focus as the visitor approaches and passes the letters. A maximum 3.5% canvas overscan keeps blurred edges covered. Both filter and overscan are removed entirely at focus, before the door opens, preserving accurate portal alignment and avoiding a permanent filter layer. Reverse scroll restores defocus; reduced motion uses a sharp static house.


AUTOMATIC ENTRANCE — supersedes the scroll-driven homepage journey: Once the scene has rendered, the camera starts immediately while the white surface dissolves over 2.4 seconds. The 10-second take follows the existing lettering, focus, tilt, opening door and projected collection path. A continuous timing curve starts moving immediately, preserves a readable facade approach and accelerates through the open door. The door is fully open around 7.6 seconds, leaving about 2.4 seconds to reach the live grid. Only the final half-second brakes to zero velocity; position and velocity stay continuous at the join. There is no additional delay before movement. The page itself stays at scrollY=0; no visitor scroll input or programmatic document scrolling drives the take. At arrival the stage collapses and the same live collection returns to ordinary flow at its existing screen coordinates, with header space already reserved. The hero toggles playback on click/tap or keyboard activation, with a quiet centred pause glyph visible only while manually paused. No visible Pause/Continue button or instruction text is shown. A separate Skip link remains available; hidden tabs pause the clock without skipping ahead, and a manual pause persists. Reduced motion keeps the static house and ordinary collection, without autoplay. ScrollTrigger no longer drives the homepage hero. Immediate camera samples retain the static shadow cache until the door actually changes angle.


COMPACT COLLECTION NAVIGATION — 24 October 2026: At collection arrival, show only the heavy-LO/light-THUUS wordmark, category filters with counts, and the heart / Mijn selectie checkout entry in one sticky 76px desktop row. Remove the separate global navigation, editorial collection title, duplicate total and hover instruction. Products begin 12px below the rule. Remove the entrance world's old header reservation and section top padding so arrival has no empty header band. Phones use a compact logo/selection row and horizontally scrollable filter row; all labels, pressed states and selection functionality remain accessible. How-to information remains available below the collection.


GRID EDGE REFINEMENT — 24 October 2026: Only the photo grid breaks out of the page inset and maximum width. Keep a 12px viewport edge on desktop/tablet and 8px on phones. The navigation retains its existing inset and 1584px content cap. Container-relative sizing excludes the scrollbar and follows the live collection during the entrance.

The loading wordmark begins in charcoal and transitions to white over 1.6 seconds immediately when loading completes, alongside the dissolving paper and immediate camera departure. There is no outline.

IOS CRASH CONTAINMENT — 24 October 2026: iOS temporarily uses a 960px house photograph, existing slogan and collection link with normal document scrolling. No WebGL scene, entrance atlas or automatic camera initializes. Desktop keeps the live entrance. The live iPhone 3D crash is unresolved; this is a containment fallback after repeated full-page reloads on iPhone 13 mini.

COLLECTION IMAGE WINDOW — Full-page reloads persist with the photo entrance, so live 3D is not a necessary trigger. Mount product photos only within a 240px viewport margin and unmount them beyond it, keeping tile geometry and buttons. Image sizes follow the actual tile width; scroll-time `will-change` applies only to tiles with mounted photos. Keep the iOS photo fallback during device validation of this correction.

IOS NATIVE GRID — iOS now selects an ordinary CSS grid before mounting any animated tiles. No tile transforms, animated height, snapshot transitions or elastic scroll loop. Square photos, category filtering, hearts, direct product details, keyboard navigation and the image visibility window remain. Desktop retains its animated mosaic. Real iPhone verification is still required.

MOBILE OPENER RESTORED — User confirms the native grid fixes the crash. Restore the live 3D opener and focus blur on mobile, retaining reduced-motion behavior and the iOS native grid. Both grid variants supply the doorway atlas. Dispose the scene and release atlas observers/image on automatic arrival so collection scrolling is independent of hero resources.

MOBILE FOCUS / PORTAL STABILITY — Phone focus uses 3px blur and 1.5% overscan. Keep the first eight grid rows mounted throughout the flight so projected intersections cannot replace images/atlases. Resume ordinary viewport photo loading on arrival, and decode new atlas blobs before swapping backgrounds. Keep the ten-second timing and native iOS grid.
