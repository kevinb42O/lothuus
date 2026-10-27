# Plan: foto's klaar vóór ze in beeld komen

Datum: 27 oktober 2026. Status: kernoplossing geïmplementeerd; fysieke iPhone-validatie staat nog open.

## Gewenste ervaring

De collectie voelt als een doorlopende fotowand. Bij gewoon scrollen staan nieuwe foto's al klaar wanneer ze in beeld komen. Even terugscrollen toont dezelfde foto's zonder opnieuw opbouwen. Een snelle veeg houdt de pagina responsief. De mobiele grid blijft stabiel op de iPhone waarop eerdere versies herlaadden.

Dit verandert de laadstrategie, niet de vormgeving, productvolgorde of bestaande desktopinteracties. iOS behoudt de gewone CSS-grid. De entree, selectie, details, toetsenbordbediening en reduced motion blijven werken.

## Vastgestelde oorzaak

- `src/components/use-visible-mosaic-photos.ts` gebruikt één `IntersectionObserver` met `rootMargin: '240px 0px'`. Diezelfde grens beslist zowel wanneer een afbeelding wordt gemonteerd als wanneer ze wordt verwijderd.
- Beide grids renderen buiten die verzameling geen afbeelding. `loading="eager"` in `mosaic.tsx` en `native-mosaic.tsx` kan pas iets doen nadat de afbeelding bestaat. De kleine buffer geeft bij snel scrollen weinig tijd voor ophalen, decoderen en schilderen.
- Verwijderen vlak achter de viewport maakt terugscrollen gevoelig voor opnieuw monteren en decoderen. De browser mag gedecodeerde beelden bovendien zelf vrijgeven; een eerder geladen URL garandeert geen direct schilderbaar beeld.
- API-bronnen gebruiken `unoptimized` en de vaste `size=grid`-variant. Voor nieuwe uploads is die 800 pixels breed. `sizes` maakt die API-bestanden niet kleiner. De aanwezige 320px-thumb en 1600px-detail bieden aanknopingspunten, maar de werkelijke formaten van geïmporteerde foto's moeten apart worden gecontroleerd.
- Beide API-imageroutes gebruiken `private, no-cache` met ETag. Cachehergebruik kan dus een nieuwe validatie vereisen. Dat is bewust gekoppeld aan publicatie/toegang en wordt in deze verbetering behouden.
- De 240px-grens is historisch ingevoerd na iPhone-herlaadproblemen. Alle foto's blijvend monteren zou die begrenzing ongedaan maken. De projectnotities melden dat de native iOS-grid de crash oploste; dit plan vereist opnieuw controle op het echte toestel.

Dit is een diagnose op basis van de broncode en de gemelde ervaring. Er is nog geen netwerkwaterval, decodeprofiel of geheugenmeting van deze sessie; de relatieve kosten moeten tijdens uitvoering worden gemeten.

## 1. Eerst een eenvoudige, ruimere laadzone

Vervang de ene 240px-grens door twee zones met hysterese:

1. **Voorladen:** monteer afbeeldingen ongeveer één viewport vóór ze zichtbaar worden. Begin met een symmetrische zone; zo werkt ook een onmiddellijke omkering goed.
2. **Behouden:** verwijder een eenmaal gemonteerde afbeelding pas buiten een ruimere zone, als startwaarde twee viewports boven/onder. Een afbeelding buiten de laadzone maar binnen de behoudzone blijft bestaan.

De zichtbare viewport krijgt altijd voorrang. Verwerk de noodzakelijke setwijzigingen gebundeld en werk uitsluitend bij als de set daadwerkelijk verandert. Laat de browser de gemonteerde beelden laden; introduceer in deze eerste stap geen tweede verzameling verborgen preload-afbeeldingen.

De afstanden zijn afstelwaarden, geen gegarandeerd veilige geheugenbudgetten. Meet aantallen én de geschatte gedecodeerde pixels. Kies de mobiele bovengrens uit de fysieke iPhone-test; onzichtbare, verst verwijderde beelden verdwijnen als eerste. Zichtbare en actief gebruikte foto's blijven staan. Bij een heel groot viewport wordt de zichtbare inhoud nooit opgeofferd om een numerieke limiet te halen.

## 2. Passende bron per gebruik

