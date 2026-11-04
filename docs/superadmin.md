# Superadmin — LOTHUUS

Route: `https://www.lothuus.be/superadmin`. Persoonlijke login: `kevin@webaanzee.be`. Het wachtwoord staat uitsluitend bij Supabase Auth en wordt niet in Git, documentatie of browseropslag bewaard.

## Aanmelden

Sinds 4 november 2026 is de authenticator op uitdrukkelijk verzoek van Kevin verwijderd. Inloggen gaat uitsluitend met het persoonlijke e-mailadres en wachtwoord. Er is geen QR-code, setupstap of eenmalige code meer. De server blijft de vaste identiteit, serverrol en actieve private operatorregistratie controleren. De HTTP-only superadmincookie blijft gescheiden van de eigenaarsessie.

## Functies

- **Overzicht:** objectgebruik, effectieve blokkade, pakket, laatste bevestigde back-up en beschikbare technische metingen. Ontbrekende metingen blijven onbekend; een fout daarin blokkeert de andere beheerfuncties niet.
- **Activiteiten:** nieuwe en gewijzigde producten, publicaties, archivering, uploads, succesvolle aanmeldingen, geweigerde toevoegingen en belangrijke beheeracties. De log begint bij installatie en wordt één jaar bewaard. Er is geen retrospectieve veldgeschiedenis en geen versieherstelinterface.
- **Pakket & rechten:** objectlimiet handhaven aan/uit, een afwijkende objectlimiet en een optionele einddatum. Een reden is verplicht. Bestaande producten blijven behouden en bewerkbaar. Na de einddatum gelden weer de gewone pakketlimiet en handhaving. Prijzen, facturatie en providerabonnementen veranderen hierdoor niet.
- **Betalingen:** bestaande pakketbestellingen bekijken en ontvangst bevestigen na eigen bankcontrole. Een bankreferentie en bevestiging van geleverde infrastructuur zijn vereist bij een hostingpakket. De bestaande idempotente activeringsfunctie voorkomt dubbele toekenning.

## Centrale limiet

`lothuus_capacity_policy()` is de gedeelde bron voor frontend, server en databasecontrole. `operator_settings` bewaart de uitzondering; de effectieve pakketlimiet blijft uit het bestaande hostingrapport komen. Het aanmaken van een product wordt atomair in de databasetrigger gecontroleerd. Instellingen krijgen een versienummer, zodat een oud tabblad recentere rechten niet stilzwijgend overschrijft. Operatorwijzigingen en de gekoppelde auditregel worden in dezelfde transactie opgeslagen.

Het handmatig terugdraaien uit `objectlimiet-handhaving.md` is na deze installatie vervangen door de schakelaar in superadmin. Voer de oudere limietmigratie niet opnieuw uit na de superadminmigratie: die oude functie kent de centrale instelling niet. De historische migraties blijven wel intact.

## Activiteiten en privacy

Productwijzigingen worden in een private databasetrigger geregistreerd, in dezelfde transactie als de wijziging. De HTTP-eigenaarsroute geeft de gecontroleerde actoridentiteit mee via `lothuus_commit_state_audited`; operator-/importacties zonder die identiteit staan als Systeem vermeld. Het log bewaart productreferentie, titel en namen van gewijzigde velden, geen volledige productteksten, klantgegevens, wachtwoorden, tokens of ingetypte invoer. Geweigerde toevoegingen worden per actor en minuut samengevoegd. Het logboek gebruikt cursorpaginering; gewone dashboarduitlezingen veroorzaken geen activiteitregels.

Er is geen browseropname, cursorregistratie of toetsregistratie. Een upload die slaagt maar waarvan de aparte logregistratie faalt, blijft een geslaagde upload; een latere productopslag registreert de fotowijziging atomair.

## Installatie en beheer

Migratie `20261104160000_superadmin.sql` is uitgevoerd via de SQL-editor van het bestaande LOTHUUS-productieproject. Hij voegt private tabellen, RPC's, de audittrigger, centrale policy en begrensde retentie toe. De bestaande productcollectie wordt niet herschreven. De SQL-editor registreert geen CLI-migratiehistoriek; push historische migraties niet blind.

Het account is afzonderlijk aangemaakt via de bestaande Supabase Admin API. Operatorregistratie gebeurt lokaal met:

