# Plan: een vaste productgrid met een vloeiende hoverpreview

Status: vervangen door de nieuwe richting: de foto vergroot binnen de grid en alle omliggende producten herschikken gelijktijdig. De eerdere vaste grid met overlay hieronder is historische context; DESIGN.md beschrijft het actuele gedrag.
Beslissing van de gebruiker: de huidige verschuivende grid vervangen door vergroten boven de andere producten. De grid blijft op zijn plaats.

## Gewenste ervaring

De foto's vormen een rustige, vaste verzameling. Bij bewust aanwijzen groeit één product vanuit zijn eigen tegel boven de verzameling uit. De omringende tegels, hun volgorde, de sectiehoogte en de scrollpositie blijven onveranderd. Klikken opent het bestaande productdetail. Het effect moet direct en beheerst aanvoelen, ook bij snel bewegen of onderbreken.

## 1. Vaste basis

- Vervang de absolute tegelplaatsing en de asynchrone reeks evacueren/groeien/comprimeren door een responsieve CSS-grid.
- Geen packing, verschuivende rijen, gereserveerde lege cellen of veranderende gridhoogte bij hover.
- Behoud alle 195 producten, drie materiaalfilters, fotogalerijen, selectie en detailvensters.
- Begin visueel met 8 kolommen op brede desktop, 6 op kleinere desktop, 4 op tablet en 3 op telefoon; beoordeel de echte foto's op 1440, 1024, 768 en 390 px voordat de aantallen definitief worden.
- Fotografie blijft volledig zichtbaar, met behoud van verhouding en natuurlijke kleur. Geen wisselende uitsnede tijdens vergroten.

## 2. Eén preview boven de grid

- Gebruik één actieve previewlaag, los van de documentflow. Laat het oorspronkelijke tegelvak bezet en geometrisch stabiel.
- De preview begint exact op de bronfoto en groeit naar een begrensde leesbare maat: uitgangspunt 320–380 px breed op desktop, aangepast aan beschikbare ruimte.
- Positioneer rond de bron; stuur bij aan linker-, rechter-, boven- en onderrand zodat foto en onderschrift in de viewport blijven.
- Geen donkere achtergrond over de pagina. Alleen een subtiele zachte schaduw voor scheiding waar foto's overlappen.
- Toon een compact onderschrift met titel, categorie en eventueel een bestaande prijs/status. Geen verzonnen productgegevens.
- Houd de preview stabiel zolang de aanwijzer erboven is. Het vergroten mag zelf geen nieuw hoverdoel activeren. De preview is aanklikbaar en opent hetzelfde product.
- Test expliciet de afweging tussen de grotere klikzone en toegang tot bedekte buurtegels; na verlaten van de preview worden die direct weer bereikbaar.

## 3. Bewegingsgedrag

- Uitgangspunt: 100–140 ms aanwijstijd voordat de preview opent; snelle passages over tegels openen niets.
- Richtwaarde voor vergroten: 220–280 ms; sluiten: 160–200 ms. Geen zichtbare overshoot of natrillen.
- Foto en onderschrift vormen één beweging. Geen extra draai, parallax, cursorvolger of hoverfoto-wissel in deze eerste versie.
- Een kleine verlaatmarge van circa 80–120 ms vangt onbedoeld verlaten op, zonder een oude preview te laten hangen.
- Animaties zijn onmiddellijk onderbreekbaar vanaf de actuele zichtbare positie. Geen wachtrij van eerdere hoverintenties.
- Bij scrollen sluit de preview; de pagina blijft normaal scrollen. Filteren, resizen en openen van een detailvenster ruimen de preview en timers op.
- Reduceer beweging met prefers-reduced-motion tot een directe toestand of korte fade.
- Exacte tijden zijn afstelwaarden; de browsercontrole met de echte collectie bepaalt de uiteindelijke combinatie.

## 4. Telefoon en toetsenbord

- Activeer hover uitsluitend voor apparaten met een nauwkeurige aanwijzer en echte hoverondersteuning, ook op hybride apparaten.
- Telefoon: één tik opent direct het productdetail. Geen eerste tik om de grid te vergroten en daarna nog een tweede tik.
- Touchscrollen activeert nooit een preview.
- Behoud zichtbare toetsenbordfocus en pijltoetsnavigatie. Enter opent het detail; Escape sluit een preview. Focus blijft op het oorspronkelijke product, zonder dubbele focusbare kopieën in de preview.
- Een preview verschijnt pas nadat de betreffende foto klaarstaat; reserveer dezelfde beeldverhouding zodat laden geen sprong veroorzaakt.

## 5. Afwerking van de catalogus

- Stem tegelgrootte, tussenruimte en onderschrift af op de aangeleverde foto's, inclusief verpakkingen en serviezen.
- Behoud de LOTHUUS-identiteit, het logo, de huissectie en de bestaande kleurwereld.
- Pas uitlegteksten aan: op desktop aanwijzen om te bekijken, op telefoon tikken voor details.
- Houd filters in deze wijziging functioneel gelijk. Een uitklapbaar zoekpaneel, uitgebreidere productmetadata en reserveringsaanpassingen zijn afzonderlijke werkzaamheden.

## Technische ingreep

Primair: src/components/mosaic.tsx en de bijbehorende regels in src/app/globals.css. Werk instructieteksten in src/components/lothuus.tsx bij. Haal de packing-afhankelijkheid uit de grid en verwijder onbereikbare packingcode/tests als die daarna nergens meer gebruikt worden. Documenteer het uiteindelijke gedrag in DESIGN.md en de home-surfacebrief; de nieuwe gebruikersbeslissing vervangt de eerdere eis dat vergrote objecten ruimte in de grid reserveren.

## Uitvoering en bewijs

1. Bouw eerst de vaste grid en direct openen op touch.
2. Voeg de enkele previewlaag met randbegrenzing toe.
3. Regel hoverintentie, onderbreken, sluiten en toetsenbordbediening.
4. Stel formaat, ritme en beweging af met de echte foto's.
5. Controleer desktop, tablet, telefoon, reduced motion en beeldladen; leg de uiteindelijke weergave vast.

Acceptatie:

- Tijdens hover blijven posities van alle andere tegels, totale gridhoogte en scrollpositie exact gelijk.
- Snel langs tien producten bewegen veroorzaakt geen achterlopende reeks animaties of heropening van oude producten.
- Preview flikkert niet bij bron/previewgrenzen en verdwijnt niet onder de aanwijzer door zijn eigen vergroting.
- Eerste/laatste rij en beide buitenste kolommen blijven binnen de zichtbare viewport.
- Geen lege afbeelding of zichtbare resolutiesprong tijdens groei.
- Alle materiaalfilters en productfoto's blijven correct werken.
- Eén tik op telefoon opent het juiste detail; scrollen opent niets.
- Toetsenbordbediening, focusherstel en reduced motion werken.
- Typecheck, productiebuild en relevante bestaande tests slagen; gerichte tests dekken hoverannulering en randpositionering als die in eigen logica worden geïmplementeerd.
