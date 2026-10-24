# Left gate and covered passage

The street-level Google Maps photograph supplied on 24 October 2026 is the primary reference for the left entrance. A preserved local copy is `artifacts/house-gate/reference.png`. It supersedes the narrow panelled doorway previously inferred from the distant restored house photograph. Street View interface graphics, projection distortion, and the blurred patch are not architectural features.

## Reconstruction

- Two charcoal iron gate leaves, with opaque lower sheets, a centre seam, perimeter rails, slender vertical bars, pointed finials, repeated upper spirals, lower ornamental loops, brass-coloured decorative curls and central crest, hinges and a handle.
- Two dark square gateposts with projecting layered capitals and pale stone bases.
- Low ochre/yellow brick street wall on the left, staggered brick courses, pale coping, end pier and plinth, partly visible pale service door and timber enclosure.
- Dark pitched carport behind the gate: triangular front gable clad in narrow vertical boards, roof slopes extending along the passage, fascia, edge trim, exposed rafters, ties, knee braces and supports. The passage below the eave is open, with paving and a glimpse of the garden behind it.
- Straight canopy gutters and drainpipe. The existing house gutter and downpipe retain their regular geometry; the photograph's bent projection is not reproduced.
- Two parked bicycles with frames, wheels, spokes, handlebars, saddles and a rear carrier; the red bicycle has dark panniers. Dark bins sit under the canopy.
- The tall invented triangular neighbour wall behind the canopy is removed following the second close-up reference. Sky remains visible above the dark gable. All exposed faces of the low boundary, pier and return walls use fine staggered ochre brickwork, recessed grey joints, eased brick edges, rough surface detail, thin segmented coping and a stone foot. The main house’s existing windows, dressed stone, brick facade and balcony remain the reference for the right edge of this view.

The gate is recessed at z≈0.16, approximately 3.84 metres behind the main house facade at z=4. The inham has continuous paving from the public footpath back to the gate and a yellow-brick left return wall. Its opening spans x −12.62 to −9.12; the solid panels reach 1.06, the top rail 2.20, the spearheads approximately 2.48. The canopy starts behind it at z −1.08, with eaves 2.77 and ridge 4.58. These are visual estimates in the existing model's scale, not measured dimensions. The deep roof, obscured fixings, garden  are conservative approximations. Weathering and decoration are interpreted from the visible photograph rather than asserted as surveyed details.

The model uses solid geometry and instanced brickwork, merged by material for rendering. The renderer does not load or project the reference image. The `De poort` preset frames the new entrance from near the house side, alongside the existing front, angled and front-door views.

## Verification

`house-left-context.test.ts` casts rays through the lower sheets and upper ironwork, verifies that the passage stays open under the gable, checks that the canopy continues into depth, and checks the wall/post junction. Run it with the streetscape, planting and rendering tests and TypeScript validation. Visual checks use `/huis` and its `De poort` view.

## Background revision

The front elevation uses `public/house/materials/front-street-backdrop.webp`, an ordinary rectilinear flat photograph generated for this composition: Flemish brick houses, gardens, a level paved square, and blue sky with white clouds. No spherical projection, mountains, hills or rising terrain. Three.js uses the default UV mapping as a screen-aligned scene background. Centred cover cropping preserves the image proportions on resize without stretching houses. Earlier panorama and sky-only experiments remain unused source assets. The existing HDR supplies illumination only. The generation brief and provenance are recorded alongside the WebP.