```sh
node --env-file=.env.local scripts/setup-superadmin.mjs
```

Deze opdracht controleert de bestaande serverrol en gebruikt de eenmalige service-role-RPC `lothuus_operator_bootstrap`. Hij verandert geen bestaand wachtwoord, MFA of ingetrokken toegang. De RPC is niet beschikbaar via een website-endpoint; gewone anon/authenticated-rollen kunnen hem niet uitvoeren. De opgegeven gebruiker blijft dezelfde eigenaar van dit persoonlijke beheeraccount.

Toegang intrekken: zet `app_private.operator_users.enabled=false` voor de betrokken UUID. Iedere beschermde request controleert dit opnieuw; de bootstrapopdracht kan deze blokkade niet terugdraaien. Verlies van de authenticator vereist gecontroleerd herstel via Supabase Auth door de projectbeheerder, gevolgd door sessie-intrekking en opnieuw koppelen. Er is geen onbeveiligde herstelroute in de website.

## Back-ups en verificatie

De bestaande dagelijkse snapshot bevat nu ook `operator_users`, `operator_settings` en `operator_activity` (18 tabellen). Eerdere complete v2-snapshots met 15 tabellen blijven geldig. Auth-wachtwoorden en MFA-geheimen zitten niet in deze applicatiesnapshot. Bij een daadwerkelijke volledige PostgreSQL-restore moeten identity-sequences, waaronder `operator_activity_id_seq`, op minstens de hoogste herstelde ID worden gezet voordat schrijven weer wordt toegestaan.

Gerichte tests controleren identiteit en rollen, cross-origin weigering, de verplichte MFA-stap in de UI, atomiciteit van activiteitregels, verboden normale rollen, intrekking, dubbele betaalactivering, policyversies, verlopen uitzonderingen, behoud van collecties boven de limiet en back-upcompatibiliteit/herstel. Browsercontrole bekijkt desktop en telefoon met geïsoleerde testgegevens; productiecontrole maakt geen testproducten of testbetalingen aan.

## Livecontrole bij oplevering — 4 november 2026

Productie-uitrol `dpl_E2RetnumWGYiEXDpbdaomeUeGnxe` is READY op `www.lothuus.be`. De broncode is gepusht naar `main` in `e349393`. Alle 225 tests, de typecheck en productiebuild slagen. De desktop- en telefoonweergave zijn bekeken; de ingelogde layout is gecontroleerd met geïsoleerde testgegevens.

Historische controle vóór het verwijderen van de authenticator: de echte aparte login is via de productie-API gecontroleerd zonder wachtwoorden of sessietokens af te drukken of op te slaan. Zonder login geeft het rapport HTTP 401; na alleen wachtwoordlogin geven rapport en beheeracties HTTP 403 totdat MFA is bevestigd. Een superadmincookie geeft geen toegang tot de eigenaarsstore (HTTP 401). De testaanmelding is daarna uitgelogd. MFA is niet door de bouwer gekoppeld: Kevin koppelt zijn eigen authenticator bij de eerste aanmelding.

De productie-RPC retourneert de effectieve policy 304/200 met handhaving aan. Anonieme rechtstreekse RPC-toegang is geweigerd. De uitgebreide back-upsnapshot valideert met 18 tabellen. De productcollectie is vóór en na de installatie identiek: 304 records, revisie 2892, SHA-256 `da3757b1c77e40690836c2e58c6fdd0c70cf01c82688a939ebdea10f170cab89`. Er zijn geen testproducten, testbetalingen of kunstmatige productactiviteiten in productie aangemaakt.

## Uitgebreide persoonlijke werkruimte

**Opleverstatus (4 november 2026):** de uitgebreide werkruimte en klik-/pakketuitbreiding zijn geïmplementeerd; 240 tests, typecheck en productiebuild zijn geslaagd. Migraties `20261104190000_operator_workspace.sql`, `20261104210000_workspace_usage_packages.sql` en `20261104220000_workspace_arrivals.sql` zijn via de officiële Supabase-CLI op LOTHUUS productie (`gzrxxdmhonzcfkomowpo`) uitgevoerd. De collectie bleef bytegelijk aan de vooraf gemaakte reservekopie: 304 producten, 304 nieuwe baselineversies en 24 tabellen in de uitgebreide snapshot. De productie-RPC's voor het overzicht, gebruik en pakketrechten zijn rechtstreeks gecontroleerd. De browserverbinding blijft door de Work-instelling geblokkeerd; een visuele browsercontrole is daarom niet uitgevoerd. De releasecontrole gebruikt daarnaast de geauthenticeerde HTTP-routes na deployment. De persoonlijke login gebruikt geen authenticator.

