# Online backend en beheer

Hostingkeuze: **Vercel**. De ongewenste Cloudflare Worker is op 24 oktober 2026 verwijderd. Er is geen actieve Cloudflare-webhosting. Definitief adres na domeinregistratie en Vercel-koppeling: **https://www.lothuus.be/admin**. De handleiding voor Katrien staat in `docs/owner-guide.md`.

## Diensten en toegang

- Cloudflare wordt uitsluitend voor private R2-opslag gebruikt; er is geen applicatie-Worker.
- Supabase-project: `gzrxxdmhonzcfkomowpo`, naam `LOTHUUS productie`, EU/Ierland.
- Eigenaarslogin: `katrien@lothuus.be`. Het wachtwoord staat niet in broncode of deze documentatie. De bevestigde account heeft `app_metadata.role=owner`; de server controleert daarnaast de vaste `ADMIN_USER_ID` via `auth.getUser()`.
- Publieke registratie en anonieme accounts zijn uit. Wachtwoorden vereisen minimaal 12 tekens, kleine/hoofdletters, cijfers en een symbool. Wachtwoordwijziging vereist een actuele login en het huidige wachtwoord. De applicatie biedt geen wijziging van het inlogadres.
- SSR-cookies zijn HTTP-only en in productie Secure, met een bewaartermijn van acht uur. Gewoon uitloggen beëindigt de huidige sessie. Wachtwoord wijzigen meldt andere sessies af. Geteste ingetrokken tokens worden door Supabase geweigerd.
- Vercel gebruikt de standaard Next.js Node-runtime, sharp voor beeldverwerking en het S3-protocol voor R2. Vul de servervariabelen uit `.env.example` in Vercel in. De R2-toegang moet tot de benodigde buckets beperkt zijn; sleutels blijven op de server. De verwijderde Worker-secrets zijn geen Vercel-configuratie.
- Lokale `.env.local` en `.dev.vars` zijn genegeerd en hebben modus 0600. Wrangler bewaart zijn OAuth-toegang versleuteld, met de sleutel in macOS Keychain. De expliciet goedgekeurde rechten zijn User Read, Account Read, Workers Write, Workers Scripts Write en Background Access.

## Database

De bestaande bedrijfslogica blijft in `src/lib/backend/service.ts`. `cloud.ts` laadt de toestand en commit wijzigingen met een revisievergelijking. Een gelijktijdige schrijver veroorzaakt een begrensde retry; callbacks mogen daarom alleen zuivere gegevensbewerkingen doen. Uploads of echte e-mail horen niet in zo’n callback.

Dit is een compacte Postgres-aggregate voor de huidige catalogus, met afzonderlijke tabellen voor media, permanente productnummers, unieke voorraadclaims en rate limits. Het is geen volledig genormaliseerd verkoopplatform. Bij sterke groei van orderhistoriek of verkeer moet de aggregate in gerichte queries en transacties opgesplitst worden. Een ETag voorkomt herhaald downloaden van ongewijzigde beheergegevens; bij actieve bestellingen wordt ten minste per minuut op tijdgebonden wijzigingen gecontroleerd. Foto-autorisatie vraagt alleen een boolean op en downloadt geen volledige inventaris.

De Security Advisor is uitgevoerd: geen errors. Twee standaardwaarschuwingen over publieke uitvoerrechten op Supabase’s `rls_auto_enable`-eventtrigger zijn verholpen door onnodige EXECUTE-rechten in te trekken; de automatische RLS-trigger blijft behouden. De vijf informatieve meldingen over ontbrekende RLS-policies zijn bewust: deze private tabellen weigeren alle gewone rollen en worden alleen via de server/service role gebruikt. De waarschuwing over gelekte wachtwoorden blijft bestaan: Supabase biedt die ingebouwde controle alleen op Pro en hoger. Het huidige Free-project heeft wel de genoemde sterke wachtwoordeisen en herauthenticatie. Er is geen extra betaald Supabase-abonnement geactiveerd.

