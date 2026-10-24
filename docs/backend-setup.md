# SQLite development/test adapter

**Production now uses Supabase Auth/Postgres and private Cloudflare R2. See `docs/production.md` for the live setup. Everything below describes only the isolated local test adapter; it does not change the online owner account.**

## Local implementation

- Persistent SQLite-backed state and private image directory, independent of browser storage.
- Password hashing with scrypt, signed HTTP-only same-site owner session, eight-hour expiry, mutation origin checks and login throttling.
- Explicit public projections: published catalogue and capability-scoped reservation status. No public customer or owner-settings endpoints.
- Atomic reservation creation with price/version/terms checks, cross-process stock exclusion, request idempotency, customer association and two local email previews.
- Immutable financial/contact snapshots, payment/refund ledger, lifecycle audit history, overdue owner review and fulfilment.
- Item/photo management, customer/contact/notes/history, contact corrections, customer merging, direct sales, exports and backup scripts.
- Uploaded images decoded/re-encoded into three WebP sizes with pixel/byte/type checks and private draft access.

## Local architecture

`src/lib/backend/types.ts` defines serializable business records. `validation.ts` holds input schemas. `service.ts` implements synchronous business operations and explicit public/admin projections. `repository.ts` owns persistence and transaction lifetime. Route handlers are thin HTTP/auth boundaries. The UI sends commands and reads those projections.

The local adapter stores a versioned JSON aggregate in one SQLite row. `BEGIN IMMEDIATE` serializes updates across processes, and rollback covers reservations, stock decisions, customer association and outbox together. This is deliberately small-scale local persistence, not a normalized cloud schema. It reads/writes the aggregate per operation; migrate before high traffic or large customer histories.

SQLite uses Node's built-in `node:sqlite`; Node 22.13+ is required and Node 24 is recommended. Some Node versions print an experimental-feature notice. There is no database subscription or separately running database server.

The default data directory is `.data/`, outside public assets and ignored by Git. It contains `lothuus.sqlite` plus possible WAL/SHM files, `images/`, and `owner.json` or `session-key`. Protect the parent directory and use encrypted backups. Tokens for public reservation status are hashed on the reservation; retry recovery retains the original token privately in the request journal, so the database and backups must be treated as secrets too.

## Configuration

Run `npm run owner:setup` interactively; there is no default password. Alternatively set `ADMIN_PASSWORD` through the environment. Do not commit it. The latter bypasses `owner.json`; remove the override before using the setup command to change the active password. If rotating an environment password, remove/rotate `session-key` while the app is stopped to invalidate old sessions.

`APP_ORIGIN` is the exact browser origin, including port; set it explicitly if a proxy changes the incoming host. `LOTHUUS_DATA_DIR` may be an absolute persistent path. `TRUST_PROXY` stays false locally. Both public rate limits and login limits use a shared local bucket unless a trusted proxy is explicitly configured to overwrite forwarded IP headers.

Default scripts bind to 127.0.0.1. The current local implementation is not a public production release: no Turnstile integration, distributed rate limiter, outbound mail worker, MFA, managed recovery, managed encryption/backup service or automated retention policy is configured. Do not expose it directly to the Internet. A single trusted local operator can test the complete business flow.

## HTTP routes

| Route | Methods | Access |
| --- | --- | --- |
| `/api/session` | GET / POST / DELETE | Session state, password sign-in and sign-out |
| `/api/catalogue` | GET | Published public catalogue and safe policy/settings fields |
| `/api/reservations` | POST | Create reservation or fetch status with secret capability |
| `/api/store` | GET / POST | Owner-only snapshot and validated commands |
| `/api/images` | POST | Owner-only image processing/upload |
| `/api/images/[id]` | GET | Published photos, or owner-only draft/staging photos |

POST requests require a matching Origin, including scripted HTTP tests. Browser forms and fetch set this automatically. JSON requests are limited to 128 KB after parsing the request body; uploads are limited to 15 MB plus a decoded pixel limit. Before public deployment, enforce streaming body limits at the ingress as well.

## Mail mode

There is intentionally no sending integration. `email_jobs` from the original cloud design are represented as immutable local `emails` records with `status: preview`. A preview is not queued for real delivery and is never labelled sent. No historical preview should be blindly replayed after migration: it may refer to a cancelled reservation or obsolete deadline.

The owner dashboard's explicit refresh invokes overdue review. This creates at most one reminder preview per deadline stage and keeps the item blocked. Payment receipts, cancellations and owner-triggered instruction previews are similarly visible in the outbox.

## Supabase migration work later

1. Normalize the local aggregate into the tables/indexes/checks outlined in BACKEND-PLAN.md; include an explicit schema/data migration and reconciliation report.
2. Map the local transaction operations to server-owned Postgres transactions/RPCs. Keep stock locking, active-reservation uniqueness and the outbox insert in the same transaction. Do not simulate them with multiple browser writes.
3. Replace password/session route logic with Supabase Auth, owner-role enforcement, recovery and MFA; enable/test RLS for anonymous, owner and unrelated authenticated roles.
4. Move WebP variants to Supabase Storage with private staging and published access policies. Migrate photo IDs/paths and preserve historical snapshots.
5. Move public and owner command handlers to Supabase Edge Functions or a supported server boundary, preserving UI contracts where practical. The existing local adapter cannot be switched to cloud just by supplying a URL/key.
6. Add verified-domain email delivery, transactional outbox leases, provider idempotency, signed webhooks, quota handling and scheduled retries/reviews. Test on controlled inboxes before enabling public reservations.
7. Add Turnstile verification, trusted ingress/body limits, customer data retention/anonymization policy, encrypted production backups and monitored restore drills.
8. Only then consider the static frontend deployment. This local implementation uses dynamic Next route handlers and requires Node plus persistent disk until those routes are migrated.

