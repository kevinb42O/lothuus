# LOTHUUS backend and reservation implementation plan

Prepared: 21 October 2026. Status: cloud implementation specification. A local SQLite backend and owner UI have now been implemented without Supabase; see docs/backend-setup.md and docs/owner-guide.md. Real outbound email and the hosted cloud services remain unconfigured. The architecture and phases below describe the target cloud version.

## 1. Intended result

The owner manages her real collection, photographs, prices, reservations, payments and customer history from a private Dutch-language dashboard. Visitors reserve an individual object without creating an account. They receive instructions to pay directly into the owner's bank account. The owner receives a separate notification and checks the bank transfer herself.

The website reserves the item immediately after a successful database transaction. Receiving a reservation email does not mean payment has arrived. The owner records payment and completion separately. There is no payment gateway, card processing, automatic bank connection or platform commission in this scope.

### Proposed defaults

| Decision | Initial behaviour |
| --- | --- |
| Stock | One physical item per listing; quantity is always one |
| Currency | EUR; store amounts as integer cents |
| Amount requested | Full listed item price; deposit support can be added later |
| Payment deadline | Three calendar days after reservation, configurable |
| Late payments | Flag for owner review; never automatically relist an item that may have an incoming transfer |
| Fulfilment | Pickup by arrangement; delivery can be agreed directly and is not silently included |
| Customer account | None required |
| Owner access | One invited owner account; public sign-up disabled |
| Language | Dutch customer and owner interfaces, Dutch email templates |
| Multiple favourites | Keep existing selection; reserve each work individually in the first release |
| Unpaid cancellation | Owner checks bank before cancelling and releasing the item |

These are planning assumptions, not verified business policies. The owner must confirm her trading details and reservation/payment wording before launch.

## 2. Current project and integration points

- Next.js 16, React 19, TypeScript, Tailwind and Motion are already installed.
- `src/lib/collection.json` contains 96 illustrative museum objects, not verified sellable inventory.
- `src/lib/collection.ts` exports that static catalogue and its types; no price or stock state exists.
- `src/components/lothuus.tsx` renders details, favourites and an enquiry form. The form only downloads a text file.
- There is no Supabase client, authentication, customer database, email integration or owner dashboard.
- Keep the existing mosaic interaction and house content. Replace the catalogue data boundary and enquiry submission deliberately.
- Never import the museum examples as available stock. Keep them as development fixtures, isolated from production.

The installed Next.js static export guide was read at `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`. Read relevant installed guides again when implementing authentication or changing rendering behaviour, as required by AGENTS.md.

## 3. Architecture and free-tier budget

```text
Visitor / owner browser
    |
    +-- Next.js static frontend on Cloudflare Pages
    |
    +-- Supabase Auth: owner identity only
    +-- Supabase Data API: approved public catalogue and owner-scoped operations
    +-- Supabase Storage: listing photographs
    |
    +-- Supabase Edge Functions
            +-- validate visitor requests and abuse checks
            +-- invoke transactional Postgres functions
            +-- send queued emails through Resend
            +-- process signed email delivery webhooks

Postgres transaction
    +-- reservation + stock exclusion + customer association
    +-- immutable price / payment-instruction snapshots
    +-- audit event + two durable email jobs

Supabase Cron
    +-- process email retries
    +-- flag overdue reservations and create reminders
```

### Services

| Component | Choice | Cost target / relevant restriction |
| --- | --- | --- |
| Frontend hosting | Cloudflare Pages Free, static Next.js export | $0 within plan limits; 500 builds/month |
| Database, owner auth, photos | Supabase Free | $0 within quotas; 500 MB database, 1 GB storage; inactivity can pause the project |
| Backend requests and jobs | Supabase Edge Functions + Cron | Free allowance; budget calls rather than adding another server |
| Transactional email | Resend Free | 3,000 emails/month; maximum 100/day |
| Spam protection | Cloudflare Turnstile Free | Validate challenge responses on the backend |
| Payments | Customer's manual bank transfer | No gateway subscription or gateway transaction fees; bank terms are separate |
| Sending domain | Existing owner-controlled domain | Domain ownership/renewal is separate from free application services |

