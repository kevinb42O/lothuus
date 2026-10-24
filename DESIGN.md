---
name: LOTHUUS
description: A warm editorial archive for culture, encounter, and objects with a story.
colors:
  paper: "#fafaf7"
  ink: "#292c30"
  muted: "#62676b"
  line: "#d8dcda"
  tile: "#edf0ec"
  accent: "#b52f62"
  accent-soft: "#f8e8ee"
  on-accent: "#ffffff"
  saved-hover: "#10544f"
  saved-soft: "#e5f2ee"
  button-hover: "#94234e"
  saved: "#176b65"
  field-border: "#929c99"
  icon-hover: "#f5e3eb"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(70px, 8.3vw, 132px)"
    fontWeight: 420
    lineHeight: 0.99
    letterSpacing: "-0.04em"
  editorial-display:
    fontFamily: "DM Serif Display, serif"
    fontWeight: 400
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(32px, 3.6vw, 53px)"
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "18px"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Manrope, sans-serif"
    fontSize: "14px"
  label:
    fontFamily: "Manrope, sans-serif"
    fontSize: "11px"
rounded:
  square: "0px"
  circle: "50%"
spacing:
  archive-gap: "10px"
  archive-gap-mobile: "7px"
  page-desktop: "48px"
  page-tablet: "32px"
  page-mobile: "20px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "17px 20px"
    width: "100%"
  button-primary-hover:
    backgroundColor: "{colors.button-hover}"
  button-primary-saved:
    backgroundColor: "{colors.saved}"
  button-text:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    padding: "6px 0"
  button-icon:
    backgroundColor: "transparent"
    border: "none"
    textColor: "{colors.ink}"
    height: "38px"
    width: "38px"
  input:
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "12px"
    width: "100%"
  archive-tile:
    backgroundColor: "{colors.tile}"
    rounded: "{rounded.square}"
  dialog:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
---

# Design System: LOTHUUS

## Overview

**Creative North Star: "The Living Editorial Archive"**

A European decorative-arts archive translated into an interactive editorial wall. Light paper, charcoal lettering, fine rules, and object photography create a quiet cultural identity with a densely inhabited collection.

The typography pairs a precise sans serif with a restrained italic editorial voice. Surfaces stay flat; physical movement belongs to simultaneous enlargement and repacking of the collection. The heavy LO and fine THUUS lettering remain the identifying brand gesture.

**Key Characteristics:**
- Light paper and charcoal with raspberry actions, petrol selection feedback, and soft rose hover surfaces.
- Oversized sans serif headlines with italic editorial contrast.
- Square, flat surfaces, fine rules, and architectural whitespace.
- Object-led density with deliberate, accessible physical motion.

## Colors

A light, fresh palette pairs raspberry actions with petrol selection feedback; photographed objects retain their natural colours. The frontmatter records the normative recurring colors; isolated image-credit, footer, and photographic ground treatments remain local CSS values.

### Primary
- **Charcoal Ink** (`ink`): primary text and structural rules. The footer stays light.
- **Raspberry** (`accent`): primary actions, selected hearts and filters, focus outlines, caret, and interaction hints.
- **Petrol** (`saved`): saved-action states and selection feedback; pair with white text.

### Neutral
- **Light Paper** (`paper`): page, captions, dialogs, and text on ink.
- **Secondary Ink** (`muted`): supporting copy and metadata.
- **Archival Hairline** (`line`): dividers and structural boundaries.
- **Object Ground** (`tile`): archive tiles and selected-object thumbnails.
- **Field Border** (`field-border`): input outlines.
- **Icon Hover Ground** (`icon-hover`): quiet feedback for icon controls.

The primary action deepens to `button-hover` on hover; saved actions use `saved` as a fresh petrol status tone and `saved-hover` on hover.

**The Paper and Ink Rule.** Use light paper for reading and charcoal for primary content. Raspberry identifies action; petrol identifies saved feedback. Do not use brown interface colours.