## Verification

`npm test` includes business invariants, cross-process reservation races, full transaction rollback, payment/refund guards, customer privacy and existing mosaic packing checks. `npm run typecheck` and `npm run build` verify integration. An additional development HTTP smoke check used isolated temporary storage to test owner access, Origin rejection, real image processing, public/draft image permissions, catalogue publication, retry/conflict behaviour and private status.

## Selectie en gezamenlijke bestellingen — 24 oktober 2026

De selectie plaatst nu één bestelling met maximaal 50 unieke objecten via dezelfde `/api/reservations`-route. De nieuwe payload bevat `items` met object-ID, verwachte prijs en versie. De bestaande payload met één `itemId` en alle bestaande privélinks blijven werken. Een bestelling gebruikt het bestaande reserveringsrecord als orderheader, met optionele `lines` voor de objectmomentopnamen en één totaal/betalingsregister. Oudere records worden via `reservationLines` als één regel gelezen; bestaande data, tokens en betalingen hoeven niet destructief te worden omgezet.

`checkout` valideert de volledige selectie vóór de gezamenlijke mutatie. De SQLite-transactie omvat alle voorraadclaims, klantkoppeling, twee lokale mailvoorbeelden en een blijvende dashboardmelding. De publieke catalogus bevat ook gereserveerde en verkochte gepubliceerde objecten. Beschikbaarheid controleert elke bestelregel. Volledig betaald betekent publiek verkocht, ook wanneer het ophalen nog niet is afgerond.

Nieuwe bestellingen met regels vervallen automatisch bij een onbetaalde verstreken deadline. Gedeeltelijk betaalde bestellingen blijven geblokkeerd en krijgen een controletaak. Oude individuele reserveringen behouden hun eerdere handmatige vrijgavebeleid. `src/instrumentation.ts` controleert termijnen iedere minuut zolang de lokale Node-server draait; iedere transactie controleert ze ook vóór een nieuwe voorraadbeslissing. Na serveruitval worden deadlines bij de volgende transactie verwerkt. Dit is geschikt voor de huidige persistente lokale server, niet voor een slapende/serverless deployment zonder aparte scheduler.

Een late betaling op een vervallen bestelling kan als ontvangst worden geregistreerd voor controle/terugbetaling, maar herstelt nooit de voorraadclaim en maakt geen betaalbevestiging aan. Het dashboard toont gelezen en afgehandelde meldingen afzonderlijk. De website, privéstatus en het dashboard verversen hun status zolang ze openstaan. Statusopvragen hebben een eigen frequentielimiet en verbruiken niet de limiet voor nieuwe bestellingen.

E-mail blijft uitsluitend `preview`. Er is geen verzenddienst aangesloten en niemand ontvangt een echte mail. De bevestiging zegt dit en biedt de privélink en kopieerbare betaalgegevens aan. Voer uitsluitend echte verkoopgegevens in voordat bestellen wordt geactiveerd. De aangeleverde fotocatalogus zonder prijzen kan inmiddels ook als tijdelijke reserveringsaanvraag worden doorgegeven; prijs en betaalafspraak worden daarna door Katrien bevestigd (zie de aanvulling hieronder).

Voor geïsoleerde controles kan `LOTHUUS_BUILD_DIR=.next-checkout-review` worden gebruikt bij zowel build als start, naast een aparte `LOTHUUS_DATA_DIR`. Zo delen gelijktijdige controles geen build of klantgegevens.

### Reserveren vóór prijs- en betaalconfiguratie

De fotocollectie is nu ook via de backend reserveerbaar. De server valideert de bronreferentie (zoals H031) tegen de echte aangeleverde catalogus en bewaart naam, e-mailadres, objectmomentopnamen en een tijdelijke voorraadclaim. De catalogusprojectie levert de reserveringsstatus terug; de browser mag de aangeleverde catalogus niet langer als ongecontroleerde fallback over die status heen zetten.

`pricePending` betekent dat nog geen prijs is bevestigd; een interne nulwaarde wordt niet als verkoopprijs getoond en kan nooit betaald/verkocht betekenen. `paymentPending` betekent dat Katrien eerst de betaalafspraak moet klaarzetten. Bankgegevens worden dan niet als onvolledige betaalopdracht getoond. `prepare-payment` bevestigt alle regelprijzen, legt geldige bankgegevens vast en start de betaaltermijn opnieuw. Betalingen, ophalen en afronden zijn daarvoor geblokkeerd. Alle e-mails blijven lokale voorbeelden.

`requestsEnabled` beheert of klanten hun selectie kunnen laten reserveren (standaard toegestaan). `reservationsEnabled` bepaalt of geprijsde objecten meteen complete betaalinstructies meekrijgen. Een ontbrekend rekeningnummer of nog niet aangesloten e-maildienst blokkeert zo niet langer het achterlaten en daadwerkelijk reserveren van een selectie.
