# Module 2 - Import en invoer roostercoach

## Waar deze module over gaat

Deze module beschrijft hoe gegevens de roostercoach binnenkomen en hoe ze worden vertaald naar het datamodel uit Module 1.

De kernvraag is:

> Hoe komt een rooster, wens, optie of gezinsafspraak betrouwbaar in de app terecht, zonder dat de gebruiker alles dubbel hoeft over te typen?

De app werkt met meerdere bronnen:

1. iCal voor gepubliceerde roosters en agenda-informatie.
2. PDF voor controle, aanvulling en eventueel ronde-2/3-informatie.
3. Handmatige invoer voor wensen, onzekerheden, ruilbehoefte en uitzonderingen.
4. Plannerberichten voor instructeursdagen en keuze-opties.
5. Screenshots alleen als fallback wanneer een bron niet anders uitleesbaar is.

## Hoofdprincipes

1. **Import is nooit direct waarheid zonder bron**
   Iedere geïmporteerde dienst krijgt een `bronId`, betrouwbaarheid en importmoment.

2. **iCal overschrijft alleen gepubliceerde gegevens**
   iCal is leidend voor definitieve roosters, maar mag geen ronde-1-wensen of ronde-2-notities ongemerkt verwijderen.

3. **Handmatige invoer blijft expliciet**
   Wensen, ruilbehoefte en onzekerheden worden niet automatisch weggegooid bij een nieuwe import.

4. **De gebruiker ziet verschillen, niet ruwe importrommel**
   De app moet vooral tonen: nieuw, gewijzigd, verdwenen, dubbel, onzeker of conflict.

5. **Import werkt per persoon en per maand**
   Jij en je vrouw kunnen apart geïmporteerd worden. Augustus kan definitief zijn terwijl november nog handmatig of onzeker is.

## Importbronnen

### 1. iCal-import

iCal is de hoofdbron voor gepubliceerde roosters.

Gebruik voor:

| Data | Naar entiteit | Status |
| --- | --- | --- |
| Werkdienst | `Dienst` | `gepubliceerd` |
| Vrije dag of vrij-code | `Dienst` | `gepubliceerd` |
| Opleiding/cursus | `Dienst` | `gepubliceerd` |
| Instructiedag | `Dienst` | `gepubliceerd` |
| Schoolvakantie | `ContextPeriode` | n.v.t. |
| Gezinsagenda-item | `GezinsVerplichting` | afhankelijk van bron |

Minimale velden uit iCal:

| iCal-veld | Roostercoach-veld |
| --- | --- |
| `DTSTART` | `datum`, `start` |
| `DTEND` | `einde` |
| `SUMMARY` | `dienstCode`, `dienstType`, `opmerking` |
| `LOCATION` | `locatie` |
| `UID` | onderdeel van stabiele externe sleutel |
| `LAST-MODIFIED` | wijzigingsdetectie |

### 2. PDF-import

PDF is nuttig voor controle en aanvulling. De betrouwbaarheid hangt af van de herkomst en structuur.

Gebruik voor:

| PDF-type | Doel |
| --- | --- |
| Gepubliceerd maandrooster | Controle naast iCal |
| Conceptrooster ronde 2/3 | `Dienst` met status `onzeker`, `waarschijnlijk` of `bevestigd` |
| Overzicht instructeursdagen | `KeuzeAanvraag`, `KeuzeOptie` of `Dienst` |
| Roosterlijst collega's | Later mogelijk voor ruilkandidaten |

PDF-import moet altijd een controlescherm krijgen, omdat tekstherkenning en tabelherkenning fouten kunnen maken.

### 3. Handmatige invoer

Handmatige invoer is nodig voor alles wat niet betrouwbaar uit Intus of agenda komt.

Gebruik voor:

| Invoer | Entiteit |
| --- | --- |
| Wens voor dienst of vrije dag | `Wens` |
| Ronde-2-afspraak met collega | `Dienst` of `ActieItem` |
| Ruilbehoefte | bestaande `Dienst` met status `ruil_gewenst` |
| Onzekerheid | `Dienst` met status `onzeker` of `ActieItem` |
| Kind/opvang/schoolafspraak | `GezinsVerplichting` |
| Beschikbaarheid/blokkade | `Beschikbaarheid` |
| Instructeursoptie | `KeuzeAanvraag` en `KeuzeOptie` |

Handmatige invoer moet snel zijn: datum, persoon, type, tijd en korte opmerking zijn genoeg voor een eerste versie.

### 4. Plannerbericht of tekstplakveld

Voor instructeursdagen en losse voorstellen is een plakveld handig.

Voorbeeldinvoer:

```text
Planner vraagt voorkeur instructeursdag week 42:
ma 12 okt 08:00-17:00 Oost
wo 14 okt 08:00-17:00 Zuid
vr 16 okt 08:00-17:00 Oost
```

Vertaling:

| Regel | Entiteit |
| --- | --- |
| Onderwerp/deadline | `KeuzeAanvraag` |
| Iedere datumoptie | `KeuzeOptie` |
| Gekozen voorkeur | `voorkeursOptieId` |

### 5. Screenshot-import

Screenshot-import is fallback, niet de basisroute.

Gebruik alleen wanneer:

1. Er geen bruikbare iCal of PDF beschikbaar is.
2. De gebruiker expliciet kiest voor screenshot uitlezen.
3. De app alle herkende items eerst ter controle toont.

Screenshot-items krijgen standaard:

| Veld | Waarde |
| --- | --- |
| `bron.type` | `screenshot` |
| `betrouwbaarheid` | `laag` |
| `status` | `onzeker` of door gebruiker bevestigd |

## Importproces

Elke import doorloopt dezelfde stappen.

### Stap 1. Bron kiezen

De gebruiker kiest:

1. Persoon: jij, je vrouw of gezin.
2. Bron: iCal, PDF, handmatig, plannertekst of screenshot.
3. Maand of periode.
4. PlanningStage indien niet automatisch duidelijk.

### Stap 2. Ruwe gegevens uitlezen

De app maakt tijdelijke importregels.

Voorbeeld:

```json
{
  "externalKey": "ical_jij_uid_123",
  "persoonId": "persoon_jij",
  "datum": "2026-09-15",
  "start": "14:00",
  "einde": "23:00",
  "summary": "C dienst Zuid",
  "sourceType": "ical"
}
```

### Stap 3. Normaliseren

Normaliseren betekent dat ruwe tekst wordt vertaald naar vaste waarden.

| Ruwe waarde | Genormaliseerd |
| --- | --- |
| `C`, `Laat`, `L` | `dienstType: laat` |
| `V`, `Vrij`, `AVL` | `dienstType: vrij` |
| `Instr`, `Instructie` | `roosterLaag: instructie` |
| `Opl`, `Cursus` | `roosterLaag: opleiding` |
| `Zuid`, `Post Zuid` | `locatie: Zuid` |

Onbekende codes blijven zichtbaar als `dienstCode`, met `dienstType: overig`.

### Stap 4. Koppelen aan bestaande data

De app probeert ieder importitem te koppelen aan bestaande gegevens.

Koppelvolgorde:

1. Exacte externe sleutel, zoals iCal `UID`.
2. Zelfde persoon, datum, start, einde en dienstcode.
3. Zelfde persoon en datum met sterk gelijkende tijd.
4. Geen match: nieuw item.

### Stap 5. Verschillen tonen

De gebruiker krijgt een importsamenvatting.

| Verschil | Betekenis | Standaardactie |
| --- | --- | --- |
| Nieuw | Nog niet bekend | Toevoegen |
| Gewijzigd | Zelfde dienst, andere tijd/code/locatie | Bijwerken na controle |
| Verdwenen | Bestond eerder in deze bron, nu niet meer | Markeren als vervallen of tonen als waarschuwing |
| Dubbel | Lijkt op bestaande dienst uit andere bron | Samenvoegen voorstellen |
| Conflict | Bronnen spreken elkaar tegen | Gebruiker laten kiezen |

