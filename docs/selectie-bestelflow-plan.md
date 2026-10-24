# Van selectie naar bestelling

Datum: 24 oktober 2026. Status: geïmplementeerd met lokale e-mailvoorbeelden; echte e-mailverzending volgt later. Zie de implementatiestatus onderaan.

## Doel en vastgelegde afspraken

De bezoeker kan een object met één tik op een hartje bewaren, meerdere objecten verzamelen en de volledige selectie met één kort formulier bestellen. De selectie vervult de functie van een mandje. Geen bezoekersaccount en geen online betaalstap. Katrien controleert de externe betaling en bevestigt dat de objecten definitief voor de klant aan de kant staan.

De gebruiker heeft expliciet bevestigd dat objecten vóór betaling tijdelijk geblokkeerd mogen worden tot de betaalafspraak vervalt. Bewaren via het hartje blokkeert nooit voorraad; een succesvol ingediende bestelling doet dat wel.

Dit plan vervangt voor deze flow de keuze in `BACKEND-PLAN.md` om per object te reserveren. Het bouwt op de bestaande lokale backend. Een cloudmigratie is een afzonderlijke infrastructuurkeuze, geen voorwaarde om eerst de nieuwe flow lokaal te realiseren.

## Vastgesteld in de huidige code

| Onderdeel | Huidig gedrag | Gevolg |
| --- | --- | --- |
| `src/components/lothuus.tsx` — Detail | Plusknop vergroot de foto; bewaren staat onder de inhoud; aparte reserveerknop | Opslaan is moeilijk vindbaar en de acties concurreren |
| `src/components/mosaic.tsx` | Hele foto is één knop; selectie heeft alleen een bewaard-markering | Bewaren vereist eerst het detailvenster |
| Mijn selectie | Formulier downloadt een informatieaanvraag als tekstbestand | Geen mandje of gezamenlijke bestelling |
| `src/components/reservation.tsx` | Eén object per formulier, inclusief herhaald e-mailadres en contactvoorkeur | Meerdere objecten veroorzaken herhaald werk |
| Backend | Eén item per reservering; SQLite-transactie, voorraadcontrole, prijsversie, betalingsregister en herhaalbeveiliging bestaan | Sterke basis, maar gezamenlijke bestellingen ontbreken |
| E-mail | Alleen records met `status: preview`; niets wordt verstuurd | Echte verzending en opvolging moeten worden toegevoegd |
| Dashboard | Reserveringen, betaalregistratie, klanten en e-mailvoorbeelden bestaan | Bestellingen met meerdere regels en blijvende meldingen ontbreken |
| Aangeleverde fotocollectie | Kan als fallback verschijnen zonder prijs of gekoppeld verkooprecord | Een foto is nog geen bestelbaar voorraadobject |

## 1. Hartje en detailvenster

- Verwijder de plusknop op productfoto’s en de bijbehorende plus/min-bediening. Geen vervangende vergrotingsknop. De bestaande fotokeuze en volledige beeldverhouding blijven behouden; geen extra fotomodal in deze scope.
- Plaats één hartje op de hoofdfoto in het detailvenster, linksboven, los van de sluitknop rechtsboven. Het hartje hoort bij het object, niet bij elke afzonderlijke foto. Het blijft dezelfde toestand tonen bij fotowissels.
- Een leeg hartje betekent toevoegen; een gevuld hartje betekent geselecteerd. Tweede tik verwijdert. Directe feedback: korte melding “Toegevoegd aan je selectie”, met een rustige link “Bekijk selectie”. Geen automatische navigatie of bevestigingsvenster.
- Toon ook een hartje op collectieobjecten zodat bewaren zonder detailvenster mogelijk is. Op kleine, dichte desktoptegels verschijnt de bediening bij aanwijzen of toetsenbordfocus; een geselecteerd hartje blijft zichtbaar. Op touch is het hartje direct zichtbaar en bruikbaar. Hit-area minimaal 44 × 44 pixels; kies plaatsing die niet de hele kleine tegel afdekt.
- Maak openen en bewaren aparte sibling-knoppen; nooit een knop in de huidige `object-button` nesten. De hartactie opent het detailvenster niet en activeert geen onbedoelde hoververgroting of filtertransitie. Bewaarde harten moeten ook in decoratieve filterovergangen correct worden weergegeven.
- De header toont een hartje, “Mijn selectie” en het werkelijke aantal. Vanuit details leidt “Bekijk mijn selectie (n)” naar dezelfde selectie. Verwijder de afzonderlijke route om één object te reserveren. Eén object bestellen gebruikt dezelfde flow.
- Toon bij de objecttitel meteen prijs en beschikbaarheid zodra die bekend zijn. Gebruik productnaam als hoofdtekst; de importcode is secundair. Verzin geen ontbrekende titel of prijs.
- Toegankelijk: `aria-pressed`, een naam als “Bewaar H031 in je selectie” / “Verwijder H031 uit je selectie”, zichtbare focus, contrast op lichte en donkere foto’s en feedback via een beleefde live-region. Behoud focus na toggelen en respecteer verminderde beweging.

