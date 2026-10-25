# Bezoekers — bouwplan

Status: geïmplementeerd in de applicatie; opslag en cleanup aangesloten op Supabase. De website-uitrol is een afzonderlijke stap. Datum: 25 oktober 2026.

## Opdracht en vastgelegde keuzes

Een zelfstandig tabblad **Bezoekers** in het bestaande admin dashboard. De twee aangeleverde screenshots bepalen de functionaliteit en volgorde; de huidige admininterface bepaalt de vormgeving. Doel: de eigenaar ziet hoe het websitebezoek evolueert en hoe bezoeken over apparaten verdeeld zijn.

- Sessies zijn de hoofdmeting, door de gebruiker bevestigd. Na 30 minuten inactiviteit begint bij nieuwe activiteit een nieuwe sessie.
- De bezoekersmeting gebruikt geen cookies, localStorage, sessionStorage of fingerprinting.
- Expliciete gebruikerskeuze: **geen uitleg of waarschuwing in het dashboard dat de meting een benadering is**. De technische grenzen staan uitsluitend in dit bouwplan.
- De volledige implementatie en verfijnde laadervaring zijn op 25 oktober 2026 uitgevoerd op verzoek van de gebruiker.

## Bestaande aansluiting

Het beheer staat in `src/components/admin/admin.tsx`, met een interne `Section`-selectie, bestaande navigatie, een vertrekcontrole voor onbewaarde invoer en eigenaarsauthenticatie. Gebruik deze patronen voor de nieuwe sectie. Bezoekers wordt een zelfstandig navigatie-item, buiten de uitklapgroep Verkoop, na Verkoop en vóór Hosting & capaciteit. Bestaande parallelle wijzigingen aan Hartjes en Hosting blijven behouden.

De actuele visuele autoriteit is de bestaande implementatie met `src/components/admin/admin.css` en `workspace.css`. Het beheer heeft groene oppervlakken en selecties, maar primaire actieknoppen gebruiken daadwerkelijk `--accent: #b52f62` en `--button-hover: #94234e`. Ook `workspace.css` stelt die frambooskleur expliciet in. `docs/admin-design.md` en de oudere adminbeschrijving in `.impeccable/surfaces/admin.md` zijn daarom geen volledige beschrijving van de actuele kleuren. Volg de bestaande implementatie: groene grafiek, selectie en apparaatbalken; bestaande frambooskleurige primaire knop. Geen algemene herkleuring of documentatieherziening buiten dit bouwplan.

Er is nog geen bezoekersregistratie aangetroffen. De bestaande hartjesregistratie is een aparte meetstroom met eigen browseropslag en toestemming. Bezoekers krijgt eigen opslag en endpoints, zonder koppeling aan hartjes, klanten of bestellingen. Online opslag sluit aan op de bestaande Supabase-serververbinding; ontwikkeling krijgt een geïsoleerde lokale adapter.

## Scherm, in de volgorde van de screenshots

### 1. Kop

De bestaande breadcrumb wordt `Werkruimte › Bezoekers`. De paginatitel is **Bezoekers**, met de omschrijving “Zie in één oogopslag hoe je website wordt bezocht.” Rechts staan “Bijgewerkt …” en **Vernieuwen**, met de bestaande knopstijl en een refresh-icoon.

Vernieuwen haalt de actuele samenvatting op en behoudt de geselecteerde periode. Tijdens het ophalen blijft bestaande inhoud zichtbaar en is de knop tijdelijk bezig. De actualisatietijd verandert pas na een geslaagde respons. Gebruik de bestaande paginakop als enige h1; voeg geen tweede kop toe in het paneelcomponent. Bezoekers levert zijn vernieuwactie en rapporttijd aan die kop, los van de voorraadvernieuwactie.

### 2. Periode

Een gelabelde keuzebalk met exact deze opties:

| Optie | Venster | Grafiek |
| --- | --- | --- |
| 24 uur | De laatste 24 verstreken uren | Per uur |
| 7 dagen | Vandaag en de zes voorgaande kalenderdagen | Per dag |
| 30 dagen | Vandaag en de 29 voorgaande kalenderdagen | Per dag |
| 3 maanden | Vanaf 00:00 op dezelfde kalenderdatum drie maanden terug tot nu | Per dag |
| 12 maanden | Vanaf 00:00 op dezelfde kalenderdatum twaalf maanden terug tot nu | Per maand |
| Dit jaar | 1 januari tot nu | Per maand |
| Alles | Vanaf de meetstart tot nu | Per dag tot 90 kalenderdagen, daarna per maand |

