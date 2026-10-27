# Updates voor Katrien

Datum: 27 oktober 2026. Status: lokaal geïmplementeerd; nog niet gepubliceerd.

## Doel en advies

Geef Katrien een vaste plek waar ze in gewone taal kan teruglezen wat Kevin aan haar website en werkruimte heeft verbeterd. De naam in het menu wordt **Updates**, met als paginatitel **Nieuw voor jou** en als introductie: “Hier lees je wat er aan je website en werkruimte is verbeterd.”

Het overzicht beschrijft afgeronde, voor haar relevante verbeteringen. Iedere update zegt wat veranderd is, wat zij eraan heeft en eventueel waar ze het kan bekijken. Meerdere technische wijzigingen die samen één verbetering opleveren worden één bericht.

## Onderzochte basis

- De GitHub-remote `origin` is `https://github.com/kevinb42O/lothuus.git`. Op het moment van controle wijst GitHub `main` naar `2222147e0016bcbd98f38f33f04f56a35816763e`, gelijk aan de lokale HEAD.
- Commit `8c59147` bevat de nieuwe collectie, extra materiaalcategorieën, gewijzigde dashboardvormgeving en de optie “Onthoud mij”. Commit `2222147` geeft de dashboardgrafieken hun blauwe kleur.
- Het importverslag `docs/import-inox-plastiek-textiel-plan.md` documenteert 102 nieuwe producten en 403 nieuwe foto's: 20 inox/ijzer, 63 plastiek en 19 textiel. Het verslag vermeldt ook een geslaagde productiecontrole. Voor de daadwerkelijke publicatie van een update wordt de zichtbare productie opnieuw gecontroleerd; GitHub alleen bewijst niet dat iets al live staat.
- Het dashboard gebruikt secties binnen `/admin`, aangestuurd door `Section` en `navigate()` in `src/components/admin/admin.tsx`. Er is al een belletje voor operationele meldingen. Het overzicht staat in `WorkspaceOverview` in `src/components/admin/inventory.tsx`.
- Visuele basis: `.impeccable/surfaces/admin.md`, `DESIGN.md` en de huidige dashboard-CSS. Bij uitvoering blijven de bestaande neutrale stijl, Manrope, dunne scheidingslijnen en focusbehandeling leidend.

## Plaats en gedrag

1. Voeg **Updates** als vaste menukeuze toe, na Bezoekers en vóór Hosting & capaciteit. Een eenvoudig krant-icoon sluit aan bij de bestaande iconen. Dezelfde keuze blijft bereikbaar in de horizontale mobiele navigatie.
2. Toon op Overzicht, onder de bestaande snelkoppelingen, een compacte rij **Nieuw voor jou** met datum, titel van de recentste update en **Alle updates bekijken**. Toon alleen de recentste update; het productenbeheer houdt de hoofdrol.
3. Open een eigen dashboardsectie met een rustige leeslijst, nieuwste datum bovenaan. Per bericht: datum, korte titel, maximaal twee korte alinea's of drie bullets en hoogstens één relevante actie.
4. Gebruik alleen zinvolle acties, bijvoorbeeld **Producten bekijken** of **Bezoekers bekijken**. Interne acties gebruiken de bestaande navigatie en respecteren de controle op onopgeslagen wijzigingen. Links naar de website zeggen duidelijk dat ze de website openen.
5. Geen popup bij aanmelden. Updates blijven later terug te vinden en worden niet vermengd met bestelmeldingen of waarschuwingen.

De eerste versie bevat op verzoek vijftien berichten, inclusief de eerdere verbeteringen. De volledige leeslijst blijft beschikbaar zonder zoekfunctie, filters, reacties of apart beheerscherm. Bij verdere groei kan een knop “Oudere updates” volgen.

## Nieuw en bekeken

Bevestigde keuze van de gebruiker: teruglezen met een subtiel **Nieuw**-label, zonder handmatig afvinken.

- Het menu toont “Nieuw” zolang er nog onbekende update-ID's zijn; geen rood alarm of knipperende teller.
- Registreer de geladen update-ID's pas als bekeken nadat de Updates-sectie succesvol geopend en weergegeven is. Nieuwe labels binnen die geopende leeslijst mogen voor die sessie blijven staan, zodat duidelijk blijft wat net nieuw was.
- Een bezoek aan alleen Overzicht markeert de volledige lijst niet als bekeken.
- Bewaar bekeken ID's voor de eerste versie lokaal in de browser, onder een eigen sleutel en met een begrensde lijst. Dit onthoudt bekeken updates op dat toestel. Bij geblokkeerde browseropslag blijft de leeslijst werken.
- Op een ander toestel of na het wissen van browsergegevens kunnen berichten opnieuw “Nieuw” zijn. Synchronisatie tussen toestellen vraagt opslag per eigenaar en hoort pas bij de eerste versie als dat gewenst is.