## 2. Mijn selectie is het mandje

Gebruik herkenbare taal zonder de collectie in een drukke webshop te veranderen:

> Mijn selectie · 3 objecten  
> [foto] Objectnaam · productcode · € … · Verwijderen  
> Totaal € …  
> **Verder met bestellen**  
> Je betaalt buiten de website. Na bevestiging van je betaling zet Katrien je objecten voor je klaar.

- Eén regel per uniek object; geen aantalkiezer, kortingscodes of afzonderlijke favorietenlijst.
- Elke regel toont foto, naam, code, prijs, beschikbaarheid en verwijderen. Objectdetails blijven bereikbaar, met behoud van selectie en formuliergegevens bij teruggaan.
- Onder de regels staan het totaal en de primaire actie. Op mobiel blijft die actiebalk zichtbaar zonder inhoud, toetsenbord of laatste regel te bedekken.
- “Verder kijken” sluit de selectie en brengt de bezoeker terug waar die was.
- De selectie blijft bewaard in deze browser. Synchroniseer tabbladen; als browseropslag niet beschikbaar is, blijft de selectie in het geheugen bruikbaar. Alleen object-ID’s lokaal bewaren, geen klantgegevens.
- Een verwijderd, gearchiveerd of niet meer beschikbaar object verdwijnt niet stilzwijgend. Bewaar minimale productinformatie in de selectiepresentatie, toon de wijziging en laat de klant de niet-bestelbare regel verwijderen voordat hij bestelt. Totalen onderscheiden bestelbare regels expliciet.
- Een ontbrekende prijs betekent “Prijs volgt”, nooit € 0. Zo’n object kan bewaard worden maar niet besteld. Geen fictieve prijs, schijnbestelling of lokale tekstdownload als alternatief voor een echte bestelling.
- Lege selectie: “Tik op een hartje om een object te bewaren”, met “Ontdek de collectie”.

## 3. Eén korte afronding

De route is **hartje → Mijn selectie → gegevens invullen → bestelling bevestigd**. Het gegevensscherm bevat opnieuw de compacte objectlijst en het totaal; geen extra controlescherm na het formulier.

Verplicht: naam, e-mailadres en akkoord met de concrete bestelafspraken. Optioneel: telefoon en bericht. Geen verplicht account, tweede e-mailveld, adres of contactkanaalkeuze. Toon privacyinformatie bij het formulier; eventuele marketingtoestemming staat hier los van. De precieze voorwaarden en definitieve bestelknop moeten passen bij de door Katrien vastgelegde verkoopafspraken.

De laatste actie is **“Bestelling plaatsen · € …”**. Erboven staat wat de klik doet, hoe lang de tijdelijke reservering duurt en hoe betalen en ophalen werken. Ophalen op afspraak is het voorstel; levering krijgt pas een eigen keuze wanneer kosten en werkwijze bekend zijn. Geen verzendkosten stilzwijgend op nul zetten.