Standaard: **7 dagen**. Onder de balk staan het label van het gekozen venster en de concrete datums; 24 uur vermeldt ook de begintijd en eindtijd. Nederlandse datumnotatie, tijdzone Europe/Brussels. Voor maandterugrekening wordt een niet-bestaande dag begrensd tot de laatste dag van de doelmaand. Het eerste en laatste maandpunt omvatten uitsluitend de dagen binnen het gekozen venster. De lopende dag of maand krijgt in de tooltip de toevoeging “tot nu”.

De referentie toont bij “7 dagen” acht datumlabels. We nemen de bediening en vorm over, maar tellen zeven kalenderdagen consequent. Een venster van zeven dagen op 25 oktober omvat dus 19–25 oktober.

### 3. Bezoeken doorheen de tijd

Een breed paneel met een klein grafiekicoon, titel **Bezoeken doorheen de tijd** en een omschrijving passend bij de aggregatie, bijvoorbeeld “Het aantal websitebezoeken per dag.”

- Eén donkergroene lijn met een subtiele groene vlakvulling, rustige horizontale rasterlijnen en een gehele getallenschaal die bij nul begint.
- Hover of aanraken toont een punt, hulplijn en tooltip met datum/tijd en `Bezoeken: aantal`.
- De tooltip is ook met toetsenbord bereikbaar. De tabel biedt dezelfde gegevens zonder grafiekbediening.
- De grafiek heeft één focuspunt: links/rechts wisselt van meetpunt, Home/End gaat naar begin/einde en Escape sluit de tooltip. Touch selecteert met tikken en blijft verticaal scrollen toestaan. Begrens de tooltip binnen de grafiekcontainer, ook aan de randen. Gebruik een stabiele hoogte tijdens laden; bij één meetpunt staat een zichtbaar punt en bij uitsluitend nullen blijft de y-as bruikbaar (bijvoorbeeld 0–1).
- Onder de grafiek staat **Toon cijfers per dag**, een uitklapbare tabel met datum en bezoeken. Voor 24 uur luidt de actie **Toon cijfers per uur**. Ook bij een maandgrafiek blijven de onderliggende dagcijfers beschikbaar, gepagineerd bij grote perioden.
- Geen extra KPI-kaarten, vergelijkingspercentages of andere rapporten in deze eerste versie.

### 4. Apparaten

Een tweede breed paneel met apparaat-icoon, titel **Apparaten** en de ondersteunende tekst uit de referentie, in de aanspreekvorm van het bestaande beheer.

Per rij: apparaatnaam, `aantal sessies`, horizontale balk en percentage met één decimaal en een decimale komma. Dezelfde geselecteerde periode als de grafiek.

Desktop en Mobiel zijn de hoofdgroepen uit de referentie. Tablet en Onbekend verschijnen alleen wanneer daar bezoeken voor zijn gemeten; geen geforceerde desktopclassificatie voor onduidelijke apparaten. Volgorde blijft Desktop, Mobiel, Tablet, Onbekend, onafhankelijk van de aantallen. Bij nul bezoeken staan aantallen op nul en percentages op een streepje. Percentages gebruiken het totaal van alle apparaatgroepen als noemer; afronding kan een tiende verschil opleveren. Balkbreedtes gebruiken de onafgeronde verhoudingen. Gebruik “1 sessie” en meervoud vanaf nul of twee. De som van de apparaatgroepen moet exact gelijk zijn aan de som van de grafiekpunten voor hetzelfde rapport.

## Huisstijl, mobiel en toegankelijkheid