- Kies voor gewone tegels de kleinste bestaande variant die de weergegeven breedte × een begrensde device-pixelratio dekt. Controleer ook hoogte en extreme beeldverhoudingen; alleen breedte begrenzen kan bij portretten veel geheugen kosten.
- API-foto's krijgen expliciete bronkeuze of een `srcset` met bestaande varianten. Statische foto's blijven hun bestaande Next.js-bronselectie gebruiken. Eén bronresolver levert dezelfde keuze aan grid, hovervoorbereiding en filtervoorbereiding.
- 320px mag alleen worden gebruikt waar dat voldoende scherp is. Voeg pas een tussenformaat toe als metingen aantonen dat de stap naar 800px te duur is; zo voorkomen we een onnodige herverwerking van de collectie.
- Bij desktopvergroting blijft het bestaande beeld zichtbaar terwijl de scherpere bron wordt voorbereid. Schakel pas na succesvolle decode om. Detailfoto's op 1600px laden voor het detailgebruik.
- Laat hoge fetchprioriteit beperkt tot de werkelijk kritieke foto's. Geen `preload` voor de hele collectie. Volg de lokale Next.js 16-documentatie; `priority` is verouderd.

## 3. De entree en filters gebruiken dezelfde voorbereiding

- Tijdens de geprojecteerde huisentree blijven de huidige acht bronrijen stabiel voor de atlas. De scrollbuffer mag tijdens die fase geen extra collectiebeelden gaan laden op basis van de getransformeerde schermposities.
- Bij aankomst blijven de al geladen, nabijgelegen foto's behouden. Activeer de gewone laad- en behoudzone zonder de eerste zichtbare rijen tussentijds leeg te maken. Behoud de bestaande vrijgave van scène en atlas.
- Filters gebruiken dezelfde bronkeuze als de uiteindelijke tegels, zodat voorbereiding geen andere variant ophaalt dan de grid daarna toont.
- Desktop behoudt zijn bestaande decode vóór de overgang. Geef voorbereiding een begrensde wachttijd en behandel fouten, zodat een mislukte foto de filter nooit eindeloos blokkeert.
- iOS behoudt zijn directe filterwissel. De eerste zichtbare nieuwe foto's krijgen prioriteit; geen zware snapshot- of animatielaag toevoegen. Achtergrondvoorbereiding van andere categorieën komt alleen in aanmerking na meting en binnen het beeldbudget.
- Bij snel wisselen maken oude voorbereidingen geen verouderde toestand zichtbaar. Deel lopende voorbereiding van dezelfde bron waar nodig; pretendeer niet dat een los `Image`-verzoek gegarandeerd annuleerbaar is.

## 4. Alleen bij bewezen nood: verder vooruitkijken

Als de vaste zones bij snelle veegbewegingen nog te laat zijn, maak de vooruitzone afhankelijk van richting, snelheid en gemeten laadtijd, met een harde afstands- en beeldlimiet. Behoud een basisbuffer in de andere richting. Gebruik één lichtgewicht, gebundelde scrollmeting; meet niet alle tegelrechthoeken op ieder frame.

Bij beperkte verbinding of databesparing krijgt zichtbare inhoud voorrang en blijft speculatief laden kleiner. Gebruik netwerk- en geheugenhints alleen als optionele signalen; ontbrekende browserondersteuning krijgt veilige standaardwaarden. Pauzeer speculatief werk in verborgen tabs.

Deze stap volgt uitsluitend als de eenvoudige oplossing het acceptatiecriterium niet haalt. De extra regeltechniek moet aantoonbaar iets oplossen.

## Uitvoeringsvolgorde en controle

1. Leg op een productiebuild het huidige gedrag vast: koude/warme cache, gewone scroll, snelle veeg en direct terug. Meet verzoekstart ten opzichte van viewportintrede, decodevertraging, lege tegels, aantal gemonteerde foto's en geheugenverloop waar beschikbaar.
2. Bouw de gedeelde laad-/behoudzones in de bestaande hook en sluit beide grids erop aan. Controleer met de huidige bronnen of de zichtbare laadgaten verdwijnen.
3. Centraliseer bronkeuze en pas tegel-, hover- en filtervoorbereiding samen aan. Vergelijk bytes, gedecodeerde pixels en scherpte met de uitgangssituatie.
4. Controleer entree-aankomst, skip, categorieën, resize, detail sluiten en toetsenbord Home/End. Behoud stabiele geometrie en focus, ook als een foto faalt.
5. Test op desktop, Android en fysiek iPhone 13 mini: tien keer omlaag/omhoog door de collectie en voorbij de footer, inclusief filters en details. Browseremulatie geldt niet als bewijs tegen de eerdere iPhone-crash.
6. Voeg gerichte tests toe voor de twee zonegrenzen, behoud/evictie, bronkeuze en verouderde filtervoorbereiding. Draai typecheck, relevante bestaande tests en productiebuild. Werk na implementatie de actuele ontwerpafspraken bij; laat historische plannen met hun status staan.

## Acceptatie

