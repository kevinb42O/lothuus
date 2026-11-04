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