- Hergebruik de adminvariabelen: papier `#fafbf8`, tekst `#282f29`, secundair `#657064`, lijnen `#e1e5dc`, accent `#354c39`, zachte achtergrond `#eef2e9`.
- Manrope, bestaande kopgroottes, regelafstand, knoppen en Lucide-iconen. Panelen krijgen de huidige bescheiden afronding en dunne rand; de grafiek gebruikt groen. Gebruik componentgebonden `.av-*`-klassen en bestaande variabelen; vermijd globale SVG-, tabel-, knop- of `.a-header`-overrides die andere tabbladen veranderen.
- Desktop: twee brede panelen onder elkaar. Mobiel: gestapelde kopacties, horizontaal scrollbare periodekeuze met zichtbare selectie, minder aslabels en apparaatregels die binnen de beschikbare breedte passen. De periodebalk krijgt gewone knoppen met `aria-pressed`, geen tabrollen zonder bijbehorend tabpanelpatroon. Zorg dat alleen de periodebalk horizontaal scrolt, met minimaal 44 px bedienhoogte en automatische zichtbaarheid van de geselecteerde knop. Apparaatregels gebruiken op telefoon label/aantal/percentage boven de volledige balk. Controleer ook 200% tekstzoom en een smalle viewport van 320 px.
- Expliciete labels, zichtbare toetsenbordfocus, semantische tabel, `aria-expanded` op de uitklapactie en toegankelijke laad-/foutstatus. Geen betekenis uitsluitend via kleur. Geen decoratieve grafiekanimatie.

## Telregels en registratie

Een bezoek begint zodra een toegestane publieke pagina zichtbaar is. Eén in het werkgeheugen beheerde sessie zorgt dat clientnavigatie, productvensters, filters, hartjes en rerenders geen extra bezoeken opleveren. Alleen vertrouwde gebruikersinvoer (pointer, toetsenbord, touch, wheel) en publieke clientnavigatie werken de activiteit bij. Beweging wordt lokaal begrensd verwerkt, zonder per-event renders of requests. Automatische 3D-animaties, programmatische scroll en timers zijn geen activiteit. De eerste activiteit na ten minste 30 minuten inactiviteit start een nieuwe sessie en één nieuwe registratie. Alleen een verborgen tabblad laten openstaan veroorzaakt geen nieuwe sessies. Terugkeren naar een zichtbaar document geldt als hervatten; de eerste klik erna mag niet nogmaals tellen.

De provider moet clientnavigatie tussen publieke routes overleven. Plaats hem als kleine clientcomponent in de bestaande server-rootlayout, zonder die layout naar een clientcomponent om te zetten. Activeer listeners en requests uitsluitend op de exacte toegestane routes `/` en `/huis`. `/reservation` is een privéstatuspagina en wordt uitgesloten, evenals alle onbekende routes. Verander de bestaande navigatie niet uitsluitend voor analytics: de huidige gewone links naar `/huis` kunnen een volledige documentnavigatie veroorzaken. Een volledige herlading, volledige paginanavigatie, nieuw tabblad of browserherstart kan opnieuw tellen. Zonder blijvende identificatie worden bezoeken niet over zulke grenzen samengevoegd. Er wordt geen unieke-persoonstelling beloofd. Deze technische grenzen verschijnen overeenkomstig de gebruikerskeuze niet in het dashboard.

Bewaar de lopende sessie en ongewijzigde gebeurtenissleutel in een modulegebonden singleton, niet in alleen een component-effect of kortlevende componentref. Effect-cleanup verwijdert listeners, maar begint bij remount geen nieuwe sessie. Test React Strict Mode, een verloren response na een geslaagde write en herstel via de back/forward cache. Gebruik geen unload-beacon: die kan de cookie-uitsluiting van de gewone fetch omzeilen. Een sessie telt zodra de server de registratie voor het eerst accepteert; een verloren aanvraag verschuift bij een geslaagde retry naar dat acceptatietijdstip, zonder door de client opgegeven historische tijd.

Een sessie telt bij de starttijd en in één apparaatgroep, ook als zij over middernacht loopt. De server bepaalt het meettijdstip. Bekende bots en prefetchverkeer worden waar herkenbaar uitgesloten; automatische detectie garandeert geen uitsluitend menselijk verkeer. Ontwikkeling, previews, `/admin`, API-aanvragen en de performancetestpagina worden uitgesloten. Eigen bezoeken aan de publieke productiesite tellen mee; de eerste versie voegt geen herkenning van de eigenaar aan de bezoekersmeting toe.

## Technische bouw

