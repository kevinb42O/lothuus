# Import Inox / ijzer, Plastiek en Textiel

Datum: 27 oktober 2026. De oorspronkelijke planning is hieronder bijgewerkt naar de door de eigenaar bevestigde uitvoering.

## Beslissingen van de eigenaar

- De objectlimiet is een waarschuwing: producten toevoegen en bewerken blijft toegestaan. De pakketlimiet blijft 200 en wordt niet kunstmatig verhoogd. Geen aankoop of upgrade.
- In productmappen met meer dan acht foto's worden uitsluitend de eerste acht foto's in numerieke volgorde gebruikt. Overige bestanden worden niet geüpload of aan de fiche gekoppeld; de originele lokale levering blijft behouden.
- Nieuwe categorieën moeten volledig aansluiten op de bestaande website, Supabase, R2 en dashboard, inclusief hartjes, selectie en bestellingen.
- Productfiches starten als concept; ontbrekende prijzen en productgegevens worden niet verzonnen.

## Bron en definitieve aantallen

Bronmap: `wetransfer_inox-ijzer_2026-10-26_2014`.

| Materiaal | Websitecategorie | Productnummers | Producten | Geïmporteerde foto's |
| --- | --- | --- | ---: | ---: |
| Inox / ijzer | `inox-ijzer` | I1–I20 | 20 | 75 |
| Plastiek | `plastiek` | P1–P63 | 63 | 250 |
| Textiel | `textiel` | T1–T19 | 19 | 78 |
| **Nieuw** | | | **102** | **403** |
| **Totaal na import** | | | **297** | **1.211 bronfotoverwijzingen** |