- Op de vastgelegde gewone scrollroute in de productiebuild zijn foto's bij viewportintrede al geschilderd zodra de eerste schermvulling gereed is, zowel omlaag als direct terug. Leg netwerkprofiel en scrollsnelheid bij die route vast voor een reproduceerbare vergelijking.
- Bij een snelle veeg blijft input responsief, krijgen de nieuw zichtbare foto's prioriteit en blijft er geen wachtrij met achterhaalde foto's voorrang houden.
- Tien volledige scrollrondes laten een begrensd aantal gemonteerde beelden zien, zonder blijvend oplopende bewaarde beeldreferenties. Controleer waar mogelijk ook het procesgeheugen; DOM-aantallen alleen bewijzen geen veilig geheugengebruik.
- De fysieke iPhone herlaadt of crasht niet tijdens deze controle. Zonder toesteltest blijft dit expliciet onbevestigd.
- Geen lege eerste rijen bij entree-aankomst en geen extra layoutsprongen door beeldladen. Filters kunnen herstellen van fouten; focus, selectie en details blijven werken.
- Bij een koude cache en een plotselinge sprong naar een verre rij kan wachttijd onvermijdelijk zijn. Een rustige bestaande tegelachtergrond blijft dan de fallback; geen kunstmatige fade, shimmer of blur als vervanging voor tijdig laden.

## Primaire bestanden

`src/components/use-visible-mosaic-photos.ts`, `src/components/mosaic.tsx`, `src/components/native-mosaic.tsx`, `src/lib/collection.ts` en gerichte tests voor de nieuwe laadlogica. Bronformaatgeneratie en mediaroutes alleen uitbreiden als de formaatmeting daar aanleiding toe geeft. De bestaande toegangscontrole en cachevalidatie blijven intact.


## Uitvoeringsresultaat

- Gedeelde laadzone van één viewport en behoudzone van twee viewports, met halve voorlaadafstand bij databesparing. Twee observers bundelen grenswijzigingen; geen scrollhandler die iedere frame alle tegels meet.
- Speculatieve beelden krijgen initiële grenzen van 80/160 foto's en 16/48 Mi gedecodeerde pixels voor compact/desktop. Zichtbare, vergrote en gefocuste foto's blijven beschermd. Werkelijk gemeten afbeeldingsafmetingen vervangen de schatting zodra de bron is geladen. De schatting blijft na vrijgave bekend, zodat zware beelden niet telkens opnieuw worden gemonteerd.
- Eén bronresolver voor tegel-, hover- en filtervoorbereiding, met bestaande 320/800px-API-varianten. Geen nieuwe mediaformaten of veranderingen aan publicatie/toegang. Scherpere bronnen vervangen het bestaande beeld pas na decode; achterhaalde voorbereidingen kunnen niet alsnog omschakelen.
- De eerste acht rijen blijven tijdens de entree stabiel. Nabijgelegen afbeeldingselementen blijven bestaan bij aankomst. Filtervoorbereiding heeft een deadline van 2,5 seconden en afzonderlijke decodevoorbereiding van 8 seconden.
- Gerichte tests dekken zonegrenzen, budgetvoorrang, tien gesimuleerde scrollrondes, observerbundeling/cleanup, behoud bij aankomst, bronkeuze, hangende voorbereidingen en het verwerpen van achterhaalde bronwissels.
- Browsercontrole op de ontwikkelversie bij 1280 × 720: eerste schermvulling 72 gemonteerde foto's tegenover 48 in de oude versie; op scrollpositie 2160 waren alle 40 zichtbare foto's geladen, geen afbeeldingselement ontbrak en de eerste rij was vrijgegeven. De glasfilter toonde na de overgang 24 van 24 zichtbare foto's geladen, met 42 van 51 foto's gemonteerd.
- Enkele bestaande lokale API-foto's zijn ook vóór de wijziging onbeschikbaar; dat is geen betrouwbare laadprestatiemeting voor die bronnen. De werkende statische collectie is visueel en op aanwezigheid gecontroleerd.
- Deze browsercontrole is geen complete netwerk-/frameprofilering of fysieke iPhone-test. De adaptieve snelheidsbuffer is niet toegevoegd: daarvoor is nog geen aangetoonde noodzaak. Een fysieke iPhone 13 mini, koude/vertraagde verbinding en volledige scrollrondes op het toestel blijven de aanvullende validatie.


Validatie: volledige bestaande en nieuwe suite op dat moment 197/197 geslaagd; de daarna toegevoegde decode-/annuleringstest slaagde afzonderlijk. Typecheck en volledige productiebuild zijn geslaagd. De mechanische UI-controle meldt geen bevindingen en `git diff --check` is schoon.


Productiecontrole op `127.0.0.1:3002` bij 1059 × 804: glasfilter toont 12/12 zichtbare foto's gereed; één scherm omlaag 16/16 gereed en de eerste rij behouden; direct terug 12/12 gereed, met 36 van 51 foto's gemonteerd. Screenshot: `artifacts/grid-loading/production-grid.png`. De lokale productiepreview is gestart met de geïsoleerde `.next-grid-review`-build.
