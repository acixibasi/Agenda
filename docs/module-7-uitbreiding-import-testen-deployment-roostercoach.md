# Module 7 - Uitbreiding, import, testen en deployment

## Waar deze module over gaat

Module 6 levert de eerste lokale basisapp op: `index.html`, `style.css`, `app.js`, lokale opslag, handmatige invoer, analyse-acties, backup en een importcontrole-scherm zonder echte parser.

Module 7 beschrijft hoe die basis doorgroeit naar een app die echt gekoppeld is aan bronnen en online gebruikt kan worden.

De kernvraag is:

> Hoe sluiten we de lokale roostercoach veilig aan op iCal, PDF-controle, serveropslag, tests en webserver-deployment, zonder de betrouwbare lokale basis kwijt te raken?

Daarin bepalen we:

1. Hoe echte iCal-import wordt toegevoegd.
2. Hoe PDF-controle naast iCal werkt.
3. Hoe `save.php` en `load.php` serveropslag mogelijk maken.
4. Welke testscenario's minimaal nodig zijn.
5. Hoe de app naar de webserver gaat.
6. Welke onderdelen pas later AI of advieslogica mogen krijgen.

## Hoofdprincipes

1. **Lokaal blijft leidend bij twijfel**
   De app moet lokaal blijven werken, ook als import, sync of webserver tijdelijk faalt.

2. **Import komt altijd eerst in controle**
   iCal en PDF mogen niet stilletjes bestaande wensen, opmerkingen, ruilstatussen of actiehistorie overschrijven.

3. **iCal is bron voor gepubliceerde roosters**
   Zoals in Module 2: iCal is de hoofdbron voor R4-gepubliceerde diensten.

4. **PDF is controle en aanvulling**
   PDF mag verschillen signaleren en ontbrekende context aanvullen, maar vervangt iCal niet blind.

5. **Server-sync is voorzichtig**
   Uploaden en downloaden moet met revisies, backups en conflictmelding.

6. **Deployment is pas geslaagd na online test**
   Een upload is niet genoeg. De online pagina moet openen, opslaan, laden en herkenbare tekst tonen.

7. **AI komt pas na betrouwbare data**
   Advieslogica mag pas groeien als import, opslag, analyse en tests stabiel zijn.

## Fase 1: echte iCal-import

### Doel

De app kan een iCal-bestand of iCal-tekst lezen en vertalen naar `Dienst`-objecten binnen het datamodel uit Module 1.

### Eerste invoervormen

Start met:

1. iCal-bestand uploaden via de browser.
2. iCal-tekst plakken in een importveld.

Later kan daar een iCal-URL bij komen, maar die heeft vaker CORS-, login- of serverproblemen. Voor de eerste werkende import is bestand of plakveld betrouwbaarder.

### iCal-parser

De parser moet minimaal herkennen:

| iCal-veld | Roostercoach-veld |
| --- | --- |
| `UID` | `externalId` of bronkoppeling |
| `DTSTART` | startdatum en starttijd |
| `DTEND` | einddatum en eindtijd |
| `SUMMARY` | dienstnaam of dienstcode |
| `LOCATION` | locatie |
| `DESCRIPTION` | extra notitie of ruwe bronregel |

### Mapping naar Dienst

Voor ieder iCal-event maakt de app een importitem:

```json
{
  "type": "dienst",
  "bronType": "ical",
  "persoonId": "persoon_jij",
  "externalId": "ical_uid_123",
  "datum": "2026-09-14",
  "start": "14:00",
  "einde": "23:00",
  "dienstCode": "C",
  "locatie": "Ambulancepost",
  "status": "gepubliceerd",
  "ruweBron": {}
}
```

Pas na controle wordt dit een echte `Dienst`.

### Importcontrole

Na iCal-invoer toont de app:

1. Aantal gevonden events.
2. Aantal nieuwe diensten.
3. Aantal bestaande diensten die hetzelfde lijken.
4. Aantal gewijzigde diensten.
5. Aantal events die niet begrepen zijn.

De gebruiker kan daarna:

1. Alles bevestigen.
2. Per regel overslaan.
3. Persoon of maand corrigeren.
4. Import annuleren.

### Deduplicatie

De app herkent bestaande diensten in deze volgorde:

1. Exacte `UID` of externe sleutel.
2. Zelfde persoon, datum, starttijd en eindtijd.
3. Zelfde persoon, datum en dienstcode.

Bij twijfel wordt geen automatische vervanging gedaan. De regel komt in de importcontrole.

### iCal-acceptatiecheck

