# LOTHUUS /admin — productinvoer

Mode: Operate. De eigenares bouwt haar collectie op in eigen tempo. Het scherm helpt haar producten starten, hervatten en afronden. Dit is de visuele uitbreiding voor het beheer; de publieke website behoudt haar eigen vormgeving.

## Visuele richting

Een lichte, rustige werkruimte met Manrope, donkergrijze tekst, zachte groene accenten en echte objectfoto's. Het bestaande zware LO / lichte THUUS blijft herkenbaar. Geen bruine interfacevlakken. Gebruik het accent voor acties, selectie en bewaarbevestiging. De objecten dragen het beeld; geen decoratieve grafieken of animaties.

Basistokens in `workspace.css`: papier #fafbf8, inkt #282f29, muted #657064, lijn #e1e5dc, actie #354c39, zachte laag #eef2e9. Secundaire tekst op groene vlakken gebruikt een donkerdere toon (#5b6c4e). Velden en knoppen hebben 6 px hoeken, productbeelden 4–7 px en brede vlakken maximaal 10 px. Deze beheerkeuzes wijken bewust af van de vierkante publieke archieflay-out.

## Werkstroom

- Overzicht met nieuwe invoer en recent bewerkte producten. De aangeleverde fotocatalogus blijft expliciet gescheiden van bewerkbare voorraad.
- Productoverzicht met statusfilters, materiaalfilter, zoeken, sorteren, raster/lijst en CSV-export van de getoonde producten.
- Eén editor met materiaal, foto's, verhaal en details. Concepten mogen onvolledig zijn. Nummering en bewaren gebeuren op de server.
- De tekstassistent staat naast de echte velden; voorstellen worden eerst gecontroleerd. Bestaande inhoud wordt alleen na aanvinken vervangen; terugdraaien blijft mogelijk.
- Foto's zijn te slepen, ook via een pointer-handle op touch. Volgordeknoppen blijven aanwezig. Verwijderen is herstelbaar en foutieve uploads krijgen een eigen retry.
- De preview toont opgeslagen foto's en actuele veldinhoud. De checklist verplaatst de focus naar ontbrekende onderdelen. Klaar zetten publiceert niets.

## Responsief en toegankelijk

Desktop: vaste navigatie links, inhoud daarnaast; een sticky preview tijdens de invoer. Onder 950 px volgt de preview op het formulier. Onder 700 px wordt de navigatie horizontaal, staan de velden onder elkaar en blijven de opslagacties onderaan bereikbaar. Foto's gebruiken twee kolommen op telefoon. Status wordt steeds met tekst aangeduid, niet alleen met kleur.

Expliciete labels, toetsenbordfocus, skiplink, herstelmeldingen en een reduced-motionvariant zijn aanwezig. Voor de mobiele browsercontrole is 390 × 844 gebruikt; voor desktop de bestaande browsergrootte. Preview en hoofdbeelden tonen verschillende uitsnedes: de productpreview bewaart de volledige foto, de overzichtstegels gebruiken een uitsnede.

## Implementatiegrens

De frontend werkt met de lokale API en echte conceptopslag. Nummering, aanmaakherhalingen, versieconflicten en gereedheidscontrole zijn aangesloten. Foto's worden nu nog lokaal verwerkt. R2, online login/hosting en de migratie van de aangeleverde collectie volgen afzonderlijk. De interface doet geen uitspraak dat die aansluiting al bestaat.
