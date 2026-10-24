# Plan: online productbeheer op /admin

Datum: 24 oktober 2026. Doel: bruikbare productinvoer vanaf 1 november 2026.
Status: frontend, Supabase Auth/Postgres, Cloudflare Workers/R2 en de overzet van 195 privéconcepten met 808 foto’s zijn uitgevoerd op 24 oktober 2026. Domein/DNS en echte e-mail zijn de volgende aansluitingen. Zie `docs/production.md` en de eigenaarshandleiding voor de actuele uitvoering; de ontwerpkeuzes hieronder blijven de leidraad.

## 1. Opdracht en vastgelegde keuzes

De eigenares moet zelfstandig vintageproducten kunnen invoeren, aanvullen en terugvinden. De publieke website hoeft hiervoor niet klaar te zijn. De hoofdtaak is een productfiche maken; reserveringen, klanten en betalingen krijgen pas later de nadruk.

Door de gebruiker bevestigd:

- Nieuwe nummerreeksen per materiaal, zonder bestaande etiketten of verkoopnummers over te nemen: K1, P1, G1, T1, H1, I1.
- Vanaf 1 november via internet kunnen inloggen op haar eigen computer.
- Foto-opslag via Cloudflare R2, **niet via Supabase Storage**. De aansluiting wordt later vandaag behandeld; dit plan maakt geen cloudwijzigingen.

Voorgestelde uitvoeringskeuzes: een Nederlandstalige werkruimte voor één eigenares, desktop als primaire werkplek, bruikbaar op tablet en telefoon. Eén formulier met overzichtelijke delen. Vrij kunnen beginnen, onderbreken en hervatten. Geen verplichte afwerking voor het bewaren van een concept.

## 2. Wat al bestaat, en wat ontbreekt

Dit is een controle van broncode en gegevensbestanden. De ingelogde interface is in deze planningsronde niet visueel of met de eigenares getest.

| Onderdeel | Aanwezig in de huidige code | Werk voor de gewenste invoer |
| --- | --- | --- |
| `/admin` en toegang | Nederlandstalig beheer met lokaal eigenaarswachtwoord | Online toegang, account- en sessiebeheer, herstel en passende autorisatie |
| Producten | Toevoegen, bewerken, concept/publicatie/archief | Invoer centraal zetten; onvolledige concepten, hervatten en nummering toevoegen |
| Productnummer | Interne UUID; aparte fotocatalogus met voorlopige importcodes | Vast productnummer en zes onafhankelijke tellers |
| Materiaal | Vrij tekstveld; categorieën mengen materiaal en objecttype | Materiaalgroep voor nummering scheiden van categorie en vrije materiaalbeschrijving |
| Titel en beschrijving | Aanwezig | Behouden, duidelijker ordenen; titel is nu verplicht bij iedere opslag |
| Stijl/Periode | `date`, getoond als Periode / datering | Label Stijl / Periode; vrije invoer, geen verplichte datum |
| Afmetingen en Staat | `dimensions` en `condition` | Behouden; herkenbare labels en concrete voorbeelden |
| Vaste Lothuus-prijs | `priceCents`, invoer in euro | Label en Belgische invoer verduidelijken; onbekende prijs onderscheiden van € 0 |
| Foto's | Meervoudige bestandskeuze, WebP-verwerking, omslag als eerste, pijltjes voor volgorde | Dropzone, slepen op desktop/touch, 2–8 geselecteerde foto's, voortgang en retry |
| Fotolimieten | Maximaal 12; publiceren vanaf 1 foto | Concepten met 0–8; gereed/publiceren met 2–8; importuitzonderingen apart behandelen |
| Tekst plakken | Gewone tekstvelden | Bronvak, verdelen, controle en ongedaan maken |
| Bewaren | Handmatige submit, foutmelding en versiecontrole | Automatisch concept bewaren, herstel, conflictafhandeling en zichtbaar bewaarmoment |
| Collectieoverzicht | Foto, titel, prijs, zichtbaarheid, beschikbaarheid en zoeken | Productnummer, materiaal, invoerstatus en filters; hervatten waar zij stopte |
| Klanten en verkopen | Reserveringen, betalingen, verkoop en klantgeschiedenis | Bestaande logica bewaren; later eenvoudig ontsluiten |
| Opslag en backup | Lokale SQLite en afbeeldingsmap; backupscripts | Online database/login, R2, automatische reservekopieën en bewezen herstel |