## Eerste berichten: voorstel voor Katrien

Deze teksten zijn concepten. Datum is de datum waarop de verbetering beschikbaar kwam, niet automatisch de datum van de commit. Bevestig de live beschikbaarheid vóór opname in de uitlevering.

### 27 oktober 2026 — Je nieuwe producten zijn toegevoegd

“Je nieuwe levering is verwerkt: 102 producten en 403 foto's zijn toegevoegd. Je vindt nu ook inox en ijzer, plastiek en textiel terug bij de materialen.

De productfiches staan als concept klaar in je werkruimte. Je kunt ze rustig aanvullen en zelf kiezen wanneer je ze publiceert.”

Actie: **Producten bekijken** → Producten. Claim geen automatische publicatie van alle nieuwe fiches. De openbare fotocatalogus en de publicatiestatus van een productfiche zijn verschillende zaken.

### 27 oktober 2026 — Een frissere, rustigere werkruimte

“Je dashboard heeft een rustigere vormgeving gekregen, met neutrale kleuren en duidelijkere knoppen. De grafieken bij Bezoekers en Hartjes zijn nu blauw, zodat je de cijfers makkelijker kunt volgen.”

Actie: **Bezoekers bekijken** → Bezoekers.

### 27 oktober 2026 — Makkelijker opnieuw inloggen

“Bij het inloggen kun je nu ‘Onthoud mij’ aanvinken. Zo hoef je op je eigen toestel minder vaak opnieuw in te loggen.”

Geen actie nodig. Geen garanties over een ononderbroken sessie of onbeperkt ingelogd blijven.

Op verzoek van de eigenaar is ook de relevante geschiedenis van vóór 27 oktober opgenomen: twaalf berichten over 24 en 25 oktober. Samen met de drie berichten van 27 oktober zijn er vijftien berichten, met vaste ID’s en nieuwste datum bovenaan. Technische tussenstappen zijn gebundeld tot begrijpelijke verbeteringen.

## Redactie en vertrouwelijkheid

- Kevin selecteert en schrijft de berichten bewust. GitHub is alleen een onderzoeksbron; er komt geen automatische feed van commits, pull requests of technische wijzigingslijsten naar Katrien.
- Vertrouwelijke commerciële en interne informatie komt niet in de updategegevens, teksten, verborgen velden, links, afbeeldingen of meegeleverde browserbestanden. Gebruik ook geen verhullende omschrijving die alsnog naar een vertrouwelijke wijziging verwijst.
- Eén commit kan zowel geschikte als uitgesloten wijzigingen bevatten. Schrijf een afzonderlijk bericht over uitsluitend de toegestane verbetering; neem nooit de committekst of het volledige verschil over.
- Neem uitsluitend positieve, concrete en geverifieerde productinformatie op. Geen ontwikkeljargon, interne foutgeschiedenis, infrastructuurdetails of onbewezen claims zoals “alles is veiliger”.
- Berichten zijn afrondingsmeldingen. Toekomstige plannen of beloftes horen niet tussen geleverde updates.
- Schrijf nieuwe berichten bij de bijbehorende oplevering en controleer de tekst bewust vóór uitrol. Stabiele ID's voorkomen dat een kleine tekstcorrectie een oud bericht opnieuw als nieuw presenteert.

## Technisch bouwplan

Houd de eerste versie klein: handmatig onderhouden inhoud in de repository, uitgeleverd met de website. Een editor, GitHub-koppeling of extra databasetabel is hiervoor niet nodig.

Voorgestelde nieuwe bestanden:

- `src/lib/updates/types.ts`: gedeeld type met uitsluitend `id`, `date`, `title`, `body` en een optionele actie uit een toegestane lijst. Geen vrije HTML of willekeurige actie-URL's.
- `src/lib/updates/server.ts`: expliciet alleen voor servergebruik, met uitsluitend de goedgekeurde berichten. Geen interne concepten, broncommits of uitgesloten velden in deze module.
- `src/app/api/updates/route.ts`: leesroute die vóór uitleveren `requireOwner(request)` gebruikt, zoals de bestaande beheerroutes. Antwoorden met `Cache-Control: private, no-store`; fouten via de bestaande foutafhandeling.
- `src/components/admin/updates.tsx` en `updates.css`: leeslijst en compact overzichtselement, met bestaande dashboardtokens en hergebruik van bestaande knoppen.
- `src/lib/updates/viewed.ts`: kleine begrensde opslaghelper voor bekeken ID's, alleen als de lokale variant wordt gekozen.

Aanpassingen in bestaande bestanden:

- `src/components/admin/admin.tsx`: sectie, naam, menukeuze, laden na authenticatie, inhoud en navigatieacties. Neem Updates op bij de secties die geen periodieke vernieuwing van de volledige bedrijfsgegevens nodig hebben.
- `src/components/admin/inventory.tsx`: compact overzichtselement invoegen via props/callback, zonder afhankelijkheid van de inhoudsmodule op de server.
- Na uitvoering de bestaande dashboarddocumentatie gericht aanvullen met de nieuwe functie en het redactieproces.

Laad de updates eenmaal na succesvolle authenticatie en deel die gegevens tussen menu, overzicht en leeslijst. Geen polling. Een mislukte update-aanvraag mag producten of bestellingen niet blokkeren. Bij uitloggen de geladen gegevens uit de componentstatus verwijderen. Volg vóór implementatie de meegeleverde Next.js-documentatie; de lokale Route Handler-guide is voor dit plan al geraadpleegd.

## Toestanden en toegankelijkheid

- Laden: korte status “Updates laden…”, zonder het hele dashboard te blokkeren.
- Geen berichten: “Zodra er iets nieuws is, lees je het hier.” Geen leeg Nieuw-label of leeg overzichtselement.
- Fout: “De updates konden niet worden geladen.” met **Opnieuw proberen**; niets als bekeken markeren.
- Niet aangemeld: geen update-inhoud uitleveren. Alleen een robots-instelling of een verborgen menukeuze biedt geen toegangscontrole.
- Leesbreedte circa 65 tekens; datum als echte datum met Nederlandse weergave; normale koppenstructuur en zichtbare toetsenbordfocus.
- Mobiel één leeskolom, zonder horizontale tekstscroll. Nieuw is ook tekstueel herkenbaar en hangt niet alleen van kleur af.

## Uitvoering en acceptatie

1. Selecteer de definitieve eerste teksten; teruglezen met een automatisch bijgehouden Nieuw-label is bevestigd.
2. Bouw de afgeschermde gegevensroute, het menupunt en de leeslijst; voeg daarna de compacte verwijzing op Overzicht toe.
3. Controleer met gerichte tests dat de route niet-aangemelde aanvragen weigert, dat alleen geselecteerde inhoud wordt teruggegeven en dat onbekende/gecorrumpeerde lokale bekeken-status de functie niet breekt.
4. Controleer navigatie met onopgeslagen productwijzigingen, de Nieuw-status, opnieuw openen, lege lijst en laden met fout/herstel. Controleer dat de nieuwe sectie geen volledige bedrijfsgegevens blijft verversen.
5. Voer TypeScript, relevante bestaande tests en een productiebuild uit. Controleer desktop en een smalle telefoonweergave met toetsenbordbediening. Voer de voorgeschreven ontwerpcontrole uit over de gewijzigde UI-bestanden.
6. Lees de uiteindelijke berichten nog eens letterlijk zoals Katrien ze zal zien. Controleer de genoemde functies in productie vóór publicatie van het bijbehorende bericht.

Klaar wanneer Katrien Updates op desktop en telefoon vindt, recente verbeteringen in gewone taal kan teruglezen, de bedoelde functie kan openen en uitsluitend bewust geselecteerde informatie ontvangt.


## Uitvoering

De inhoud staat bewust rechtstreeks in `src/app/api/updates/route.ts`, binnen de servergrens van de Route Handler. Er is geen aparte inhoudsmodule die per ongeluk door een clientcomponent kan worden geïmporteerd. `types.ts` bevat alleen het gedeelde type. Acties zijn beperkt tot Producten, Bezoekers en Hartjes; de Hartjes-actie opent ook de Verkoop-navigatie.

`useUpdates()` deelt één aanvraag per aanmelding tussen menu, overzicht en leeslijst. Uitloggen maakt de geladen inhoud leeg; verlate aanvragen uit een eerdere sessie worden genegeerd. De bekeken-status wordt pas na succesvol weergeven van de lijst bewaard en het Nieuw-label blijft tijdens dat eerste bezoek staan. De eerste versie bewaart maximaal 200 ID’s per browser.

Validatie: volledige testsuite (186 tests) en productiebuild geslaagd voor de functie; na uitbreiding van de historische inhoud zijn de route-, component- en opslagtests en TypeScript opnieuw uitgevoerd. De publieke productiecatalogus is alleen-lezen gecontroleerd: 297 objecten, waaronder 20 inox/ijzer, 63 plastiek en 19 textiel. De eerste drie berichten zijn in de lokale geïsoleerde werkruimte visueel op een smal scherm gecontroleerd. De aanvullende browsercontrole werd vervolgens geblokkeerd doordat lokaal browsergebruik in Work-instellingen uitgeschakeld was; een desktopcontrole en visuele controle van de uitgebreide historie zijn daardoor nog niet afgerond.