1. **Meetmodule.** Voeg `src/lib/analytics/` toe met gescheiden client- en servermodules, types, sessiebeheer, validatie, opslag en rapportage. Servermodules blijven buiten de clientbundle. De client gebruikt voor meetaanvragen `credentials: 'omit'`, `referrerPolicy: 'no-referrer'` en `cache: 'no-store'`; het meetendpoint leest en zet geen cookies en retourneert eveneens `Cache-Control: no-store`. Cookies uitsluiten verwijdert niet vanzelf de Referer-header. De bestaande eigenaarslogin blijft zijn eigen beveiligde authenticatie gebruiken.
2. **Publiek endpoint.** Voeg `POST /api/analytics/visit` toe. Accepteer uitsluitend een willekeurige gebeurtenissleutel en een toegestane publieke routecode. De sleutel leeft alleen in het geheugen en dient om herhaalde verzending van dezelfde gebeurtenis te herkennen. Bepaal apparaatcategorie en tijd op de server. Bewaar geen volledige URL, querystring, referrer, IP-adres of volledige user-agent in de meetdataset. Gebruik geen extra client hints of fingerprintkenmerken voor apparaatclassificatie.
3. **Opslag.** Gebruik een aparte Supabase-migratie voor dagtotalen per apparaatcategorie, meetstart/configuratie en kortlevende gebeurtenisrecords met alleen een unieke gebeurtenissleutel, serveracceptatietijd en apparaatcategorie. Deze tijdelijke records dienen zowel voor deduplicatie als voor het exacte 24-uursvenster. Alleen hele uurtotalen kunnen de gedeeltelijke uren aan de randen daarvan niet correct berekenen. Bereken de 24 grafiekpunten als aansluitende intervallen van één verstreken uur vanaf het exacte begin van het venster. Dag- en maandrapporten gebruiken uitsluitend dagtotalen; tel de tijdelijke records daar niet bij op. Verwerk insert en dagtellerupdate in één databasefunctie; alleen een werkelijk nieuw ingevoegd record verhoogt de teller. Gebruik een vaste lockvolgorde bij gelijktijdige writes. Voeg indexen op acceptatietijd en lokale dag/apparaat toe. Gebruik het bestaande private-schema/service-role-patroon met expliciet ingetrokken publieke functieprivileges. Geen writes naar het algemene voorraad-/bestellingsdocument per bezoek.
4. **Bewaren en opruimen.** Tijdelijke gebeurtenisrecords verlopen na 48 uur; alle reads sluiten verlopen records uit. Gebruik een begrensde database-opruimtaak om de vijf minuten via Supabase Cron, zodat verwijderen ook zonder websiteverkeer gebeurt. De fysieke verwijdering volgt uiterlijk bij de eerstvolgende geslaagde opruimrun; monitor mislukte runs. Geen langlevende intervaltimer in de Next.js-runtime. Bewaar dagtotalen zonder gebeurtenissleutels vanaf de meetstart, zodat Alles de volledige meethistorie omvat. Een tijdelijke retry bestaat alleen in het geheugen, gebruikt dezelfde sleutel en stopt uiterlijk vijf minuten na de eerste poging, ook na hervatten van een gesuspendeerd tabblad. Begrens tot drie pogingen, met backoff; geen retry bij validatiefouten, geen oude wachtrij of replay na herladen.
5. **Beveiliging.** Begrens payload, routecodes en verzendfrequentie; controleer dezelfde oorsprong. De bestaande throttle gebruikt een IP-afgeleide sleutel: neem die niet ongemerkt over als bezoekersidentificatie. Eventuele misbruikbeveiliging op infrastructuurniveau blijft gescheiden van de meetdataset. Een publiek endpoint blijft manipuleerbaar; een gebeurtenissleutel bewijst geen echte bezoeker.
6. **Beheerrapport.** Voeg `GET /api/admin/analytics?period=…` toe met `requireOwner` en `Cache-Control: private, no-store`. Valideer de periode tegen een vaste lijst en geef onbekende waarden een 400-respons. Bereken klok en rapporttijd op de server; alle vensters zijn halfopen `[from, to)`. Geef meetstart, rapporttijd, effectieve periodegrenzen, grafiekpunten en apparaattotalen uit één consistente database-read terug. Beperk dagdetails tot 50 rijen per pagina en valideer paginanummers. Elke detailaanvraag bevat dezelfde periodegrenzen als de geopende samenvatting. Verversen reset detailpagina en snapshot; labels, grafiek en apparaten worden samen vervangen. Totalen en grafiek zijn altijd gebaseerd op het volledige venster, nooit alleen op de zichtbare detailpagina.
7. **Interface.** Voeg `src/components/admin/visitors.tsx` en `visitors.css` toe. Breid `Section`, de namen, navigatie en inhoud in `admin.tsx` uit via het bestaande navigatiepad. Laad bezoekersgegevens alleen wanneer dit tabblad actief is. Wisselen van periode annuleert of negeert oudere aanvragen. Houd gewenste periode en daadwerkelijk getoonde rapportperiode gescheiden: oude cijfers mogen nooit onder het nieuwe periodelabel staan. Toon tijdens een eerste periodewissel een passende laadstatus of behoud de volledige oude rapportkop met de oude cijfers tot het nieuwe rapport gereed is. Vernieuw bij openen, terugkeren naar het zichtbare tabblad en de expliciete vernieuwknop. Voeg de bestaande focusvernieuwing en `visibilitychange` samen tot één lopende aanvraag; na uitloggen of verlaten van de sectie mogen late responses geen data terugzetten.

