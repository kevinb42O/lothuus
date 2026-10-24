# Footpath and roadway reference pass

Reference: `public/house/lothuus-today-restored.png`, 1604 × 981 pixels. The photograph is inspected as reference only; no part of it is projected onto the model. The main house geometry and camera presets are unchanged by this pass.

## Comparison method

Inspect the lower 211 pixels separately, then compare the complete front view at the same aspect ratio. Align the facade before comparing ground points: the photograph and the model do not have precisely identical camera calibration. The facade's lower edge on the right is hidden by the planting, so the visible top of that plinth must not be mistaken for the ground line.

Visible reference anchors, in source image pixels:

| Feature | Approximate reference position | Reconstruction decision |
| --- | --- | --- |
| Main facade meets the ground | x 107–1455, y about 830 | Anchor for the ground comparison; keep the house unchanged. |
| Small planting bed, rear edge | (435, 850) to (691, 852) | Shift towards the entrance and reduce depth. |
| Small planting bed, front edge | (403, 860) to (651, 874) | Model sloping edges rather than a deep axis-aligned rectangle. |
| Large planting bed, front edge | (847, 877) to about (1585, 911) | Widen its visible ground footprint towards the right. |
| White marking begins | about (399, 858) | Start beside the small bed, rather than far out in the foreground. |
| White marking reaches the image boundary | about (0, 980) | Angle the long stripe in world space and add transverse comb strokes. |
| Road-block joints in the foreground | clearest to the right of the entrance | Turn the long stone axes towards the house and use staggered columns. |

Coordinates identify visible landmarks, not survey measurements. Some rear bed edges are hidden by leaves. The shared bed footprints therefore use conservative estimated rear boundaries while following the visible front kerbs.

## Implemented ground details

- Individually modeled 118 × 231 mm road blocks, 3.5 mm nominal joints, shallow irregularities, rounded edges, surface normals and roughness at a world-space scale.
- Separate, slightly raised clinker footpath and entrance approach, without the former conspicuous large square slab strip.
- Approximately 105 mm exposed planting kerbs instead of the earlier 200 mm tops, with separate short segments, softened edges and low flush header/drainage courses.
- Sloping bed boundaries shared by the soil geometry, kerbs and every plant placement. The three tree-root positions are retained.
- Warm grey/ash road material, restrained per-stone variation and warm grey footpath material.
- One diagonal long white boundary with nine transverse strokes; remove the invented closed parking rectangle. Paint wear is procedural, stable in world space and receives scene shadows.
- Continuous matching bonds where the square enters the right side street and the recessed left approach. The distant receiver uses the same longitudinal module.
- The footpath continues left beyond the main facade and across the approach in front of the neighbouring frontage. Its kerb follows the same uninterrupted line.
- The entrance apron ends at one straight, segmented kerbstone between the adjacent planter corners. Boundary stones are geometrically cut at that line; alternating half-bonds cannot leave a sawtooth edge. Boundary splits preserve the source block area, without gaps or overlapping paving.

## Validation

Inspect the default front view, the angled view and a 390 px phone viewport. Verify the entrance stays open, kerbs remain low, markings begin beside the small bed and the side street remains connected. Run the TypeScript check and the planting/rendering tests; the planting checks include every transformed corner of rotated oversized specimens against the sloping bed edges.

One photograph cannot establish hidden street geometry, exact block sizes, levels or unseen drainage. Those remain estimates; the visible layout, proportions and material direction are the basis of this reconstruction.