| Test | Verwacht resultaat |
| --- | --- |
| Upload iCal met 10 diensten | App toont 10 importregels |
| Bevestig import | Diensten staan in de maandcockpit |
| Importeer hetzelfde bestand opnieuw | App maakt geen dubbele diensten |
| Wijzig 1 diensttijd in iCal en importeer opnieuw | App toont een wijziging ter controle |
| Importeer event zonder eindtijd | App toont waarschuwing of slaat regel over |

## Fase 2: PDF-controle

### Doel

PDF wordt gebruikt om gepubliceerde roosters te controleren naast iCal en om verschillen zichtbaar te maken.

PDF-import hoeft in de eerste uitbreiding niet alles perfect automatisch te begrijpen. Het belangrijkste is dat verschillen controleerbaar zijn.

### Eerste PDF-route

Start met:

1. PDF-bestand uploaden.
2. Tekst uit PDF extraheren als dat technisch mogelijk is.
3. Ruwe tekst tonen in een controlevenster.
4. Herkende datums, tijden en dienstcodes als conceptregels tonen.

Als automatische extractie onvoldoende is, mag de gebruiker tekst uit de PDF plakken.

### PDF als controlebron

PDF levert geen stilzwijgende overschrijving op. De app vergelijkt:

| Situatie | Gedrag |
| --- | --- |
| PDF en iCal gelijk | Markeer als gecontroleerd |
| PDF heeft dienst die iCal mist | Toon aandachtspunt |
| iCal heeft dienst die PDF mist | Toon aandachtspunt |
| Tijd verschilt | Toon conflict |
| Dienstcode verschilt | Toon conflict |

### Verschillenmodel

PDF-conflicten worden opgeslagen als `AnalyseResultaat` of `ActieItem`, niet als directe wijziging van de dienst.

Voorbeeld:

```json
{
  "type": "bron_conflict",
  "ernst": "aandacht",
  "maandPlanningId": "2026-09",
  "entiteitType": "Dienst",
  "entiteitId": "dienst_2026-09-14_jij",
  "samenvatting": "PDF en iCal verschillen voor dienst op 14 september",
  "bronnen": ["ical_jij", "pdf_rooster_2026_09"]
}
```

### PDF-acceptatiecheck

| Test | Verwacht resultaat |
| --- | --- |
| Upload PDF met dezelfde diensten als iCal | App toont geen nieuwe conflicten |
| PDF mist een iCal-dienst | App maakt aandachtspunt |
| PDF heeft andere eindtijd | App toont bronconflict |
| PDF-tekst is onleesbaar | App vraagt om handmatige tekst of stopt netjes |

## Fase 3: serverkoppeling met save.php en load.php

### Doel

De app kan data bewaren op de webserver en later weer ophalen, zodat gebruik op meerdere apparaten mogelijk wordt.

De server is geen vervanging voor lokale opslag. De browser houdt lokale data en gebruikt de server als synchronisatiepunt.

### Minimale serverbestanden

| Bestand | Doel |
| --- | --- |
| `save.php` | Ontvangt JSON en schrijft actuele dataset weg |
| `load.php` | Geeft laatst opgeslagen dataset terug |
| `health.php` | Controleert of de serverroute bereikbaar is |
| `backup.php` | Downloadt serverbackup of maakt backup op aanvraag |
| `data/roostercoach-data.json` | Actuele serverdata |
| `data/backups/` | Serverbackups |

### Minimale save.php-regels

`save.php` moet:

1. Alleen `POST` accepteren.
2. JSON body lezen.
3. Controleren of `dataVersion`, `revisionId` en `lastModified` bestaan.
4. Huidig serverbestand backuppen voor overschrijven.
5. Nieuwe data atomair wegschrijven.
6. Een JSON-resultaat teruggeven.

Voorbeeldantwoord:

```json
{
  "ok": true,
  "serverRevisionId": "rev_2026-07-13T16-10-00_server",
  "savedAt": "2026-07-13T16:10:00"
}
```

### Minimale load.php-regels

`load.php` moet:

1. Alleen JSON teruggeven.
2. Bestaan van databestand controleren.
3. Bij lege server een duidelijke lege status teruggeven.
4. Geen PHP-fouten als HTML tonen.

Voorbeeldantwoord:

```json
{
  "ok": true,
  "hasData": true,
  "data": {},
  "serverRevisionId": "rev_2026-07-13T16-10-00_server"
}
```

### Beveiliging eerste versie

Voor een persoonlijke familie-app is de eerste beveiligingslaag:

1. Geen geheimen in `app.js`.
2. Serverdata buiten publiek uitleesbare routes plaatsen als hosting dat toestaat.
3. `.htaccess` of serverinstelling om directe toegang tot `data/` te blokkeren.
4. Eenvoudige gedeelde sleutel of serverconfiguratie pas toevoegen als online gebruik start.
5. Geen medische of zeer gevoelige extra data in deze app opslaan.