De uitbreiding voegt negen samenhangende onderdelen toe. De authenticator is verwijderd: de volledige omgeving gebruikt de persoonlijke wachtwoordlogin, serverrol en actieve operatorregistratie.

### Overzicht en aandachtspunten

Het startscherm koppelt aandachtspunten aan de juiste actie: objectlimiet, verouderde of falende reservekopie, open pakketbestellingen en verstreken interne taken. De fichecontrole leidt naar ontbrekende prijzen, onvolledige beschrijvingen en onvoldoende of te veel geselecteerde foto's. Een dertigdaagse grafiek toont opgeslagen producthandelingen, met een doorklik naar de dag in het logboek. Dit is geen meting van schermtijd of aanwezigheid. Verkoopcijfers zijn gebaseerd op geregistreerde ontvangsten/terugbetalingen en niet op de bank.

### Collectie en productversies

De collectie heeft serverfilters, titel-/nummerzoeken, sortering en paginering met 40 resultaten. De projectie maakt onderscheid tussen concept, publicatie, archief en beschikbare/gereserveerde/verkochte voorraad. Foto's lopen via een eigen superadmin-geauthenticeerde fotoroute: privéfoto's worden niet publiek gemaakt en een browsercache wordt pas na een nieuwe toegangscontrole hergebruikt.

De migratie legt een baseline vast van bestaande producten zonder de productcollectie bij te werken. Een private trigger bewaart daarna gewijzigde producten als versie. De interface toont maximaal de dertig recentste bewaarde versies per product. Versies blijven maximaal negentig dagen bewaard; de dagelijkse retentie houdt maximaal vijftig versies per product bij om de opslag te begrenzen. De baseline is de toestand bij installatie, geen reconstructie van gebeurtenissen voordien.

Een vergelijking laat toe om gekozen tekst-, categorie- en prijsvelden te herstellen. Productidentiteit, vaste nummers, foto's, publicatiestatus en verkoop-/klantgeschiedenis vallen buiten deze herstelactie. De actuele itemversie wordt gecontroleerd voordat de mutatie wordt uitgevoerd; de bestaande bedrijfsregels verbieden onder meer prijswijzigingen tijdens reserveringen of na verkoop. Het herstel en de aanvullende operatorauditregel zijn onderdeel van dezelfde committransactie. Publicatie, terugzetten naar concept en archiveren hebben een afzonderlijke actie met reden en bevestiging; dezelfde bestaande validatieregels blijven gelden.

### Activiteiten en exports

Het logboek zoekt op titel, productnummer, handeling en beheerreden. Filters omvatten soort handeling, actor en begin-/einddatum. Cursorpaginering gebruikt stabiele numerieke ID's. Een CSV-export bevat maximaal de duizend recentste overeenkomende activiteiten; het dashboard vermeldt expliciet hoeveel van het volledige resultaat zijn meegenomen. Elke CSV-download is daarnaast begrensd op 3 MB om betrouwbare levering mogelijk te houden. De collectie-export bevat maximaal vijfduizend producten en wordt eveneens met de echte resultaatsteller geleverd. Exports worden geregistreerd en bevatten geen auth-wachtwoorden, sessietokens of bankcredentials. CSV-cellen worden gequote en formuleprefixen, inclusief die na witruimte, worden geneutraliseerd.

### Werkblad

Interne taken/notities hebben status, prioriteit, optionele termijn en versiecontrole. Er worden geen berichten verstuurd naar de eigenaar. Actieve taken zijn begrensd op tweehonderd; afgeronde en gearchiveerde taken hebben aparte weergaven. Updates met een oude versienummer worden geweigerd. Open taken en verstreken termijnen verschijnen ook op het startscherm. De formulieren beschermen tegen het stilzwijgend verlaten van niet-opgeslagen invoer.

