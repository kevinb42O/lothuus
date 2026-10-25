# Plan: Hartjes onder Verkoop

Datum: 25 oktober 2026. Status: geïmplementeerd; Supabase-migraties toegepast in productie. Zie de uitvoeringsnotities onderaan voor verificatie en meetgrenzen.

## Doel en uitgangspunt

Voeg in het huidige beheerdashboard onder **Verkoop** het tabblad **Hartjes** toe. De eigenares ziet welke objecten belangstelling krijgen, hoe die belangstelling evolueert en welke populaire beschikbare objecten nog geen reservering hebben. Dit is een interesse-indicator, geen koopintentie of bezoekersregister.

Bevestigde focus: **populaire objecten en trends**, gekozen door de gebruiker op 25 oktober 2026. De eerste versie geeft voorrang aan de rangschikking van objecten en de evolutie van belangstelling. Reserveringen worden uitsluitend als aanvullende context op objectniveau ernaast gezet, zonder bezoekers met klanten te verbinden; uitgebreide conversieanalyse valt buiten deze versie.

## Wat er nu bestaat

- `src/components/lothuus.tsx` bewaart selectie-ID's in `lothuus-selection` in localStorage. Grid, detail, selectie verwijderen en opruimen na een geslaagde bestelling delen deze toestand. Andere tabbladen synchroniseren via het storage-event.
- Er worden geen hartjes naar de server gestuurd. Bestaande aantallen en historische klikmomenten zijn daarom niet beschikbaar.
- `src/components/admin/admin.tsx` heeft onder Verkoop de onderdelen Bestellingen, Klanten en E-mailuitbox. Het beheer ververst gegevens momenteel elke 15 seconden wanneer geen editor actief is.
- De online bedrijfsgegevens worden via `src/lib/backend/cloud.ts` als één transactioneel document opgeslagen. Hartjes krijgen aparte opslag, zodat publieke interacties geen volledige product-, klant- en bestelgegevens herschrijven.
- De publieke collectie kan de aangeleverde fotocollectie of gepubliceerde voorraad gebruiken. De meting moet beide ID-bronnen expliciet ondersteunen en mag niet op titel of productnummer koppelen.

## Scherm en bediening

Plaats **Hartjes** na Bestellingen binnen de bestaande Verkoopnavigatie, met een harticoon. Titel: **Interesse in je collectie**. Toelichting: “Bekijk welke objecten bezoekers bewaren. De telling gebeurt per browser, zonder namen of contactgegevens.”

Behoud de actuele beheercomponenten, kleuren, typografie en mobiele navigatie. Gebruik de echte uitvoering in `workspace.css` als uitgangspunt; geen nieuw dashboardontwerp.

De leesvolgorde is:

1. **Periode:** 7 dagen, 30 dagen (standaard), 90 dagen en sinds de meetstart. Toon meetstart en laatst bijgewerkt. Vergelijk alleen volledige, vergelijkbare periodes; bij te weinig voorgeschiedenis staat “Nog onvoldoende meetgegevens”.
2. **Drie kerncijfers:** toegevoegde hartjes, handmatig verwijderde hartjes en objecten met nieuwe hartjes in de gekozen periode. Een toevoeging is een echte toestandsovergang, geen willekeurige klik of opnieuw geladen pagina.
3. **Evolutie:** een eenvoudige grafiek van toevoegingen en handmatige verwijderingen per dag, bij langere periodes per week. Bied dezelfde cijfers tekstueel/tabelmatig aan. Opruimen na reservering telt niet als handmatig verwijderen.
4. **Objectenlijst:** foto, nummer of bronreferentie, titel, voorraadstatus, toevoegingen, handmatige verwijderingen, recent bewaard, laatste gemeten interesse en webreserveringen in de periode. Sorteer standaard op toevoegingen. Zoek op nummer/titel en filter op materiaal/categorie en beschikbaarheid. Geef toegang tot de productfiche wanneer die bestaat; toon anders een leesbare bronfiche.
5. **Objectdetail:** dezelfde meetgegevens voor één object, met tijdlijn en voorraadstatus. Beschikbare objecten met veel hartjes kunnen aanleiding geven om informatie, foto's of prijs te bekijken; het scherm trekt geen automatische conclusie over de reden waarom ze niet reserveren.

“Recent bewaard” betekent: bij de laatste succesvolle synchronisatie geselecteerd in een browser die de voorbije 90 dagen werd gezien. Toon deze uitleg bij de kolom. Het is een momentopname over een vast venster, onafhankelijk van de gekozen grafiekperiode. Het is geen exact aantal mensen of gegarandeerd actuele verlanglijstjes.

Op telefoon krijgen foto, titel, toevoegingen en voorraadstatus voorrang; overige waarden blijven via detail of een lokaal scrollbare tabel bereikbaar. Filters en sortering zijn gelabeld en met toetsenbord bedienbaar. Gebruik tekst naast kleur voor trends en statussen.