Als er een gedeelde sleutel komt, hoort die niet hardcoded zichtbaar in de publieke JavaScript. Dan is een server-side sessie, eenvoudige login of andere afscherming nodig.

### Syncgedrag in de app

De interface krijgt:

1. `Serverstatus`.
2. `Online laden`.
3. `Online opslaan`.
4. `Synchroniseren`.
5. `Serverbackup downloaden`.

Bij synchronisatie:

1. Maak lokale snapshot.
2. Haal servermetadata op.
3. Vergelijk revisies.
4. Upload als alleen lokaal nieuwer is.
5. Download als alleen server nieuwer is en lokaal niets openstaat.
6. Toon conflict als beide kanten gewijzigd zijn.

### Server-acceptatiecheck

| Test | Verwacht resultaat |
| --- | --- |
| Open `health.php` | JSON met `ok: true` |
| Klik online opslaan | Serverbestand wordt bijgewerkt |
| Klik online laden in nieuwe browser | Data komt terug |
| Server tijdelijk onbereikbaar | Lokale app blijft werken |
| Twee apparaten wijzigen dezelfde maand | App toont syncconflict |

## Fase 4: testscenario's

### Doel

Module 7 maakt de app testbaar genoeg om met vertrouwen online te zetten.

Tests zijn hier vooral scenario's die de echte workflow afdekken. Niet alleen technische unit-tests.

### Testsets

| Testset | Doel |
| --- | --- |
| Lokale basis | Bewijst dat Module 6 nog werkt |
| iCal-import | Voorkomt dubbele of fout gemapte diensten |
| PDF-controle | Bewijst dat verschillen zichtbaar worden |
| Opslag en backup | Voorkomt dat data kwijtraakt |
| Server-sync | Bewijst upload, download en conflictgedrag |
| Mobiel gebruik | Bewijst dat de cockpit bruikbaar is op telefoon |
| Deployment | Bewijst dat online versie echt werkt |

### Minimale regressietest na iedere wijziging

Na iedere grotere wijziging moet dit blijven werken:

1. App opent.
2. Bestaande lokale data laadt.
3. Maand kan worden aangemaakt.
4. Dienst kan worden toegevoegd.
5. Analyse maakt actie bij conflict.
6. Backup downloaden werkt.
7. Backup terugzetten werkt.
8. iCal-import maakt geen dubbele diensten.
9. Server health-check geeft JSON terug.
10. Online pagina toont de juiste versie.

### Handmatige scenario's

#### Scenario 1: eerste gebruik

1. Open lege app.
2. Maak maand September 2026.
3. Voeg kindmoment toe.
4. Voeg dienst voor beide ouders toe.
5. Controleer actie-item.
6. Refresh browser.

Verwacht: maand, diensten en actie blijven bestaan.

#### Scenario 2: iCal importeren

1. Open importscherm.
2. Upload iCal voor jou.
3. Controleer importregels.
4. Bevestig import.
5. Open maandcockpit.

Verwacht: diensten staan correct bij de juiste persoon en maand.

#### Scenario 3: PDF controleren

1. Upload PDF of plak PDF-tekst.
2. Laat app vergelijken met iCal.
3. Controleer verschillenlijst.

Verwacht: normale overeenkomsten blijven rustig; alleen verschillen worden actiegericht getoond.

#### Scenario 4: online opslaan en laden

1. Maak lokale wijziging.
2. Klik online opslaan.
3. Open andere browser of apparaat.
4. Klik online laden.

Verwacht: laatste dataset komt terug en revisie klopt.

#### Scenario 5: serverconflict

1. Apparaat A laadt serverdata.
2. Apparaat B laadt dezelfde serverdata.
3. A wijzigt maand en slaat online op.
4. B wijzigt dezelfde maand en probeert te synchroniseren.

Verwacht: B krijgt conflictmelding en overschrijft A niet stil.

## Fase 5: deployment naar de webserver

### Doel

De app wordt online gezet met dezelfde controle als eerdere webserver-workflows: uploaden, terug kunnen downloaden en online testen.

### Deploybare bestanden

Voor eerste online versie:

```text
index.html
style.css
app.js
save.php
load.php
health.php
backup.php
data/.htaccess
data/backups/.htaccess
```

Afhankelijk van hosting kan `data/` anders worden afgeschermd. Het principe blijft: serverdata mag niet rechtstreeks publiek browsebaar zijn.

### Deploymentconfiguratie

De lokale werkmap krijgt bij voorkeur:

```text
webserver.example.env
webserver.env
upload-to-strato.ps1
download-from-strato.ps1
test-webserver.ps1
publish-to-strato.ps1
STRATO-KOPPELING.md
```

`webserver.env` bevat alleen configuratie die nodig is voor deployment, zoals host, gebruiker, remote map, lokaal bestand en test-URL. Wachtwoorden of geheime sleutels worden niet in chat of documentatie gezet.

