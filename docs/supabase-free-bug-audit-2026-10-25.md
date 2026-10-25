# Bug- en verbruiksaudit — 25 oktober 2026

De huidige applicatie doet onnodige herhaalde Supabase-aanvragen. De grootste bron is de publieke collectie, gevolgd door lege hartjessynchronisaties en herhaald ophalen van volledige rapporten. De bezoekregistratie zelf heeft geen periodieke netwerkheartbeat.

Scope: publieke collectie, hartjesclient, bezoekersclient, beheer, reserveringsstatus, API-routes, Supabase-RPC's, retentie, herstel en beschikbare verbruiksmetingen. Baseline: commit `a9aa922`, aangevuld met de op het auditmoment aanwezige wijzigingen in de gedeelde werkboom. Tijdens de audit zijn ook andere wijzigingen aangebracht; de hieronder vermelde open bevindingen zijn tegen de laatste gelezen bron gecontroleerd. De oorspronkelijke metingen hieronder zijn bewaard. De herstelstatus staat apart vermeld.

## Gemeten en gereproduceerd

- Productie: 195 objecten, geen reserveringen, klanten of uitboxberichten in de gelezen winkelstaat.
- De genormaliseerde RPC-respons van de winkelstaat is 231.846 bytes. De daadwerkelijke JSON-respons was 246.905 bytes, gecomprimeerd met gzip tot 40.744 bytes.
- De huidige collectiepoller doet vier uitlezingen per minuut per zichtbaar tabblad. Bij dezelfde responsomvang is dat circa **9,8 MB aan gecomprimeerde RPC-antwoorden per bezoekersuur**. Duizend bezoeken van tien minuten zouden alleen voor deze poller ongeveer **1,63 GB** aan antwoorddata opleveren. Dit is een berekening op basis van één gemeten respons, geen uitlezing van de maandelijkse facturatieteller; headers, compressie en toekomstige gegevensgroei kunnen het werkelijke verbruik veranderen.
- De bestaande productiefunctie voor databasegrootte rapporteerde 29.585.269 bytes, circa 29,6 MB. Deze functie telt de databases van het project samen. Er is nu geen aanwijzing voor acuut ruimtegebrek.
- Geïsoleerde clientreproductie: één hartjesactie verstuurde twee HTTP-aanvragen, waarvan één leeg. Drie synchronisaties zonder gewijzigde selectie verstuurden drie lege HTTP-aanvragen.
- Een publieke Supabase-sleutel kreeg geen toegang tot `lothuus_load_state` en `lothuus_analytics_report`: HTTP 401 met databasecode `42501`.