## Typography

**Display Font:** self-hosted variable Manrope, with sans-serif fallback.
**Body Font:** Manrope, with sans-serif fallback.
**Editorial Font:** self-hosted DM Serif Display Italic, with serif fallback; use the actual italic face.

The pairing combines Swiss-inspired precision with a soft editorial counterpoint. The wordmark has heavy LO (850) and fine THUUS (300), both with -0.04em tracking. The closing statement also uses -0.04em tracking.

### Hierarchy
- **Display:** the frontmatter desktop role leads the introduction. At widths up to 1100px it becomes 8.2vw, then 9vw up to 800px. The mobile introduction uses clamp(43px, 13.9vw, 76px) and line-height 1 up to 540px.
- **Editorial display:** italic spans inherit display size and leading while changing family, weight, and tracking.
- **Headline:** the house heading uses the frontmatter responsive scale; dialog headings use 42–48px on desktop and 36–38px on phones.
- **Title:** expanded object names use the frontmatter title role, falling to 15px with line-height 1.05 on phones.
- **Body:** the global base is recorded in frontmatter. Reading copy is generally 12–13px with 1.9–1.95 leading, while secondary instructions are 11px. House paragraphs are constrained to 360px, or 340px on phones.
- **Label:** navigation and actions use 11–12px. Some archive metadata is currently 6–10px; see the uncanonized limitation below rather than treating that range as a reusable reading scale.

**The Two Voices Rule.** Use Manrope for structure and reading; use the editorial italic for a brief expressive counterpoint. Preserve heavy LO and fine THUUS.

## Layout

The page, header, and footer share a maximum width of 1680px. Outer spacing steps from the desktop token to tablet at 1100px, then mobile at 540px. Fine horizontal rules separate major bands; open editorial space contrasts with the tight object wall. The house section uses two equal columns on larger screens and stacks on phones.

The archive measures its container and uses 8 columns above 1150px, 6 above 800px, 4 above 500px, and 3 on narrower containers. Gutters are 10px, or 7px on phones. The active product uses its decoded photograph’s natural aspect ratio, plus an 84px caption. Portraits start at two columns wide; landscape and square photos at three. Photo height is limited to the available viewport height, preserving the ratio. Other products fill column intervals around the actual rectangle, including immediately below its caption; all positions, active dimensions and archive height animate simultaneously. Every product has a non-overlapping final position.

Viewport styles adapt at 1100px, 800px, and 540px, with an outer page frame above 1700px. Phone filters scroll horizontally, secondary navigation yields space, and detail panels stack image above copy. The filter toolbar sticks to the viewport top within the collection, on an opaque paper background with a fine bottom rule. Filter changes scroll to a separate natural-flow anchor so choosing a category from deep in the archive starts at its first objects.

## Elevation & Depth

Page content and archive tiles use tonal layering and fine rules without card shadows. Modal dialogs alone use an ambient shadow (`0 24px 90px #202a3033`), a dark translucent backdrop (`#202a30aa`), and 5px backdrop blur. Museum object photographs use saturation and multiply blending to integrate with the light grounds. The real house photographs retain their restored colours without a filter; small paper-ground captions sit outside each photograph.

**The Flat Archive Rule.** Keep page surfaces flat. Reserve ambient shadow and a blurred backdrop for modal separation.

## Shapes

Containers, fields, dialogs, and object tiles have square corners. Small status dots, saved markers, and the closing arrow use circles. One-pixel rules provide structure. Object images are contained within square tiles; the two actual house photographs retain their complete facades and natural image ratios. Use thin SVG strokes for directional and utility icons.

## Components

### Buttons