Voorstel voor de minste handelingen: de server bevestigt actuele beschikbaarheid en geeft meteen de ingestelde betaalinstructies. Katrien hoeft beschikbaarheid dan niet nogmaals handmatig goed te keuren. Als zij eerst een betaal- of leverafspraak moet maken, krijgt de bestelling expliciet “Wacht op afspraak” en worden nog geen betaalinstructies of definitief totaal verzonden. Deze uitzondering mag geen impliciete extra stap voor iedere klant worden.

Na succesvolle opslag:

- Bevestigingsscherm met één bestelnummer, alle objecten, totaal, exacte vervaldatum en volgende stap.
- Tekst: “Je bestelling is ontvangen. Je objecten zijn tijdelijk voor je gereserveerd tot [datum en uur]. Na bevestiging van je betaling zet Katrien ze definitief voor je klaar.”
- Bij overschrijving: begunstigde, IBAN, één mededeling en kopieeractie. Geen betaalwidget of melding dat al betaald is.
- Privélink naar bestelstatus, zonder account. De link geeft uitsluitend toegang tot deze bestelling en wordt niet in analytics of logs opgenomen.
- Alleen de succesvol bestelde objecten uit de selectie verwijderen; later toegevoegde objecten behouden. Bij een fout blijven selectie en gegevens staan. Klantgegevens alleen tijdens de sessie in geheugen behouden.

## 4. Voorraad, betaling en verlopen afspraken

| Moment | Status voor Katrien | Effect op objecten en klantcommunicatie |
| --- | --- | --- |
| Hartje aangeklikt | Geen bestelling | Vrij beschikbaar; alleen opgeslagen in de browser |
| Bestelling atomair opgeslagen | Wacht op betaling | Alle bestelregels tijdelijk geblokkeerd; bevestiging en betaalafspraak |
| Betaling gedeeltelijk ontvangen | Deels betaald | Geblokkeerd; openstaand bedrag zichtbaar; geen definitieve betaalbevestiging |
| Katrien bevestigt volledige ontvangst | Betaald · klaarzetten | Objecten definitief aan klant toegewezen en publiek niet meer bestelbaar; bevestigingsmail |
| Afspraak voor ophalen vastgelegd | Ophalen afgesproken | Afspraak zichtbaar voor klant en Katrien |
| Objecten overgedragen | Afgerond | Verkoop in klantgeschiedenis; objecten blijven verkocht |
| Termijn voorbij, niets ontvangen | Vervallen | Tijdelijke blokkering eindigt; oude betaalinstructies vervallen |
| Annulering vóór betaling | Geannuleerd | Objecten vrij; klant wordt geïnformeerd |

**Voorgestelde betaaltermijn:** drie kalenderdagen, door Katrien instelbaar. Dit is een voorstel, geen vastgelegde bedrijfsregel. Leg per bestelling één expliciete deadline vast in Europe/Brussels en toon datum én uur. Verlengingen worden geregistreerd en aan de klant meegedeeld.

De termijn moet automatisch worden verwerkt door een geplande taak; niet alleen wanneer Katrien haar dashboard ververst. Controleer bij iedere nieuwe besteltransactie ook verlopen blokkeringen. Markeer een bestelling bij het verstrijken van de termijn atomair als vervallen, zodat een vertraagde taak geen extra blokkering veroorzaakt en een oude privélink geen geldige betaalopdracht blijft tonen.

Een overschrijving kan al onderweg zijn zonder dat de website dit weet. Laat Katrien daarom vóór de deadline een bankcontrole uitvoeren via een dashboardtaak. Is een bedrag al gedeeltelijk ontvangen of heeft Katrien expliciet uitstel gegeven, geef de voorraad niet automatisch vrij: toon “Controle nodig” met reden en eigenaaractie. Dit is een zichtbare uitzondering op het normale vervallen, geen stille verlenging van iedere reservering.