Gebruik de lokale Next.js-documentatie volgens AGENTS.md vóór implementatie; de route-handlergids is tijdens de planning geraadpleegd. Er is geen extra analyticsdienst of omvangrijke grafiekbibliotheek nodig; de ene lijn-/vlakgrafiek kan met SVG en toegankelijke HTML-bediening worden gebouwd.

## Perioden en toestanden

Bereken kalendergrenzen in Europe/Brussels, bewaar tijdstippen als UTC. Dagtotalen krijgen hun Brusselse dag rechtstreeks bij serveracceptatie; leid die niet af uit de eerste tien tekens van een UTC-tijdstip. De laatste 24 uur blijft exact 24 verstreken uren; kalenderdagen kunnen tijdens zomer-/wintertijd 23 of 25 uur duren. Herhaalde lokale uurbenamingen krijgen een ondubbelzinnige tooltip met UTC-offset. Vul ontbrekende intervallen binnen de actieve meetperiode met nul. Datums vóór de meetstart krijgen geen verzonnen historie. Bij een gedeeltelijk beschikbaar venster blijft de daadwerkelijke meetstart zichtbaar als datum. De meetstart is het eerste inschakelmoment. De huidige installatie schakelt de registratie bij het aanmaken van de configuratie in; opnieuw toepassen van de migratie behoudt de oorspronkelijke meetstart. Zonder ingeschakelde configuratie registreert het publieke endpoint niets. Uitschakelen stopt nieuwe registratie en wist geen historie; opnieuw inschakelen behoudt de oorspronkelijke meetstart.

Voorzie laden, vernieuwen, nog geen bezoeken, nog niet gestarte meting, verlopen eigenaarslogin en verbindingsfout. Een mislukte aanvraag toont nooit plots nul bezoeken. Bewaar reeds geladen cijfers bij een vernieuwfout en laat de laatste geslaagde actualisatietijd staan. Een meetstoring blokkeert de website, collectie, selectie of bestelling niet. Voor bekende registratiestoringen wordt geen historische reeks achteraf gereconstrueerd.

## Bouwvolgorde en acceptatie

1. Leg telregels en periodeberekening vast in gedeelde types en functies; bouw schema en lokale testadapter.
2. Bouw registratie, atomaire deduplicatie en het beveiligde rapportendpoint.
3. Sluit de publieke provider aan en bouw het Bezoekers-tabblad in de huidige huisstijl.
4. Controleer uitsluitend met geïsoleerde testgegevens: één sessie, navigatie zonder dubbeltelling, Strict Mode, retries, herladen, twee tabs, 30 minuten inactiviteit, verborgen tabblad, apparaatgroepen, nulpercentages, meetstart, maandgrenzen en Belgische zomer-/wintertijd. Controleer ook gelijktijdige writes, onbevoegde rapporttoegang en uitval van opslag.
5. Controleer desktop en telefoon, toetsenbord, touch-tooltips, lange perioden en de uitklapbare tabel. Controleer in browseropslag en netwerk dat de bezoekersmeting geen cookies of browseropslag gebruikt en geen bestaande cookies meestuurt.
6. Voer relevante tests, typecheck en productiebuild uit. Neem de meting op in de bezoekersinformatie en controleer de feitelijke infrastructuurlogging apart van de meetdataset. Uitrol, migratie en activering zijn vervolgstappen na dit plan.

