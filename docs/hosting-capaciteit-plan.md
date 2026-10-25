# Hosting en capaciteit — bouwplan

Status: geïmplementeerd op 25 oktober 2026; productiecontrole wordt hieronder bijgehouden. Het oorspronkelijke bouwplan blijft als ontwerpreferentie bewaard.

## Opdracht en beslissingen

Een eigen sectie **Hosting & capaciteit** in het bestaande dashboard. De zes screenshots en FabriceBoekenKunst bepalen de functies, betaalgegevens en bedragen. De huidige groene LOTHUUS-werkruimte bepaalt de vormgeving. Klantteksten gebruiken consequent **objecten**, nooit kunstwerken of werken. “Tokens” is niet nodig als klantbegrip: de klant koopt extra objectcapaciteit of een beheerpakket.

Door de gebruiker vastgelegd:

- **Basis: 150 objecten. Pro: 300 objecten. Premium: 500 objecten.**
- Een overschreden Basislimiet moet zichtbaar rood zijn. Geen vrijstelling of verhoogde startcapaciteit voor de al aanwezige collectie.
- Prijzen, rekeningnummer en QR-codes blijven gelijk aan FabriceBoekenKunst.
- Het klantdashboard benoemt de eigen dienstverlening en afgesproken capaciteit. Interne leveranciersabonnementen, inkoopkosten en commerciële marge horen niet in deze interface.
- Deze fase levert uitsluitend dit bouwplan. Geen productiegegevens, infrastructuur of applicatiecode wijzigen.

## Bestaande implementatie als uitgangspunt

LOTHUUS gebruikt Next.js, eigenaarsauthenticatie en private serverroutes. `src/components/admin/admin.tsx` heeft een interne sectiekeuze en een vertrekcontrole voor onbewaarde wijzigingen. `workspace.css` en `docs/admin-design.md` zijn de actuele visuele autoriteit; de oudere frambooskleurige adminbrief is daarvoor achterhaald.

De bedrijfsgegevens zitten nu als JSON-aggregate in `app_private.store`. `withStore` downloadt die aggregate en voert waar nodig een revisiegebonden commit uit. Dat is bruikbaar voor de bestaande transacties, maar onnodig zwaar voor hostingcijfers. De nieuwe sectie krijgt een kleine eigen RPC en gaat niet via `withStore`.

`savePhoto` bewaart per foto een origineel en drie WebP-varianten (320, 800 en 1600 pixels). `app_private.media.bytes` registreert alleen de oorspronkelijke uploadgrootte. Dit is dus nog geen volledige opslagmeting. De import gebruikt dezelfde uploadfunctie. De fotoroute controleert toegang vóór browserhergebruik en leest private R2-objecten via Vercel. Er is momenteel geen gedeelde beeld-CDN-cache.

Referentiebronnen: `/Users/kevin/PROJECTS/FabriceBoekenKunst/src/components/admin/TokensManager.jsx`, `UpgradeModal.jsx` in dezelfde map, en `/Users/kevin/PROJECTS/FabriceBoekenKunst/api/hosting-metrics.js`. Alleen lezen; dat project niet aanpassen.

## Pakketten en prijzen

Alle bedragen komen uit de referentiecode, inclusief de niet-afgebeelde maandprijs van Pro.

| Product | Objectcapaciteit | Betaling |
| --- | ---: | --- |
| Basis | 150 | €0 per maand |
| Pro, jaarbetaling | 300 | €240 per jaar; equivalent €20 per maand |
| Pro, maandbetaling | 300 | €25 per maand |
| Premium, jaarbetaling | 500 | €490 per jaar |
| Premium, maandbetaling | 500 | €49 per maand |
| Eenmalige uitbreiding | +50 | €25 eenmalig |
| Eenmalige uitbreiding | +150 | €50 eenmalig |