Een betaling die pas na vrijgave wordt ontdekt, wordt als late betaling geregistreerd. Blokkeer niet achteraf een object dat intussen door iemand anders is besteld. Katrien beoordeelt of alsnog leveren mogelijk is of een terugbetaling nodig is; de klant krijgt geen automatische belofte. Overbetaling en terugbetaling lopen eveneens via het betalingsregister. “Ik heb betaald” is hoogstens een klantbericht, nooit een betaalbevestiging.

Bewaar betaalstatus, voorraadtoewijzing en overdracht apart. De huidige `active/completed`-afleiding moet veranderen: betaald maar nog niet opgehaald is al verkocht voor publieke beschikbaarheid; afronden betekent overdracht, niet het moment waarop pas voorraad wordt beschermd.

## 5. Eén bestelling, meerdere regels

Introduceer een `Order` met `OrderLine`-records; voer niet simpelweg de bestaande reserveringsroute in een lus uit.

- Bestelling: ID, bestelnummer, klantkoppeling, contactmomentopname, bericht, valuta, totaal in centen, betaalafspraak, deadline, voorwaardenversie, levenscyclus, overdrachtstatus, versie, tijdlijn en hash van de privéstatus-token.
- Bestelregel: object-ID, naam/code/fotomomentopname, prijs in centen en voorraadtoewijzing. Aantal is altijd één. Bescherm historische regels tegen latere productwijzigingen.
- Betalingen horen bij de bestelling: één overschrijving met één referentie voor de volledige selectie. Bewaar ontvangsten, correcties en terugbetalingen; leg een expliciete verdeling vast als een deel van de bestelling wordt geannuleerd. Geen stille herberekening na betaling.
- E-mailtaken en meldingen verwijzen naar de bestelling en het bronevent. Eén bestelling veroorzaakt geen losse bevestigingsmails per object.
- Eén servertransactie controleert alle objecten, publicatie, beschikbaarheid, prijs/versie, voorwaarden en request-key. Zij legt bestelling, regels, voorraadclaims, klantkoppeling, tijdlijn, melding en e-mailtaken samen vast. Alles slaagt of alles wordt teruggedraaid.
- Bij een conflict: retourneer de betrokken regels en actuele informatie. De klant verwijdert een onbeschikbaar object of accepteert een nieuwe prijs en verstuurt opnieuw. Nooit ongemerkt een deel bestellen.
- Verwijder dubbele object-ID’s of wijs ze expliciet af; begrens selectieomvang, payload en aanvraagfrequentie. De server bepaalt totaal, deadline en bankgegevens.
- Een retry van dezelfde onveranderde aanvraag geeft dezelfde bestelling terug. Een gewijzigd winkelmandje of gewijzigde prijsacceptatie krijgt een nieuwe request-key. Gelijktijdige orders kunnen hetzelfde fysieke object nooit beiden vastleggen.
- Bouw een versiegebonden migratie van bestaande reserveringen naar bestellingen met één regel, inclusief betalingen, tijdlijnen en bestaande privélinks. Maak eerst een backup en valideer aantallen, bedragen en voorraadclaims. De migratie verstuurt geen e-mails.

De lokale `BEGIN IMMEDIATE`-transactie kan de gezamenlijke mutatie dragen. Houd de servicegrens geschikt voor latere genormaliseerde opslag. Geen losse browserwrites voor voorraad, bestelling of betaling.

## 6. E-mail en dashboardmeldingen

| Gebeurtenis | Klant | Katrien / dashboard |
| --- | --- | --- |
| Bestelling opgeslagen | Ontvangst, volledige selectie, totaal, afspraak/deadline, privélink | Eén nieuwe-bestellingmail en één ongelezen melding met directe link |
| Katrien bevestigt volledige betaling | “Je betaling is bevestigd; je objecten staan voor je klaar” | Bestelling naar Betaald; taak “Klaarzetten / ophalen afspreken” |
| Termijn bijna verstreken | Alleen een ingestelde, zinvolle herinnering | Taak “Bank controleren”; geen dubbele meldingen per object |
| Termijn vervalt / annulering | Uitleg en geen geldige oude betaalopdracht | Statuswijziging in tijdlijn en overzicht |
| E-mail bounced of definitief mislukt | Bevestigingspagina/status blijft beschikbaar | Actiemelding “Klant niet bereikt” met correctie en opnieuw verzenden |