Belangrijke bronbestanden: `src/components/admin/admin.tsx`, `admin.css`, `src/lib/backend/{types,validation,service,repository}.ts`, de API-routes, `src/lib/collection.json`, `scripts/import-collection.mjs` en de bestaande beheerhandleidingen.

### De huidige fotocatalogus is nog geen beheervoorraad

De aangeleverde collectie bevat 195 producten met 808 foto's: 103 keramiek, 51 glas, 41 hout/riet/bamboe. Het importscript schrijft naar `collection.json` en `public/collection/`, niet naar de beheerdatabase. De backend begint met een lege `items`-lijst; dit zegt niets over eventueel inmiddels handmatig ingevoerde lokale voorraad.

De codes K001/G001/H001 worden door het script uit de mapvolgorde opgebouwd. Het zijn geen bevestigde inventarisnummers. Dezelfde tekens zonder voorloopnullen zijn daarom niet automatisch hetzelfde productnummer.

Twee bestaande fotogroepen overschrijden de nieuwe limiet: K012 heeft 9 foto's; G029 heeft 15. Die foto's mogen tijdens een import niet stilzwijgend verdwijnen.

### Een bestaande koppeling moet eerst worden aangepast

`catalogue()` zet `hasInventory` nu op basis van het bestaan van **eender welk** beheerproduct. `Lothuus` vervangt daarmee de aangeleverde catalogus door de gepubliceerde beheervoorraad. Het eerste opgeslagen concept kan dus de fotocatalogus op de website laten verdwijnen terwijl er nog niets gepubliceerd is.

Daarom wordt de publieke cataloguskeuze expliciet losgekoppeld van het aantal concepten. Ook geen automatische omschakeling bij de eerste publicatie: alleen een bewuste keuze bij publieke lancering. De bestaande onboardingtekst over museumvoorbeelden is eveneens verouderd.

## 3. De werkruimte en dagelijkse flow

### Start op /admin

Een rustige werkplek met bovenaan **Product toevoegen** en **Verder werken**. Toon recent bewerkte producten en kleine, aanklikbare aantallen voor Concepten, Klaar voor publicatie en Verkocht. Geen lege verkoopstatistieken als hoofdinhoud tijdens de invoerfase.

De eerste navigatie bestaat uit Overzicht, Producten en Instellingen. Bestaande reserverings- en klantfuncties blijven behouden, maar komen onder Verkoop zodra dat onderdeel wordt gebruikt. E-mailvoorbeelden horen niet bij de dagelijkse productinvoer.

Behoud het bestaande LOTHUUS-woordmerk en de rustige lichte adminstijl met donkergrijze tekst. Goede leesbaarheid en herkenbare bediening zijn leidend: zichtbare labels, bodytekst rond 15–16 px, ruime aanklikvlakken, fouten bij het betrokken veld. Geen bruine vlakken of decoratieve animaties in de werkstroom.

### Nieuw product

1. Kies de materiaalgroep. De app maakt bij de eerste serveropslag een concept met definitief nummer. Eerst kan een voorgesteld nummer worden getoond, nadrukkelijk nog niet toegekend.
2. Sleep foto's in het fotovak of kies ze via de bestandskiezer.
3. Vul de fiche in, of plak bestaande tekst in het hulpvak en verdeel die.
4. Controleer foto's en gegevens. Het product blijft privé en wordt automatisch bewaard.
5. Kies **Opslaan en volgend product** of **Markeer als klaar**. Publiceren is een afzonderlijke handeling die pas beschikbaar wordt bij publieke lancering.