Eenmalig gekochte capaciteit wordt bij de basislimiet van het actieve pakket opgeteld, blijft bij een pakketwissel behouden en wijzigt geen opslag- of verkeerslimieten. Voorbeeld: Basis +50 = 200; Pro +50 = 350. Vermeld dit bij de aankoop. Verlengen van een abonnement voegt geen objecten toe.

Behoud Premium €49 per maand op de kaart en toon daarnaast helder €490 bij jaarbetaling. De referentie koppelt €49 ten onrechte aan “jaarlijks gefactureerd”; dat label niet overnemen. De kortingsbadge wordt “Voordeliger per jaar”, zonder het onjuiste uniforme percentage van 15%. Bedragen veranderen niet.

Capaciteitsdoelen uit de referentie:

| Capaciteit | Basis | Pro | Premium |
| --- | ---: | ---: | ---: |
| Database | 500 MB | 8 GB | 20 GB |
| Mediaopslag | 1 GB | 100 GB | 500 GB |
| Direct verkeer per maand | 5 GB gedeeld | 250 GB | 1 TB |
| Gecachet verkeer per maand | binnen gedeelde 5 GB | 500 GB | 2 TB |

Dit zijn beoogde klantpakketten, geen bewijs dat deze infrastructuur al is geleverd. De server bewaart commerciële rechten en operationele leveringsstatus afzonderlijk. Een infrastructuuruitbreiding wordt pas als actief getoond nadat de benodigde voorzieningen beschikbaar zijn. Toon geen garanties voor uptime, onbeperkte data, 4K of directe verwerking die de bestaande implementatie niet waarmaakt. Het detailformaat is nu maximaal 1600 px. Bezoekersanalytics is bovendien nog een apart bouwplan; verkoop geen reeds beschikbare geavanceerde analytics op basis van alleen de screenshots.

## Scherm en bediening

Zelfstandig navigatie-item vóór Instellingen, buiten Verkoop. Titel **Hosting & capaciteit**, omschrijving “Beheer de capaciteit, opslag en het dataverkeer van je website.” Rechts: meettijdstip en Vernieuwen. Gebruik Manrope, bestaande groene acties, rustige witte panelen, dunne lijnen en bestaande afrondingen. Geen blauwe referentiestijl over het huidige dashboard leggen.

Volgorde:

1. Actueel pakket, objectgebruik en eventuele rode overschrijdingsmelding.
2. Vijf gebruikspanelen: Objecten, Mediaopslag, Database, Direct dataverkeer, Gecachet verkeer.
3. Drie pakketkolommen: Basis, Pro en Premium, met huidige pakketstatus en upgradeactie. Pro kan “Aanbevolen” dragen; huidige pakketstatus komt uitsluitend van de server.
4. Eenmalige capaciteitsuitbreiding: +50 of +150 objecten, met knop **Capaciteit verhogen**.
5. Eigen bestellingen, betaalstatus en actieve uitbreidingen, zodat de eigenaar kan zien wat al besteld of verwerkt is.

Desktop toont drie gebruikskolommen en drie pakketkolommen. Op tablet twee gebruikskolommen; op telefoon alles onder elkaar. De betaalmodal heeft twee kolommen op desktop en een scrollbare stapeling op telefoon. Focus blijft binnen de dialoog; Escape sluit, de sluitknop heeft een naam en focus keert terug naar de opener. Bedragen, QR en bankgegevens blijven zonder horizontaal scrollen leesbaar.

### Rode objectlimiet

Tel alle opgeslagen objectrecords, inclusief concepten, gepubliceerde, verkochte en gearchiveerde objecten. Archiveren of een verkoop verbergt geen gebruikte cataloguscapaciteit. Een foto is geen extra object. Een geïmporteerd record dat wordt bijgewerkt telt één keer; een apart nieuw record telt erbij. De statische broncatalogus en de bewerkbare import mogen niet dubbel geteld worden.

Toon de werkelijke, servergetelde voorraad; 195 is een rekenvoorbeeld uit de projectgegevens, geen hardcoded teller:

- **195 / 150 objecten**.
- **130% gebruikt** in rood; de balk is visueel begrensd op 100%.
- **Limiet overschreden · 45 objecten boven je pakket**.
- “Verhoog je capaciteit om nieuwe objecten toe te voegen.” Met acties **+50 objecten · €25** en **Bekijk Pro**.

Vanaf 80% een rustige waarschuwing; bij exact 100% “Limiet bereikt”; boven 100% de rode overschrijding. Betekenis altijd ook met tekst, niet alleen kleur. Bestaande objecten, prijzen, foto's, bestellingen en klanten blijven toegankelijk. Geen automatische verwijdering of depublicatie.

Voorstel voor handhaving bij de bouw: nieuwe objecten blokkeren zodra de limiet is bereikt; bestaande objecten bewerken blijft toegestaan. De database controleert dit atomair bij de commit, zodat twee tabbladen de limiet niet omzeilen. Het generieke uploadendpoint wordt niet blind geblokkeerd: foto's bij een bestaand object moeten mogelijk blijven. Nieuwe-productflow controleert eerst objectcapaciteit; opslagcapaciteit krijgt eigen controle. Een eindige uploadreservering voorkomt gelijktijdige overschrijding van opslag; opruimen volgt pas na controle van referenties en wachttijd.

## Zuinige en correcte metingen

### Dashboard leest één samenvatting

`GET /api/admin/hosting` controleert `requireOwner` vóór iedere uitlezing. Eén kleine RPC retourneert pakket, objectlimiet inclusief uitbreidingen, objectaantal, laatste meetwaarden, meetperiode, actualiteit en bestelstatus. Geen klantgegevens, volledige inventory, R2-sleutels, providerabonnementen of interne foutdetails in deze respons.

Alleen ophalen bij openen en via Vernieuwen. Geen extra 15-secondenpoller voor hosting. De bestaande algemene storepoller wordt tijdens deze sectie gepauzeerd; bij terugkeer naar voorraad/verkoop volgt een refresh. Vernieuwen haalt de beschikbare samenvatting op en start hoogstens een begrensde refresh van verlopen metingen. Een kleine clientcache voorkomt herhalen bij snel heen-en-weer navigeren. Servermetingen staan duurzaam in Supabase; alleen modulegeheugen is ongeschikt bij meerdere serverless instanties. Antwoorden zijn `private, no-store`; geen publiek gecachte beheergegevens.

### Objecten en opslag

- Objectaantal wordt tijdens de bestaande committransactie bijgewerkt in een compacte gebruiksrij. Bij installatie één controle/backfill vanuit de store. Geen extra netwerkdownload van de aggregate bij iedere meting.
- Nieuwe media krijgen een manifest met objectkey, type, werkelijke bytes en status voor het origineel en elke variant. Schrijf bytes pas bij na bevestigde R2-opslag; unieke sleutels maken retries idempotent.
- Fysiek nog bestaande uploadresten tellen mee als opslag, ook als de laatste registratiestap mislukte. Een reconciliatietaak herstelt het verschil met de manifestregistratie. Backupopslag blijft operationeel apart, geen media van de klant erbij optellen.
- Bestaande media worden eenmalig gecontroleerd met gepagineerde R2-objectlijsten voor de relevante prefixes. Hervatbare cursor en limiet per run; HEAD alleen waar nodig. Geen downloads van beeldinhoud. Controleer ook ongekoppelde bestanden. Geen bucketlijst in een gewone dashboardrequest.
- Dagelijkse reconciliatie verwerkt begrensde pagina's met een opgeslagen cursor; nieuwe uploads en verwijderingen werken het manifest direct bij. Een totalentelling wordt pas vervangen wanneer een complete telling is afgerond. Geen gedeeltelijke lijst als volledig totaal tonen.
- Mediaopslag toont opgeslagen originelen plus varianten, elk fysiek bestand één keer. Tot de backfill af is blijft de meting gemarkeerd als onvolledig; gebruik niet zomaar de som van `media.bytes`.