### Back-ups, onderhoud en toegang

Vanuit superadmin kan Kevin een reservekopie of hernieuwde meetronde aanvragen. Een private taakregistratie begrenst uitvoering op één gelijktijdige aanvraag en tien minuten tussen aanvragen. De achtergrondverwerking gebruikt de bestaande onderhoudsfuncties. Statussen onderscheiden wachtrij, uitvoering, geslaagd, gedeeltelijk, overgeslagen en fout. Een niet tijdig bevestigde uitvoering wordt zichtbaar als controlepunt en niet als succes. Alleen tijdens een actieve taak wordt de uitvoeringslijst tijdelijk ververst. Incomplete opslagmetingen worden niet als volledig beschouwd.

Een handmatig gevraagde databaseback-up gebruikt dezelfde private opslag, teruglees-/checksumcontrole en beperkte retentie als de dagelijkse taak. De normale dagelijkse scheduler blijft bestaan. De handmatige claim kan de daggrens doorbreken, maar respecteert een al lopende lease en een recente succesvolle back-up. Er is geen volledige productie-restoreknop: een dergelijke restore vereist afzonderlijke, gecontroleerde voorbereiding buiten deze interface.

De toegangspagina toont de persoonlijke aanmelding en de actieve beheerdersregistratie. Andere sessies van uitsluitend het superadminaccount kunnen via de normale Supabase-sessie-intrekking worden afgemeld; de eigenaarsessie wordt niet aangeraakt. De interface bevat directe links naar het bestaande Vercel-project, Supabase-project en GitHub-repository.

### Migratie en herstelbaarheid

`20261104190000_operator_workspace.sql` voegt private tabellen voor notities, productversies en handmatige uitvoeringen toe, plus beperkte service-role-RPC's. Alle nieuwe tabellen hebben RLS en weigeren anon/authenticated-toegang. De HTTP-routes controleren de actieve superadminidentiteit vóór elke uitlezing en de eigen origin vóór mutaties. De toegangsregistratie wordt bij elke request opnieuw geraadpleegd; lokale formuliervelden kunnen geen actoridentiteit kiezen.

Snapshots omvatten nu 24 tabellen. Eerdere complete v2-snapshots met 15, 18 of 21 tabellen blijven geaccepteerd; gedeeltelijke combinaties worden geweigerd. Productversies in een snapshot worden op itemidentiteit en versienummer gecontroleerd. Een volledige PostgreSQL-restore moet de identity-sequences opnieuw op de hoogste herstelde ID zetten, zoals reeds bij de eerdere superadminrelease beschreven. De geïsoleerde SQL-hersteltest controleert tabelinhoud zonder productie te wijzigen.


### Klikken, pakketinteresse en verbruik

‘Klikken & interesse’ toont over 7, 30 of 90 dagen de meest gebruikte benoemde acties, een tijdlijn met het registratiemoment en afzonderlijke tellers voor pakketten en verbruik. Het overzicht onderscheidt Hosting openen, het verbruiksblok zien, pakketten zien, Pro/Business aanklikken, het betaalvenster openen, bestellen aanklikken en een betaling melden aanklikken. De pakketverdeling laat de gekozen maand-/jaartermijn zien. Filters en paginering worden serverzijdig toegepast op de tijdlijn; de samenvatting blijft de volledige geselecteerde periode tonen. Een knop vernieuwt de cijfers op verzoek.

Zichtbaarheid wordt één keer per bezoek aan Hosting geregistreerd als minstens 25% van het verbruiksblok of van één pakketkaart twee onafgebroken seconden in een actief tabblad zichtbaar is. Dit bewijst geen lezen, schermtijd, conversie of betaling. De gebeurtenissen staan op ontvangsttijd van de server; de browser bundelt maximaal twintig gebeurtenissen per verzoek met korte vertraging. Dit is geen schermopname of registratie van elke willekeurige muisklik. Het instellingsscherm vermeldt de registratie. Alleen vaste actiecodes, secties en productcodes worden geaccepteerd; formulierinhoud, wachtwoorden, vrije knopteksten en URL's worden niet verzameld. De server bepaalt de actor en tijd; browservelden daarvoor worden geweigerd. Herhaalde event-ID's verhogen geen tellingen.

