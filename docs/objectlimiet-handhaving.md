# Objectlimiet — 4 november 2026

Nieuwe producten worden geweigerd zodra de actuele pakketlimiet bereikt is. De bestaande collectie wordt niet verwijderd, verborgen of opnieuw opgeslagen door deze wijziging. Bestaande fiches, foto's en verkoopbeheer blijven bewerkbaar.

Alle ingangen voor een nieuw product, inclusief ‘Opslaan en volgend product’, controleren `/api/admin/hosting` vóór de editor opent. Bij onvoldoende capaciteit verschijnt ‘Je pakketlimiet is bereikt’, met de actuele aantallen en een actie naar de bestaande pakketten. Een mislukte capaciteitscontrole laat de huidige pagina staan.

`withStore` controleert bij groei het actuele recht via de hosting-RPC. Dit gebeurt opnieuw na elke mislukte revisievergelijking: twee gelijktijdige toevoegingen kunnen niet allebei de laatste plaats gebruiken. Bij weigering volgt HTTP 409 met een duidelijke pakketmelding. De producteditor houdt invoer, fotoverwijzingen en zijn bestaande browserherstelkopie vast. Deze browserkopie is geen serveropslag; onafgeronde uploads en browseropslagbeperkingen houden hun bestaande waarschuwingen.

De lokale SQLite-adapter handhaaft Free 200 onder zijn transactieslot. Productielimieten volgen het actieve pakket, vervaldatum en toegekende uitbreidingen via het bestaande hostingrapport.

## Extra databasecontrole

`supabase/migrations/20261104120000_enforce_object_capacity.sql` herstelt aanvullend de atomaire databasetrigger: Free 200, Pro 1000, Business 5000, plus toegekende uitbreidingen. Hij weigert uitsluitend toename boven de limiet en verandert geen bestaande productrecords. De migratie is lokaal met de volledige migratiereeks getest en opnieuw uitvoerbaar.

De migratie is op 4 november 2026 uitgevoerd via de SQL-editor van LOTHUUS productie (`gzrxxdmhonzcfkomowpo`) nadat de juiste beheersessie beschikbaar was. De bestaande trigger is ingeschakeld en gebruikt de herstelde functie. Ook toevoegingen buiten de applicatie vallen daarmee onder de databasecontrole. De SQL-editor werkt de CLI-migratiehistoriek niet automatisch bij; push niet blind de historische migraties.

## Validatie

Volledige testsuite (213 tests), productiebuild en typecheck slagen. Een aanvullend geïsoleerd transporttest controleert een concurrerende toevoeging: de eerste commit mist zijn revisie, de tweede uitlezing ziet de volle collectie en verstuurt geen tweede commit. Componenttests controleren blokkade op 200/304, toegang op 199, mislukte capaciteitsuitlezing en herstel van een al geopend nieuw formulier na HTTP 409. SQL-tests controleren uitbreidingen, verlopen rechten, behoud van bestaande collecties boven de limiet en herhaalde installatie.

## Live-uitrol en behoudcontrole

Vercel-deployment `dpl_Boqjm39CD6nUXYYBQgJzAgsYwcdn` is READY en gekoppeld aan `https://www.lothuus.be`. De live eigenaarssessie toont de modal met 304/200 na Product toevoegen; sluiten herstelt de focus op de toevoegknop en Bekijk de pakketten opent Hosting & capaciteit. De modal is op desktop en telefoonformaat bekeken.

Een alleen-lezen vergelijking vóór en na de uitrol geeft exact dezelfde productcollectie: 304 records, revisie 2854 en SHA-256 `54eadeff210259e9b92bd950b587708dabb1a005b65e1d316ba44e1c1b0f228b`. Er zijn geen productieproducten, betalingen of testbestellingen aangemaakt. Het aanvullende concurrentietest slaagt, evenals de nieuwe typecheck. De extra SQL-migratie is vervolgens op productie uitgevoerd en onafhankelijk gecontroleerd via een tijdelijke tabel met een kopie van de collectie. Een update zonder groei slaagt; een extra object geeft exact `HOSTING_OBJECT_LIMIT`. De tijdelijke tabel verdwijnt bij de commit. De controle bevestigt 304 objecten, actieve limiethandhaving, ingeschakelde trigger en geweigerde anonieme uitvoering. De echte productiecollectie is hiervoor niet gewijzigd.