Het dashboard krijgt onder Verkoop **Bestellingen**, met filters Nieuw, Wacht op betaling, Controle nodig, Betaald, Ophalen en Afgerond. Een bestelregel in het overzicht toont klant, aantal objecten, totaal, status en deadline. Details tonen de volledige selectie en één betalingsregister. Primaire actie volgt de toestand: “Betaling bevestigen”, daarna “Ophalen afspreken” en “Overdracht afronden”. Bevestigen toont bedrag en ontvangstdatum; het registreert uitsluitend een door Katrien gecontroleerde ontvangst.

Meldingen worden blijvend opgeslagen met event-ID, bestel-ID, type, aanmaakdatum en gelezen/opgelost-status. Gelezen is iets anders dan afgehandeld. Nieuwe bestellingen verschijnen door periodieke verversing zolang het dashboard open is, plus verversing bij vensterfocus. Realtime-infrastructuur is hiervoor niet noodzakelijk. Betaalcontroles en mislukte mails blijven zichtbaar tot ze zijn opgelost.

Echte mail vereist een ingestelde verzenddienst, geverifieerde afzender en Katrien haar ontvangstadres. Houd productieconfiguratie buiten browsercode. Vervang previews door een duurzame uitbox met queued/processing/sent/failed-status, pogingen, volgende poging, lease en provider-ID. Verstuur na commit, met een stabiele deduplicatiesleutel en herstel bij time-outs. Verwerk afleverfouten via gecontroleerde provider-events. Een mailstoring mag nooit een bestelling verliezen, voorraad vrijgeven of een dubbele bestelling veroorzaken. Zeg pas “E-mail verzonden” wanneer verzending bevestigd is; provideracceptatie is nog geen bezorging.

Historische previews blijven previews en worden niet alsnog verstuurd. De verzenddienst en hosting worden tijdens de technische aansluiting gekozen op basis van de werkelijk gebruikte omgeving; dit plan legt geen nieuwe leverancier vast.

## 7. Implementatievolgorde

1. **Hartje en één selectiepad.** Wijzig `lothuus.tsx`, `mosaic.tsx`, `collection-wall.tsx` waar nodig en `globals.css`. Verwijder foto-plusbediening en dubbele reserveeractie. Behoud gridgedrag, beeldverhoudingen en bestaande selectie-ID’s. Bouw de selectie met prijzen en duidelijke niet-bestelbare toestanden.
2. **Gezamenlijke bestelling.** Voeg ordertypes, validatie, transacties, deadline-afhandeling en migratie toe aan `src/lib/backend/`. Maak een order-API en privéstatusprojectie. Vervang het losse reserveringsformulier en de selectie-download door de gezamenlijke afronding. Behoud algemene contactaanvragen als aparte functie.
3. **Opvolging voor Katrien.** Pas dashboard, klantgeschiedenis, betalingsregistratie en voorraadprojectie aan. Voeg blijvende meldingen en verversing toe. Bestaande productinvoer blijft intact.
4. **Verzending en geplande verwerking.** Sluit de maildienst aan, maak de uitboxworker en termijnverwerking, en controleer foutmeldingen met testontvangers. Zolang die aansluiting ontbreekt heet de flow expliciet testmodus; geen echte verzendbelofte.
5. **Volledige verificatie.** Loop de klant- en eigenaarflow door met één en meerdere unieke objecten, inclusief concurrentie en storingen. Open de verkoopflow publiek pas na controle van echte voorraad, prijzen, betaalafspraken, afzender en opvolging.

Lees vóór codewijzigingen de relevante geïnstalleerde Next.js-documentatie onder `node_modules/next/dist/docs/`, zoals AGENTS.md vereist. De huidige lokale backend gebruikt dynamische Node-routes en persistente opslag; een statische export ondersteunt die backend niet zonder afzonderlijke migratie.