De levering bevat oorspronkelijk 409 foto's. Plastiek `naamloze map 16` gebruikt 1–8 van 13; `naamloze map 58` gebruikt 1–8 van 9. De zes overige foto's staan alleen in de lokale levering. ``4`.jpg`` in map 31 is correct meegenomen als vierde foto. Twee foto's zijn byte-identiek tussen mappen 55 en 56; de afzonderlijke productgroepen en hun fotovolgorde zijn behouden.

De broncodes I001/P001/T001 enzovoort zijn importidentiteiten. De permanente productnummers zijn via de bestaande bedrijfslogica toegekend; UUID's zijn de interne productidentiteit. De bestaande 195 fiches en hun vijftien publicaties zijn ongewijzigd gebleven.

## Uitvoering

`scripts/import-new-collection.ts` leest een vaste batchmapping uit `scripts/lib/new-collection.ts`. De standaardmodus rapporteert alleen. `--upload` maakt een geverifieerde backup en uploadt foto's; `--apply` maakt daarna de fiches en vult de catalogus aan. De twee modi kunnen worden hervat. Een tweede volledige uitvoering is gecontroleerd en maakt geen dubbele fiches, foto's of nummers. Een bronwijziging wordt afgewezen; bestaande fichewijzigingen worden niet overschreven.

Het private manifest staat in `.data/collection-2026-10-26.json`, met de bronpaden, SHA-256, behouden/overgeslagen bestanden, media-ID's, product-UUID's en productnummers. Het wordt atomair bijgewerkt en is ook opgeslagen onder `lothuus-backups/imports/collection-2026-10-26.json`.

Foto's lopen via de bestaande `savePhoto()`-verwerking: het JPEG-origineel plus WebP-varianten met breedtes van maximaal 320, 800 en 1600 px, registratie in Supabase en boekhouding voor hosting. De nieuwe batch voegt 1.612 R2-objecten toe, samen 120.937.603 bytes.

Categorieën, standaard materiaalcategorieën, websitefilters, dashboardfilters, producteditor en checkoutvalidatie ondersteunen nu alle zes materialen. De categorieënlijst bevat iedere categorie precies eenmaal. De dashboardtekst over de aangeleverde collectie berekent aantallen dynamisch.

Nieuwe openbare bronfoto's worden via `/api/collection-images/<uuid>?size=thumb|grid|detail` uit de private R2-bucket gelezen. Alleen expliciet in de broncatalogus opgenomen media kunnen deze route gebruiken. De route volgt de actuele catalogus, archivering en geselecteerde foto's voordat een ETag/304 wordt toegestaan. Willekeurige R2-objecten en originele bestanden zijn niet via deze route bereikbaar. `/api/images` behoudt zijn bestaande eigenaars-/publicatiecontrole; privéuploads blijven privé. Raster, detailweergave en fotostrip vragen de passende variant op.

Migratie `20261027090000_collection_materials_soft_capacity.sql` maakt de bestaande capaciteitstrigger adviserend en breidt de SQL-hartjesclassificatie uit naar K/P/G/T/H/I. De productieaanpassing is via de SQL-editor op het bestaande project uitgevoerd en teruggelezen: zachte limiet actief, zes materialen herkend, pakketlimiet nog steeds 200. De bestaande migratiehistoriek is niet blind gerepareerd. De afzonderlijke trigger voor het werkelijke objectaantal blijft actief.

Het dashboard toont bij overschrijding op alle beheerschermen het werkelijke aantal, de pakketlimiet en de overschrijding: momenteel **297 van 200, 97 boven de pakketlimiet**. Product toevoegen en opslaan worden niet geblokkeerd. Hosting & capaciteit behoudt de gebruiksmeting en vermeldt dat toevoegen en bewerken toegestaan blijven.

## Controles

- 177 automatische tests geslaagd, waaronder geïsoleerde PostgreSQL-migraties, de 297/200-situatie, categorie-uniciteit, numerieke importvolgorde, achtfotolimiet, hervatten zonder ficheverlies, I/P/T-checkout en behoud van reserveringsidentiteit na publicatie.
- Foto-autoriteit getest voor openbare bronbeelden, gepubliceerde fotoselectie, archiveren, privéuploads, onbekende ID's, verboden originele formaten en ETag-hergebruik.
- TypeScript en productiebuild geslaagd.
- `scripts/verify-new-collection.ts` heeft alle 403 R2-originelen via SHA-256 met de bron vergeleken en alle 1.209 WebP-varianten volledig gedecodeerd. Alle product-, bronfoto-, media- en nummerverwijzingen zijn geldig. Alle 195 bestaande fiches zijn veld voor veld gelijk gebleven.
- Dashboard visueel gecontroleerd op desktop en op een geëmuleerd scherm van 390 × 844: waarschuwing, nieuwe foto's, openen, bewerken, bewaren en opnieuw openen boven de limiet. Deze schrijftests gebruiken een afzonderlijke lokale database zonder echte klantgegevens.
- Voor- en nasnapshot en verificatierapport staan privé in `.backups/` en in de R2-backupbucket onder `imports/collection-2026-10-26-*`. R2-checksums zijn teruggelezen. De oorspronkelijke levering is behouden.

De verificatierapporten en schermafbeeldingen bevatten uitvoeringsbewijs; een geslaagde controle is geen garantie tegen iedere toekomstige fout. Productiecontrole na uitrol is geslaagd op https://www.lothuus.be: 297 unieke catalogusproducten, aantallen 20/63/19 voor I/P/T, alle 403 nieuwe openbare foto-URL’s gecontroleerd, drie beeldformaten per materiaal steekproefsgewijs gecontroleerd en privéfoto’s/beheer-API’s afgeschermd. Vercel-deployment `dpl_7qNuqFanaG5j7qBfdTKzSzu7EpJc` is READY. De live Inox-filter toont 20 producten en 20 geladen foto’s.

## Bedieningscommando's

```sh
npm run collection:import:new
npm run collection:import:new -- --upload
npm run collection:import:new -- --apply
node --env-file=.env.local --import tsx scripts/verify-new-collection.ts
```

Deze import hoort bij deze vaste levering. Wijzig de batchmapping of bestaande broncodes niet om later een andere levering te importeren.

## Herstel

Gebruik het batchmanifest om uitsluitend deze nieuwe fiches te identificeren en zo nodig te archiveren, en neem de bijbehorende bronrecords terug uit de publieke catalogus. Herstel geen oude volledige database over nieuwe wijzigingen van de eigenares. Verwijder geen media waar fiches, broncatalogus, bestellingen of backups nog naar verwijzen.