### Database en verkeer

- Databasegrootte via een beperkte, alleen server-uitvoerbare SQL-functie met vaste zoekpaden en expliciete rolrechten. Gebruik de officiële Postgres-groottemeting voor dezelfde scope als de providerlimiet; meet eerst met de werkelijke service role. Als die rechten ontbreken: intern configuratieprobleem, geen brede Management PAT als standaardoplossing.
- Databasegrootte hoogstens één keer per uur meten en de uitslag bewaren, met een atomair refresh-slot tegen gelijktijdige uitvoering. De dashboard-RPC leest de laatste meting. Een mislukte refresh behoudt de vorige waarde en het vorige meettijdstip.
- R2-verkeer via Cloudflare Analytics, expliciet gefilterd op de LOTHUUS-mediabucket en op kalendermaand tot nu. Gebruik een beperkt server-token. Controleer het beschikbare GraphQL-schema: voor bandwidth bestaat `r2BandwidthUsageAdaptiveGroups`; neem de accountbrede `responseBytes`-query uit Fabrice niet blind over.
- Providerstatistieken hoogstens ieder uur vernieuwen en dagtotalen bewaren voor langere historie. Respecteer de maximale queryperiode van 31 dagen. Gebruik halfopen tijdsvensters waar het schema dat toestaat om dubbeltelling op daggrenzen te voorkomen.
- Definieer eerst wat Direct verkeer omvat: de huidige R2-downloadbytes zijn origin-media, geen volledige websitebandbreedte. API/databaseverkeer via Supabase en levering via Vercel hebben een eigen meetbron en kosten. Geen origin- en edgebytes bij elkaar optellen wanneer het dezelfde levering betreft. Zonder volledige bron labelt het paneel het gemeten bereik en dekt het niet stilzwijgend al het websiteverkeer.
- R2 levert geen meting van browsercachehits. Voor de huidige private beeldroute wordt Gecachet verkeer **Niet van toepassing** met tekst “Gedeelde mediacache niet actief”. Geen verzonnen 0 GB of berekend cachepercentage. Na een echte CDN-aansluiting volgt deze meting uit daadwerkelijke edge-cachehits; privébeelden blijven daarvan uitgesloten.
- Verkeer heeft een expliciete maandperiode; opslag is een momentopname. Reken in vaste eenheden: providerlimieten eerst naar bytes normaliseren; klantweergave consequent decimaal GB/MB/TB, niet binair omrekenen en vervolgens GB noemen.

Elke meting heeft `value`, `measured_at`, `period_start`, `period_end`, `source` en `status`. De klant krijgt een beperkte vertaling van de status. Bij ontbreken: “Nog niet beschikbaar”; bij storing oude waarde met tijdstip en “Bijwerken mislukt”. Nooit nul als foutfallback. Een mislukte pakketlookup toont evenmin zomaar Basis met een rode overschrijding.

## Betalen met exact dezelfde gegevens en QR's

Begunstigde: **Kevin Bourguignon**. IBAN: **BE43 7380 0488 6701**. Onopgemaakte waarde: `BE43738004886701`.

De referentie genereert EPC-QR's uit onderstaande payload, met LF-regeleinden en zonder extra newline op het einde:

```text
BCD
002
1
SCT

Kevin Bourguignon
BE43738004886701
EUR{bedrag}.00

{referentieproductnaam}
```

| Keuze | Bedrag | Exacte referentieproductnaam in QR |
| --- | ---: | --- |
| +50 objecten | 25 | Uitbreiding 50 Kunstwerken |
| +150 objecten | 50 | Uitbreiding 150 Kunstwerken |
| Pro maandelijks | 25 | Pro Plan Maandelijks |
| Pro jaarlijks | 240 | Pro Plan Jaarlijks |
| Premium maandelijks | 49 | Premium Plan Maandelijks |
| Premium jaarlijks | 490 | Premium Plan Jaarlijks |

