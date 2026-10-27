# Cinematische intro — productieplan

Datum: 27 oktober 2026. Status: uitvoering van de filmrichting; zie `intro-video.md` voor de actuele pipeline en `public/house/video/sources.json` voor de uiteindelijke export.

Uitvoeringskeuze: de afzonderlijke Three.js-filmrenderer uit het alternatief hieronder is gebruikt om de bestaande maatwerkgevel, ramen en exacte transparante deurdoorgang te behouden. De productie gebruikt hoogwaardige raster-PBR, HDR-licht, GTAO, supersampling en schaduwkaarten. Het is geen Cycles/path-tracing-render. De hieronder beschreven Cycles-instellingen blijven onderzoeksopties, geen claims over deze export.

## Opdracht en visuele richting

Maak van de bestaande entree een veel rijkere architectuurfilm: hetzelfde echte LOTHUUS-huis, herkenbare Manrope-letters met zwaar LO en licht THUUS, door de O naar de opening van de echte deur en vervolgens naar de bestaande live collectie. De bezoeker speelt alleen video af; de productierender hoeft niet binnen een realtime framebudget te passen.

De letters worden nadrukkelijk zichtbare ruimtelijke objecten. De eerdere terughoudendheid over nauwelijks zichtbare extrusie is door de nieuwe vraag achterhaald. Kies een warmwitte, satijnen lak met duidelijk leesbare zijvlakken en afgeronde lichtvangende randen. Houd het huis en de witte letters herkenbaar, met rijk natuurlijk daglicht, heldere materiaalverschillen en rustige maar voelbare beweging in de beplanting.

## Vastgesteld in de huidige broncode

- De film is 14 seconden bij 60 fps, afzonderlijk opgenomen op 1440 × 900 en 540 × 1170. Capture gebruikt pixelratio 1.
- `HouseVideoRender` gebruikt de normale hero-scène. De kwaliteitskeuze is gekoppeld aan viewportbreedte en pointertype, ook tijdens capture. De portrait-export kan daardoor lagere model- en texturekwaliteit gebruiken.
- De letters zijn al geëxtrudeerde geometrie: diepte 100 in fontunits, curveSegments 16 en twee bevelsegmenten. Ze staan in een aparte belichte laag, werpen en ontvangen geen schaduw, en hebben een zeer ruw materiaal. Hun eigen rendertarget heeft geen MSAA. Dit zijn concrete verbeterpunten; zonder vergelijking van bronframes en afspeelvideo is de zichtbare karteling niet definitief aan één oorzaak toe te wijzen.
- De hero schakelt de extra GTAO-pass uit. De film profiteert dus nog niet van een aparte hoogwaardige occlusiebehandeling.
- Wind bestaat in de plantenshaders, maar staat bij de opname uit. De normale windschaduwen worden bovendien op een lager tempo bijgewerkt.
- De export geeft `progress * 14000` aan de renderklok door, terwijl progress zelf al door de camerachoreografie vervormd is. Dat zou wind onbedoeld aan de camerasnelheid koppelen.
- Positie, yaw en pitch worden uit verschillende easingsegmenten opgebouwd. De timingcurve deelt snelheid tussen knooppunten, maar garandeert geen doorlopende versnelling van de uiteindelijke positie en kijkrichting. Het precieze aandeel in de ervaren schokkerigheid moet in bewegende beelden worden vastgesteld.
- De WebM-encoder gebruikt CRF 32 en begrensde bitrates. Een verbeterde bronrender moet ook na de uiteindelijke compressie worden beoordeeld.

## Productieroute

Voorkeursroute: exporteer het bestaande huis naar een afzonderlijk Blender/Cycles-filmproject en reconstrueer de materialen, belichting en animatie die nu in specifieke Three.js-shaders zitten. Dit is een bewuste productiestap; een GLB-export neemt de windshader, vensterillusies, focuscompositie en doorgangsmaskers niet vanzelf correct mee.

Bewaar een reproduceerbare export van geometrie, instance-transformaties, deurpivot, fontcontouren, textures, camera en schaal. Gebruik voor desktop én portrait de beste beschikbare bronassets. Er komt geen nieuw verzonnen huis en geen AI-videomorphing van gevel, letters of deur.

Begin met een technische proef: vijf representatieve beelden en een korte bewegende uitsnede. Verifieer materiaaloverdracht, glas, het O-gat, deurdekking en de transparante collectie-opening. Meet rendertijd en geheugen op de beschikbare machine vóór een volledige render. De aanwezigheid en geschiktheid van Blender/GPU-rendering zijn nog niet vastgesteld.

Een eventuele Three.js-productierender is een expliciet alternatief als de overdracht onvoldoende betrouwbaar blijkt. Die vraagt een afzonderlijk filmprofiel, supersampling, meerdere tijdsamples en hoogwaardige schaduw/reflectiebehandeling; alleen kwaliteitswaarden verhogen van de bestaande webpreset is onvoldoende voor deze opdracht.