Alle applicatietabellen staan in het niet-publieke schema `app_private`, met RLS aan. `anon` en `authenticated` hebben geen tabeltoegang. Alle zeven RPC-functies zijn security invoker, hebben een vaste lege search path en zijn uitsluitend uitvoerbaar door `service_role`.

De nummerregistratie verwijdert geen oude nummers. De voorraadclaim heeft een unieke sleutel op productidentiteit voor actieve/voltooide bestellingen. De volledige commit rolt terug bij een dubbele claim of ontbrekende, nog niet gereed gemelde foto.

Migraties staan in `supabase/migrations/`. Ze zijn op de lege productie via de SQL-editor toegepast en opnieuw uitvoerbaar zonder bestaande gegevens te vervangen. De SQL-editor registreert dit niet automatisch in de CLI-migratiehistoriek. Bij latere CLI-koppeling de historie eerst reconciliëren; niet blind repareren of een andere database overschrijven.

`repository.ts` en `local-auth.ts` blijven beschikbaar voor geïsoleerde ontwikkeltests. De HTTP-routes vallen in productie niet terug op SQLite of een lokaal wachtwoord als cloudconfiguratie ontbreekt.

## Foto’s en import

De private EU-buckets zijn `lothuus-media` en `lothuus-backups`; publieke r2.dev-toegang staat uit. Browseruploads gaan via de eigenaar-geauthenticeerde serverroute. Er is geen browser-CORS of publiek uploadtoken nodig.

Uploads zijn maximaal 15 MB en 40 megapixels. De server bewaart de upload onder `originals/<uuid>` en WebP-varianten onder `variants/<uuid>-thumb.webp`, `-grid.webp` en `-detail.webp` (320/800/1600 px). Beeldverwerking gebeurt met sharp in Node.js. De mediaregistratie wordt pas aangemaakt nadat alle varianten zijn opgeslagen. Alleen geselecteerde foto’s van gepubliceerde producten zijn zonder eigenaarslogin bereikbaar via `/api/images`.

De fotoroute gebruikt een private browsercache met `no-cache` en een ETag per foto-ID en formaat. Iedere heraanvraag controleert eerst de eigenaar of actuele publicatiestatus; pas daarna kan een `304` de bestaande browserkopie hergebruiken zonder R2-read. Er is geen gedeelde CDN-cache voor privéfoto’s. Foto-ID’s worden bij nieuwe uploads aangemaakt en mogen niet met andere beeldinhoud worden overschreven.

De 195 fotogroepen zijn als privéconcept overgezet: K1–K103, G1–G51 en H1–H41. Prijzen en ontbrekende inhoud zijn niet geschat. Alle 808 aangeleverde webfoto’s zijn bewaard, inclusief de extra’s van K012 en G029. De productfiche bevat maximaal acht geselecteerde foto’s; `sourcePhotos` bewaart de volledige importkeuze voor herstel in de editor. De oorspronkelijke openbare fotocatalogus blijft als bestaande referentie beschikbaar.

Het hervatbare manifest staat lokaal in `.data/cloud-import.json` en in R2 op `lothuus-backups/imports/collection-2026-10-24.json`. `npm run collection:import` toont eerst een rapport; `npm run collection:import -- --apply` voert uit/hervat. Identiteiten worden herkend aan een vaste creation key; bestaande fiches worden niet opnieuw aangemaakt. De import gaat via bestaande Wrangler-rechten, zonder extra blijvende S3-credential.

Foto’s hebben geen automatische vervaldatum. Mislukte uploads kunnen ongekoppelde blobs achterlaten. Verwijder ze alleen na vergelijking met zowel productfoto’s, `sourcePhotos`, importmanifest en mediaregistratie; verwijder nooit uitsluitend op basis van publicatiestatus. De lokale cleanup-opdracht is uitsluitend voor de SQLite-testadapter en mag niet op R2 worden toegepast.