Filled actions are full-width raspberry bars with white text and the frontmatter padding. Hover deepens the ground; a saved action uses the saved tone. Text actions use an underline, small text, and a directional SVG with a subtle hover translation. Favourite hearts and dialog close controls are freestanding icons without a visible background or border, with circular 44px hit areas. Empty hearts use a crisp white under-stroke behind the charcoal outline for visibility over light and dark photography, without a button surface. The detail action “Voeg toe aan mijn selectie” and the photo heart share saved state; either action pulses the photo heart. Saved actions turn petrol and show a check; the selection link remains a separate text action. Hearts lift, enlarge and tilt slightly on hover; clicking gives a 280–380ms pulse and immediately updates the raspberry fill. Repeated clicks interrupt the pulse. Close icons rotate on hover and shrink into a 140ms dialog exit on click. The header selection heart has matching hover and press feedback. Reduced motion removes spatial feedback and closes immediately; colour and selection state remain visible. Other icon controls retain their tonal hover ground. All controls inherit the visible 2px accent outline, offset 5px.

### Inputs / Fields

Transparent, square fields have a one-pixel field border, 12px text, and the frontmatter padding. Labels sit above the field; focus uses the shared outline and the accent caret. Textareas resize vertically. Validation follows native required/email controls; no custom error or disabled palette is established.

### Navigation

Compact Manrope links sit in a horizontal row. A fine underline scales from the left on hover over 220ms. The collection link carries a raspberry dot. The selection action has a left hairline and tabular count. Secondary links hide progressively at tablet and phone widths, while the selection icon and count remain.

### Category Filters

Text-only category buttons have muted resting labels and raspberry hover/selected text. A one-pixel underline identifies `aria-pressed` selection; it is not a pill chip. Filters scroll on phones and retain the shared focus treatment.

### Archive Tiles

Square thumbnails fill their cells with a centre crop and natural colour. On expansion the full photograph appears at its exact natural aspect ratio, without letterboxing or cropping. The active tile includes an 84px caption below its photograph. Its actual rectangular footprint is reserved before other objects pack into the remaining column intervals. No separate portal or overlay intercepts neighboring products.

Collection scrolling follows Elastic Grid Scroll variation 01: symmetrical outer-column lag. Native document scrolling remains in control. Whole tiles receive an additive translateY per column; the centre catches up sooner and outer columns lag more. A frame-rate-independent exponential decay uses .11–.28 second time constants and a 50–100px desktop bound (smaller on compact/coarse-pointer devices). Offsets return to exact zero at rest. No image scaling, warping or WebGL is involved. Scroll start cancels hover enlargement; real pointer movement can select again once displacement is small. Dialog scrolls, filter/column changes, window blur and reduced motion do not leave residual offsets. The frame loop stops at rest and resets when the document is hidden. Geometry, photo proportions and detail dialogs remain independent of the scroll effect.

Hover changes use a single interruptible spring: stiffness 320, damping 38, mass .85, restDelta .2, restSpeed 2. There are no sequential evacuation or compaction phases. Pointer intent follows journeys rather than per-product hover timers. Continuous movement, including slow travel, keeps the current photo open. Clear braking with a projected endpoint inside the target can select immediately; otherwise the end of pointer input selects, detected after a short cadence-adaptive input silence (34–100ms). Displayed product bounds are frozen per journey and the live hit target is verified before and after image decoding. Subpixel noise is ignored and a new journey requires 8px of travel after landing; layout-generated enter events cannot select products. Expansion anchors to the photo's current displayed position, including during an interrupted animation. Leaving the collection closes after 180ms. Width changes, filtering, blur and Escape reset the active item. Reduced motion uses immediate changes. Touch opens details directly; visible keyboard focus expands on desktop, with arrow/Home/End navigation and Enter for details.

Packing tests expand every one of 195 products across 2/3/4/6/8 columns and portrait, square and landscape aspect ratios, checking exact image proportions, boundaries, identity, final non-overlap and immediate packing below the caption. Transitional paths are not guaranteed collision-free; tile exchanges animate simultaneously, with the active tile above moving neighbors.

