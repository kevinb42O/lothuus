import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/backend/auth';
import { safeError } from '@/lib/backend/service';
import type { WorkspaceUpdate } from '@/lib/updates/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Handmatig geselecteerde berichten voor Katrien. Voeg alleen afgeronde,
// gecontroleerde verbeteringen toe; neem nooit automatisch GitHub-teksten over.
const updates: WorkspaceUpdate[] = [
  {
    id: '2026-10-29-product-layout', date: '2026-10-29',
    title: 'Foto en productinformatie blijven samen in beeld',
    body: [
      'Het detailvenster gebruikt op de computer meer van je scherm. De titel staat ruimer en gecentreerd bovenaan, met het hartje linksboven en de sluitknop rechtsboven. Op de computer staan de grote foto en de kleine foto’s samen links, met de prijs en productinformatie rechts. Ook horizontale foto’s blijven volledig zichtbaar, zonder extra lege banden. Bij verticale foto’s krijgt de productinformatie automatisch meer breedte. Door de informatie kun je apart scrollen.',
      'Een gekleurde rand en een vinkje bij de kleine foto tonen duidelijk welk beeld je bekijkt. Wanneer je op je telefoon door de foto’s swipet, schuift de bijbehorende kleine foto mee in beeld. Op je telefoon staan de titel, grote foto en kleine foto’s onder elkaar, gevolgd door de prijs en productinformatie.',
    ],
  },
  {
    id: '2026-10-29-product-photos', date: '2026-10-29',
    title: 'Makkelijker alle foto’s van een object bekijken',
    body: [
      'De kleine foto’s staan nu direct onder de grote foto, boven de beschrijving. Ook bij een uitgebreide tekst, bijvoorbeeld bij een groot servies, hoef je niet eerst door alle informatie te scrollen om een andere foto te kiezen.',
      'Op je telefoon kun je op de grote foto naar links of rechts swipen om door de beelden te bladeren. Op de computer gebruik je de pijlen links en rechts op de foto. De kleine foto’s blijven ook beschikbaar; wanneer je op je telefoon zo een ander beeld kiest, komt de grote foto weer in beeld.',
      'Producttitels op de website tonen alleen de naam van het object, zonder de voorraadcode ervoor. In je werkruimte blijven de codes bewaard om je producten terug te vinden.',
    ],
  },
  {
    id: '2026-10-27-house-intro', date: '2026-10-27',
    title: 'Een vernieuwde binnenkomst bij LOTHUUS',
    body: [
      'Je website opent met een vernieuwde filmische tocht naar de voordeur. Het huis heeft meer detail gekregen, met een inkijk achter de ramen en je naam boven de ingang. Zodra de deur opengaat, verschijnt de collectie.',
      'Bezoekers kunnen de intro pauzeren of overslaan om meteen naar de collectie te gaan. Wie minder beweging heeft ingesteld op zijn toestel, komt rechtstreeks bij de foto’s terecht.',
    ],
  },
  {
    id: '2026-10-27-collection-photos', date: '2026-10-27',
    title: 'Vlotter door de foto’s bladeren',
    body: ['Foto’s verderop in de collectie worden eerder voorbereid. Foto’s die je net bekeken hebt, blijven ook wat langer klaarstaan wanneer je terugscrolt. Zo kun je rustiger verder kijken en terugbladeren.', 'Bij het vergroten van een foto blijft het bestaande beeld staan terwijl de scherpere versie wordt geladen.'],
  },
  {
    id: '2026-10-27-collection-filters', date: '2026-10-27',
    title: 'Een rustiger menu voor de materialen',
    body: ['De materiaalkeuze boven de collectie heeft een eenvoudigere vormgeving gekregen. Een onderlijning laat zien welk materiaal je bekijkt. De aantallen naast de materialen zijn weggehaald, zodat de aandacht bij je objecten blijft.'],
  },
  {
    id: '2026-10-27-collection', date: '2026-10-27',
    title: 'Je nieuwe producten zijn toegevoegd',
    body: [
      'Je nieuwe levering is verwerkt: 102 producten en 403 foto’s zijn toegevoegd. Je vindt nu ook inox en ijzer, plastiek en textiel terug bij de materialen.',
      'De nieuwe productfiches zijn als concept toegevoegd aan je werkruimte. Je kunt ze rustig aanvullen en zelf kiezen wanneer je ze publiceert.',
    ],
    action: { label: 'Producten bekijken', target: 'items' },
  },
  {
    id: '2026-10-27-workspace', date: '2026-10-27',
    title: 'Een frissere, rustigere werkruimte',
    body: ['Je dashboard heeft een rustigere vormgeving gekregen, met neutrale kleuren en duidelijkere knoppen. De grafieken bij Bezoekers en Hartjes zijn nu blauw, zodat je de cijfers makkelijker kunt volgen.'],
    action: { label: 'Bezoekers bekijken', target: 'visitors' },
  },
  {
    id: '2026-10-27-remember', date: '2026-10-27',
    title: 'Makkelijker opnieuw inloggen',
    body: ['Bij het inloggen kun je nu ‘Onthoud mij’ aanvinken. Zo hoef je op je eigen toestel minder vaak opnieuw in te loggen.'],
  },
  {
    id: '2026-10-25-visitors', date: '2026-10-25',
    title: 'Zie hoe je website wordt bezocht',
    body: ['Bij Bezoekers zie je hoeveel bezoeken je website krijgt en hoe die over de dagen verdeeld zijn. Je ziet ook of bezoekers vooral een telefoon, tablet of computer gebruiken.', 'Zo krijg je een beeld van de belangstelling voor LOTHUUS, zonder namen of contactgegevens van bezoekers.'],
    action: { label: 'Bezoekers bekijken', target: 'visitors' },
  },
  {
    id: '2026-10-25-hearts', date: '2026-10-25',
    title: 'Ontdek welke stukken aandacht krijgen',
    body: ['Onder Verkoop → Hartjes zie je welke objecten bezoekers in hun selectie bewaren. Je kunt opzoeken welke stukken belangstelling krijgen en hoe die interesse evolueert.', 'Een hartje toont interesse; het is nog geen bestelling.'],
    action: { label: 'Hartjes bekijken', target: 'hearts' },
  },
  {
    id: '2026-10-25-information', date: '2026-10-25',
    title: 'Privacy en voorwaarden hebben een eigen plek',
    body: ['Onderaan de website staan nu links naar Privacy en Algemene voorwaarden. Zo kunnen bezoekers de informatie over hun gegevens en de praktische afspraken terugvinden.'],
  },
  {
    id: '2026-10-25-backup', date: '2026-10-25',
    title: 'Een reservekopie is gecontroleerd',
    body: ['Er is een reservekopie van de beheergegevens gemaakt en gecontroleerd. Ook het terugzetten van die kopie is getest. Zo is nagegaan of de bewaarde gegevens opnieuw kunnen worden ingelezen.'],
  },
  {
    id: '2026-10-24-publish', date: '2026-10-24',
    title: 'Kies zelf wanneer een productfiche zichtbaar wordt',
    body: ['Je kunt een productfiche op je eigen tempo aanvullen en als concept bewaren. Zodra ze volledig is, zet je ze met ‘Publiceer op website’ online.', 'Wil je een gepubliceerde fiche toch nog even terugnemen? Met ‘Terug naar concept’ blijft je ingevulde werk bewaard.'],
    action: { label: 'Producten bekijken', target: 'items' },
  },
  {
    id: '2026-10-24-photo-order', date: '2026-10-24',
    title: 'Zet je mooiste foto vooraan',
    body: ['Je kunt de foto’s op een productfiche verslepen naar de volgorde die jij wilt. Die volgorde wordt meteen bewaard, ook als de rest van de fiche nog niet af is.', 'De website neemt de opgeslagen fotovolgorde over. Zo bepaal je zelf met welk beeld je een object voorstelt.'],
    action: { label: 'Producten bekijken', target: 'items' },
  },
  {
    id: '2026-10-24-feedback', date: '2026-10-24',
    title: 'Duidelijker zien wanneer je werk bewaard is',
    body: ['Je werkruimte toont korte meldingen wanneer je iets opslaat of een actie uitvoert. Als iets niet lukt, krijg je daar ook een melding van, zodat je weet wat er gebeurd is.'],
  },
  {
    id: '2026-10-24-mobile', date: '2026-10-24',
    title: 'Prettiger door de collectie bladeren op je telefoon',
    body: ['De weergave van het huis en de fotocollectie is aangepast voor telefoons. De foto’s blijven overzichtelijk staan terwijl je door de collectie scrolt.', 'Ook op een groter scherm blijft een vergrote foto beter in beeld wanneer je verder kijkt.'],
  },
  {
    id: '2026-10-24-house', date: '2026-10-24',
    title: 'Een binnenkomst via het huis',
    body: ['De eerste versie van de huisentree bracht bezoekers via de voordeur naar de collectie. Die binnenkomst vormt de basis voor de vernieuwde intro bovenaan dit overzicht.'],
  },
  {
    id: '2026-10-24-sharing', date: '2026-10-24',
    title: 'Een herkenbaar beeld bij je websitelink',
    body: ['Je website heeft een eigen voorbeeldafbeelding en beschrijving gekregen voor het delen van een link. Zo kan LOTHUUS herkenbaar verschijnen wanneer je de website via een bericht of op sociale media deelt.'],
  },
  {
    id: '2026-10-24-password', date: '2026-10-24',
    title: 'Even nakijken wat je hebt getypt',
    body: ['Met het oogje naast je wachtwoord kun je tijdens het inloggen even controleren wat je hebt getypt. Klik nog eens om het wachtwoord weer te verbergen.'],
  },
  {
    id: '2026-10-24-workspace', date: '2026-10-24',
    title: 'Je website en eigen werkruimte krijgen vorm',
    body: ['De eerste fotocollectie is toegevoegd: 195 producten met 808 foto’s, verdeeld over keramiek, glas en hout, riet en bamboe.', 'In je eigen werkruimte kun je de productfiches aanvullen, foto’s beheren en op je eigen tempo aan je collectie werken.'],
    action: { label: 'Producten bekijken', target: 'items' },
  },
];
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: NextRequest) {
  try {
    await requireOwner(request);
    return NextResponse.json({ updates }, { headers });
  } catch (e) {
    const error = safeError(e);
    return NextResponse.json({ error: error.message }, { status: error.status, headers });
  }
}