## 1. Letters als hoofdonderwerp

- Behoud de exacte merkcontouren, spatiëring en zwaar/licht-verhouding. Verhoog de contourresolutie tot ronde vormen ook dichtbij rond blijven.
- Vergelijk in drie representatieve camerahoeken twee echte dieptes en een fijnere bevel. Selecteer op leesbaarheid van voorvlak, zijkant, binnenwand van de O en randlicht. Geen willekeurige diepte in fontunits vastleggen zonder de wereldschaal te beoordelen.
- Gebruik fysiek belichte satijnwitte oppervlakken, subtiele materiaalruwheid en zachte zelfschaduw. De zijvlakken ontlenen hun toon aan het licht en de omgeving.
- Maak de diepte vroeg zichtbaar door cameracompositie en lichtinval. Houd de fysieke doorgang door de O vrij, ook na extrusie en bevel. Geen logo dat zich tijdens de passage verplaatst om de camera te ontwijken.
- Behoud het scherpe huis tijdens de passage. Alleen zeer nabije letterranden verliezen geleidelijk focus; herkenning, volumebeleving en het O-gat blijven lang genoeg leesbaar.
- Controleer afzonderlijk geometrische facetten, aliasing, flikkering tussen frames, onscherpte en compressie. Gebruik de term tearing pas als er werkelijk een beeldbreuk wordt aangetoond.

## 2. Cameratraject

Ontwerp positie en kijkrichting op één echte tijdlijn. Gebruik een traject met doorlopende snelheid én versnelling, bijvoorbeeld een zorgvuldig begrensde quintische spline. Ontwerp een vloeiend aandachtspunt voor de blik, controleer de resulterende hoeksnelheid en hoekversnelling en voorkom roll. Alleen quaternion-interpolatie toevoegen garandeert nog geen goed traject.

Eerste storyboard, met 14–16 seconden als werkbereik:

| Moment | Beeld en beweging |
| --- | --- |
| Herkenning, ongeveer 0–3 s | Volledige merknaam leesbaar, huis als bestemming zichtbaar, genoeg hoek en randlicht om de letterdiepte te zien. Zachte inzet van voorwaartse beweging. |
| Letterpassage, ongeveer 3–6 s | Eén rustige yaw naar het echte O-gat. Waar nodig een kleine ruimtelijke boog die de binnenwand zichtbaar maakt; geen opvallende zijwaartse sweep. Geen stop of nieuwe versnelling bij het passeren. |
| Nadering, ongeveer 6–11 s | Eén geleidelijke daling naar de entree, met pitch die de deur volgt en vóór de drempel tot rust komt. De deur opent met een eigen beheerste beweging. |
| Aankomst, ongeveer 11–14/16 s | Recht en rustig door de opening, natuurlijk afremmen tot de exact passende collectieprojectie. Geen laatste knik, zoomsprong of kijkcorrectie. |

Dit zijn voorlopige beats, geen onafhankelijke animatieclips. Eén beweging moet ze verbinden. De definitieve duur volgt uit de bewegende proef; alle video- en projectietiming wordt daarop aangepast.

Eerst een goedkope bewegingsproef met echte lettergeometrie en eenvoudige materialen, volledig op desktop en portrait. Beoordeel op normale snelheid en kwart snelheid. Plot daarnaast translatie- en hoeksnelheid en versnelling; controleer fysieke O- en deurclearance op alle tussenliggende samples.

## 3. Licht, materialen en reflecties

- Richt één samenhangende daglichtsituatie in: een grote hemelbron en zachte gerichte zon. Strijklicht moet baksteen, steenranden, letters en deurornament zichtbaar modelleren.
- Gebruik indirect licht en contactschaduw voor diepte bij kozijnen, dorpels, voegen, beplanting en letters. Geen zware zwarte AO-randen.
- Werk eerst aan wat de camera dichtbij ziet: deur en metaalwerk, glas, steen rond de entree, voorste bestrating en letterranden. Geef ruwheid, normal/detail, verwering en maatvoering ieder een eigen materiaalrol.
- Gebruik werkelijk aanwezige geometrie waar silhouet of contactschaduw dat nodig maakt. Verhoog textureresolutie alleen wanneer de bron echt meer detail bevat; een uitvergrote kleine texture is geen kwaliteitsverbetering.
- Ramen en gelakt metaal reflecteren de omgeving met passende ruwheid. Vermijd identieke spiegelbeelden op ieder raam en plastic glans op steen of blad.
- Houd de gevel scherp en de kleurgrading stabiel. Voeg geen extra globale blur, opvallende bloom of lensvervorming toe om ontbrekend detail te maskeren.

## 4. Wind en tijd

Gebruik seconden als onafhankelijke klok voor camera, deur, wind, schaduw en reflectie. Alle onderdelen worden deterministisch op tijdstip t geëvalueerd, ook bij losse renderbatches en subsamples voor motion blur.