Geen wizard die haar dwingt steeds in dezelfde volgorde te werken. Het formulier bevat drie herkenbare delen:

- **Product:** materiaalkeuze en nummer, titel, beschrijving; categorie/maker onder Meer gegevens.
- **Kenmerken:** Stijl / Periode, Afmetingen, Staat en Vaste Lothuus-prijs (€).
- **Foto's:** 8 overzichtelijke posities, met de eerste als Hoofdfoto; lege posities vormen samen het fotovak.

Rechts staat op desktop een compacte productpreview met nummer, hoofdfoto, titel en prijs. Daarbij staan de bewaarstatus en een concreet lijstje ontbrekende gegevens. Op telefoon volgen preview en acties in dezelfde leesvolgorde; de primaire opslagactie blijft bereikbaar zonder velden te bedekken.

### Producten terugvinden

Rijen met hoofdfoto, productnummer, titel, materiaal, prijs, invoerstatus, verkoopstatus en laatst bewerkt. Zoeken op nummer, titel en beschrijving; numeriek sorteren op productnummer binnen de materiaalgroep, dus K2 vóór K10. Filters voor materiaal, Concept, Klaar, Gepubliceerd, Verkocht en Archief. Filters combineren; de lege toestand biedt meteen herstellen van filters of een product toevoegen aan.

## 4. Productnummers: definitief en nooit hergebruikt

| Prefix | Materiaalgroep |
| --- | --- |
| K | Keramiek |
| P | Plastiek |
| G | Glas |
| T | Textiel |
| H | Hout / riet |
| I | Inox / ijzer |

De bestaande groep H bevat ook bamboe. Voorstel: bamboe blijft onder H; dit staat herkenbaar in de keuzehulp en vrije materiaalomschrijving. Voor gemengde materialen kiest zij één leidende groep en beschrijft de combinatie apart. Voor niet-passende materialen geen fictieve extra prefix verzinnen.

- Intern blijft een UUID de identiteit; een leesbaar `productNumber` staat daar los van.
- Per groep een blijvende teller. Nummer toekennen en concept aanmaken in één databasetransactie, met unieke constraints en een herhaalbare aanmaakopdracht die bij retry hetzelfde product oplevert.
- Beginnen bij 1, zonder voorloopnullen. De teller telt ook verkochte, gearchiveerde en verlaten concepten mee. Gaten zijn toegestaan; hergebruik niet.
- Geen `aantal producten + 1`, geen tellen in de browser, geen opnieuw nummeren na verkoop, archiveren of import.
- Prefix na toekenning niet stilzwijgend veranderen. Bij een verkeerde materiaalgroep een expliciete correctieflow: nieuw passend nummer, oud nummer blijvend gereserveerd en als alias aan hetzelfde interne product gekoppeld, met historie. Gewone materiaaltekst wijzigen raakt het nummer niet.
- Geen hard verwijderen vanuit het gewone beheer. Archiveren verbergt de fiche en behoudt code en gegevens. Een gedupliceerd product krijgt altijd een nieuw nummer en start privé.

De initiële fotocollectie kan K1–K103, G1–G51 en H1–H41 krijgen **na** een gecontroleerde bronmapping en nummeruitgifte. De oude importcodes en bronmappen blijven als herkomst bewaard. Als er al nieuwe producten zijn aangemaakt, gebruikt de import de dan beschikbare nummers; bestaande nummers worden nooit verschoven.

## 5. Tekst plakken en verdelen

### Eerste versie: voorspelbaar en zonder externe AI-dienst

Alle velden ondersteunen normaal selecteren, kopiëren en plakken. Een optionele knop **Bestaande tekst gebruiken** opent daarnaast een bronvak. De gebruiker kan alles in één keer plakken en ziet de oorspronkelijke tekst zolang zij de voorstellen controleert.

Bijvoorbeeld:

```text
Titel: Groene keramieken vaas
Beschrijving: Vaas met druipglazuur.
Stijl / Periode: Jaren 70
Afmetingen: H 24 cm, Ø 12 cm
Staat: Kleine chip aan de onderrand, zie laatste foto.
Vaste Lothuus-prijs: € 45
```

Herken veldlabels en gebruikelijke synoniemen zoals conditie/staat, periode/stijl en prijs. Toon de voorgestelde verdeling vóór toepassen. Niet automatisch onbekende feiten, materiaal, maker of jaartal invullen.

Ongestructureerde tekst krijgt een eenvoudige handmatige optie: selecteer een fragment en kies **Naar Beschrijving / Stijl / Afmetingen / Staat / Prijs / Titel**. Daarnaast altijd normaal knippen en plakken toelaten. Onherkende tekst blijft zichtbaar; nooit laten verdwijnen.

Alleen lege doelvelden standaard aanvullen. Voor bestaande inhoud is per veld een expliciete keuze nodig: behouden, aanvullen of vervangen. **Ongedaan maken** herstelt de vorige verdeling. Een prijs met komma of euroteken wordt genormaliseerd; meerdere of onduidelijke bedragen vragen om een keuze. `45,50` wordt € 45,50, niet € 4.550.

Later kan optionele AI ook vrije tekst voorstellen laten verdelen, maar die blijft controleerbaar en mag de basisinvoer niet blokkeren.

## 6. Foto's: 2–8 geselecteerde foto's, met herstelbare bewerkingen

- Concept met nul of één foto bewaren is toegestaan; Klaar en Publiceren vragen 2–8 geselecteerde, volledig verwerkte foto's.
- Dropzone met duidelijke instructie en knop; slepen is nooit de enige toegang.
- Voor elke foto preview, upload-/verwerkingsstatus, fout en Opnieuw proberen. Meerdere bestanden behouden hun gekozen volgorde, ook als verwerking in een andere volgorde klaar is.
- Reorderen door slepen op desktop en touch; de huidige pijltjes blijven voor toetsenbordgebruik. Wijzigingen worden opgeslagen, de hoofdfoto is altijd duidelijk gemarkeerd.
- Foto's van beschadigingen kunnen naar achteren. Optioneel kenmerk Detail / Beschadiging; niet automatisch schadefoto's verplaatsen of verbergen.
- Nieuwe bestanden boven de limiet tonen een selectieprobleem vóór upload; niets stilzwijgend afkappen. Een mislukte foto blokkeert andere geslaagde uploads niet.
- Verwijderen betekent eerst loskoppelen met Ongedaan maken. Definitieve opslagopruiming gebeurt later en alleen zonder actieve of historische referenties.
- Voor import van K012 en G029: alle 9 respectievelijk 15 bronfoto's behouden, status Foto's kiezen; zij selecteert maximaal acht voor de fiche. Extra bronfoto's blijven privé bewaard en terug te kiezen. Dit mag niet botsen met de gewone 8-fotolimiet.
- Alt-tekst met een bruikbaar voorstel en optioneel kunnen aanpassen. Geen reeks verplichte technische beschrijvingsvelden vóór zij verder mag.
- JPEG, PNG, WebP en AVIF blijven uitgangspunt. HEIC van een telefoon afzonderlijk onderzoeken en op de echte verwerkingsomgeving testen; geen ondersteuning beloven op basis van alleen bestandsextensies.
- Huidige uitgangspunt: maximaal 15 MB per foto, oriëntatie corrigeren en afgeleide webversies maken. Originelen privé bewaren met expliciete bewaarkeuze; GPS/EXIF niet doorgeven in publieke webversies.

## 7. Bewaren, gereedheid en zichtbaarheid zijn verschillende zaken

Automatisch bewaren na korte invoerpauze en bij een bewuste veldwissel, met labels **Opslaan…**, **Opgeslagen om 14:32** en **Verbinding verbroken — wijzigingen nog niet bewaard**. Alleen een succesvolle serverbevestiging mag Opgeslagen tonen. Een expliciete knop blijft aanwezig.