Category filtering opens the collection into a roomier composition: 6/4/3/2 columns at the same container breakpoints, with 14px gutters (10px on compact containers). Every filter carries its current count. The current collection stays visible while the arriving viewport and one spare row decode. Photographs visible in both compositions retain their identity and move together over 560ms with cubic-bezier(.16,1,.3,1). Departing photographs fade over 160ms; incoming photographs appear together 18px from their final position. Offscreen photographs never travel through the viewport. Hover enlargement and elastic scroll lag pause during preparation and rearrangement. Rapid filter changes replace the pending request; reduced motion removes the spatial transition. When necessary, selecting a filter aligns the toolbar near the viewport top so results are immediately visible.

Switching directly between categories uses a single 680ms directional reveal instead of independent tile fades. The previously painted viewport stays opaque above the decoded, stationary new collection until one continuous clipping edge passes over it. Direction follows filter order. Captured walls retain photo positions, captions, saved markers and any partly revealed previous wall, so rapid interruptions continue from the visible composition. Decorative snapshots are inert and hidden from assistive technology; product interaction resumes after the reveal. Reduced motion replaces the wall immediately without the wipe.

### Dialogs

Product dialogs fit the actual selected photograph. Portraits on desktop use a height-limited image at its natural ratio beside an independently scrolling text column. Landscape photos and phone layouts put the complete image above the information; the image follows the available content width, including scrollbar space. Switching photographs decodes the next source before committing its geometry. The photo-only view fits the entire image inside the viewport, replacing the former clipped transform zoom. Other native modal dialogs retain their existing layout. Informational and selection dialogs are narrower and padded. Open animation is 300ms with cubic-bezier(.16,1,.3,1); the backdrop fades over 240ms. Closing restores prior focus. Reduced motion removes the spring and effectively eliminates CSS transitions and entrance animation. The introduction otherwise has a restrained 850ms reveal using the same easing.

## Do's and Don'ts

### Do:
- **Do** preserve heavy LO and fine THUUS in the wordmark.
- **Do** use fine rules, square containers, and paper-to-ink contrast to establish hierarchy.
- **Do** reserve a real footprint and move the surrounding products together when the active photo grows.
- **Do** provide visible focus, keyboard exploration, touch expansion, and reduced motion.

### Don't:
- **Don't** use artificial grain or heavy interface chrome.
- **Don't** turn flat archive tiles into floating shadow cards.
- **Don't** introduce sequential movement queues or a separate hover overlay that blocks the next product.
- **Don't** use editorial italics for all navigation or body copy.


**Not canonized:** some secondary footer and dialog credits still use 7–9px type; this is not a reusable reading scale. Archive captions have been raised to a more legible scale. Uppercase dialog metadata remains local rather than a reusable eyebrow pattern.


### 3D entrance hero

The homepage opens on the actual authored house, edge to edge across the full browser width, without a logo or invitation overlay. Native scroll drives one critically damped entrance progress: approach the real door, open it early, cross the threshold, and reveal the existing live collection directly. All door ironwork uses the accepted refined geometry. The stage stays in place with native sticky positioning across 2.4 viewport heights; GSAP tracks scroll without intercepting input. The live collection sits behind it during entry and returns to untransformed flow at the boundary so its category toolbar remains sticky. Reverse scroll reverses the complete entrance. Reduced motion keeps the static house above the collection with no pinned journey. `/huis` remains the full orbit/film explorer. The earlier generated-window and photographic-portal hero compositions are superseded.


The hero doorway is a true transparent view onto the live collection from the moment the door opens. Scene depth preserves the stone frame and steps; a door-only coverage mask keeps the complete iron-and-glass leaf in front of the products. No interior is shown through the opening, and the facade does not crossfade over the collection. The reveal grows naturally as the camera approaches the threshold.