Aanvullende regressiegevallen uit de planreview: een bezoek exact op een periodegrens; 24 uur bekeken om 14:37 in plaats van op een heel uur; Brusselse dag tegenover UTC-dag rond middernacht; een 3-maandsvenster vanaf de 31e; de klokwissel op 25 oktober 2026; twee gelijktijdige identieke inserts; onduidelijke apparaatheader; een mislukte cleanup zonder nieuwe bezoeken; verborgen tabblad langer dan de retrydeadline; periodewissels met antwoorden in omgekeerde volgorde; focus plus visibilitychange tegelijk; uitloggen tijdens laden; één grafiekpunt; maandgrafiek met gepagineerde dagdetails. Bij integratie blijven de bestaande Hartjes-, Hosting-, product- en vertrekcontrolefuncties werken.

Klaar wanneer het nieuwe tabblad dezelfde functies heeft als de twee referenties, zichtbaar aansluit op het huidige groene dashboard, echte sessietotalen uit de eigen backend toont en de bezoekersmeting zonder cookies of blijvende browseridentificatie werkt.

## Technische bronnen

- [MDN — sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage): ook sessionStorage is browseropslag en blijft daarom buiten dit ontwerp.
- [MDN — user-agentdetectie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Browser_detection_using_the_user_agent): apparaatclassificatie heeft grenzen; bij onvoldoende informatie gebruiken we Onbekend.
- [MDN — Request.referrerPolicy](https://developer.mozilla.org/en-US/docs/Web/API/Request/referrerPolicy): bepaal expliciet welke verwijzingsinformatie een meetaanvraag meestuurt.
- [Supabase Cron](https://supabase.com/docs/guides/cron): databasefuncties gepland uitvoeren en hun runs controleren, ook zonder binnenkomend websiteverkeer.

## Uitgevoerde implementatie en laadervaring

- `src/components/admin/visitors.tsx` en `visitors.css` bevatten de volledige interface, grafiek, apparaatreportage en dagtabel. De navigatie staat vóór Hosting & capaciteit.
- De eerste laadbeurt gebruikt een subtiel ademende skeleton met dezelfde paneel- en grafiekhoogte als het resultaat. Er worden geen voorbeeldcijfers getoond tijdens laden. Kop en bediening blijven staan; inhoud verschijnt in één korte overgang.
- Vernieuwen houdt de vorige cijfers zichtbaar en gebruikt een dunne voortgangsindicatie. Reeds bekeken periodes worden binnen het geopende tabblad uit het geheugen getoond en op de achtergrond vernieuwd. Oudere antwoorden worden geannuleerd of genegeerd; een fout bewaart de bestaande cijfers en biedt opnieuw proberen.
- De SVG meet zijn werkelijke container, zodat aslabels op telefoon niet vervormen. De actieve beheernavigatie blijft op smalle schermen zichtbaar. Reduced motion schakelt beweging uit.
- De publieke tracker zit in de server-rootlayout als losse clientcomponent. Productie registreert standaard; ontwikkeling registreert alleen met `NEXT_PUBLIC_VISITOR_TRACKING=true`. `NEXT_PUBLIC_VISITOR_TRACKING=false` schakelt registratie bij de build uit. Vercel-previews worden bovendien door het endpoint uitgesloten.
- De server leest voor het rapport reeds in PostgreSQL gegroepeerde uur-/dagwaarden, geen afzonderlijke gebeurtenissleutels. Dagdetails gebruiken 50 rijen per pagina en behouden de cutoff van het geopende rapport.
- `20261025140000_visitor_analytics.sql` is op LOTHUUS productie toegepast. De serververbinding met de nieuwe rapportfunctie is gecontroleerd. Publieke toegang is geweigerd zoals bedoeld. De cleanup `lothuus-analytics-cleanup` staat actief op iedere vijf minuten. De migratie is herhaalbaar en behoudt de meetstart.
- Tests gebruiken uitsluitend een tijdelijke SQLite-database en een geïsoleerde browsercontext. Er zijn geen fictieve bezoeken in de productiedataset gezet.

Validatie: `npm run test:analytics`, de bestaande testsuite, typecheck en productiebuild; een geïsoleerde PostgreSQL-controle van schema/RPC/deduplicatie/opschoning/rechten; browsercontrole van skeleton, verversen, periodewissels, paginering, toetsenbordtooltip, mobiel op 390 en 320 px en Cookie-/Referer-uitsluiting. Screenshots met geïsoleerde testgegevens staan in `artifacts/analytics/`.