Ontbrekende titel, prijs of foto's mogen een concept niet blokkeren. Een onbekende prijs is leeg/null, geen kosteloos product. Nieuwe concepten kunnen als Tijdelijk zonder titel worden weergegeven zonder dat die tekst echte productinhoud wordt.

Beperk conflicten: bewerkingen op volgorde verzenden, bestaande versiecontrole behouden, bij twee tabbladen niet overschrijven maar vergelijken/herladen aanbieden met behoud van eigen invoer. Aanmaakretry mag geen extra productnummer kosten. Bij verlopen sessie eerst wijzigingen lokaal veiligstellen en herlogin aanbieden; een lokale herstelkopie bevat productinvoer en is geen databasebackup. Opruimen na bevestigde opslag en bij afmelden op een gedeeld toestel. Geen stille offlinebelofte voor niet-geüploade bestanden.

Voor **Klaar** gelden: titel, materiaalgroep en toegekend nummer, beschrijving, Stijl / Periode, Afmetingen, Staat, positieve vaste prijs en 2–8 gereedstaande foto's. Dit is een voorgestelde afwerkingsregel. Onbekende periode kan expliciet Onbekend zijn; geen schijnzekerheid afdwingen.

Gereedheid staat los van:

- Zichtbaarheid: privé, gepubliceerd of gearchiveerd.
- Voorraad/verkoop: beschikbaar, gereserveerd of verkocht.

Een verkocht product houdt nummer, fiche en historie. Verkocht is geen deleteknop. De bestaande directe verkoop vereist een klant en ontvangen betaling; voor oude of buiten het systeem verkochte voorraad is later een aparte inventarisregistratie nodig die geen klant of bankbetaling verzint.

## 8. Online architectuur en R2-grens

Vast: R2 bewaart fotobestanden. Voorgesteld: Supabase alleen voor Postgres en eigenaarsauthenticatie, aansluitend bij de eerdere cloudrichting. Het database-/authproject en de apphosting moeten nog worden bevestigd en ingericht. De huidige lokale SQLite-adapter is geen online oplevering; de hele oude cloudroadmap uitvoeren is evenmin een voorwaarde voor de eerste productinvoer.

De bestaande Next-app en server-API's blijven de eerste applicatiegrens. Productregels en autorisatie blijven servergestuurd. Gebruik hosting die de gekozen Next-runtime en beeldverwerking ondersteunt; geen statische deployment met behoud van de huidige serverroutes veronderstellen.

Voor de aansluiting later vandaag:

1. Eén uitgenodigd eigenaarsaccount, publiek registreren uit, herstelroute werkend; servercontrole en expliciete eigenaarstoegang tot elke product- en fotobewerking. Databasebeleid ook voor anonieme en andere ingelogde gebruikers testen. Geheimen uitsluitend op de server.
2. Private R2-opslag voor originelen, staging en conceptvarianten. Geautoriseerde servertoegang of kort geldige ondertekende links; geen onbeveiligde publieke conceptmap. R2 ondersteunt ondertekende links per object en operatie: [Cloudflare-documentatie](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).
3. Voor de eerste versie de bestaande serververwerking behouden en het opslaan achter een media-adapter zetten. Directe browseruploads pas indien hostinglimieten dat nodig maken; dan tijdelijke uploadrechten, beperkte CORS en serververificatie vóór bevestigen.
4. De database bewaart foto-ID, R2-objectsleutels, toestand, formaat, afmetingen, bytes en volgorde. Geen verlopende signed URL als blijvende fotoverwijzing opslaan.
5. Upload en database zijn geen gedeelde transactie: staged → verwerkt → gekoppeld. Een onderbroken stap blijft herkenbaar en herstelbaar. Opruiming verwijdert geen bronfoto's die nog aan import, concept of historie hangen.
6. Publieke webvarianten later bewust publiceren via een apart publiek distributiepad; originelen blijven privé. Gebruik voor publieke productie een passend domein/distributie, geen `r2.dev` als productieontwerp. Cloudflare onderscheidt publiek en privé expliciet: [Public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/).
7. Bij terugtrekken van publicatie ook publieke varianten/toegang en cachegedrag regelen. Productstatus alleen maakt een reeds publieke afbeelding niet privé; eenmaal gedownloade kopieën zijn niet terug te halen.
8. Automatische databasebackup én fotobackup, afzonderlijk, met manifest en hersteltest. Een R2-bucket of productexport alleen is geen volledige onafhankelijke reservekopie. Bewaar uploadoriginelen en verwerkte bestanden volgens een expliciete retentieafspraak.