## Backups na verwijderen van de Worker

De bestaande R2-backups blijven bewaard, inclusief `database/latest.json`, gedateerde snapshots met SHA-256 en het importarchief. De bewaartermijn voor `database/` is 45 dagen. De dagelijkse Cloudflare-planning is met de ongewenste Worker verwijderd en is **niet meer actief**. Een nieuwe geauthenticeerde scheduler moet bij het aansluiten van Vercel worden ingericht en getest; de aanwezigheid van oude snapshots betekent niet dat nieuwe backups automatisch plaatsvinden.

`npm run backup:verify` controleert de bestaande private backup via lokale Wrangler-toegang en herstelt deze in een nieuwe map onder `.backups/restore-test-*`, zonder productie te overschrijven. De uitgevoerde hersteltest controleerde 195 producten, 808 bronfotoverwijzingen, 809 mediaregistraties en het permanente nummerregister. Foto's zelf blijven in de aparte mediabucket en zijn geen tweede onafhankelijke mediakopie. Auth-wachtwoorden en serverkeys zitten niet in het database-snapshot.

## GitHub en Vercel

1. Importeer `kevinb42O/lothuus` in Vercel met framework Next.js, Node 24, installatie `npm ci` en build `npm run build`. Gebruik de repository-root.
2. Stel de servervariabelen uit `.env.example` in via Vercel Environment Variables. Gebruik productiegegevens alleen voor Production; geef niet automatisch elke pull-request-preview toegang tot de echte database. Commit nooit `.env.local`, `.dev.vars`, sleutels of klantbackups.
3. Supabase Auth/Postgres en R2 blijven de bestaande diensten. Maak voor Vercel bucket-beperkte R2 S3-credentials; de lokale Wrangler OAuth is geen productiecredential voor Vercel.
4. Koppel het domein aan Vercel zodra het geregistreerd is. Stel `APP_ORIGIN` op de exacte browser-origin in en test HTTPS, inloggen, wachtwoord wijzigen, privéfoto's, opslaan en uitloggen.
5. Richt de dagelijkse backup opnieuw in. Test een nieuwe snapshot en `npm run backup:verify` voordat automatisch herstel als operationeel wordt beschouwd.

**Nog op te lossen voor productie-uploads op Vercel:** de bestaande multipart-uploadroute accepteert 15 MB, terwijl Vercel Functions een request-bodylimiet van 4,5 MB hebben. Voor de beloofde 15 MB is een geauthenticeerde directe R2-upload met kort geldige ondertekende URL, passende bucket-CORS en een server-side finalisatiestap nodig. De huidige route werkt alleen binnen de platformlimiet. Zie [Vercel Function limits](https://vercel.com/docs/functions/limitations). De Vercel-deployment en deze uploadaanpassing zijn nog niet uitgevoerd.

Validatie: `npm test`, `npm run typecheck` en `npm run build`. Geen Workers-adapter, Workers-deployscript of Cloudflare-applicatieconfiguratie is nodig.

## Resterend voor publieke lancering

- Domein lothuus.be registreren. Daarna DNS volgens Vercel instellen en `www.lothuus.be` aan het Vercel-project koppelen, HTTPS controleren en de gewenste apex-redirect instellen. De Supabase Site URL staat al op `https://www.lothuus.be`; voeg bij de toekomstige mailflow alleen exacte benodigde redirects toe.
- E-maildienst/SMTP, geverifieerd verzenddomein, SPF/DKIM/DMARC, bezorgstatus en retries en wachtwoordherstel aansluiten en testen. De uitbox bevat nu alleen voorbeelden; er wordt geen echte mail verzonden.
- Bank- en contactgegevens en toepasselijke voorwaarden/privacytekst invullen. Publieke reserveringsaanvragen en directe betaalinstructies staan uit tijdens de inrichting. Pas activeren na controle van de volledige klantflow.