## 8. Wanneer is dit af?

- Eén tik op het hartje bewaart direct vanuit foto/detail; nogmaals tikken verwijdert; foto-plusknoppen ontbreken. Foto-openen, toetsenbordbediening en gridanimatie blijven werken.
- Selectie, header, detail en tweede tabblad tonen dezelfde toestand. Browserherladen behoudt de selectie; onbeschikbare of ontbrekende objecten worden uitgelegd.
- Eén formulier maakt één bestelling voor meerdere objecten, met correct totaal, één referentie en één betaalafspraak. Geen account en geen betaling op de site.
- Dubbelklikken, verloren response en retry creëren één order, één voorraadclaim per object en één set mailtaken/meldingen. Een conflict in één regel laat geen halve bestelling achter.
- Bij gelijktijdige kopers wint maximaal één bestelling een object. Gewijzigde prijzen vereisen expliciete acceptatie.
- De tijdelijke blokkering vervalt volgens de afspraak, ook zonder geopend dashboard. Gedeeltelijke en late betalingen komen in de juiste controleflow. Geen dubbele toezegging na vrijgave.
- Katrien kan één betaling voor de hele bestelling bevestigen. Alle objecten zijn dan publiek niet meer bestelbaar; de klant ontvangt de juiste bevestiging. Ophalen en afronden zijn aparte stappen.
- Klant én Katrien krijgen hun bedoelde mails; mailuitval, retry, bounce en ongeldige privélink zijn getest. Het dashboard toont nieuwe bestellingen en onopgeloste problemen zonder dubbele notificaties.
- Migratie behoudt bestaande reserveringen, bedragen en links en verstuurt niets achteraf.
- Visuele en interactiecontrole op desktop en smalle telefoon, met toetsenbord, touch en verminderde beweging. Gerichte tests voor ordertransactie, races, deadline, betalingsregels en migratie; bestaande relevante tests, typecheck en build draaien bij implementatie.

Nog in te vullen vóór echte verkoop: betaaltermijn, bank-/betaalafspraak, afzender en ontvangstadres, ophaal- of leverafspraken en definitieve verkoopteksten. De UX en lokale implementatie kunnen op basis van bovenstaande voorstellen worden gebouwd zonder die gegevens te verzinnen.

## Implementatiestatus — 24 oktober 2026

Uitgevoerd: hartjes in grid en detail, foto-plus verwijderd, selectie als mandje, gezamenlijk formulier, één transactionele bestelling met meerdere regels, voorraadlabels in het grid, automatische termijnverwerking voor nieuwe bestellingen, betaling/overdracht en blijvende dashboardmeldingen. Bestaande individuele reserveringen blijven leesbaar zonder destructieve datamigratie. Publieke privéstatus wordt automatisch ververst.

Op verzoek uitgesteld: echte e-mailverzending, provider-uitboxworker en afleverwebhooks. De huidige uitbox blijft uitsluitend lokale voorbeelden tonen. De aangeleverde fotocollectie heeft nog geen verkoopprijzen of gepubliceerde verkooprecords; echte verkoop vereist aanvulling in het beheer en de betaal-/bestelinstellingen. Voor de implementatiecontrole zijn uitsluitend afzonderlijke tijdelijke testgegevens gebruikt.

### Aanvulling: afronden vanuit de echte fotocollectie

De klant kan nu ook zonder ingevulde verkoopprijs of betaalconfiguratie afronden via naam, e-mailadres en **Laat mijn selectie reserveren**. Deze stap slaat een echte tijdelijke reservering op en toont Gereserveerd op het grid. Onbekende prijzen worden expliciet als te bevestigen opgeslagen en getoond. Katrien zet daarna de prijs en betaalafspraak klaar; pas dan begint de betaaltermijn en verschijnen bankgegevens op de privélink. De tijdelijke reservering vóór deze afspraak heeft eveneens een zichtbare vervaldatum. Er wordt nog geen automatische mail verstuurd.