## Meetdefinities en grenzen

| Gegeven | Betekenis |
| --- | --- |
| Toegevoegd | Geregistreerde overgang van niet geselecteerd naar geselecteerd voor een browser/object. Opnieuw toevoegen na verwijderen is een nieuwe overgang, geen nieuwe persoon. |
| Handmatig verwijderd | Bezoeker verwijdert een geselecteerd object via grid, detail of selectielijst. |
| Afgerond via reservering | De selectie wordt opgeruimd nadat de server de bestelling bevestigt; apart tellen, uitsluitend gevalideerd tegen die bestelling. |
| Bestaande selectie | Een bij de eerste synchronisatie al geselecteerd object. Dit vormt een beginstand, geen nieuw hartje op die dag. |
| Recent bewaard | Laatst bekende geselecteerde toestanden van browsers die binnen 90 dagen synchroniseerden. Verlopen toestanden zijn geen handmatige verwijderingen. |
| Webreserveringen | Aantal via de website aangemaakte bestellingen waarin dit object voorkomt, met annuleringen/vervallen apart herkenbaar. Geen bewezen gevolg van een hartje. |

Toon geen conversiepercentage in de eerste versie. Zonder individuele attributie en vergelijkbare observatieperiodes zou dat misleidend zijn. Directe verkoop hoort niet bij webreserveringen. Geen percentages bij een nulbasis of onvoldoende data.

Eerdere hartjes kunnen alleen als beginstand worden ingelezen wanneer de bezoeker terugkomt en synchronisatie toegestaan is. De datum van hun oorspronkelijke toevoeging blijft onbekend. Nieuwe browser, privémodus, gewiste opslag, verlopen meetidentificatie, bots en geblokkeerde/verloren aanvragen beperken de meting. Dit zijn gemeten interacties, geen volledige telling van alle belangstelling.

## Registratie en privacy als ontwerpvoorwaarden

- Gebruik een willekeurige eigen browseridentificatie voor deduplicatie. Bewaar serverzijdig bij voorkeur een daarvan afgeleide sleutel, zonder naam, e-mail, klant-ID of bestelprivélink. Het dashboard toont alleen totalen per object en periode.
- Noem de onderliggende registratie technisch **pseudoniem** zolang een browser herkenbaar blijft. Alleen het weglaten van een naam maakt de registratie niet vanzelf volledig anoniem.
- Bouw geen individuele bezoekersprofielen, fingerprinting, locatieanalyse, externe marketingtracking of koppeling met klantfiches.
- Bewaar geen IP-adressen of volledige user agents in de meetdataset. Behandel eventueel tijdelijk misbruikbeheer apart, met minimale gegevens en korte vervaltermijn. Controleer ook infrastructuurlogs.
- Voorstel bewaartermijnen: browsergebonden meettoestand maximaal 90 dagen na laatste toegestane synchronisatie; dagtotalen zonder browseridentificatie maximaal 24 maanden. Opruimen moet automatisch gebeuren. Dit zijn productvoorstellen die vóór activering nog worden getoetst.
- Controleer vóór livegang de informatie aan bezoekers en de vereisten rond meetopslag/toestemming. Maak meten afzonderlijk uitschakelbaar. Bij weigering, intrekking of een meetstoring blijven de lokale hartjes normaal werken; synchroniseer eerder bewaarde keuzes niet alsnog zonder geldige grondslag.
- Geen automatische e-mails, bezoekersmeldingen of verkoopacties op basis van hartjes.

## Technische aanpak

