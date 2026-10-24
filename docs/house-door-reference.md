# Entrance reference — 24 October 2026

The user-supplied close-up in `references/house/entrance-closeup.png` is the authority for the entrance. It supersedes the closed timber-panel door in the older restored facade photograph. The user subsequently identified the gold ornaments on the bell pull as miniature birds and requested a perfectly vertical pull and a symmetrical stone surround.

`src/components/house-door.ts` authors the entrance as independently lit geometry. The curved transom, central crest and gilt ornament contours in `house-door-tracing.ts` were traced from the close-up and extruded, preserving their openings. The main grille uses separate forged strips and upright bars, behind which sit two pebbled glazing materials. Procedural colour and normal maps represent the green privacy glass; no photograph is loaded, projected or pasted onto the model.

`house-bell-tracing.ts` records the actual crown/bracket outline and the original 89 numeral contours, including the counters. The shallow enamel plate and raised dark numerals are separate solids. The bell bracket has projecting wall returns. Its continuous heavy spiral and thinner lower tail share a fixed vertical axis beneath the crown. Seven gilt miniature birds have rounded bodies, heads, beaks, inset eyes, five overlapping wing feathers, separate tail feathers and feet around the pull. Their placement alternates along the spiral. These tiny sculptural depths and feather details are reconstructed from the user's identification, rather than claimed as measurable from the low-resolution close-up.

All limestone parts are symmetrical about the door's centre. This explicitly removes the perspective skew in the supplied photograph: lintel face, soffit, top fascia, bevelled cornice, paired jambs and feet, and thresholds are centred or exactly mirrored. The surrounding facade and its opening remain unchanged.

The full-house scene calls this builder from `house-architecture.ts` and merges its static solids by material. The obsolete timber-panel design, ring knocker and oversized entrance lanterns are removed. The close-up shows two small dark wall fixtures.

Validation: `src/components/house-door.test.ts` checks limestone reflection symmetry, connected pull geometry, the two original numeral shapes with three counters, vertical helix alignment, and the seven detailed bird assemblies. Visual checks include an isolated front/angled entrance render and a pull/number detail render in `artifacts/door-review/`. The inspection renderer imports the same builder as the house; its plain backdrop is only for geometry inspection. Dimensions and hidden depths remain estimates from the single photograph.

## Upper ornament refinement

The accepted traced silhouettes are locally subdivided twice with bounded corner cutting (maximum 0.65 source pixel per edge at each pass). This retains the contour topology and open curls while rounding the low-resolution polygon edges. Iron is extruded to 24 mm with four bevel subdivisions; gilt contours receive the same refinement. This is a geometric smoothing tolerance, not a claim of pixel-identical silhouette preservation.

The upper transom now shares the main leaf's physical privacy-glass material, colour map, pebble normals, glazing depth and world-space UV mapping. The previous separate brown transom material is removed. At the user’s explicit request the entire metal-and-glass door is now one moving leaf, including this upper glazing, its perimeter, all curved rails and every traced ornament. The stone surround, pull bell and threshold remain fixed.