### Stap 6. Opslaan in het datamodel

Pas na bevestiging schrijft de app naar:

```json
{
  "bronnen": [],
  "maandPlanningen": [],
  "diensten": [],
  "keuzeAanvragen": [],
  "keuzeOpties": [],
  "contextPeriodes": [],
  "gezinsVerplichtingen": [],
  "beschikbaarheid": [],
  "wensen": [],
  "actieItems": []
}
```

### Stap 7. Analyse opnieuw draaien

Na import draait de roostercoach opnieuw:

1. Controle op conflicten.
2. Controle op gezinsdekking.
3. Controle op maandstatus.
4. Bijwerken van actie-items.
5. Tonen wat direct aandacht nodig heeft.

## Mapping naar status per ronde

De bron en maandstatus bepalen de beginstatus van een dienst.

| PlanningStage | Bron | Dienststatus |
| --- | --- | --- |
| `R1_wensen` | handmatig | `wens` |
| `R1_wensen` | planner | `optie` of `voorgesteld` |
| `R2_afstemming` | handmatig | `onzeker` of `bevestigd` |
| `R2_afstemming` | PDF | `onzeker` of `waarschijnlijk` |
| `R3_manager` | handmatig | `waarschijnlijk` of `bevestigd` |
| `R3_manager` | PDF | `waarschijnlijk` |
| `R4_gepubliceerd` | iCal | `gepubliceerd` |
| `R4_gepubliceerd` | PDF | `gepubliceerd` of controlebron |

Belangrijk: een gepubliceerde iCal-dienst mag een eerdere wens niet wissen. De wens blijft bestaan als historische of evaluatieve informatie, tenzij de gebruiker deze expliciet verwijdert.

## Leidende bron per ronde

Niet iedere bron is in iedere ronde even belangrijk. De app gebruikt daarom per `PlanningStage` een leidende bron en een aanvullende bron.

| PlanningStage | Leidende bron | Aanvullende bron | Handmatige rol |
| --- | --- | --- | --- |
| `R1_wensen` | Handmatige wensen | Plannertekst, standaardrooster, eerdere maanden | Wensen, blokkades en instructeursvoorkeuren invullen |
| `R2_afstemming` | Handmatige afstemming | PDF/conceptrooster, plannertekst | Onzekerheden, collega-afspraken en plan B vastleggen |
| `R3_manager` | PDF/conceptrooster of bekende managerinformatie | Handmatige correcties, standaardrooster | Controleren wat waarschijnlijk wordt en risico's markeren |
| `R4_gepubliceerd` | iCal | PDF als controle, handmatige ruilbehoefte | Alleen uitzonderingen, ruilwens en ontbrekende context |

### Ronde 1: wensen

In ronde 1 is er nog geen definitief rooster. De app mag daarom niet doen alsof iCal of PDF al de waarheid is.

Leidend:

1. Handmatige wensen.
2. Eerdere patronen uit standaardrooster.
3. Instructeursopties uit plannerberichten.

Uitkomst:

| Invoer | Entiteit | Status |
| --- | --- | --- |
| Wens vrije dag | `Wens` | n.v.t. |
| Gewenste dienst | `Dienst` | `wens` |
| Instructeursvoorstel | `KeuzeAanvraag` en `KeuzeOptie` | `optie` |
| Harde gezinsblokkade | `GezinsVerplichting` of `Beschikbaarheid` | n.v.t. |

### Ronde 2: afstemming

In ronde 2 ontstaan afspraken en onzekerheden. De app moet vooral bijhouden wat besproken is en waar nog risico zit.

Leidend:

1. Handmatige afstemming.
2. Plannertekst of conceptinformatie.
3. PDF als die al beschikbaar is.

Uitkomst:

| Invoer | Entiteit | Status |
| --- | --- | --- |
| Mogelijke dienst | `Dienst` | `onzeker` |
| Afgesproken dienst | `Dienst` | `bevestigd` |
| Collega-ruil in bespreking | `ActieItem` of `RuilKandidaat` | open |
| Afgevallen optie | `Dienst` of `KeuzeOptie` | `afgevallen` |

### Ronde 3: managerfase

In ronde 3 is het rooster vaak nog niet gepubliceerd, maar sommige uitkomsten zijn waarschijnlijk.

Leidend:

1. PDF of conceptrooster als dat beschikbaar is.
2. Managerinformatie of plannertekst.
3. Handmatige correcties.

Uitkomst:

| Invoer | Entiteit | Status |
| --- | --- | --- |
| Waarschijnlijke dienst | `Dienst` | `waarschijnlijk` |
| Mondeling bevestigd | `Dienst` | `bevestigd` |
| Risico door afwijking standaardrooster | `AnalyseResultaat` | `waarschuwing` |
| Nog te controleren punt | `ActieItem` | open |

### Ronde 4: gepubliceerd

In ronde 4 is iCal leidend, omdat dit de meest directe gepubliceerde bron is.

Leidend:

1. iCal.
2. PDF als controle.
3. Handmatige invoer alleen voor ruilbehoefte, opmerkingen en gezinscontext.

Uitkomst:

| Invoer | Entiteit | Status |
| --- | --- | --- |
| iCal-dienst | `Dienst` | `gepubliceerd` |
| PDF-dienst die overeenkomt | bronkoppeling bij bestaande `Dienst` | `gepubliceerd` |
| PDF-dienst die afwijkt | `AnalyseResultaat` | `aandacht` of `waarschuwing` |
| Ruilwens | bestaande `Dienst` | `ruil_gewenst` |

## Zo min mogelijk handmatig werk

De app moet handmatige invoer beperken tot wat echt niet uit bronnen kan worden gehaald.

### Automatisch invullen

De app vult automatisch aan:

| Gegeven | Automatische bron |
| --- | --- |
| Persoon | gekozen iCal-koppeling of importprofiel |
| MaandPlanning | datum van de dienst |
| PlanningStage | maandstatus uit Module 1 |
| Diensttype | dienstcode-normalisatie |
| Roosterlaag | codewoorden zoals instructie, opleiding, cursus |
| Locatie | iCal `LOCATION`, PDF-kolom of tekstherkenning |
| Bron | gekozen importbron |
| Status | combinatie van bron en PlanningStage |

### Alleen vragen bij onzekerheid

De app vraagt de gebruiker alleen iets als:

1. De persoon niet duidelijk is.
2. Een dienstcode onbekend is.
3. De tijd ontbreekt of onlogisch is.
4. Twee bronnen elkaar tegenspreken.
5. Een item op meerdere entiteiten kan slaan.
6. Een import een bestaande handmatige afspraak zou veranderen.

### Herbruikbare keuzes

Keuzes van de gebruiker worden onthouden als normalisatieregel.

Voorbeelden:

| Gebruikerskeuze | Volgende keer automatisch |
| --- | --- |
| `C` betekent late dienst | `dienstType: laat` |
| `INS` betekent instructie | `roosterLaag: instructie` |
| `Post Z` betekent Zuid | `locatie: Zuid` |
| Agenda-URL hoort bij vrouw | `persoonId: persoon_vrouw` |

### Importprofielen

Voor terugkerende imports gebruikt de app profielen.

| Profiel | Inhoud |
| --- | --- |
| `Intus iCal jij` | URL/bestand, persoon, standaard betrouwbaarheid hoog |
| `Intus iCal vrouw` | URL/bestand, persoon, standaard betrouwbaarheid hoog |
| `Schoolagenda` | gezin, contextperiodes, schoolafspraken |
| `Maand-PDF rooster` | PDF-type, periodeherkenning, betrouwbaarheid normaal |
| `Plannertekst instructie` | tekstparser voor keuze-aanvragen |