The collection stands farther back on a virtual plane beyond the entire inward door swing. Its scale and position follow the camera projection; after crossing the threshold the camera continues toward the products until the live grid reaches its natural viewport size. The door opens in front of the distant collection rather than cutting into a screen-sized wall of products.


The hero entrance begins directly in front of the doorway at x=0, z=23.4 m and an elevated 3.6 m eye position. The closer starting distance follows the supplied facade reference, with viewport-adaptive framing. A continuous straight approach descends smoothly to walking height before the door opens. The same reversible progress spring drives the entire shot; there are no camera cuts or separate timed phases. The complete opening door and distant live collection remain unchanged.


During the entrance, the distant collection reads as an uninterrupted photo wall. A repeated atlas of the actual mosaic images fills the entire doorway, including the area above and beside the scaled page. It shares the live grid's photo crops, pitch and projected origin. The atlas fades into the aligned interactive mosaic only at arrival, with the title and category filters appearing then. Blank page margins and tiny page headings are never presented as the view inside the door.


LOADING ENTRANCE: An opaque full-viewport paper surface covers the scene and collection from the server-rendered first view. Centred heavy-LO/light-THUUS lettering, the existing “Een huis voor cultuur en ontmoeting.” slogan and one 200px hairline are the entire loading identity. The bar follows actual initialization milestones, without a percentage counter. After the first complete WebGL frame and the final fill, the paper surface dissolves over 2400ms into the house; the header returns with it. Reduced motion switches directly. Collection/keyboard skip links dismiss the loader; a failed scene offers retry and collection access. The wordmark remains over the revealed house and becomes part of the scroll entrance.

The entrance always initializes at the facade, including reloads with a remembered scroll position or #collectie hash. Scroll is locked while loading. The live collection and decorative photo wall stay explicitly hidden until the rendered camera opens the door; reversing back before the opening hides them again. Explicit collection links remain available.


LETTERING FLIGHT — requested experiment: The white loading surface dissolves independently over 2.4 seconds; its slogan, hairline and skip label retire over 600ms. The same LOTHUUS lettering stays in place without a duplicate or a handoff. A virtual billboard at z=18 uses the existing camera distance and field of view to grow in perspective. It stays on the optical axis as the architectural lens descends, settles the original 36px upward offset onto the centre of the flight, and retires only at the plane crossing. Reverse scrolling restores the lettering. The grid remains hidden until the doorway opens. Reduced motion removes the lettering flight and slow dissolve.


LETTERING FLIGHT REFINEMENT: The white outline was rejected and removed; the charcoal letters retain their original clean edges. The camera briefly holds its starting elevation, tilts upward to 1.8 degrees toward the wordmark, then settles through a restrained 0.8-degree downward pitch and returns to level by 60% progress, before the doorway. The lettering centre aligns with the flight as the camera reaches its plane, rather than escaping toward the top of the viewport. The entrance remains driven by the same reversible progress spring.


FOCUS REFINEMENT: The house starts with a restrained 7px optical defocus, while LOTHUUS stays sharp and has no outline. Focus resolves continuously with the rendered camera progress, from 1.5% to 28% of the entrance: the facade comes into focus as the visitor approaches and passes the letters. A maximum 3.5% canvas overscan keeps blurred edges covered. Both filter and overscan are removed entirely at focus, before the door opens, preserving accurate portal alignment and avoiding a permanent filter layer. Reverse scroll restores defocus; reduced motion uses a sharp static house.


