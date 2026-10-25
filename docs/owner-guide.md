# De LOTHUUS-werkruimte

Open `/admin` en log in met **katrien@lothuus.be** en je afgesproken wachtwoord. Je gegevens worden online bewaard: de database en account staan bij Supabase; nieuwe productfoto’s staan in private Cloudflare R2-opslag in de EU. De webhosting wordt op Vercel aangesloten; de ongewenste Cloudflare-webhosting is verwijderd.

## Je wachtwoord wijzigen

Ga naar **Instellingen → Je account → Wachtwoord wijzigen**. Vul je huidige wachtwoord in en tweemaal je nieuwe wachtwoord. Gebruik minstens twaalf tekens met een hoofdletter, kleine letter, cijfer en symbool. Na de wijziging worden andere sessies uitgelogd. Je inlogadres staat vast. Het e-mailadres onder ‘Jouw zaak’ is een contactadres voor reserveringen en wijzigt je login niet.

Wachtwoord vergeten: automatische herstelmail wordt aangesloten bij de e-mailinrichting. De eigenaar van het Supabase-project kan intussen een account herstellen. Bewaar je wachtwoord in een wachtwoordmanager.

## Een product toevoegen

Klik **Product toevoegen**. Kies het materiaal: K keramiek, P plastiek, G glas, T textiel, H hout/riet of I inox/ijzer. Bij het bewaren krijgt het product het volgende vrije nummer, bijvoorbeeld K57. Dat nummer blijft behouden na verkoop en archivering. Een materiaalcorrectie houdt het vorige nummer in de geschiedenis; het wordt niet opnieuw gebruikt.

Begin gerust met een onvolledig privéconcept. Gegevens worden automatisch bewaard. De status naast de editor vertelt of het bewaren gelukt is. Sluit de pagina pas nadat ‘Opgeslagen’ verschijnt. Bij een onderbroken verbinding blijft je invoer op deze computer beschikbaar om te herstellen. Dat is een extra vangnet; het is geen online backup.

Vul titel, beschrijving, stijl/periode, afmetingen, staat en de vaste Lothuus-prijs in. Je mag een tekst plakken en via **Tekst verdelen** laten voorstellen in welke velden de tekst thuishoort. Controleer het voorstel; de verdeler verzint geen ontbrekende informatie. Je kunt de volledige producttekst weer kopiëren.

Sleep twee tot acht foto’s naar het fotovak. Een foto mag maximaal 15 MB en 40 megapixels zijn. JPEG, PNG, WebP en AVIF worden verwerkt naar drie webformaten. Sleep de foto’s in de gewenste volgorde; de eerste wordt de hoofdfoto. Zet detailfoto’s van beschadigingen achteraan. Verwijderde foto’s kun je tijdens het bewerken terugzetten. De oorspronkelijke upload blijft bewaard in private opslag.

**Klaar** betekent dat de fiche volledig is. **Gepubliceerd** maakt het product zichtbaar op de website. Een concept en een fiche die alleen klaarstaat zijn privé. Het archief bewaart een product en zijn nummer.

## De bestaande fotocollectie

De overzet maakt privéconcepten voor de 195 aangeleverde fotogroepen. De mapreferentie, zoals K001, blijft als importreferentie bewaard; het definitieve productnummer is bijvoorbeeld K1. Voorlopige titels kun je aanpassen. Ontbrekende prijzen, afmetingen, staat en beschrijving worden niet ingevuld of geschat.

Alle 808 aangeleverde webfoto’s blijven bewaard in R2. Bij K012 (9 foto’s) en G029 (15 foto’s) staan de eerste acht op de fiche. Via **Andere foto’s uit deze fotomap** kun je die selectie aanpassen. De extra foto’s blijven ook in de oorspronkelijke fotocollectie en in het importarchief. De import kan veilig hervatten na een onderbreking.

## Verkoop en klanten

De werkruimte bewaart klanten, bestellingen, betaalafspraken en ontvangen bedragen. Een reservering houdt alle betrokken producten tegelijk vast. Een andere koper kan hetzelfde product niet tegelijk reserveren. Productnummers en verkoopgeschiedenis blijven bewaard.

Een betaling registreer je nadat je de bankrekening gecontroleerd hebt. Een gedeeltelijke betaling houdt de producten geblokkeerd. Rond een verkoop pas af na volledige betaling en overdracht. Een onbetaalde bestelling met meerdere producten kan vervallen; gedeeltelijk betaalde bestellingen blijven ter controle staan. Bij een late betaling krijg je een melding.

E-mails staan voorlopig als voorbeelden in de uitbox en worden **nog niet verstuurd**. Publieke reserveringsaanvragen staan uit tijdens de inrichting. Schakel ze pas in wanneer de e-maildienst, contact- en bankgegevens en toepasselijke voorwaarden/privacyinformatie klaar zijn.

## Bewaren en herstellen

Je kunt in **Instellingen** een leesbare gegevensexport downloaden. Die bevat geen fotobestanden, wachtwoord of inlogtokens.

Bestaande databasebackups blijven in de private R2-backupbucket bewaard. De dagelijkse backupplanning is met de Cloudflare-webhosting gestopt en moet op Vercel opnieuw worden aangesloten. De foto’s blijven apart in de R2-mediabucket staan. De technische status en herstelprocedure staan in `docs/production.md`.

De uiteindelijke domeinkoppeling met Vercel volgt zodra lothuus.be geregistreerd is. Er wordt geen tijdelijk Cloudflare-adres gebruikt.

## Hartjes en populaire objecten

Open **Verkoop → Hartjes** voor de belangstelling per object en de evolutie over 7, 30 of 90 dagen, of sinds de meetstart. Zoek op nummer of titel, filter op categorie en voorraad en open een object voor zijn grafiek en webreserveringen. De grafiek heeft ook een uitklapbare cijfertabel. Cijfers verversen automatisch zolang het tabblad openstaat; je kunt ook Vernieuwen kiezen.

Toevoegen, handmatig verwijderen en opruimen na reservering worden apart geteld. Een bestaande selectie is een beginstand. “Recent bewaard” toont laatst bekende selecties van browsers die binnen 90 dagen synchroniseerden, ongeacht de periodefilter. Dit zijn geen unieke personen en geen koopbeloftes. Reserveringen staan er als aanvullende context, zonder koppeling tussen bezoekers en klanten.

Hartjes tellen automatisch mee; er staat geen meetcheckbox of privacyuitleg in de selectie. De footer linkt naar **Algemene voorwaarden** en **Privacy**, elk op een eigen pagina. In het beheer kun je de hele meting pauzeren; eerdere cijfers blijven zichtbaar. Browserregistraties vervallen na 90 dagen zonder synchronisatie en dagtotalen na maximaal 24 maanden. Bij een storing blijven laatst geladen cijfers zichtbaar; de foutmelding is geen nulmeting. De meting heeft geen gegevens van vóór haar invoering.

## Bezoekers

Open **Bezoekers** in de beheernavigatie om het websitebezoek te volgen. Kies een periode bovenaan; de grafiek en apparatenverdeling tonen steeds dezelfde periode. Met **Vernieuwen** haal je nieuwe cijfers op. Tijdens het ophalen blijven reeds geladen cijfers zichtbaar.

Beweeg over de grafiek of tik op een punt voor het aantal bezoeken. Met het toetsenbord gebruik je links/rechts en Home/End. Onder de grafiek kun je de cijfers per dag of uur uitklappen. Bij lange perioden heeft de dagtabel meerdere pagina’s.

De registratie gebruikt geen cookies of blijvende browseropslag. De cijfers zijn beschikbaar vanaf de meetstart.