De oude benaming blijft uitsluitend in de bankpayload om de QR exact gelijk te houden. Zichtbare producttitels zeggen objecten. Dit betekent dat de bankapp de historische omschrijving kan tonen; de implementatie mag die niet stilletjes wijzigen.

Bewaar de zes oorspronkelijke QR-afbeeldingen één keer als lokale statische assets, met dezelfde payload, formaat en marge als de referentie. Zo is bij een betaalvenster geen externe QR-aanvraag nodig. Verifieer alle QR's door ze terug te decoderen en de volledige payload met de referentie te vergelijken. Alleen opnieuw renderen uit dezelfde payload garandeert niet een identiek QR-raster; behoud daarom de referentiebeelden voor letterlijke visuele gelijkheid. De screenshots dienen als visuele controle.

De modal heeft dezelfde jaar/maandkeuze en +50/+150-keuze, het exacte betaalbedrag, scanbare QR, begunstigde en kopieerbare IBAN. Daarnaast een eigen besteloverzicht. Een QR-scan of knop “Ik heb betaald” is geen bewijs van ontvangen geld.

## Bestellingen en activering

Een hostingbestelling staat los van de reserveringen waarmee LOTHUUS zelf objecten verkoopt. De bankinstellingen voor klantverkopen mogen de hosting-IBAN nooit wijzigen. Prijzen worden uit een servercatalogus gekozen; de browser kan geen bedrag of limiet insturen die de server overneemt.

Alleen een bewuste actie **Bestelling vastleggen** maakt een pending bestelling. Het venster openen en tussen opties schakelen maakt geen orders. Aanmaak is idempotent. Bewaar productcode, prijs in centen, cyclus, exacte QR-payload, prijsversie, status en tijdstippen. Statussen: `pending_payment`, `payment_review`, `paid`, `provisioning`, `active`, `cancelled` en waar nodig `refunded`.

De klant kan “Betaling gemeld” aangeven; uitsluitend Kevin kan na bankcontrole ontvangst bevestigen en activeren, via een beperkte beheeropdracht buiten de klantrol. De bestaande eigenaarslogin van Katrien krijgt geen recht om haar eigen betaalstatus of pakket te verhogen.

Activering voegt een onveranderlijke toekenningsregel toe. Een unieke orderkoppeling voorkomt dubbel +50/+150 bij herhalen of twee gelijktijdige acties. Een abonnement krijgt begin- en einddatum en verlenghistorie; de statische bank-QR maakt geen automatische domiciliëring. Bij terugval naar Basis blijven eenmalige uitbreidingen behouden en blijven bestaande gegevens leesbaar. Nieuwe objecten worden alleen door de actuele limiet begrensd.

Omdat de QR's exact blijven, bevat de bankmededeling geen uniek LOTHUUS-bestelnummer. Pro maandbetaling en +50 kosten allebei €25, maar hebben verschillende omschrijvingen. Controle vereist bedrag, betaler, omschrijving en pending order; bij twijfel geen automatische koppeling. Geen eigen ordernummer aan de QR toevoegen. Automatische bankverwerking valt buiten deze eerste versie.

Klanttekst: **Actief na bevestiging van je betaling**. Geen “Direct verwerkt” bij een handmatige bankcontrole. Voor abonnementen met nog te leveren infrastructuur: “Betaling bevestigd · uitbreiding wordt voorbereid”, gevolgd door actief na geslaagde oplevering.

## Private migraties en toegangsgrenzen

Voorgestelde nieuwe structuren in `app_private`:

- `hosting_account`: actueel pakket, abonnementsperiode en leveringsstatus.
- `hosting_orders`: betalings- en productmomentopname, status en idempotentiesleutel.
- `hosting_entitlements`: eenmalige objectuitbreidingen met unieke orderkoppeling.
- `hosting_media_objects`: fysieke keys, bytes, type, toestand en koppeling aan media-ID.
- `hosting_usage`: compacte actuele tellingen en laatste meetwaarden.
- `hosting_usage_daily`: dagaggregaten met vaste bewaartermijn voor verkeer.
- `hosting_jobs`: leases, laatste geslaagde run en hervatbare reconciliatiecursor.