Sources checked on 21 October 2026: [Supabase pricing](https://supabase.com/pricing), [function pricing](https://supabase.com/docs/guides/functions/pricing), [Resend pricing](https://resend.com/pricing), [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/), [Turnstile plans](https://developers.cloudflare.com/turnstile/plans/).

### Meaning of “fully free”

Design for no recurring application-service charges at small usage. Do not promise unlimited free operation or guaranteed availability: providers can change plans, pause services or stop accepting requests at limits. Keep paid upgrades disabled unless explicitly chosen later.

Reliable Resend production sending needs a domain the owner can verify through DNS. Its test sender cannot email arbitrary customers. If she already owns a domain, use that domain or a sending subdomain. If she owns none, the recommended stack does not meet a literal zero-total-cost requirement until a suitable sending arrangement is supplied; do not pretend the test sender solves this. See [Resend test-domain restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

Vercel Hobby is unsuitable for this commercial reservation site under its [fair-use rules](https://vercel.com/docs/limits/fair-use-guidelines). Use the static hosting route instead.

### Hosting consequences

- Configure a static export during implementation and deploy `out/`; no Next.js POST handlers, Server Actions, request-time cookies or runtime server middleware in this deployment.
- All sensitive mutations execute in Supabase, not the exported frontend.
- Use fixed pages with query-string IDs, such as `/admin/item/?id=...` and `/reservation/`, so new items do not require generating new dynamic routes.
- Load published catalogue records at runtime, so owner updates appear without redeploying. Refresh availability after mutations and when the page regains focus; the database always makes the final reservation decision.
- Pre-generate image sizes on upload; use static-export-compatible images and no paid image-transformation dependency. The current default Next image optimizer needs to be replaced or disabled for static export.
- The current single-page catalogue can remain. Individual search-indexed product pages and per-product social previews would require a separate build/publishing strategy later.
- Cloudflare documents this specific deployment in its [static Next.js guide](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/).

## 4. Visitor reservation journey

1. Visitor opens a real, published listing with photographs, description, condition, dimensions, price and current availability.
2. Available items show “Reserveer dit object”. Reserved and sold listings cannot be submitted.
3. Form requests name, email, email confirmation, optional phone, preferred contact channel and optional short message. Phone becomes required only if phone/WhatsApp is selected. Show price, manual-transfer explanation, deadline policy and pickup information before submission.
4. Visitor acknowledges reservation terms and privacy information. Marketing permission, if ever offered, is separate and optional.
5. Browser creates a random idempotency key for this submission, completes Turnstile, and sends the item ID and customer input. The browser does not choose the price, account number, availability or deadline.
6. Backend validates input and Turnstile, applies rate limits and calls one database transaction.
7. Transaction locks the item, verifies it is published and available, associates the customer, creates the reservation and snapshots, and adds both email jobs. Either everything commits or nothing does.
8. Confirmation page displays reservation reference, item, amount, beneficiary, IBAN, transfer reference and deadline. It says the item is reserved and payment is awaiting receipt. Provide copy buttons for bank details and reference.
9. Customer email and owner email are dispatched independently after commit. An email outage cannot lose the reservation or free the item.
10. Owner checks her bank account, records payment, arranges collection and marks the sale completed. Customer history then shows the actual purchase.

Example customer wording: “Dit object is voor je gereserveerd. Maak €185,00 over naar [IBAN] op naam van [begunstigde], met vermelding [referentie], uiterlijk op [datum]. Je betaling wordt handmatig gecontroleerd.” Values are illustrative; real bank details must be entered by the owner.

### Submission edge cases

- Double-click or network retry with the same key returns the same reservation; it never creates a second reservation or pair of email jobs.
- Reusing a key with different data is rejected. Retrying an existing operation may use a fresh Turnstile token without changing its business payload.
- Another buyer wins first: return an unavailable conflict and update the listing; do not create a losing reservation or send payment instructions.
- Catalogue price changes after the form opened: return a price-change response and require acceptance of the new price before creating a reservation.
- Response lost after commit: repeat with the same key and recover the committed result.
- Invalid email is rejected; matching confirmation fields reduce typing errors. Email syntax checks do not establish identity.
- A bounced email creates an owner action item. Correcting the reservation contact must not automatically rewrite a returning customer's established contact record.
- No backend connection: show unavailable/retry; never report a successful reservation from local demo state.

## 5. Stock, reservation, payment and fulfilment rules

Track these independently so “reserved”, “paid” and “collected” cannot be confused.

| Record | Values / rules |
| --- | --- |
| Listing publication | `draft`, `published`, `archived` |
| Derived public availability | `available`, `reserved`, `sold`; draft/archived hidden |
| Reservation lifecycle | `active`, `cancelled`, `completed` |
| Payment state | Derived from payment ledger: `unpaid`, `partial`, `paid`, `refund_due`, `refunded` as applicable |
| Fulfilment | `not_arranged`, `pickup_arranged`, `fulfilled` |
| Payment review | Deadline passed and unpaid/partial; flag rather than releasing stock |

An active reservation continues blocking the item after payment and after its deadline. Completion creates a completed sale and keeps the work sold. Cancellation releases an unpaid item only through a controlled owner action. Paid cancellation requires refund handling and an explicit decision about whether the item is suitable for resale.

- Use a partial unique index to permit at most one active reservation per item, plus transaction-level item locks.
- Compute public availability from authoritative reservation/sale records; do not maintain independently editable flags that can drift apart.
- Lock the item first in reservation, cancellation, completion and direct-sale transactions, using the same lock order.
- Prevent price edits from changing existing reservation amounts. Prefer resolving an active reservation before changing its commercial terms.
- An overdue job is repeatable: one overdue event and at most one reminder per configured reminder stage.
- Owner may extend a deadline, correct a contact, cancel, resend an email or record a payment with an audit trail.
- A customer “I have transferred” message is a note, not proof of payment. Never mark paid from an email click or browser input.
- Store timestamps in UTC and display deadlines explicitly in Europe/Brussels, including daylight-saving changes.

## 6. Owner dashboard

### Overview

Show active reservations, overdue payment reviews, email failures, payments awaiting fulfilment, available pieces, and completed sales totals. Separate expected reserved value from money actually received. Use clear pending/error states and mobile-friendly forms.

### Collection manager

- List with thumbnail, title, internal stock code, category, price, publication and derived availability.
- Create/edit title, Dutch description, optional story, maker, period, material, dimensions, condition, price and categories.
- Upload multiple photos; choose cover, reorder, add alt text and remove unused images.
- Save draft, preview, publish, unpublish and archive. Publishing requires a valid positive price, description, category and completed cover-image upload.
- Drafts and private notes are never exposed in public responses.
- Record a direct/offline sale against an existing or new customer, using the same stock locking and sales history as web reservations.
- Preserve sold-item snapshots; avoid deleting items referenced by history.

### Reservations

- Filter by active, unpaid, partial, paid, overdue, cancelled and completed.
- Detail shows customer contact, work, price snapshot, deadline, transfer reference, payment instructions, message, ledger, email status and event timeline.
- Actions: extend deadline, record payment, record refund, arrange pickup, complete sale, cancel and resend applicable instructions.
- Recording payment requires amount and received date; default to the outstanding balance but allow partial/overpayments and warn about mismatches.
- Correct payment mistakes with reversal entries instead of erasing the original payment record.
- Never release a paid or partially paid reservation through a generic “cancel” button without resolving its money state.

### Customers

- Search name, email and phone. Profile includes preferred contact method, contact details, reservations, completed purchases, net received amount and owner-only notes.
- Contact actions use email/phone links; WhatsApp is a link only when a number and preference are present. The system does not send automated WhatsApp/SMS messages.
- Show each previously bought item, purchase date, actual sale price and fulfilment status.
- Manually create customers for in-person sales and add historical purchases with explicit historical dates.
- Match returning enquiries by conservatively normalized email. Never match by name alone, strip plus-tags or apply Gmail-specific dot rules.
- Treat matching as bookkeeping, not authentication. Preserve reservation-submitted contact snapshots and do not let an anonymous visitor overwrite existing customer fields or see purchase history.
- Owner can review duplicate suggestions and merge customers transactionally with history preserved.
- Export customers and purchase history to CSV; neutralize spreadsheet formula prefixes in exported user text.

### Settings

Business display name, owner notification address, reply-to address, beneficiary, IBAN, optional BIC, default deadline, pickup instructions, reservation terms and privacy-notice version. Email sender is deployment configuration restricted to a verified domain. Audit bank-detail changes and require recent owner authentication.

## 7. Database specification

All IDs are UUIDs unless indicated. Include `created_at` and appropriate `updated_at` timestamps. Add foreign keys, explicit deletion rules, checks and indexes in versioned SQL migrations.

| Table | Key fields and purpose |
| --- | --- |
| `owner_profiles` | Auth user ID, owner role, display name; only provisioned owners can access admin data |
| `categories` | Stable ID, slug, Dutch label, sort order; seed the current six categories |
| `items` | Stock code, slug, title, description, story, category ID, maker, period, material, dimensions, condition, `price_cents`, `currency`, publication state, publish/archive dates, version; owner-only notes kept in a separate private table |
| `item_images` | Item ID, original/thumbnail/grid/detail paths, width, height, alt text, position, cover flag, upload state |
| `customers` | Name, normalized email, phone, preferred channel, last activity; unique normalized email when present |
| `customer_notes` | Customer ID, owner ID, note text, timestamp; private |
| `reservations` | Item/customer IDs, unique human reference, lifecycle, deadline, fulfilment, submitted contact/message snapshot, item/title/price/currency snapshot, beneficiary/IBAN/instructions snapshot, accepted terms version and timestamp, creation source, idempotency linkage |
| `payment_entries` | Reservation or sale association, receipt/refund/reversal type, positive integer amount, currency, effective received date, bank reference, owner note, recorded-by owner; append-only |
| `sales` | Unique reservation ID when applicable, unique item ID for the initial single-sale scope, customer ID, item and final-price snapshots, sale date, fulfilment, source (`reservation`, `direct`, `historical`); inserted on completion |
| `reservation_events` | Reservation, event type, actor, safe metadata and timestamp; append-only history |
| `email_jobs` | Reservation, recipient kind/address snapshot, template/version, deduplication key, payload, queued/processing/sent/failed state, attempt count, next attempt, lease expiry, provider ID and safe error |
| `email_events` | Unique provider event ID, message ID, delivered/bounced/complaint event and timestamp |
| `business_settings` | Private singleton with bank details and notification settings; allowlisted non-sensitive public copy exposed separately |
| `request_keys` | Unique idempotency key, operation type, request hash, result reference and recovery-token metadata |
| `audit_events` | Actor, action, affected entity and redacted change metadata; no tokens or full email bodies |
| `rate_limit_buckets` | Short-lived request counters using keyed hashes for IP/email; cleanup expiry |

### Required integrity rules

- Positive price and payment amounts; `EUR` initially; refunds/reversals have explicit types rather than ambiguous signed input.
- Unique stock codes, reservation references, request keys, email deduplication keys and provider webhook event IDs.
- One cover image per item; transactionally reorder images and choose replacement cover.
- One active reservation per item and no new reservation for an already sold item.
- Completed purchase history comes from sales, not merely submitted reservation forms.
- Sales creation, completion, ledger consistency and audit events occur in a single transaction.
- Snapshot all customer-facing terms at creation; changing settings affects future reservations. Correcting historical payment instructions requires an audited explicit action and replacement email.
- Restrict hard deletion of records referenced by reservations/sales; support controlled anonymization/export policies instead.
- Index catalogue publication/category, active reservation item IDs, deadline review, normalized customer email and due email jobs.
- Returned goods and resale of the same physical item are outside the initial one-sale-per-item model; add an explicit returns/restocking model before supporting that workflow.

## 8. Security and access model

- Enable row-level security for every exposed table. Default deny.
- Anonymous users read only a deliberate public catalogue projection: item content, public image paths, price and availability. Use appropriate view security and grants; test that raw tables/private columns cannot bypass the projection.
- No anonymous direct inserts into customers, reservations, payments, email jobs or settings. Reservation creation is available only through the validating Edge Function and tightly granted transaction function.
- Owner permissions come from a protected server-controlled role record or auth claim, never editable user metadata or a frontend email check.
- Backend functions validate owner JWTs and role for privileged actions; browser hiding of `/admin` is only presentation.
- Use narrowly granted SQL functions, fixed `search_path` for privileged functions and revoked public execution. Do not expose a service-role reservation RPC to anonymous callers.
- Only the Supabase publishable key and public Turnstile site key enter frontend configuration. Supabase secret/service-role keys, Resend API key, webhook secret and rate-limit hash secret remain server-side.
- Provision the owner account securely, disable public signup and enable MFA. Configure custom SMTP for owner recovery/invitation mail; Supabase's default SMTP is restricted and is not the reservation mail service. See [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).
- Reservation public IDs and human references are not authorization credentials. A status page uses a high-entropy secret token, stored hashed, scoped to one reservation and revocable.
- Prefer passing the token through a URL fragment, exchanging it by POST and clearing it from the address bar. No customer details or tokens in query strings, analytics or request logs. Set no-referrer and no-store policies on sensitive flows.
- Status capability permits only minimal reservation/payment-instruction read access. It cannot read the customer's other purchases or mutate payment/cancellation state.
- Add request-size/input-length limits, server-side Turnstile verification, per-IP/email throttles, honeypot and global email-budget checks. CORS restricts browser origins but is not the abuse-control mechanism.
- Owner sessions on a static frontend need careful XSS prevention: plain-text descriptions initially, no arbitrary HTML, restrictive CSP and minimal third-party scripts on admin/reservation pages.
- Confirm image magic bytes, decoded dimensions, size and MIME type; reject SVG/HTML uploads and unsafe originals. Strip EXIF/location metadata from public derivatives.

## 9. Email delivery and recovery

### Required initial messages

| Recipient | Subject example | Contents |
| --- | --- | --- |
| Customer | “Je reservering bij LOTHUUS — [reference]” | Work/title/thumbnail, price and amount due, beneficiary, IBAN, transfer reference, exact deadline, pickup explanation, reply-to and private reservation-status link |
| Owner | “Nieuwe reservering — [work]” | Reference, work, customer-submitted contact/message, amount expected, deadline and authenticated dashboard link |

Also include payment-received confirmation, owner-triggered cancellation, and a single deadline reminder if enabled. Render HTML and plain text. Keep open/click tracking disabled by default; delivery/bounce signals are sufficient.

### Durable outbox

1. Reservation transaction inserts the two distinct initial email jobs. Never rely on an unawaited background task after returning the HTTP response.
2. After commit, attempt immediate dispatch through a worker; Cron processes any remaining due jobs every few minutes.
3. Workers claim a bounded batch with database locks and a lease so parallel workers cannot send the same job simultaneously.
4. Provider requests use a stable idempotency key per email job. Retry transient errors with backoff; quota exhaustion waits for the next eligible window.
5. Persist provider message IDs. Signed, deduplicated webhooks update delivered/bounced/complaint status. “Accepted by provider” and “delivered” remain distinct.
6. Permanent failure appears prominently in the dashboard with a safe error and resend/contact actions. Another email is not the only alert channel for an email-system failure.
7. Suppress queued payment instructions/reminders when a reservation has been cancelled, completed or otherwise superseded before send. Resends use current lifecycle plus the correct immutable financial snapshot.
8. Never release stock because an email failed. Confirmation page remains usable after successful commit.

Resend retains idempotency keys for 24 hours. This reduces duplicates but does not create indefinite exactly-once delivery. If a crash leaves send status ambiguous beyond that window, require reconciliation/owner review rather than blindly replaying the message. See [Resend idempotency keys](https://resend.com/changelog/idempotency-keys).

Scheduling can use [Supabase Cron with Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions); keep job credentials in Vault and avoid storing secrets in SQL source.

### Quota arithmetic and stopping behaviour

The mandatory initial pair consumes two emails per reservation. The theoretical limit is 50 new reservations/day or 1,500/month before owner auth emails, receipts, reminders, cancellations and retries. A four-message lifecycle lowers that theoretical ceiling to 25/day or 750/month. These are calculations, not guaranteed capacity; shared traffic also consumes allowance.

Maintain a safety buffer for essential messages and show remaining capacity in admin. Pause new online reservations before the system cannot enqueue/send both initial messages within an acceptable time; show a direct-contact fallback. Existing reservations remain valid, with queued messages and on-screen bank instructions. A provider outage cannot guarantee immediate inbox delivery, so make that distinction visible.

Configure verified sender DNS (SPF/DKIM and an appropriate DMARC policy), an owner-monitored reply-to address and signed webhook verification. Store no complete bank statements or payment-card details.

## 10. Image management and capacity

- Owner uploads from phone or desktop with progress, preview, reorder and retry.
- Keep originals in a private staging/archive bucket, or allow original deletion after verified local backup. Only web-ready derivatives belong in the public published bucket.
- Generate approximately 320 px thumbnails, 800 px grid images and up to 1600 px detail images as WebP/JPEG before uploading; validate dimensions and formats server-side. Recheck output quality and orientation.
- Example budget: 120 items × 4 photos × 3 derivatives averaging 150 KB each is about 216 MB, excluding originals. Actual sizes vary; show storage use before it becomes a problem.
- Storage bandwidth can run out before storage capacity. Lazy-load grid images, use thumbnails where appropriate, versioned immutable paths and cache headers, and avoid loading all detail photographs at page load.
- Supabase's built-in image transformations are not a dependency of this free plan. Retain pre-generated sizes.
- Do not publish an item until all required files and metadata exist. Clean up abandoned staging uploads on a schedule.
- Upload/edit access is owner-only. Published photos are public; do not store customer attachments or private documents in that bucket.
- Unpublishing metadata does not revoke already-public cached photo URLs. Use private/signed access if any image must be confidential.

## 11. Privacy and operational care

Collect only contact information needed for the reservation and fulfilment. Do not require a postal address for pickup. Owner notes must be relevant business notes, with no unnecessary sensitive information.

Implement a privacy notice, recorded notice/terms versions, configurable retention for abandoned enquiries, customer export and controlled anonymization. Separate operational contact from optional marketing consent. Choose an EU database region and document processors and access. Exact retention periods and legally required sales records must be settled against the owner's actual business obligations before production; this plan is not a legal determination.

### Backups and availability

- Version migrations and code in a repository; this workspace currently has no Git repository metadata, so establish version control before deployment.
- Maintain encrypted database backups and separate image backups. CSV customer exports alone are not a full backup.
- Schedule a supported `pg_dump`/Supabase CLI export from a trusted machine, at least daily when taking orders and before migrations; store outside the app account with restricted access. Account for where that machine runs and backup retention rather than assuming a free always-on runner.
- Verify restoration into a local/test project, including database relationships and photo paths.
- Free-tier inactivity pausing remains an availability limitation. Show a truthful retry/contact state during outages; do not use artificial activity to evade provider rules.
- Track last successful email dispatch, oldest queued job, last scheduled review, quota use and last backup. An owner-run dashboard check is part of the initial free operating model; fully managed uptime/backup guarantees are not included.

## 12. Endpoint and transaction contracts

These are Supabase Edge Function operations, not Next.js API routes.

| Operation | Access | Behaviour |
| --- | --- | --- |
| `create-reservation` | Public + valid abuse checks | Input item ID, expected price/version, contact, terms version, idempotency key; returns committed reservation reference and scoped capability |
| `reservation-status` | Reservation capability | Minimal status, price snapshot, bank instructions and deadline; no customer history |
| `owner-reservation-action` | Owner JWT + role | Explicit extend/cancel/complete/contact-correction/resend commands with expected record version |
| `owner-record-payment` | Owner JWT + role | Idempotent receipt/refund/reversal ledger mutation and resulting audit/event jobs |
| `owner-record-direct-sale` | Owner JWT + role | Lock stock and create customer association, sale, ledger and history atomically |
| `owner-merge-customers` | Owner JWT + role | Transactional association merge with audit and duplicate resolution |
| `process-email-jobs` | Scheduler/service credential | Claim/send/reconcile a bounded batch; never publicly callable |
| `review-overdue-reservations` | Scheduler/service credential | Flag overdue and queue eligible single reminders; no automatic relisting |
| `email-webhook` | Valid provider signature | Deduplicate and persist delivery events; never modify payment state |

Use deliberate response codes: validation failure, forbidden, unavailable/price conflict, rate-limited, service unavailable and success. Return localized user-safe errors and a request ID. Log redacted technical details privately. Owner edits use version checks to prevent one open tab overwriting another.

## 13. Planned source layout

```text
BACKEND-PLAN.md
src/lib/domain/                 # types, money formatting, lifecycle rules
src/lib/data/                   # catalogue/admin repository contracts
src/lib/supabase/client.ts      # publishable browser client only
src/lib/validation/             # shared schemas, no server credentials
src/components/reservation/    # form, confirmation and status display
src/components/admin/          # collection, reservations, customers, settings
src/app/admin/page.tsx
src/app/admin/item/page.tsx
src/app/admin/reservations/page.tsx
src/app/admin/reservation/page.tsx
src/app/admin/customers/page.tsx
src/app/admin/customer/page.tsx
src/app/admin/settings/page.tsx
src/app/reservation/page.tsx
supabase/config.toml
supabase/migrations/           # schema, policies, indexes, RPCs and jobs
supabase/functions/_shared/    # auth, validation, mail, redaction
supabase/functions/...         # operations listed above
supabase/tests/                # meaningful policy and transaction tests
docs/backend-setup.md
docs/owner-guide.md
docs/operations.md
```

Browser environment: Supabase URL, Supabase publishable key and Turnstile site key. Edge secrets: Supabase privileged key, Resend key, Turnstile secret, webhook signing secret, hash secret and canonical allowed frontend origins. Put safe names/placeholders in `.env.example`; never commit live secrets.

## 14. Implementation phases

### Phase A — Prepare before connecting hosted Supabase

Deliver domain types, repository contracts, owner dashboard screens, item/image editor, reservation UI, customer history screens, email templates, SQL migrations, Edge Function source, `.env.example` and setup/owner documentation. Use a deterministic local fixture adapter and simulated email outbox for development.

Where available, run the Supabase CLI stack locally so real SQL policies and transaction behaviour can be tested before a hosted account is connected. A browser-only fixture adapter is insufficient evidence for reservation safety. Keep demo mode visibly labeled and disabled for production reservations.

### Phase B — Provision Supabase later

Create the EU-region project, apply migrations, configure storage buckets/policies, provision the owner, disable public signup, enable MFA, connect secrets and deploy functions. Replace fixture adapter with live Supabase repositories. Validate RLS as anonymous, owner and unrelated authenticated users.

Deliverable: persistent owner-managed real inventory and private customer records. No public reservations until mail and bank settings are ready.

### Phase C — Activate reservation and emails

Verify sending domain, configure SMTP for owner account emails and API mail for reservations, add provider webhook, set actual beneficiary/IBAN, enable Cron and execute end-to-end tests against controlled inboxes. Confirm both recipients receive messages and reply-to reaches the owner.

Deliverable: public reservations with atomic item locking, durable mail, status capability, manual payment recording and owner review of overdue holds.

### Phase D — Launch and handover

Deploy static frontend, configure origins/CSP/referrer policy, import real catalogue, confirm price/availability, test mobile owner tasks, back up and restore a sample, document outages/quota handling, and train the owner on reservation → bank check → pickup → completed sale.

Launch only after the checklist below passes. No fabricated bank details, demo stock, fake send success or configured-but-untested recovery paths.

## 15. Acceptance and release checks

### Functional

- Owner can create a draft with photos, edit it, reorder/select cover and publish a priced item.
- Catalogue reflects the update without redeploying; draft/private content remains inaccessible.
- Valid reservation immediately blocks the work and shows matching immutable bank instructions on screen and in email.
- Separate customer and owner emails are both delivered in the controlled end-to-end test.
- Owner can find the reservation, contact the customer, record actual payment, arrange pickup and complete the sale.
- Returning customer's completed purchases are grouped without exposing them to an anonymous submitter with the same email.
- Direct sale cannot race successfully against a web reservation for the same item.
- Unpaid cancellation releases the item; overdue review alone does not.

### Integrity and failure tests

- Two concurrent buyers produce exactly one successful active reservation.
- Repeat submission and timeout recovery produce one reservation and one initial job per recipient.
- Mid-transaction failure rolls back stock, customer association, reservation and email jobs together.
- Stale price/version requires visitor review; existing reservations retain original amounts after catalogue/settings edits.
- Anonymous and unrelated authenticated users cannot read customers, contact snapshots, bank settings, private notes or email jobs, or invoke owner RPCs.
- Secret-free frontend bundle; owner role cannot be escalated through user metadata.
- Invalid/oversized image rejected; incomplete uploads cannot publish; orphan files are cleaned up.
- Provider outage, quota exhaustion, bounce, duplicate webhook, expired lease and ambiguous send are recoverable without losing or duplicating reservations.
- Payment/refund/reversal actions are idempotent; partial payments and money/stock conflicts are handled explicitly.
- Reminder job respects deadline extensions, paid/cancelled states and daylight-saving display.
- Unknown/expired status tokens reveal nothing; references alone grant no access.
- Backup restoration recreates reservations, sales, relationships and images.

Run existing packing tests, typecheck and production build after integration, plus targeted database/policy/concurrency tests. Test the actual exported frontend against the backend, not only Next dev mode.

### Required owner inputs before going live

- Real sellable works, original images, descriptions, condition and prices.
- Actual beneficiary name, IBAN, optional BIC and reservation payment policy.
- Owner notification address, monitored reply-to and DNS access to a usable sending domain.
- Pickup/delivery arrangements, business/contact identity, approved terms/privacy wording and retention decisions.
- Hosting/Supabase account access, securely provisioned credentials, and an agreed backup location/operator.

## 16. Scope boundary

The complete first release covers catalogue management, secure owner access, one-item reservations, two-sided transactional email, manual transfer tracking, customer contact/history, direct sales, reminders, exports, backups and operational documentation.

Potential later work: deposits, shipping price calculation, multi-item atomic reservations, invoices, customer accounts, marketing campaigns, automated bank reconciliation, returns/restocking, advanced accounting and product-specific search/social metadata. None is required for the requested direct-sale reservation model.
