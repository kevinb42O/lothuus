# LOTHUUS

A Dutch editorial website with a spatially packed, spring-animated vintage archive.

## Run

Requires Node.js 22.13 or later (Node 24 recommended). The local backend uses built-in SQLite.

```sh
npm install
npm run dev
```

Open http://localhost:3000. For production, run `npm run build` then `npm start`.

## Verify

```sh
npm test
npm run typecheck
npm run build
```

Grid layout tests expand every product across 3/4/6/8 columns, checking portrait/landscape ratios, final non-overlap, bounds, identity and filtered selections. Backend tests cover inventory, reservations and payments.

## Structure

- `src/lib/grid-layout.ts`: footprint reservation and compact collection layout.
- `src/components/mosaic.tsx`: responsive measurement, hover intent, touch and keyboard input, and Motion spring animation.
- `src/lib/collection.json`: independent structured catalogue and per-image source information.
- `src/components/lothuus.tsx`: editorial page, filters, detail experience, persistent favourites, and local enquiry download.
- `src/components/dialog.tsx`: native accessible dialog and focus restoration.
- `src/app/globals.css`: visual system and responsive/reduced-motion rules.
- `DESIGN.md` and `PRODUCT.md`: durable design decisions and content boundaries.

## Interaction

Desktop: hover intentionally over a photograph to expand it at its natural image aspect ratio, with the title underneath. All other products repack around it simultaneously. Click opens details; touch opens in one tap. Tab and arrow/Home/End navigate products; Escape settles the grid.

The measured archive has 8/6/4/3 columns. A single interruptible spring animates positions, expanded dimensions and collection height. Pointer journeys keep the current photo open while crossing other products. Clear braking inside a destination or the end of pointer input selects it, without a per-product hover timer. Each journey freezes displayed product bounds; selection also checks the live hit target before and after image decoding, so repacking cannot cause a hover cascade. Tiny corrections after landing do not rearm selection. The expanding photo anchors to its current visual location. Thumbnails fill their square cells; the expanded photo shows the complete original without letterboxing. Column packing resumes immediately below its caption. Product detail dialogs also preserve the full selected photograph: desktop portraits sit beside the information, landscapes and phones place it underneath. A photo-only view fits the complete image without clipping. Final layouts do not overlap; transitional tile exchanges can cross. Reduced motion removes animation.

The collection also uses symmetrical outer-column scroll lag, inspired by [Codrops Elastic Grid Scroll, demo 01](https://tympanus.net/Tutorials/ElasticGridScroll/). The implementation uses native scrolling and a small animation-frame controller (`src/components/use-elastic-grid.ts`), without a global scroll replacement or additional libraries. Whole tiles translate by column and settle back to zero; compact devices use smaller offsets and reduced motion disables the effect. Hover intent pauses during scrolling. Tests cover symmetry, bounded displacement, settling and frame-rate-independent decay.

## Supplied LOTHUUS collection

The WeTransfer delivery of 23 October 2026 contains 195 product folders and 808 photographs: 103 ceramics, 51 glass and 41 wood/rattan/bamboo objects. Each folder is one product, with photographs sorted numerically; the first photograph appears in the grid and all photographs are available in the detail dialog. Material filters follow the supplied folders. The full grid interleaves the three materials.

Regenerate the catalogue and optimized, auto-oriented WebP images with `node scripts/import-collection.mjs`. Optionally pass a different source folder as its first argument. Originals remain in the WeTransfer folder; site images live in `public/collection/` and the catalogue in `src/lib/collection.json`. Source folder mappings are retained in each record. References K001/G001/H001 are provisional import identifiers, not confirmed inventory numbers. Titles are neutral material labels; prices, periods and other unsupplied details remain blank. These photo records support favourites and enquiries, but cannot be reserved until configured as published inventory in the owner dashboard. The former museum sample photographs have been removed.

## Owner dashboard and deployment

The site is intended for **Vercel**, using standard Next.js and Node 24. Import this GitHub repository in Vercel with the default Next.js build (`npm run build`). Cloudflare is used only for private **R2 photo storage**, not application hosting. The previously created Worker has been deleted and its deployment adapter/configuration removed.

`/admin` uses Supabase Auth and server-only Postgres access. The owner can change their password in Settings; there is no public registration. The existing database contains 195 private imported drafts with all 808 source photographs referenced in R2. Secrets and production data are excluded from Git.

See [production setup and remaining deployment work](docs/production.md) and [.env.example](.env.example) for Vercel environment variables, bucket-scoped R2 S3 credentials, upload platform limits and backup scheduling. **Vercel has not been deployed/configured yet.** Large-photo direct upload and a replacement daily backup schedule must be completed when connecting Vercel. Email delivery and password-recovery email are a subsequent setup step; the outbox currently contains previews only.

Read [the Dutch owner guide](docs/owner-guide.md) for everyday use. [Backend setup](docs/backend-setup.md) documents the isolated SQLite development/test adapter. Local SQLite is never a production fallback. `npm run owner:setup` changes only that local test account; it does not change Supabase Auth.

Do not commit `.env.local`, `.dev.vars`, `.data/`, `.backups/` or real access keys. `npm run backup:verify` checks the existing private online backup without overwriting production. `npm run backup` instead creates a local SQLite backup.

## Image and font credits

- Object photography: LOTHUUS, from `wetransfer_foto-mappen-info_2026-10-23_1101/`. Originals are retained; no open-access licence is assumed.
- House photography: the user-supplied historic and contemporary LOTHUUS photographs inside `website.pages` → `Data/download-34.jpg`. Extracted and conservatively restored/upscaled with the built-in ImageGen tool. Original screenshot preserved in `references/originals/`; shipping photographs and exact edit prompts are in `public/house/`. These restored derivatives may reconstruct fine texture from the low-resolution source.
- Manrope: Mikhail Sharanda and contributors, SIL Open Font License.
- DM Serif Display: Colophon Foundry, SIL Open Font License.

Fonts and photographs are served locally. No screenshot is used as a flattened website background.