Supabase Free biedt volgens de actuele documentatie 500 MB database per project en 5 GB egress op organisatieniveau. Het aantal API-aanvragen is geen afzonderlijke eindige Free-bundel; hoeveelheid antwoorddata, databasebelasting en opslag blijven wel relevant. [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [Supabase pricing](https://supabase.com/pricing).

## Oorspronkelijke bevindingen

**1. P1 — De publieke collectie downloadt iedere vijftien seconden de volledige winkelstaat.**

Locatie: `src/components/lothuus.tsx:88`, `src/app/api/catalogue/route.ts:7`, `src/lib/backend/cloud.ts:20`.

Ieder zichtbaar tabblad blijft de catalogus ophalen, ook als niets verandert. `withStore(catalogue)` haalt daarvoor alle producten, klanten, bestellingen, uitbox en overige winkelstaat van Supabase naar de applicatieserver. Alleen daarna wordt de publieke projectie gemaakt. De route is dynamisch en gebruikt `no-store`; een gedeelde cache of voorwaardelijke publieke uitlezing ontbreekt. De private velden gaan hierbij niet mee naar de browser, maar ze tellen wel mee in de interne Supabase-respons.

Benodigde oplossing: een gerichte publieke projectie en gedeelde servercache met expliciete invalidatie bij publiceren, voorraadwijzigingen en tijdgebonden reserveringsverval. Een licht revisie-/beschikbaarheidsantwoord kan de volledige catalogus alleen bij wijzigingen laten ophalen. Controleer beschikbaarheid altijd opnieuw in de bestaande reserveringstransactie.

**2. P1 — De publieke bezoekendpoint heeft geen passende bescherming vóór de database.**

Locatie: `src/app/api/analytics/visit/route.ts`, `supabase/migrations/20261025140000_visitor_analytics.sql:25`.

De globale grens is 2.000 aanvragen per minuut en wordt pas binnen PostgreSQL gecontroleerd. Iedere aanvraag die die controle bereikt, leest de configuratie en schrijft de minutenteller, ook boven de grens. Een willekeurige nieuwe UUID kan als nieuw bezoek worden ingestuurd. De Origin- en User-Agent-controles zijn geen bescherming tegen een client die zelf headers instelt. De grens laat theoretisch 5,76 miljoen tijdelijke gebeurtenissen in 48 uur toe, met aanvullende index- en schrijflogbelasting. Dat is te ruim als bescherming van een Free-project met 500 MB databasebudget. Eventuele externe firewallregels zijn niet onafhankelijk geverifieerd; deze bevinding betreft de bescherming in de applicatiecode.

Benodigde oplossing: begrenzing aan de edge vóór de Supabase-aanroep, een op werkelijk verkeer afgestemd globaal budget en een servermatig uitschakelpad. Bewaar de eis dat bezoekregistratie geen cookies of blijvende browseridentiteit gebruikt. `NEXT_PUBLIC_VISITOR_TRACKING=false` wordt nu alleen door de client gelezen; daarmee wordt de serverendpoint zelf niet uitgeschakeld.

**3. P1 — Het aanwezige cloudbackupformaat dekt de nieuwe gegevens niet.**

Locatie: `supabase/migrations/20261024024905_safe_stock_refresh.sql:32`, `scripts/verify-backup.ts:15`, `vercel.json`, `docs/production.md`.

`lothuus_backup_state` bevat de winkelstaat, mediaregistratie en permanente productnummers. Hartjes, bezoekersdagtotalen, hostingaccount, hostingbestellingen en gekochte rechten ontbreken. De herstelcontrole controleert hetzelfde oudere formaat. De applicatie bevat geen actieve cloudbackupscheduler; de documentatie meldt dat de eerdere scheduler is verwijderd. Een buiten de repository ingerichte vervanger is tijdens deze audit niet operationeel aangetoond. Supabase Free levert geen inbegrepen automatische databasebackups.

Benodigde oplossing: een volledige, geversioneerde cloudbackup van alle benodigde applicatietabellen, een geauthenticeerde planning, begrensde retentie en een herstelcontrole die ook hostingrechten en geaggregeerde meetgegevens controleert. Tijdelijke bezoek-ID's horen niet onbedoeld langer via backups bewaard te worden dan het gekozen privacybeleid toestaat. [Supabase pricing](https://supabase.com/pricing).

**4. P2 — Hartjes versturen lege aanvragen na een actie en vervolgens iedere dertig seconden.**

Locatie: `src/lib/hearts/client.ts:49`, `src/components/lothuus.tsx:130`, `src/lib/hearts/server.ts:23`.

`deliver()` gaat na het leegmaken van een batch nogmaals de lus in en verstuurt de lege wachtrij. Een bestaand journal wordt bovendien iedere dertig seconden geflusht zonder dat een selectie is gewijzigd. Dat blijft ook gebeuren na het verwijderen van alle hartjes. De lokale reproductie bevestigt beide gevallen.

Een normale lege synchronisatie gebruikt vier database-RPC's: rate limit, configuratie, volledige winkelstaat en de writefunctie. De writefunctie actualiseert de browserregel en voert retentie uit. Dit veroorzaakt echte uitlezingen en writes voor een ongewijzigde selectie.

Benodigde oplossing: stop zodra de wachtrij leeg is en lever wijzigingen en retries op gebeurtenissen af. Als een actualisering van `seen_at` nodig blijft voor de meetdefinitie, geef die een afzonderlijke, ruime geldigheidsduur en een kleine serverfunctie die geen volledige catalogus laadt.

**5. P2 — Meerdere beheerpollers blijven tegelijkertijd actief.**

Locatie: `src/components/admin/admin.tsx:65`, `src/components/admin/hearts.tsx:34`.

De algemene beheerpoller haalt iedere vijftien seconden `/api/store` op, ook tijdens Bezoekers en Hartjes. De ETag voorkomt bij een ongewijzigde winkelstaat een volledige download, maar eigenaarcontrole en een Supabase-revisie-RPC worden nog uitgevoerd. Hartjes heeft daarnaast een eigen vijftiensecondenpoller. Iedere hartjesrapportaanvraag gebruikt een hosting-RPC, een hartjesrapport-RPC en een volledige winkelstaatuitlezing. Met de algemene revisiecontrole erbij gaat het bij de ongewijzigde Hartjespagina om ongeveer zestien database-RPC's per minuut, exclusief authenticatie.

Benodigde oplossing: ververs per zichtbare sectie en volgens de actualiteit die nodig is. Vermijd dubbele beheerpollers; gebruik focusverversing alleen als de laatst geladen gegevens oud genoeg zijn. Bestelmeldingen kunnen een klein eigen revisieantwoord gebruiken.

**6. P2 — Het hartjesrapport downloadt alle bewaarde historie voordat periode en paginering worden toegepast.**

Locatie: `src/app/api/admin/hearts/route.ts:20`, `src/lib/hearts/server.ts` (`rawHearts`), `supabase/migrations/20261025120000_heart_interest.sql` (`lothuus_heart_report`).

De RPC retourneert alle objectmomentopnamen, maximaal 24 maanden dagregels en alle actuele selectietotalen. De Free-periodefilter wordt pas daarna in JavaScript toegepast. Ook zoeken, pagineren en openen van een object haalt opnieuw het volledige rapport en de winkelstaat op. De kosten nemen daardoor toe met de totale historie, ook wanneer de eigenaar alleen zeven dagen of één object bekijkt.

Benodigde oplossing: periode, relevante objecten en aggregatie in SQL begrenzen, met gerichte antwoorden voor lijst, grafiek en objectdetail. Geef alleen de gegevens terug die voor het getoonde rapport nodig zijn.

**7. P2 — Bestelstatus blijft periodiek laden na een eindstatus.**

Locatie: `src/components/reservation.tsx:15`, `src/app/api/reservations/route.ts:13`.

De statuspoller controleert alleen of een token bestaat. Na `completed`, `cancelled` of `expired` blijft de pagina iedere vijftien seconden aanvragen doen. Iedere aanvraag gebruikt een rate-limit-RPC en laadt de volledige winkelstaat. In de reserveringsmodal kan dit tegelijk met de collectie- en hartjestimers gebeuren.

Benodigde oplossing: stop periodiek laden bij een eindstatus. Gebruik tijdens een actieve afspraak een langere of oplopende wachttijd en een handmatige/focusverversing met een minimale ouderdom.

**8. P2 — De onderhoudslog van Cron heeft geen retentie in de repository.**

Locatie: `supabase/migrations/20261025140000_visitor_analytics.sql:77` en de overige Cron-migraties.

De bezoekersopruiming draait iedere vijf minuten: 288 uitvoeringen per dag. De bezoek-ID's en minutentellers worden opgeruimd, maar voor `cron.job_run_details` is geen opruiming aangetroffen. Supabase bevestigt dat deze tabel niet automatisch wordt geleegd. Alleen deze job kan daardoor circa 105.000 logregels per jaar toevoegen, ook zonder websitebezoek. Een eventueel al buiten de repository ingestelde algemene logretentie is niet opnieuw via de SQL-editor gecontroleerd.

Benodigde oplossing: dagelijkse retentie voor afgeronde Cron-uitvoeringen, bijvoorbeeld zeven dagen, en zichtbaarheid van mislukte opruimjobs. De bestaande vijfminutenjob zelf is interne database-opruiming en veroorzaakt geen catalogusdownload naar een browser. [Supabase Cron quickstart](https://supabase.com/docs/guides/cron/quickstart#clean-up-job-run-history).

**9. P2 — De hostingmeter bewaakt het Supabase-egressbudget niet.**

Locatie: `src/lib/hosting/traffic.ts`, `src/components/admin/hosting.tsx:37`, `src/lib/hosting/server.ts`.

De weergegeven verkeerswaarde meet succesvolle R2-mediadownloads. De toelichting benoemt dit bereik, maar Supabase-API-antwoorden en authenticatieverkeer zitten er niet in. Een lage waarde op dit paneel betekent daarom niet dat de Supabase Free-bundel weinig wordt gebruikt. Er zijn geen geïmplementeerde waarschuwingen voor dat egressbudget aangetroffen.

Benodigde oplossing: afzonderlijke operationele controle van Supabase-organisatieverbruik en databasegroei. Vermeld meetbron en meetperiode bij iedere waarde; tel dezelfde levering via meerdere diensten niet dubbel als websiteverkeer.

**10. P2 — Terugkeren naar een oud gepagineerd bezoekersrapport kan een fout veroorzaken.**

Locatie: `src/components/admin/visitors.tsx:98`, `src/components/admin/visitors.tsx:130`, `src/app/api/admin/analytics/route.ts:21`.

Reproductiepad: een uitgebreide periode openen, naar pagina twee van de dagtabel gaan, naar een andere periode schakelen, meer dan vijftien minuten wachten zonder focusverversing en terugschakelen. De cache bewaart pagina twee en de oude `to`. Het laden van pagina één neemt die oude afkapping over, terwijl de API afkappingen ouder dan vijftien minuten weigert. Dit betreft uitgebreide periodes op een betaald pakket; Free heeft onvoldoende dagen voor deze paginering.

Benodigde oplossing: bij een periodewissel een nieuwe afkapping nemen en verlopen cache-items niet voor paginering hergebruiken. Bewaar de afkapping alleen bij navigatie binnen een nog geldig rapport.

## Wat de bezoekersanalytics al goed begrenst

- De publieke tracker heeft geen interval dat permanent HTTP-aanvragen verstuurt. Een geldige browsersessie wordt eenmaal geregistreerd; retries zijn begrensd en houden dezelfde gebeurtenissleutel. Na dertig minuten inactiviteit kan een volgende activiteit een nieuwe sessie beginnen.
- De bezoekersrapportage aggregeert tijdelijke gebeurtenissen in PostgreSQL. Individuele gebeurtenissleutels worden niet voor ieder dashboardrapport gedownload.
- Tijdelijke bezoekersregistraties hebben 48 uur retentie, een tijdindex en een begrensde opruimbatch. De dagtotalen blijven compact: maximaal vier apparaatregels per dag.
- De bezoekersmeting gebruikt geen cookies of blijvende browseropslag en verstuurt meetaanvragen met `credentials: 'omit'` en `referrerPolicy: 'no-referrer'`.
- Verouderde antwoorden worden in de bezoekersinterface genegeerd, lopende aanvragen worden afgebroken bij vervanging, en de interface heeft een tabelalternatief en ondersteuning voor verminderde beweging.

## Verificatie en grenzen

- De laatste volledige testsuite slaagde: **154 tests geslaagd, nul mislukt**. Een eerdere run van de tijdens de audit verbrede suite vond een inmiddels aangepaste tekstassertie in de uploadtest; de afsluitende volledige run is groen. TypeScript en `git diff --check` slaagden eveneens.
- De lege hartjesaanvragen zijn aanvullend gereproduceerd met een geïsoleerde browseropslag en gemockte HTTP-laag; er zijn daarvoor geen productiehartjes geschreven.
- Productiecontrole gebruikte beperkte uitlezingen van winkelstaatgrootte, databasegrootte en bestaande meetwaarden. Alleen aantallen en omvang zijn gerapporteerd. De twee controles met de publieke sleutel werden geweigerd.
- `npm audit --omit=dev` rapporteerde nul bekende kwetsbaarheden in productieafhankelijkheden.
- De Next.js-documentatie uit de geïnstalleerde versie over Route Handlers en caching is geraadpleegd. Deze routes worden niet automatisch gedeeld gecachet.
- Geen productiebelastingstest, volledige penetratietest of nieuwe visuele browsercontrole uitgevoerd. Maandelijks gefactureerd Supabase-verbruik en actuele Cron-tabellen zijn niet onafhankelijk uit de beheerconsole opgehaald. De aanbevolen externe quota- en schedulercontroles blijven daarom open.
- Tijdens de audit zijn in de gedeelde werkboom onder meer verbeteringen aan de beheerclient, reserveringen en uploadlimiet verschenen. Oudere bevindingen over die inmiddels aangepaste code zijn niet als open defect in dit rapport opgenomen.

Aanbevolen uitvoeringsvolgorde: de publieke volledige-staatpoller terugbrengen, lege hartjesaanvragen stoppen, dubbele beheerpollers verwijderen en statuspolling beëindigen bij eindstatussen. Daarna de gerichte SQL-rapporten, bescherming van de meetendpoint, volledige backups en retentie van onderhoudslogs afronden.

## Herstelstatus na implementatie

Alle tien bevindingen hebben een implementatie in de werkboom. Productieactivering is alleen bevestigd waar hieronder expliciet vermeld.

| Nr. | Implementatie en verificatie | Operationele status |
| --- | --- | --- |
| 1 | Gerichte SQL-projectie, gedeelde Next Data Cache (60 s), expliciete invalidatie na writes en ETag/304. Collectie laadt bij openen, wijzigingen en terugkeer na voldoende tijd; geen vaste poller. | SQL live; productieprojectie 144.221 bytes tegenover eerdere 246.905 bytes. Commit `773bed0` live op Vercel Production; `/api/catalogue` geeft 200 en vervolgens 304, met 195 producten. |
| 2 | Edgefilter 60 POSTs/IP/minuut; geheugenbegrenzing vóór SQL; SQL 120/minuut en maximaal 5.000/dag. Server respecteert uitschakelvlag. | Vercel-firewall gepubliceerd en actief; SQL-daglimiet 5.000 live gecontroleerd; applicatie live. |
| 3 | Geversioneerde snapshot van 15 duurzame tabellen, checksum en readback vóór latest-pointer, dagelijkse lease en 45 dagen bewaartermijn in aparte R2-bucket. Hersteltest importeert alle tabellen in geïsoleerd PostgreSQL. Tijdelijke meetidentiteiten uitgesloten. | Live snapshot gevalideerd: 195 producten, 15 tabellen. Productiebackup geslaagd op 25 oktober 2026 om 07:46 UTC (08:46 Belgische tijd); downloaden, checksum en herstel van 15 tabellen afzonderlijk gecontroleerd. Bestaande dagelijkse Vercel-planning behouden; eerstvolgende automatische run nog niet waargenomen. |
| 4 | Lege vervolgrequests gestopt; geen 30-secondeninterval. Alleen wijzigingen/retries en hoogstens dagelijkse actualisering bij actieve terugkeer. Serverfastpath vermijdt winkelstaat. | Regressietests geslaagd. |
| 5 | Vaste beheer- en hartjespollers verwijderd; focus/online met minimale ouderdom. Algemene winkeldata wordt niet op meettabbladen geladen. | Regressietest voor gecombineerde focus-/zichtbaarheidsgebeurtenissen geslaagd. |
| 6 | SQL begrenst dagregels op gevraagde periode en pakket vóór overdracht. Gedeelde rapportcache 60 s; geen volledige winkelstaat per rapport. | Nieuwe RPC live; Free-begrenzing getest. Objectmetadata blijft voor de beperkte collectie als gedeelde rapportcontext beschikbaar. |
| 7 | Terminale bestelstatus stopt verversing. Actieve controle iedere minuut, oplopende wachttijd bij fouten, verborgen tabbladen overgeslagen. | Regressietest bevestigt stoppen na eindstatus. |
| 8 | Dagelijkse retentie van afgeronde Cron-logs ouder dan zeven dagen. | Met expliciete toestemming uitgevoerd; job actief om 03:23 UTC. |
| 9 | Apart paneel voor organisatie-egress, meetperiode en waarschuwing vanaf 70%; onbekend/fout wordt niet als nul getoond. Dagelijkse provideruitlezing met lease. Oude reservekopie krijgt waarschuwing. | Providerverbinding ontbreekt nog: SUPABASE_USAGE_TOKEN is niet ingesteld. Geen actuele maandwaarde geclaimd. |
| 10 | Alleen geldige paginanavigatie behoudt snapshot; periodewissel of verlopen snapshot start nieuw op pagina één. | UI-regressietest met 16 minuten tijdsprong geslaagd. |

Afsluitende lokale controle: **169 tests geslaagd**, TypeScript geslaagd, productiebuild geslaagd, `git diff --check` geslaagd. De migratie `20261025160000_free_plan_efficiency.sql` is via de SQL-editor op project `gzrxxdmhonzcfkomowpo` toegepast; dit repareert de CLI-migratiehistorie niet automatisch. De Vercel-firewall heeft één actieve regel, geen conceptwijzigingen. Geen productiebelastingstest uitgevoerd.

Productie-uitrol `lothuus-ewz4m642d-lanternnetworks-projects.vercel.app` was READY en gekoppeld aan `www.lothuus.be`. De eerste geauthenticeerde onderhoudstest bevestigde dat bestaande opslagtoegang geen succesvolle backup opleverde. Met specifieke toestemming is daarom een afzonderlijke accounttoken aangemaakt: uitsluitend Object Read & Write op de EU-bucket `lothuus-backups`. De drie bijbehorende variabelen zijn als Secret opgeslagen, uitsluitend in Vercel Production. Uitrol `f06f98a` is READY; de productiebackup is geslaagd. `npm run backup:verify` heeft de opgeslagen snapshot gedownload en alle 15 tabellen teruggelezen in een afzonderlijke lokale herstelmap. Sleutelwaarden staan niet in de repository of het auditrapport.

De Supabase-tokeninterface biedt geen aangetoonde beperkte facturatie-/organisatie-egressscope voor de gebruikte dashboard-endpoints. Er is daarom geen brede legacy-accounttoken aangemaakt. De optionele connector is niet als werkend aangemerkt. Zonder token wordt hij overgeslagen vóór extra onderhouds-RPC’s, zodat ontbrekende configuratie geen dagelijkse zinloze providerpogingen of foutstatus voor de overige taken veroorzaakt. Het dashboard verwijst naar de echte providerwaarde en toont geen fictieve nul.

Laatste applicatie-uitrol `13d588d` is READY. De nieuwe serverfuncties weigeren anonieme uitvoering (`42501`); de Cron-route weigert ongeauthenticeerde aanvragen met HTTP 401. De afzonderlijke herstelproef staat in `.backups/restore-test-4IhVbC` (genegeerd door Git). Het automatische Supabase-organisatieverbruik blijft het enige niet aangesloten onderdeel; de dagelijkse backupplanning is geconfigureerd, maar de eerstvolgende geplande uitvoering is nog niet afgewacht.