De registratie is privé, vereist een eigenaarsessie en dezelfde origin. Alleen de actieve superadmin kan de statistieken opvragen. Er is geen externe analyticsdienst. Tijdlijngebeurtenissen vervallen na 90 dagen, dagtotalen na één jaar. Niet-bezorgde gebeurtenissen worden niet op het toestel bewaard of eindeloos herhaald. Hierdoor kan registratie bij gesloten tabbladen, netwerkproblemen of blokkeerders ontbreken. Historische klikken van vóór installatie zijn niet reconstrueerbaar.

### Handmatig pakketten activeren

Onder Betalingen staat ‘Een pakket activeren’: kies Free, Pro of Business, een looptijd van één/ drie/ twaalf maanden of een eigen einddatum, en een reden. Een betaald pakket vereist bevestiging dat de afgesproken infrastructuur en diensten beschikbaar zijn; het instellen van apprechten koopt of upgrade de providerinfrastructuur niet automatisch. De kalenderberekening bewaart de dag waar mogelijk en begrenst op het maandeinde. Het scherm bevestigt expliciet dat dit de huidige looptijd vervangt. Een verlopen betaald recht valt terug op Free via de bestaande serverregels.

Deze handeling kent rechten toe zonder een fictieve betaling te registreren. Voor bestaande bestellingen blijft de aparte ontvangstcontrole beschikbaar. De server vergrendelt de accountregel, controleert de actuele wijzigingsdatum en registreert het pakket met actor, reden en einddatum. Een identieke retry met dezelfde aanvraag-ID is veilig; verouderde wijzigingen worden geweigerd. Producten, foto's, eenmalige objectuitbreidingen en eventuele aparte limietinstellingen blijven behouden. Een actieve afwijkende objectlimiet wordt daarom expliciet vermeld naast de activering. De eigenaar vernieuwt een open werkruimte om het nieuwe pakket op het scherm te zien. De laatste dertig handmatige toekenningen zijn zichtbaar onder het formulier.


### Werkruimte opnieuw geopend

Migratie `20261104220000_workspace_arrivals.sql` voegt een afzonderlijk `workspace_open`-event toe via de bestaande geauthenticeerde gebruiksroute. De server bepaalt actor en ontvangsttijd. Het event verschijnt zowel onder Activiteiten → Aanmeldingen & bezoeken → Eigenaar als in Klikken & interesse. De tijd wordt in Europe/Brussels weergegeven. Een echte succesvolle login blijft uitsluitend `owner_login`; openen met een bestaande sessie maakt geen fictieve login.

De client meldt één opening per geladen document zodra de aangemelde werkruimte zichtbaar is. Een nieuwe pagina of herladen pagina telt als opening. Een bestaande pagina telt opnieuw na een terugkeer uit minimaal dertig minuten achtergrond of een even lange afwezigheid via de browsergeschiedenis. Korte tabwissels, sectiewissels en React-effectreplay leveren geen extra opening op. Bij afmelden worden de lokale documentmarkeringen gewist. Er zijn geen periodieke aanwezigheidspings, inactiviteitsmetingen, IP-adressen, apparaatprofielen of extra browseropslag. De opening bewijst geen werktijd of aanwezigheid gedurende een periode. Mislukte bezorging kan ontbreken, zoals bij andere gebruiksgebeurtenissen.

Het gebruiksevent en de auditregel worden in dezelfde databasefunctie alleen bij een nieuw event-ID toegevoegd. Identieke dubbele bezorging telt daardoor eenmaal en maakt één activiteit. Openingen tellen niet mee als klikken of als meest gebruikte klikactie. De migratie wijzigt geen collectiegegevens of pakketrechten en voegt geen tabellen toe.

Controle van de openingregistratie op productie: identieke event-ID tweemaal aangeleverd binnen een teruggedraaide transactie, één gebruiksevent, één auditregel, één dagtelling, zichtbaar bij Aanmeldingen & bezoeken en geen `owner_login`. De bestaande collectie en hostingaccount zijn vóór en na de migratie vergeleken en bleven ongewijzigd. De volledige testsuite bevat 240 geslaagde tests; de productiebuild inclusief TypeScript slaagt.