Minimale nieuwe gegevensstructuren: producten met UUID/nummer/materiaalgroep en revisie; materiaal-tellers; nummerregister met historische aliassen; fotometadata en product-fotovolgorde; importmapping met stabiele bronidentiteit; bewerkingshistorie. Bestaande klanten en reserveringen mogen bij migratie geen verwijzingen verliezen. Database- en loginbeleid volgen de [Supabase RLS-richtlijnen](https://supabase.com/docs/guides/database/postgres/row-level-security).

De media-adapter vervangt lokale bestandspaden en `existsSync`-controles. De producteditor hoeft daardoor niet te weten of een foto lokaal of in R2 staat. De huidige cleanup- en backupscripts moeten bewust worden aangepast; zij werken nu alleen voor lokale bestanden.

## 9. Uitvoeringsvolgorde naar 1 november

Dit is een voorgestelde planning, geen bevestigde opleverbelofte. Beschikbare cloudtoegang, domein en een testmoment met de eigenares zijn afhankelijkheden. Geen nieuwe accounts, kosten of deployments in deze planningsronde.

| Moment | Werkpakket | Controleerbaar resultaat |
| --- | --- | --- |
| 24 oktober, later vandaag | Online doelomgeving en R2-afspraken concretiseren | Hosting/runtime, database/login, private mediaflow en backupverantwoordelijkheid vastgelegd |
| 25–26 oktober | Nummering, conceptmodel en gecontroleerde gegevensmigratie | Blijvende codes; concepten mogen onvolledig; bestaande lokale gegevens veilig; geen effect op publieke catalogus |
| 26–28 oktober | Productoverzicht en editor | Materiaal kiezen, invoeren, hervatten, zoeken, afwerkingscontrole; tekst verdelen en foto-interacties |
| 28–29 oktober | Online integratie en beveiligde mediaflow afronden | Op haar eigen computer kunnen inloggen, opslaan en foto's terugzien na opnieuw openen |
| 30 oktober | Proefsessie met echte producten | Eigenares voert zelfstandig keramiek, glas en hout/riet in; onduidelijkheden worden concreet genoteerd |
| 31 oktober | Herstel, fouten oplossen en vrijgavecheck | Backup teruggezet in testomgeving; invoer zonder gegevensverlies; korte handleiding afgestemd |
| 1 november | Productinvoer in gebruik | Privévoorraad opbouwen; publieke verkoop blijft apart gepland |

Het kritieke pad is: veilige online toegang → persistente gegevens en foto's → nummering en migratie → eenvoudige invoer → herstelproef en eigenaartest. Begin online integratie meteen; bewaar die niet volledig tot de laatste dag.

Als de deadline knelt, stel AI, statistieken, etiketten en bulkpublicatie uit. Ook het volledig aanvullen van alle 195 fiches is geen voorwaarde om nieuwe producten te kunnen invoeren. Toegang, bewaarbetrouwbaarheid, nummering, foto-opslag en herstel niet wegbezuinigen.

### Import als zelfstandig controleerbare stap

Maak vooraf een consistente reservekopie en droog importverslag. Lees bestaande lokale voorraad mee zonder persoonlijke gegevens in logs te zetten. Gebruik een idempotente bronmapping; bij opnieuw uitvoeren geen nieuwe producten, nummers of fotoverdubbeling. Controleer per bronmap het aantal foto's, volgorde, bestanden en eigenaarstoegang.

Importeer als privéconcept met herkomst en voorlopige titel. Geen prijzen, makers of periodes verzinnen, geen verkoopstatus gokken. Nummering pas definitief via hetzelfde nummerregister als nieuwe invoer. Rapporteer 195 gekoppelde producten en 808 behouden bronfoto's, met twee expliciete selectietaken. Een mislukte media-overzet mag geen half-gepubliceerd product opleveren.

## 10. Acceptatie vóór ingebruikname

- Zij kan op haar eigen computer via HTTPS inloggen, uitloggen en toegang herstellen.
- Een anonieme bezoeker én een ander ingelogd account kunnen geen privéfiche of conceptfoto lezen of wijzigen, ook niet met een bekende URL of product-ID.
- Nieuwe nummers zijn per materiaal uniek. Twee tabbladen en een herhaalde aanmaakaanvraag maken geen dubbele of onbedoeld extra producten. Verkochte/gearchiveerde nummers komen niet opnieuw vrij.
- Een concept zonder prijs, titel of twee foto's kan bewaard en later hervat worden. De publieke website verandert daardoor niet van catalogus.
- De vaste prijs `45,50` blijft na bewaren en heropenen exact € 45,50. Onbekend blijft onderscheiden van nul.
- Zij kan 2–8 foto's toevoegen, omslag wijzigen, een beschadigingsfoto achteraan zetten en na heropenen dezelfde volgorde zien; dit kan ook zonder slepen.
- Een uploadfout kan afzonderlijk opnieuw; limietoverschrijding wist niets. Importgroepen met 9/15 foto's verliezen geen bronbestanden.
- Geplakte tekst wordt controleerbaar verdeeld. Bestaande tekst wordt niet ongemerkt vervangen; onherkende passages blijven behouden; ongedaan maken werkt.
- Bij netwerkverlies, sessieverloop en een conflict is zichtbaar welke wijzigingen nog niet op de server staan en kan zij die behouden.
- De 195 bronproducten/808 foto's zijn na eventuele import gereconcilieerd; opnieuw importeren maakt geen dubbels.
- Een volledige herstelproef brengt productnummers, tekst, fotoverwijzingen en bestanden terug. Afhankelijkheden tussen database- en fotobackup zijn aantoonbaar correct.
- In een gebruikerstest maakt zij drie verschillende fiches zonder mondelinge begeleiding en vindt zij een onvolledige fiche zelfstandig terug.

Technische nulmeting vóór uitvoering: 41 geslaagde tests en een geslaagde TypeScript-controle. Na de frontenduitvoering slagen de volledige suite (52 tests), TypeScript en de productiebuild. Browserproeven controleerden tekstverdeling, upload van twee foto’s, fotoverplaatsing op het mobiele breakpoint, herstel na verwijderen, klaarzetten en conflictafhandeling tussen twee vensters. Dit bevestigt de lokale flow; de online aansluiting is nog geen opgeleverde productieomgeving. Bij implementatie de relevante meegeleverde Next.js-guides lezen vóór wijzigingen, en daarna gerichte nummering/import/media/autorisatietests, typecheck, build en een echte desktop-/mobielcontrole uitvoeren.

## 11. Na de eerste invoerrelease

Daarna: publieke publicatieflow, verkoop/reserveringen online aansluiten, echte e-mails, producttekst kopiëren voor andere kanalen, productexport, etiketten, bulkbewerkingen, optionele AI-verdeling en verdere fotofuncties. De bestaande reserverings-, betaal- en klantlogica kan hergebruikt worden, maar is momenteel lokaal en verstuurt geen echte e-mails.

Dit plan specificeert de productinvoerrelease. Voor die scope heeft het voorrang op de oudere algemene cloudroadmap; met name **R2 vervangt Supabase Storage**. Het oudere plan blijft achtergrond voor latere verkoopfunctionaliteit en mag niet als actuele implementatiestatus worden gelezen.