RLS aan; geen rechtstreekse anon/authenticated-toegang. Alleen expliciete service-role RPC's met beperkte invoer. De HTTP-laag maakt daarboven onderscheid tussen eigenaar-read/order-aanmaak en Kevin-only activering. Geen publieke uitvoerrechten of klantbewerkbare pakketvelden in de gewone store. Geheimen staan uitsluitend in serverconfiguratie. Auditgegevens bewaren wie een betaling bevestigde, welke capaciteit erbij kwam en wanneer.

Migraties zijn toevoegend en hervatbaar: schema/rechten; eerste Basisaccount met 150; gecontroleerde objecttelling; mediamanifest/backfill; atomaire quotacontrole in de bestaande commitfunctie; bestel- en activeringsfuncties. Neem de huidige versie van die commitfunctie als uitgangspunt zodat eerdere voorraad- en nummercontroles blijven bestaan. Backfill schrijft niet de hele store terug. Bestaande voorraad wordt tijdens installatie niet geweigerd omdat zij boven 150 zit; de limiet grijpt alleen aan op toename na activering.

Ontwikkeling krijgt een geïsoleerde lokale adapter met dezelfde regels. Geen klantsimulaties in de productievoorraad. Nieuwe scheduled jobs sluiten aan op de bestaande gekozen hosting; geen nieuwe Cloudflare-applicatie-Worker introduceren. Jobs hebben een gedeeld slot, tijdslimiet en beperkte batchgrootte. De samenvatting blijft leesbaar als een job tijdelijk uitvalt.

## Operationele kosten en leveringspad — uitsluitend intern

Commerciële pakketten staan los van providerplannen. Een betaalde capaciteitsuitbreiding behoeft geen providerupgrade wanneer de echte opslag en het verkeer ruim binnen hun huidige grenzen passen. Meet daarom werkelijke bytes, aanvragen en groei in plaats van per extra object blind infrastructuur te kopen.

Supabase Free heeft momenteel 500 MB database en 5 GB egress; R2 Standard heeft 10 GB-month en inbegrepen aantallen lees-/schrijfoperaties. R2-opslag boven de gratis ruimte kan betaald worden zonder dat een dashboardlabel dat veroorzaakt. Deze interne grenzen komen niet in de klantinterface, maar blijven leidend voor het leveringsplan. Een SQL-migratie verhoogt geen providerquota. Bied 8/20 GB database en 100/500 GB media alleen als capaciteit die daadwerkelijk beschikbaar kan worden gemaakt, met een concreet upgradepad vóór activering van die infrastructuurrechten.

Voorgestelde interne drempels: 70% brengt groei en resterende ruimte in beeld; 85% vereist voorbereiding van uitbreiding; vóór uitputting daadwerkelijk leveren of nieuwe opslag begrenzen. Dit zijn runbookregels voor de implementatie, geen nu aangemaakte monitoringautomatisering. R2-vrije ruimte is accountniveau en wordt ook door andere buckets/backups gebruikt.

De huidige R2 → Vercel → browserroute betekent dat gratis R2-egress niet gelijkstaat aan gratis websitelevering. Neem ook Vercel-bandbreedte en uitvoering mee. Eventuele latere publieke CDN-media vragen een afzonderlijk publicatieontwerp: alleen gepubliceerde varianten publiek, originelen en concepten privé, en een werkende intrekking bij depublicatie. Deze hostingsectie maakt beelden niet publiek om kosten te besparen.