Een profiel voorkomt dat de gebruiker bij elke import opnieuw persoon, bronsoort en betrouwbaarheid moet kiezen.

## Velden voor bronbeheer

Voor betrouwbare synchronisatie zijn extra technische velden nodig. Deze hoeven niet prominent in de gebruikersinterface zichtbaar te zijn.

### ImportItem

Tijdelijke structuur tijdens import.

| Veld | Type | Opmerking |
| --- | --- | --- |
| `id` | string | Tijdelijke sleutel |
| `bronId` | string | Koppeling naar `Bron` |
| `externalKey` | string | UID, bestandsregel of hash |
| `persoonId` | string | Jij of je vrouw |
| `rawText` | string | Originele tekst |
| `parsed` | object | Herkende velden |
| `confidence` | number | 0-100 |
| `matchStatus` | enum | `nieuw`, `gewijzigd`, `dubbel`, `conflict`, `ongewijzigd` |
| `targetEntity` | enum | `dienst`, `wens`, `keuzeOptie`, `contextPeriode`, `gezinsVerplichting` |

### BronHistorie

Voor controle achteraf.

| Veld | Type | Opmerking |
| --- | --- | --- |
| `id` | string | Unieke sleutel |
| `bronId` | string | Welke bron |
| `importMoment` | datetime | Wanneer geïmporteerd |
| `periodeStart` | date | Eerste datum |
| `periodeEinde` | date | Laatste datum |
| `aantalNieuw` | number | Importsamenvatting |
| `aantalGewijzigd` | number | Importsamenvatting |
| `aantalConflict` | number | Importsamenvatting |
| `bestandNaam` | string | Bij PDF/screenshot |
| `checksum` | string | Om dubbele uploads te herkennen |

## Gebruikersschermen

### 1. Importcockpit

Doel: snel zien wat al bijgewerkt is.

Toont per maand:

| Item | Voorbeeld |
| --- | --- |
| Maand | September 2026 |
| Stage | `R4_gepubliceerd` |
| Laatste iCal-import jij | vandaag 09:12 |
| Laatste iCal-import vrouw | gisteren 21:04 |
| Open conflicten | 2 |
| Actie | Importeren / Controleren |

### 2. Importwizard

Stapvolgorde:

1. Bron kiezen.
2. Persoon kiezen.
3. Bestand, URL of tekst invoeren.
4. Periode bevestigen.
5. Gevonden regels controleren.
6. Opslaan.

### 3. Snelle handmatige invoer

Compact formulier:

| Veld | Type |
| --- | --- |
| Persoon | keuze |
| Datum | datum |
| Type | dienst, wens, blokkade, instructie, ruil |
| Tijd | start/einde of dagdeel |
| Status | wens, onzeker, bevestigd, ruil gewenst |
| Opmerking | korte tekst |

Voor veelgebruikte invoer moeten snelknoppen bestaan:

1. `Kind halen`.
2. `Liever vrij`.
3. `Late dienst ruilen`.
4. `Instructeursopties`.
5. `Onzeker in ronde 2`.

### 4. Verschillencontrole

De app toont per import:

| Kolom | Inhoud |
| --- | --- |
| Datum | Dag en datum |
| Persoon | Jij/vrouw |
| Bestaand | Huidige waarde |
| Import | Nieuwe waarde |
| Verschil | Nieuw/gewijzigd/conflict |
| Actie | accepteren, overslaan, samenvoegen |

## Conflictafhandeling

### iCal tegenover handmatig

Als een handmatige ronde-2-dienst later anders in iCal staat:

1. iCal wordt opgeslagen als gepubliceerde dienst.
2. De handmatige dienst krijgt eventueel status `afgevallen`.
3. De app maakt een analyse of actie-item als het verschil belangrijk is.

### PDF tegenover iCal