### Upload-flow

1. Controleer lokale bestanden.
2. Controleer dat `webserver.env` is ingevuld.
3. Upload statische bestanden.
4. Upload PHP-endpoints.
5. Maak servermappen `data/` en `data/backups/` als nodig.
6. Controleer rechten.
7. Open `health.php`.
8. Open online app.
9. Test herkenbare tekst en versie.

### Download-flow

Downloaden is nodig om te controleren wat er echt online staat.

1. Download online `index.html`, `app.js`, `style.css` en PHP-bestanden naar een controlemap.
2. Vergelijk belangrijke versieregels.
3. Controleer of serverkopie overeenkomt met lokale release.

### Online test-flow

Minimaal:

1. `health.php` geeft JSON.
2. Online `index.html` opent.
3. Verwachte appnaam of versietekst staat op de pagina.
4. `load.php` geeft geldige JSON.
5. `save.php` accepteert testdata alleen via gecontroleerde route.
6. Browserconsole heeft geen blokkerende fouten.

### Releaseversie

Iedere online release krijgt een zichtbaar of intern versienummer, bijvoorbeeld:

```js
const APP_VERSION = "2026-07-13-module7-server-sync-1";
```

Bij wijzigingen in `app.js` moet de online pagina zo nodig met cachebuster naar de nieuwe versie verwijzen.

## Fase 6: latere AI en advieslogica

### Wanneer pas toevoegen

AI of geavanceerde advieslogica hoort pas na:

1. Betrouwbare lokale opslag.
2. Werkende iCal-import.
3. Bruikbare PDF-controle.
4. Serverbackup en restore.
5. Genoeg echte testscenario's.
6. Duidelijke grenzen voor wat advies wel en niet mag doen.

### Eerste nuttige AI-toepassingen

AI kan later helpen met:

1. Plannertekst omzetten naar keuzeopties.
2. Onregelmatige PDF-tekst interpreteren.
3. Ruilsuggesties in gewone taal samenvatten.
4. Actielijst prioriteren.
5. Uitleg geven waarom een maand risicovol is.

### Grenzen

AI mag niet:

1. Stil diensten wijzigen.
2. Een conflict oplossen zonder bevestiging.
3. Als enige bron bepalen wat het rooster is.
4. Oncontroleerbare adviezen geven zonder bronregels.
5. Gegevens naar externe diensten sturen zonder expliciete keuze.

AI-uitvoer wordt daarom altijd opgeslagen als voorstel, toelichting of conceptactie.

## Volgorde van bouwen

De praktische bouwvolgorde is:

1. iCal-parser voor bestand/plakveld.
2. Importcontrole en bevestigen zonder duplicaten.
3. PDF-tekstinvoer en verschillencontrole.
4. `health.php`, `load.php` en `save.php`.
5. Online opslaan en laden vanuit de app.
6. Conflictcontrole met revisies.
7. Deployment-scripts en online test.
8. Regressietestscenario's vastleggen.
9. Pas daarna AI of geavanceerd advies.

## Wat Module 7 beslist

Deze module legt vast:

1. iCal-import wordt de eerste echte bronkoppeling.
2. iCal-events gaan altijd via importcontrole voordat ze echte diensten worden.
3. PDF wordt eerst controlebron, niet stille overschrijver.
4. Serveropslag start eenvoudig met PHP en JSON-bestanden.
5. `save.php` en `load.php` werken met revisies, backups en JSON-antwoorden.
6. Syncconflicten worden getoond in plaats van automatisch opgelost.
7. Deployment bestaat uit uploaden, downloaden en online testen.
8. Testscenario's horen bij de module, niet pas achteraf.
9. AI/advieslogica is een latere laag bovenop betrouwbare data.

## Minimale Module 7-versie die echt bruikbaar is

Module 7 is geslaagd als dit kan:

1. iCal-bestand importeren.
2. Importeerregels controleren.
3. Import bevestigen zonder dubbele diensten.
4. PDF of PDF-tekst vergelijken met iCal.
5. Verschillen als actie of aandachtspunt tonen.
6. Data online opslaan via `save.php`.
7. Data online laden via `load.php`.
8. `health.php` gebruiken als servercheck.
9. App naar de webserver uploaden.
10. Online app testen met herkenbare versie.
11. Serverkopie kunnen downloaden voor controle.
12. Lokale app blijft bruikbaar als server niet bereikbaar is.

## Volgende module

De logische volgende module is:

**Module 8 - Bouwplan en implementatiestappen**

Daarin kan de documentatie worden omgezet naar concrete bestanden, functies en taken: welke HTML-schermen, welke JavaScript-modules, welke PHP-endpoints en welke tests als eerste worden gemaakt.
