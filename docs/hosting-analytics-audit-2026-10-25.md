# Audit hosting en analytics — 25 oktober 2026

Scope: pakketkaarten, objectquota, bezoekersanalytics, hartjesanalytics, betaalgegevens, private API's, Supabase-rapportage, R2-metingen en Vercel-publicatie. Dit is geen penetratietest van de volledige publieke website.

## Actuele afspraken

| Pakket | Objecten | Betaling | Analytics |
| --- | ---: | --- | --- |
| Free | 200 | €0 | Laatste 7 dagen; bezoekers ook 24 uur |
| Pro | 500 | €240/jaar of €25/maand | Alle aangeboden periodes |
| Enterprise | 1.000 | €490/jaar of €49/maand | Alle aangeboden periodes |

Eenmalige uitbreidingen: +50 voor €25 en +150 voor €50. Bestaande uitbreidingen blijven behouden. Interne sleutels `basis` en `premium` blijven bestaan om bestaande accounts en betalingen compatibel te houden. De historische bankmededelingen en QR-payloads veranderen niet.

## Gevonden en hersteld

- De lokale schrijfcontrole blokkeerde nieuwe objecten nog boven 150, terwijl het rapport 200 vermeldde. Zowel controle als lokale rapportage gebruiken nu de centrale pakketcatalogus. De regressietest maakt object 200 aan en weigert object 201 met rollback.
- Hartjesanalytics bood op Free nog 30/90 dagen en alle historie aan. De opties blijven zichtbaar maar zijn uitgeschakeld. De server weigert deze periodes, begrenst de historische dagdata tot zeven dagen en geeft geen vergelijking met een oudere periode terug. “Recent bewaard” blijft de expliciet benoemde momentopname, geen historische periodekeuze.
- Bij bezoekersanalytics hing de periodeblokkering af van het geladen rapport. Tijdens het ophalen van een nieuwe periode verdween dat rapport tijdelijk, waardoor betalende pakketten onterecht geblokkeerd werden. Pakketrechten worden nu afzonderlijk bewaard en onbekende pakketrechten geven geen uitgebreide toegang.
- Bij terugval naar Free verwijdert de bezoekersinterface gecachete uitgebreide rapporten. Een door de server geweigerde historische periode schakelt terug naar zeven dagen; Hartjes doet dit eveneens.
- Ontbrekende Cloudflare-meetconfiguratie werd stilzwijgend overgeslagen bij de hostingcron. Dit levert nu een meetfout op, zodat een onvolledige meting niet als volledig geslaagd wordt gerapporteerd.
- De hostingtest vergeleek een percentage exact met een decimale waarde. De test accepteert nu uitsluitend een verwaarloosbaar verschil door binaire getalopslag.

## Controles

- Supabase-productierapport: actief `basis`/Free, 195 objecten, limiet 200, geen extra capaciteit of bestellingen.
- Recente productiemetingen: media 171.466.669 bytes, database 29.577.077 bytes en R2-origin-downloads 35.896.110 bytes voor oktober UTC. Meetmoment circa 05:10 Belgische tijd. CDN-cache staat terecht op niet van toepassing.
- Alle zes bestaande PNG-betaalcodes teruggedecodeerd. Volledige payload exact vergeleken met IBAN `BE43 7380 0488 6701`, begunstigde, bedrag en historische mededeling; alle zes gelijk. Geen QR-bestanden gewijzigd.
- Productie-API's voor hosting, bezoekers, hartjes en cron zonder sessie/sleutel: alle HTTP 401.
- Supabase-hostingrapport en bezoekersrapport met publieke sleutel: toegang geweigerd.
- Geauthenticeerde lokale API-regressie: bezoekers 24 uur en zeven dagen toegestaan; 30 dagen, drie/twaalf maanden, dit jaar en alles geweigerd. Hartjes weigert 30/90 dagen, alles en ongeldige periodes op Free.
- Ordervalidatie: browser kan geen bedrag, quota of actieve betaalstatus insturen. Herhaalde lokale bestellingen blijven idempotent. “Betaling uitgevoerd” activeert geen capaciteit; aparte operatorbevestiging blijft vereist.
- SQL-review: objectlimiet wordt in de bestaande trigger onder accountlock gecontroleerd; geldige betaalde pakketten en extra capaciteit tellen mee. Afname of bewerking van bestaande objecten blijft mogelijk.
- Interfacebroncontrole: native disabled-controls, toegankelijke periodegroep, focusstijlen, tabelalternatieven, modalsluiting en focusherstel, scrollbegrenzing en reduced-motion aanwezig. Responsieve CSS is nagekeken.
- Productieafhankelijkheden: `npm audit --omit=dev` rapporteert nul bekende kwetsbaarheden op het auditmoment.
- TypeScript, productiebuild, hostingtests, analyticstests en de bestaande projecttests uitgevoerd; resultaten staan in de oplevering.

## Grenzen van deze audit

- Nieuwe visuele desktop-/mobielcontrole kon niet worden uitgevoerd: lokale browserbediening is uitgeschakeld in Work-instellingen. De vorige live controle toonde al Free 200, Pro 500 en Enterprise 1.000, maar is geen nieuwe visuele controle van deze auditfixes.
- R2 en Cloudflare zijn beoordeeld via hun recente in productie opgeslagen metingen en de meetcode. De private productiecredentials zijn als Sensitive opgeslagen en worden door Vercel niet geëxporteerd; deze audit heeft daarom geen onafhankelijke nieuwe R2-bucketopsomming of Cloudflare-query uitgevoerd.
- Er is geen echte betaling, live bestelling, pakketactivering of productie-objectcreatie uitgevoerd als test.
- Opslag- en verkeerswaarden op pakketkaarten zijn commerciële rechten. Een pakketactivering vereist passende infrastructuur. Alleen een objectquotamigratie schaalt Supabase of R2 niet op.