Als PDF en iCal verschillen in R4:

1. iCal blijft leidend.
2. PDF-verschil wordt `AnalyseResultaat` met ernst `aandacht` of `waarschuwing`.
3. Gebruiker kan PDF alsnog als correct markeren.

### Dubbele diensten

Twee diensten worden als dubbel gezien als:

1. Persoon gelijk is.
2. Datum gelijk is.
3. Start/einde gelijk of bijna gelijk zijn.
4. Dienstcode of diensttype overeenkomt.

De app bewaart dan niet twee losse werkblokken, maar koppelt meerdere bronnen aan dezelfde dienst.

## Voorbeeld: iCal naar Dienst

Ruwe iCal:

```text
SUMMARY:C dienst Zuid
DTSTART:20260915T140000
DTEND:20260915T230000
LOCATION:Zuid
UID:intus-abc-123
```

Wordt:

```json
{
  "id": "dienst_2026-09-15_jij_c",
  "persoonId": "persoon_jij",
  "maandPlanningId": "2026-09",
  "datum": "2026-09-15",
  "start": "14:00",
  "einde": "23:00",
  "dienstCode": "C",
  "dienstType": "laat",
  "locatie": "Zuid",
  "roosterLaag": "regulier",
  "status": "gepubliceerd",
  "bronId": "bron_ical_jij",
  "ruilbaar": "ja",
  "opmerking": ""
}
```

## Voorbeeld: handmatige ronde-2-notitie

Invoer:

```text
November, dinsdag 10 nov: waarschijnlijk laat, collega wil mogelijk ruilen.
```

Wordt:

```json
{
  "id": "dienst_2026-11-10_jij_laat_handmatig",
  "persoonId": "persoon_jij",
  "maandPlanningId": "2026-11",
  "datum": "2026-11-10",
  "start": null,
  "einde": null,
  "dienstCode": "",
  "dienstType": "laat",
  "locatie": "",
  "roosterLaag": "regulier",
  "status": "waarschijnlijk",
  "bronId": "bron_handmatig_2026-11",
  "ruilbaar": "onbekend",
  "opmerking": "Collega wil mogelijk ruilen"
}
```

Omdat start/einde ontbreken, maakt de app een actie-item:

```json
{
  "id": "actie_2026-11-10_tijd_controleren",
  "maandPlanningId": "2026-11",
  "titel": "Tijd late dienst controleren",
  "type": "gegevens_aanvullen",
  "prioriteit": "normaal",
  "status": "open",
  "deadline": "2026-10-20",
  "gekoppeldeAnalyseIds": []
}
```

## Minimale versie voor implementatie

Voor een eerste werkende versie is genoeg:

1. Handmatige invoer van diensten, wensen, blokkades en instructeursopties.
2. iCal-import per persoon.
3. Importcontrole met nieuw/gewijzigd/dubbel/conflict.
4. Opslag van `Bron` en `bronId` bij ieder item.
5. Heranalyse van de maand na import.

PDF en screenshot kunnen daarna volgen.

## Wat Module 2 beslist

Deze module legt vast:

1. Import gebeurt altijd via een bron met betrouwbaarheid en historie.
2. iCal is leidend voor gepubliceerde roosters, maar wist handmatige wensen niet automatisch.
3. PDF is controle/aanvulling en moet altijd een controlescherm krijgen.
4. Handmatige invoer is nodig voor wensen, ronde-2-afspraken, onzekerheden en ruilbehoefte.
5. Plannerteksten worden gebruikt voor instructeursdagen en keuze-opties.
6. Screenshot-import is alleen fallback en standaard laag betrouwbaar.
7. Iedere import toont verschillen voordat gegevens definitief worden opgeslagen.

## Volgende module

De logische volgende module is:

**Module 3 - Analyse, waarschuwingen en actie-items**

Daarin bepalen we hoe de roostercoach conflicten, gezinsdekking, ruilkansen en maandstatus omzet naar concrete adviezen.