Plan één rustige windrichting met langzame vlagen: weinig beweging aan stammen, meer aan fijne takken en blad, een andere respons bij grassen en lage planten. Varieer fase en sterkte per plant zodat de tuin niet synchroon wiebelt. Houd de wortels vast.

Schaduwen volgen dezelfde vervorming en dezelfde tijdsamples. Hergebruik geen statische schaduw/AO-cache waar vegetatie beweegt. Beoordeel vooral temporele rust: geen bladflikkering, schaduwsprongen of bewegende ruis door agressieve denoising.

## 5. Render en video

Startdoel: 60 fps, een desktopmaster rond 2880 × 1800 en een portraitmaster rond 1080 × 2340, met dezelfde hoogwaardige scène. De uiteindelijke afleverresoluties volgen uit zichtbare kwaliteit, decoderbelasting en bestandsgrootte. Houd 4K als meetbare optie voor grote schermen.

Voor Cycles: begin de kwaliteitsproef rond 256–512 maximum samples met adaptive sampling en beoordeel ruis en detail in beweging. Verhoog lokaal of algemeen wanneer dat zichtbaar helpt; het samplegetal is geen kwaliteitsbewijs. Vergelijk een korte tot middelmatige shutter, bijvoorbeeld 90–180 graden, op letterranden en bladeren. Gebruik motion blur alleen als de beweging al goed is.

Bewaar hoogwaardige RGBA-bronframes en camera-/tijdmetadata, zodat codecs opnieuw gemaakt kunnen worden zonder de scène opnieuw te renderen. Vergelijk lossless frames met twee kwaliteitsniveaus per aflevercodec. Beoordeel dunne THUUS-stroken, O-randen, deurornament en blad vóór een keuze voor bitrate/CRF.

Behoud alpha voor de echte live collectie. Een transparante renderachtergrond alleen maakt geen correcte opening in de gevel: leg de bestaande wereldruimte-opening, diepteafdekking en volledige bewegende deur expliciet vast met holdouts/mattes of een gelijkwaardige compositingoplossing. Behoud de hemel en omgeving buiten de opening. Controleer premultiplied alpha en dekking van privacyglas; voorkom donkere of witte randen boven productfoto's.

Nieuwe camera = nieuwe collectieprojectie. Deel dezelfde geëvalueerde cameradata met de speler, bijvoorbeeld via een voldoende nauwkeurig gesamplede projectietabel met geteste interpolatie. De oude projectieformule mag niet achter een gewijzigd pad blijven staan. Synchroniseer op werkelijk gepresenteerde videoframes en laat het eindbeeld exact op de DOM-collectie landen.

Behoud WebM/VP9-alpha en HEVC-alpha waar ondersteund, met daadwerkelijke browserverificatie. Test ook tussengelegen beeldverhoudingen: `object-fit: cover` mag de merknaam, O-passage of deur niet afsnijden.

## Uitvoering en oplevercriteria

1. Leg huidige film en bronmetadata vast als vergelijkingsmateriaal. Maak de technische overdrachtsproef en meet de kosten.
2. Los lettervolume en het volledige cameratraject op in de bewegende proef, voor desktop en portrait. Beoordeel deze combinatie voordat zware afwerking begint.
3. Werk licht, entree-materialen, reflecties en wind uit. Vergelijk vijf kwaliteitsframes en een korte bewegende uitsnede met de huidige film.
4. Render beide definitieve takes in hervatbare batches met vaste sceneversie, instellingen en tijdmetadata. Maak nieuwe codecvarianten en projectiedata.
5. Controleer de uiteindelijke video in Chrome en Safari, op desktop en een echte iPhone: letters bij 100% schaal, vloeiende beweging, wind/schaduw, alpha, deurdekking, pauzeren/hervatten, skip, buffering, foutafhandeling, reduced motion en naadloze collectieaankomst. Draai relevante projectietests, typecheck en productiebuild na integratie.

Geslaagd betekent: de letters lezen al vóór de passage overtuigend als 3D; afgeronde contouren blijven schoon in de gecomprimeerde film; de blik heeft één doelbewust vloeiend traject; materiaal en schaduw geven het huis meer diepte; wind voelt organisch; de collectie blijft live en sluit zonder zichtbare sprong aan. Rendertijd en bestandsgrootte worden gemeten en gerapporteerd. Er wordt geen numerieke kwaliteitsfactor of ongeteste renderduur beloofd.

De bestaande film blijft het vergelijkingspunt totdat de nieuwe versie deze criteria haalt. Dit was de oorspronkelijke planningsstatus; de uitgevoerde configuratie wordt bijgehouden in `intro-video.md`.

## Technische referenties

- Blender/Cycles sampling en adaptive sampling: https://docs.blender.org/manual/en/latest/render/cycles/render_settings/sampling.html
- Blender/Cycles motion blur: https://docs.blender.org/manual/en/latest/render/cycles/render_settings/motion_blur.html
- Blender/Cycles film, pixel filtering en transparantie: https://docs.blender.org/manual/en/latest/render/cycles/render_settings/film.html