AUTOMATIC ENTRANCE — supersedes the scroll-driven homepage journey: Once the scene has rendered, the camera starts immediately while the white surface dissolves over 2.4 seconds. The 10-second take follows the existing lettering, focus, tilt, opening door and projected collection path. A continuous timing curve starts moving immediately, preserves a readable facade approach and accelerates through the open door. The door is fully open around 7.6 seconds, leaving about 2.4 seconds to reach the live grid. Only the final half-second brakes to zero velocity; position and velocity stay continuous at the join. There is no additional delay before movement. The page itself stays at scrollY=0; no visitor scroll input or programmatic document scrolling drives the take. At arrival the stage collapses and the same live collection returns to ordinary flow at its existing screen coordinates, with header space already reserved. The hero toggles playback on click/tap or keyboard activation, with a quiet centred pause glyph visible only while manually paused. No visible Pause/Continue button or instruction text is shown. A separate Skip link remains available; hidden tabs pause the clock without skipping ahead, and a manual pause persists. Reduced motion keeps the static house and ordinary collection, without autoplay. ScrollTrigger no longer drives the homepage hero. Immediate camera samples retain the static shadow cache until the door actually changes angle.


COMPACT COLLECTION NAVIGATION — 24 October 2026: At collection arrival, show only the heavy-LO/light-THUUS wordmark, category filters with counts, and the heart / Mijn selectie checkout entry in one sticky 76px desktop row. Remove the separate global navigation, editorial collection title, duplicate total and hover instruction. Products begin 12px below the rule. Remove the entrance world's old header reservation and section top padding so arrival has no empty header band. Phones use a compact logo/selection row and horizontally scrollable filter row; all labels, pressed states and selection functionality remain accessible. How-to information remains available below the collection.


GRID EDGE REFINEMENT — 24 October 2026: Only the photo grid breaks out of the page inset and maximum width. Keep a 12px viewport edge on desktop/tablet and 8px on phones. The navigation retains its existing inset and 1584px content cap. Container-relative sizing excludes the scrollbar and follows the live collection during the entrance.

The loading wordmark begins in charcoal and transitions to white over 1.6 seconds immediately when loading completes, alongside the dissolving paper and immediate camera departure. There is no outline.

IOS CRASH CONTAINMENT — 24 October 2026: After repeated full-page reloads on an iPhone 13 mini, iOS temporarily uses a lightweight photograph of the actual house with the existing slogan and a collection link, followed by the ordinary live collection. It does not initialize WebGL, the entrance photo atlas or the automatic flight. iPad desktop user agents with touch use the same fallback. Desktop retains the live 3D entrance. This contains the failing feature; the underlying device crash remains undiagnosed.

COLLECTION IMAGE WINDOW — The photo entrance also reloaded on the user's iPhone, excluding live 3D as a necessary trigger. Product image elements now exist only within the viewport plus 240px above/below; offscreen images unmount while all tile positions and product buttons remain. Responsive sources use the actual tile width. Only tiles with mounted photos receive scroll-time `will-change`. The iOS photo fallback remains while this collection correction is validated on the device.

IOS NATIVE GRID — After a further reload when scrolling below the collection, iOS uses an ordinary CSS grid: square tiles in document flow, immediate category changes and direct detail opening. No transformed tile positioning, animated grid height, category snapshot wall, hover expansion or elastic scrolling initializes on iOS. The viewport image window, selection hearts and keyboard product navigation remain. Desktop keeps its animated mosaic. This is a device-specific fallback pending physical-device validation.

MOBILE OPENER RESTORED — The user confirms the native grid stops the crash and requests the 3D opener with blur back on mobile. All devices again use the live entrance and its 7px-to-sharp optical focus, with the existing reduced-motion exception. iOS retains its native collection grid. Its rows/columns feed the doorway photo atlas. At automatic collection arrival, dispose the 3D scene and disconnect/release the temporary atlas, leaving ordinary collection scrolling.

MOBILE FOCUS / PORTAL STABILITY — Mobile uses a subtler 3px-to-sharp defocus with 1.5% overscan; desktop retains 7px/3.5%. During the pinned flight, keep the first eight photo rows mounted, unaffected by camera projection. Resume the viewport image window only at arrival. Decode each new atlas blob before swapping its CSS background to avoid blank intermediate frames. Preserve the ten-second path and native iOS grid.