1. **Aparte opslag en aggregatie.** Voeg Supabase-tabellen en beperkte serverfuncties toe voor browser/object-toestand, kort bewaarde deduplicatie van aanvragen en dagtotalen per object en gebeurtenistype. Sleutel op stabiel object-ID plus expliciete bron. Neem een minimale titel/bronreferentie-snapshot op om historie leesbaar te houden als een object verdwijnt. Daggrenzen volgen Europe/Brussels.
2. **Veilige toestandsregistratie.** Een publieke serverroute ontvangt gewenste toestand, objectbron/ID, aanvraag-ID en volgordegegevens. De server bepaalt het tijdstip, valideert objecten en toegestane overgangen en verwerkt toestand plus totalen atomair. Rechtstreekse publieke databasewrites en leesbare browserrecords zijn niet toegestaan.
3. **Eén selectie-integratie.** Centraliseer opslag en synchronisatie uit `lothuus.tsx`. Alleen een expliciete wijziging maakt een nieuwe overgang; renderen, opstarten en storage-events doen dat niet. Bestaande keuzes gebruiken een aparte beginstand. Voorkom extra tellingen door dubbele tabs, herhaalde aanvragen en React-effecten.
4. **Volgorde en herstel.** Serializeer wijzigingen per browser/object en coördineer tabbladen. Gebruik idempotente aanvragen en serverversies om vertraagde of conflicterende updates te herkennen. Houd een begrensde tijdelijke wachtrij bij voor netwerkherstel, alleen zolang meten is toegestaan. Een volgelopen of verlopen wachtrij leidt tot een herstelde beginstand met ontbrekende historie, nooit tot verzonnen klikmomenten. Synchroniseer de toestand bij terugkeer; verdwenen browseropslag kan niet achteraf worden gedetecteerd.
5. **Reservering als aparte reden.** Gebruik een serverbevestigde bestelactie als bron voor opruimen na reservering. Het publieke meetendpoint mag niet zelfstandig een geslaagde reservering claimen. Bestellen en voorraadbeveiliging blijven functioneren als meten faalt.
6. **Eigen beheerendpoint.** Voeg een alleen voor de ingelogde eigenaar toegankelijke, gepagineerde samenvattingsroute toe. Verwerk filters en periodes op de server. Laad hartjes alleen wanneer het tabblad openstaat, met dezelfde rustige verversfrequentie als het huidige beheer, zichtbare actualisatietijd en herstelactie bij een fout.
7. **Misbruik en werking.** Beperk aanvraaggrootte, toegestane ID's, aantal objecten en frequentie. Negeer onmogelijke overgangen. Sluit expliciete tests en beheerpreview uit. Rate limiting vermindert spam, maar bewijst geen unieke mens. Voorzie een lokale ontwikkel/testadapter met dezelfde meetregels en een opruimtaak voor productie.

Lees bij implementatie eerst de toepasselijke lokale Next.js-documentatie in `node_modules/next/dist/docs/`, met name route handlers en server/client-grenzen, volgens AGENTS.md.

## Toestanden die het scherm moet uitleggen

- Nog niet ingeschakeld: “De meting is nog niet gestart.” Geen historische nullen suggereren.
- Wel ingeschakeld, nog geen hartjes: meetstart tonen en rustig uitleggen wanneer hier gegevens verschijnen.
- Geen resultaten binnen filters: filters kunnen herstellen zonder de meetgegevens te wissen.
- Laden of vernieuwen: bestaande cijfers zichtbaar houden met een status; een fout nooit als nul tonen.
- Meetuitval: bekende uitval of onvolledigheid markeren waar detecteerbaar. Volledigheid van geblokkeerde clientmetingen is niet bewijsbaar.
- Verkocht, gearchiveerd of verdwenen object: historie blijft leesbaar met status, zonder ongeldige bewerklink.

## Bouwvolgorde en acceptatie

**Stap 1 — meetfundament:** schema, toegangscontrole, definities, bewaartermijnen, activeringsvoorwaarde en lokale adapter. Verifieer atomaire overgangen, deduplicatie en opschoning.

**Stap 2 — publieke aansluiting:** alle selectieroutes, beginstand, meerdere tabs, netwerkherstel en serverbevestigd opruimen na bestellen. De hartknop blijft direct reageren, ongeacht de meetverbinding.

**Stap 3 — dashboard:** tabblad, kerncijfers, periodevergelijking, grafiek, objectenlijst/detail en fout-/lege toestanden. Laat reserveringen uitsluitend als objectstatistiek ernaast zien.

**Stap 4 — verificatie en activering:** gebruik uitsluitend geïsoleerde testgegevens. Controleer grid/detail/selectielijst, herladen, snelle toggles, dubbele/vertraagde aanvragen, twee tabs, gewiste opslag, bestaande selectie, ontbrekend object, bestelling, geweigerde meting, onbevoegde toegang en spamlimieten. Controleer periodes over een Belgische zomer-/wintertijdgrens en toetsenbord/mobiele bediening. Voer typecheck, relevante backendtests en productiebuild uit. Activeer de meting pas na controle van de bezoekersinformatie en configuratie.

Klaar wanneer één echte toevoeging één keer verschijnt, handmatige verwijdering en reserveringsopruiming gescheiden blijven, de beginstand niet als nieuwe interesse telt, meetstoringen de selectie niet blokkeren en de eigenaar de cijfers met hun meetstart en beperkingen kan begrijpen.

## Later, bij voldoende gebruik

CSV-export van geaggregeerde cijfers, materiaaltrends en vergelijking tussen opeenvolgende periodes kunnen volgen. Productweergaven en een bewaarratio vragen aparte, betrouwbare blootstellingsmeting en vallen buiten deze eerste versie. Individuele attributie, automatische prijswijzigingen en meldingen per hartje horen niet bij dit plan.

## Uitvoering — 25 oktober 2026

