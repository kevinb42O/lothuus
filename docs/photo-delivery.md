# Fotoverkeer via private R2-opslag

## Werking

`R2_DIRECT_DELIVERY=true` laat de bestaande openbare fotoroutes na hun publicatiecontrole een tijdelijke HTTP 302 naar R2 teruggeven. De link geeft uitsluitend GET-toegang tot één bestaande WebP-variant en vervalt na 60 seconden. De redirect heeft `private, no-store`; de fotoversie gebruikt `private, no-cache`. Originele uploads en buckets worden niet openbaar. Een ingetrokken publicatie weigert nieuwe links; een al afgegeven link kan nog maximaal 60 seconden worden gebruikt. Reeds gedownloade foto's kunnen, zoals voorheen, niet worden teruggenomen.

De eigenaarsroute voor `/api/images` blijft fotobytes via de server leveren. Openbare bronfoto's onder `/api/collection-images` blijven dezelfde selectie- en archiefcontrole gebruiken. Server-side catalogusprojecties behouden hun bestaande maximale cacheleeftijd van 60 seconden.

Zonder de vlag, zonder volledige R2-configuratie, bij een ongeldig endpoint of een fout bij ondertekenen blijft de bestaande serverroute actief. `delivery=proxy` forceert die route, met dezelfde toegangscontrole. De collectie, detailfoto's en hun thumbnails kunnen daar eenmaal op terugvallen bij een mislukte directe levering. De entree-atlas en filtervoorbereiding gebruiken CORS en dezelfde terugval. De vlag verandert geen voorraad-, bestel-, upload- of bewaarbeleid.

## Browserconfiguratie

- Alleen de exacte R2-origin uit `R2_ENDPOINT` wordt aan `img-src` in de productie-CSP toegevoegd. Path-style ondertekening voorkomt extra bucket-subdomeinen. Alleen de R2 API-domeinen worden geaccepteerd.
- R2 CORS moet GET toestaan voor de daadwerkelijke website-origin. Dat maakt de bucket niet openbaar en geeft geen upload- of lijsttoegang. Canvasgebruik van de collectie vraagt `crossOrigin=anonymous`.
- De ondertekende URL wordt pas bij een afbeeldingsaanvraag gemaakt; de catalogus bevat blijvende applicatie-URL's. Een lang openstaand tabblad krijgt bij een nieuwe aanvraag een nieuwe link.
- Zowel CSP als de featurevlag worden bij de build vastgelegd: een gewijzigde vlag vereist een nieuwe deployment.

## Uitrol en terugdraaien

Test eerst op een productiepreview: openbare foto en variant laden, detail wisselen, entree-atlas, filter, browserfout met proxyterugval, en een geweigerde privéfoto. Controleer de werkelijke R2-response, niet alleen de redirect. Houd het voorgaande Vercel-deployment-ID bij voor rollback. Activeer geen publieke bucket of r2.dev-adres.

Terugdraaien: promoot het vorige deployment, of bouw opnieuw met `R2_DIRECT_DELIVERY=false`. Alle bestaande API-URL's, bestanden en databasegegevens blijven bruikbaar. Het uitschakelen van directe levering vereist geen datamigratie.

## Kosten en beperkingen

De fotobody gaat bij directe levering buiten Vercel om. Kleine toegangscontroles, redirects, uploads en andere API-antwoorden blijven Fast Origin Transfer gebruiken. R2 GET-aanvragen blijven meetellen bij R2; door kort geldige links kan hergebruik minder gunstig zijn dan een langdurige publieke CDN-cache. Er is bewust geen langdurig openbaar fotoadres toegevoegd. Besparing op de totale Vercel-facturatieteller moet na uitrol uit werkelijk verkeer worden gemeten; er is geen vooraf gegarandeerd percentage.
