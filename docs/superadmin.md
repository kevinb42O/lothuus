# Superadmin — LOTHUUS

Route: `https://www.lothuus.be/superadmin`. Persoonlijke login: `kevin@webaanzee.be`. Het wachtwoord staat uitsluitend bij Supabase Auth en wordt niet in Git, documentatie of browseropslag bewaard.

## Eerste aanmelding

1. Meld aan met het afzonderlijke superadminaccount.
2. Kies Authenticator instellen en scan de QR-code met je eigen authenticator-app.
3. Bevestig de actuele zescijferige code. Pas daarna worden beheerdata geladen en beheeracties toegestaan.

Bij volgende aanmeldingen volgt na het wachtwoord de authenticatorcode. De superadmin gebruikt eigen HTTP-only sessiecookies op `/api/superadmin`, los van de eigenaarsessie. De server vereist de vaste accountidentiteit, `app_metadata.role=superadmin`, een actieve private operatorregistratie en AAL2. Zelf ingevulde gebruikersmetadata verlenen geen rol. De gewone eigenaarslogin en haar rechten zijn niet uitgebreid.

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