Het tabblad Verkoop → Hartjes, de periodefilters, volledige-dagenvergelijking, grafiek met tabelalternatief, zoek-/categorie-/voorraadfilters, sortering, paginering en objectdetail zijn gebouwd. De eerste versie legt de nadruk op populaire objecten en trends. Bronobjecten behouden hun oorspronkelijke identiteit wanneer hun geïmporteerde productfiche wordt gepubliceerd.

Gewijzigd op expliciet verzoek: hartjes tellen automatisch mee. De checkbox en alle privacyuitleg in de selectie zijn verwijderd. Alleen aparte footerlinks naar Algemene voorwaarden en Privacy blijven zichtbaar. Zonder selectie of hartjesactie wordt geen meetidentificatie aangemaakt. Dagtotalen bevatten geen browsercode. De eigenaar kan de volledige meting pauzeren in het tabblad.

Registratie staat los van de bedrijfsaggregate. De client gebruikt afzonderlijke Web Locks voor de lokale wachtrij en netwerkverzending: volgende klikken kunnen meteen worden opgeslagen tijdens een trage aanvraag. Dubbele en vertraagde updates worden aan de serverkant afgewezen op volgnummer. Herladen en reconciliëren leggen alleen een beginstand vast. De wachtrij is begrensd en wordt na een dag als beginstand hersteld, zonder klikmomenten te verzinnen. Een meetstoring blokkeert de selectie of bestelling niet.

Reserveringsopruiming gebruikt een door de server gecontroleerde bestelcapability. Er wordt geen browsercode bij de klant of bestelling opgeslagen. Alleen eerder succesvol gemeten selecties kunnen als opgeruimd na reservering worden geteld. Als registratie rond het bestellen uitvalt, kan dit aantal onvolledig zijn; latere reconciliatie herstelt de selectietoestand zonder een handmatige verwijdering te tellen.

Migraties `20261025120000`, `20261025120100` en `20261025120200` zijn via de SQL-editor toegepast op het bestaande project `gzrxxdmhonzcfkomowpo`. Zoals bij de eerdere migraties schrijft de SQL-editor geen CLI-migratiehistoriek. De lokale CLI toont een ander project; er is geen CLI-link of blinde history repair uitgevoerd. Vijf nieuwe private tabellen hebben RLS en zijn niet toegankelijk voor gewone rollen. Alleen de server/service role mag de zes hartjesfuncties uitvoeren. Supabase Cron voert dagelijks om 03:17 UTC de eigen retentiefunctie uit; andere jobs blijven behouden. De registratie bewaart browsergebonden toestand maximaal 90 dagen en dagtotalen maximaal 24 maanden. Meetstart in productie: 25 oktober 2026 om 03:35 Belgische tijd.

Verificatie: geautomatiseerde tests voor beginstanden, toestandsovergangen, retries, verlate aanvragen, retentie, Belgische daggrenzen, filtertotalen, toegangscontrole, offline wachtrij, niet-blokkerende checkoutcontext en intrekken. De SQL-functies zijn ook in een afzonderlijke PostgreSQL-testomgeving uitgevoerd. Een geïsoleerde HTTP-controle doorliep toevoegen, dubbele aanvraag, reserveren, gescheiden opruiming en vergeten. Desktop en telefoon (390 × 844) zijn visueel gecontroleerd met uitsluitend afzonderlijke lokale testgegevens; geen testhartjes of testbestellingen zijn in productie gezet.

In productie is via de service role bevestigd dat de meetfuncties beschikbaar zijn en dat anonieme rapporttoegang geweigerd wordt. Nieuwe hartjes worden automatisch geregistreerd wanneer de aangepaste frontend wordt gebruikt. Historische hartjes worden niet gereconstrueerd. De bestaande algemene backup-/hostinginrichting valt buiten deze wijziging.

## Bugcontrole en aangepaste meetkeuze

Op verzoek vervalt de vrijwillige meetkeuze. De privacyverklaring beschrijft de automatische, pseudonieme hartjesregistratie op een aparte pagina; de selectie bevat geen uitleg of checkbox. De algemene voorwaarden krijgen eveneens een eigen pagina. Het eerdere voorstel over een vrijwillige keuze is daarmee vervangen.

Gerepareerd: verwijderen van niet meer gepubliceerde objecten, verlate toevoegingen na reserveringsopruiming, wisselende meetcontext bij een bestelretry, grafieken in objectdetails met achtergebleven lijstfilters, voorraadstatus van gepubliceerde importobjecten, schrikkeldagretentie, beschadigde lokale journals, tellen zonder Web Locks en het verwerken van meetpauzes. Oude requests kunnen geen nieuwere productmomentopname meer overschrijven. Gewone bezoeken zonder selectie genereren geen lege browserregistratie. Gebeurtenissen die pas op een latere Belgische kalenderdag worden verzonden, worden als beginstand hersteld in plaats van op de verkeerde dag als nieuwe klik geteld.