Bronnen gecontroleerd op 25 oktober 2026: [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [databasegrootte](https://supabase.com/docs/guides/platform/database-size), [R2-prijzen](https://developers.cloudflare.com/r2/pricing/), [R2-metrics](https://developers.cloudflare.com/r2/platform/metrics-analytics/). Controleer tarieven en schema's opnieuw bij implementatie.

## Bouwvolgorde en acceptatie

1. Serverproductcatalogus, private schema's/rechten en lokale adapter. Basis 150, Pro 300, Premium 500; bedragen zoals hierboven. Veilige migratie en gecontroleerde starttelling.
2. Mediamanifest en hervatbare backfill; kleine usage-RPC, beperkte meetjobs en foutstatussen. Geen zware scans door een dashboardklik.
3. Hostingsectie in de huidige groene werkruimte, correcte rode overschrijding, pakketkaarten en uitbreidingskeuze. Pauzeer algemene storepolling tijdens deze sectie.
4. Zes onveranderde QR-assets, betaalmodal, pending orders en Kevin-only bevestiging. Geen pakketactivering door alleen een klantactie.
5. Atomaire object-/opslagcontrole en toekenningen. Bestaande voorraad boven de limiet blijft bewerkbaar. Leveringsstatus voor echte infrastructuuruitbreidingen controleren.
6. Relevante tests, typecheck en productiebuild; desktop- en telefooncontrole van limieten, modal, QR en toetsenbordbediening. Geen tests uitvoeren uitsluitend voor het schrijven van dit plan.

Gerichte controles bij de bouw:

- 149/150, 150/150 en 195/150 tonen de juiste status; 195 toont rood 130% en 45 teveel. De balk loopt nooit buiten zijn kader.
- Basis +50 bij 195 wordt 195/200 en laat weer vijf nieuwe objecten toe. Twee gelijktijdige creaties bij nog één vrije plaats laten er maar één slagen.
- Pro geeft 300, Premium 500; eenmalige uitbreidingen blijven behouden na upgrade, verlenging en terugval. Een herhaalde betaalbevestiging verhoogt nooit dubbel.
- Geen toegang zonder eigenaarslogin; eigenaar kan eigen pakket/ontvangst niet aanpassen; bedragen uit clientinvoer worden genegeerd of geweigerd.
- Alle zes QR-payloads exact gelijk aan Fabrice, inclusief begunstigde, IBAN, bedrag en omschrijving. Prijsweergave en geselecteerde QR wisselen samen.
- Ontbrekende metrics, falende R2-listpagina en halve backfill verschijnen nooit als nul of als voltooid totaal. Buckets van andere projecten tellen niet mee.
- Herhaald openen veroorzaakt één kleine samenvattingsquery per benodigde refresh, geen store-download, bucketwalk of providerquery per kaart.
- Foto's en verkopen blijven werken bij overschreden objectlimiet; de bestaande privéfoto-autorisatie blijft intact.

Open detail voor implementatie: de handhaving van de objectlimiet is hierboven een concreet voorstel. De gebruiker heeft de rode weergave en pakketlimieten expliciet bevestigd; blokkeren van nieuwe objecten is nog niet afzonderlijk bevestigd. De eerste UI-oplevering kan de overschrijding daarom tonen voordat harde handhaving wordt aangezet. Factuur-/btwvermelding en contractuele looptijden moeten uit de bestaande bedrijfsafspraken komen, niet uit aannames van de bouwer.


## Implementatie en beheer — 25 oktober 2026

De hostingsectie, zes statische betaal-QR’s, private Supabase-opslag en RPC’s, metingen, bestelregistratie en aparte operatoropdracht zijn gebouwd. De implementatie gebruikt de bestaande eigenarenlogin. Basis 150, Pro 300, Premium 500; eenmalige uitbreidingen blijven apart bewaard.

**Objectlimiet:** de volledige implementatie begrenst nieuwe objecten atomair in Supabase. Een bestaande collectie boven de limiet blijft te bewerken; verkopen, archiveren en bestaande foto’s blijven werken. De knop Product toevoegen leidt bij een volle collectie naar Hosting & capaciteit. Aanpassing van een bestaand object wordt niet door de objectlimiet geweigerd. De lokale testadapter heeft dezelfde basiscontrole. Er is geen nieuwe harde mediaopslagblokkade aangezet; opslag krijgt een echte gebruiksmeter en de operationele opvolging blijft vereist.

**Meten:** de eerste volledige lijstcontrole telde 3.255 fysieke mediabestanden en 171.466.669 bytes in de private EU-mediabucket. De database rapporteerde circa 28,6 MB. Verkeer gebruikt `r2OperationsAdaptiveGroups`, gefilterd op `eu_lothuus-media`, succesvolle `GetObject`-operaties en de huidige UTC-kalendermaand. Dit vermijdt de 100 KiB-ondergrens van de aparte bandwidthdataset. Het paneel benoemt daarom R2-mediadownloads; het is geen totaal van alle Vercel- of Supabase-egress. Maandtotalen van een vorige maand worden nooit als huidig getoond. CDN-verkeer blijft niet van toepassing zolang er geen gedeelde mediacache is.

**Configuratie:** de goedgekeurde Cloudflare-token `LOTHUUS hostingmetingen` heeft uitsluitend Account Analytics Read op het betreffende account. `CLOUDFLARE_ANALYTICS_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` en een willekeurige `CRON_SECRET` zijn servergeheimen in het bestaande Vercel-project. De bestaande bucketrechten en private zichtbaarheid zijn behouden. Er is geen nieuwe Worker of betaald providerplan aangemaakt.

**Planning:** `vercel.json` voert `/api/cron/hosting` dagelijks om 03:17 UTC uit. Vernieuwen vraagt daarnaast hoogstens ieder uur een achtergrondmeting aan. Een databaselease verhindert dubbel werk tussen Vercel-instanties. Gepagineerde scans bewaren hun voortgang; een mislukte of onvolledige scan vervangt het laatste volledige totaal niet. Nieuwe succesvolle uploads registreren originelen en varianten direct. Werkelijke meetfouten leveren ook een foutstatus aan de cronroute op. Controleer Vercel Cron Jobs na een platform- of deploymentwijziging.

**Betalingen:** de gewone eigenaar kan een bestelling vastleggen en betaling melden; dat activeert geen capaciteit. Elke productcode heeft maximaal één openstaande bestelling. Na eigen bankcontrole gebruikt Kevin:

```sh
npm run hosting:operator -- list
npm run hosting:operator -- activate <bestelling-uuid> <echte-bankreferentie>
```

Voor een abonnement is bovendien `--provisioned` vereist, pas nadat de afgesproken infrastructuur werkelijk geleverd kan worden. Dezelfde bevestiging is idempotent: zij kan nooit tweemaal extra objectcapaciteit toekennen. Een wissel tussen verschillende nog actieve abonnementen vereist eerst een operatorcontrole van de resterende termijn; de opdracht weigert die overgang bewust. Gebruik hiervoor de SQL-editor om een expliciet afgesproken migratie uit te voeren, niet de klantrol. Jaar- en maandbetalingen zijn handmatige verlengingen, geen incasso.

De drie migraties `20261025130000`, `20261025130100` en `20261025130200` zijn via de Supabase SQL-editor geïnstalleerd. Zoals de eerdere migraties registreert dit nog geen CLI-migratiehistoriek. Niet blind opnieuw pushen zonder die historie te vergelijken.

**Verificatie:** zes gerichte hostingtests en 111 bestaande tests slagen op de geïsoleerde release. De productiebuild inclusief TypeScript slaagt. Alle zes PNG’s zijn met OpenCV teruggedecodeerd en de volledige payload is gelijk aan de referentie. Publieke toegang tot de hosting-RPC’s is aantoonbaar geweigerd. Desktop en telefoon (390 × 844), QR/IBAN, modalsluiting met Escape en herstel van focus zijn bekeken. Productie- en schedulercontrole volgen bij de publicatie.
