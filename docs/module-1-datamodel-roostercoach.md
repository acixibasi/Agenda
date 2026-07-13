# Module 1 - Datamodel roostercoach

## Waar deze module over gaat

Deze module beschrijft het datamodel voor de familie-roostercoach. De app is geen vervanging van Intus, maar een beslislaag eromheen. Het systeem helpt bij wensen, harde voorwaarden, gezinsdekking, ronde-statussen, instructeursdagen, iCal/PDF-import, ruiladvies en waarschuwingen.

De kernvraag van dit datamodel is:

> Welke gegevens moeten we vastleggen zodat de software per maand kan zeggen wat vaststaat, wat onzeker is, waar actie nodig is en welk advies logisch is?

## Hoofdprincipes

1. **Maanden hebben elk hun eigen ronde**
   Augustus kan in ronde 4 zitten terwijl november in ronde 2 zit en december in ronde 1.

2. **Diensten hebben een bron en status**
   Een dienst uit iCal is anders dan een wens, een handmatige ronde-2-notitie of een PDF-import.

3. **Jij en je vrouw zijn allebei volwaardige roosterpersonen**
   Jullie werken bij hetzelfde bedrijf en doen vergelijkbaar werk, maar kunnen op verschillende posten en in verschillende roosterstromen zitten.

4. **Instructeursdagen zijn een aparte laag**
   Ze kunnen vroeg in ronde 1/2 als voorstel of keuze-aanvraag bestaan en later als gewone werkverplichting zichtbaar worden in iCal/PDF.

5. **De app toont vooral uitzonderingen**
   Niet alles hoeft uitgelegd te worden. De app moet conflicten, risico's, keuzes en ruilkansen naar voren halen.

## Entiteiten

### 1. Persoon

Een persoon is iemand wiens rooster meetelt in de gezinsplanning.

| Veld | Type | Voorbeeld | Opmerking |
| --- | --- | --- | --- |
| `id` | string | `persoon_jij` | Unieke sleutel |
| `naam` | string | `Jij` | Weergavenaam |
| `rol` | enum | `ouder` | Later uitbreidbaar |
| `werkgever` | string | `zelfde bedrijf` | Vrij veld |
| `post` | string | `Zuid` | Huidige/standaard post |
| `contractUrenPerWeek` | number | `32` | Voor urenbewaking |
| `standaardRoosterId` | string | `std_jij` | Koppeling naar basisrooster |
| `actief` | boolean | `true` | Alleen actieve personen tellen mee |

### 2. Kind

Een kind is relevant voor school, opvang, brengmomenten en haalmomenten.

| Veld | Type | Voorbeeld |
| --- | --- | --- |
| `id` | string | `kind_1` |
| `naam` | string | `Kind 1` |
| `schoolId` | string | `school_basis` |
| `opvangProfielId` | string | `opvang_basis` |

### 3. MaandPlanning

De maand is de centrale werk-eenheid. Iedere maand kan in een andere ronde zitten.

| Veld | Type | Voorbeeld | Opmerking |
| --- | --- | --- | --- |
| `id` | string | `2026-09` | Jaar-maand |
| `jaar` | number | `2026` |  |
| `maand` | number | `9` |  |
| `planningStage` | enum | `R4_gepubliceerd` | Ronde/status van deze maand |
| `samenvattingStatus` | enum | `aandacht` | `goed`, `aandacht`, `conflict`, `onvolledig` |
| `laatstBijgewerkt` | datetime | `2026-07-13T12:00:00` |  |

### 4. PlanningStage

De app gebruikt deze vaste ronde-statussen.

| Waarde | Betekenis | Hoofdactie |
| --- | --- | --- |
| `R1_wensen` | Wensenrooster voorbereiden | Beste wensen en instructeursvoorstellen beoordelen |
| `R2_afstemming` | Afstemming met collega's | Knelpunten, onzekerheden en plan B bijhouden |
| `R3_manager` | Managerfase | Standaardrooster, open diensten en manager-risico checken |
| `R4_gepubliceerd` | Gepubliceerd rooster | Conflicten en ruiladvies op definitief rooster |

### 5. Dienst

Een dienst is iedere werkverplichting, wens, optie of gepubliceerd roosteritem.

| Veld | Type | Voorbeeld | Opmerking |
| --- | --- | --- | --- |
| `id` | string | `dienst_2026-09-14_jij_laat` | Unieke sleutel |
| `persoonId` | string | `persoon_jij` | Jij of je vrouw |
| `maandPlanningId` | string | `2026-09` | Koppeling naar maand |
| `datum` | date | `2026-09-14` |  |
| `start` | time | `14:00` |  |
| `einde` | time | `23:00` |  |
| `dienstCode` | string | `C` | Code uit Intus/PDF/iCal |
| `dienstType` | enum | `laat` | `vroeg`, `dag`, `laat`, `nacht`, `vrij`, `opleiding`, `instructie`, `overig` |
| `locatie` | string | `Zuid` | Bijvoorbeeld Zuid/Oost |
| `roosterLaag` | enum | `regulier` | Zie roosterlagen |
| `status` | enum | `gepubliceerd` | Zie dienststatussen |
| `bronId` | string | `bron_ical_jij` | Waar komt dit vandaan? |
| `ruilbaar` | enum | `ja` | `ja`, `beperkt`, `nee`, `onbekend` |
| `opmerking` | string | `opvang lastig` | Vrije notitie |

### 6. DienstStatus

| Waarde | Betekenis |
| --- | --- |
| `wens` | Gewenste dienst voor ronde 1 |
| `aangevraagd` | In Intus/planner aangevraagd |
| `optie` | Mogelijke dienst of keuzeoptie |
| `voorgesteld` | Door planner voorgesteld |
| `onzeker` | Nog niet zeker in ronde 2/3 |
| `waarschijnlijk` | Nog niet definitief, maar kansrijk |
| `bevestigd` | Afgesproken maar nog niet per se gepubliceerd |
| `gepubliceerd` | Definitief zichtbaar in iCal/PDF |
| `ruil_gewenst` | Staat vast, maar er is ruilbehoefte |
| `afgevallen` | Was optie, maar telt niet meer mee |

### 7. RoosterLaag

| Waarde | Betekenis |
| --- | --- |
| `regulier` | Gewone dienst op eigen post |
| `instructie` | Instructeursdag of instructeursoptie |
| `opleiding` | Opleiding/cursus |
| `overleg` | Overlegdag |
| `extra` | Extra dienst of bijzondere verplichting |
| `gezin` | Gezinsafspraak die als blokkade telt |

### 8. KeuzeAanvraag

Voor instructeursdagen of andere semi-keuzes waarbij de planner opties voorlegt.

| Veld | Type | Voorbeeld | Opmerking |
| --- | --- | --- | --- |
| `id` | string | `keuze_instr_week42` | Unieke sleutel |
| `persoonId` | string | `persoon_vrouw` | Meestal je vrouw bij instructie |
| `type` | enum | `instructeursdag` | Ook opleiding/extra dienst mogelijk |
| `planningStageVanaf` | enum | `R1_wensen` | Vanaf welke ronde zichtbaar |
| `deadline` | date | `2026-09-20` | Wanneer reactie nodig is |
| `responseStatus` | enum | `nog_beoordelen` | Reactiestatus |
| `voorkeursOptieId` | string | `optie_2` | Beste optie volgens app/gebruiker |
| `toelichting` | string | `planner vroeg voorkeur` | Vrije notitie |

### 9. KeuzeOptie

Een concrete optie binnen een keuze-aanvraag.

| Veld | Type | Voorbeeld |
| --- | --- | --- |
| `id` | string | `optie_2` |
| `keuzeAanvraagId` | string | `keuze_instr_week42` |
| `datum` | date | `2026-10-14` |
| `start` | time | `08:00` |
| `einde` | time | `17:00` |
| `locatie` | string | `Oost` |
| `weging` | enum | `hoog` |
| `adviesScore` | number | `82` |
| `adviesLabel` | enum | `beste_optie` |
| `uitleg` | string | `Geen opvangconflict en normale reistijd` |

### 10. Bron

Een bron verklaart waar gegevens vandaan komen.

| Veld | Type | Voorbeeld | Opmerking |
| --- | --- | --- | --- |
| `id` | string | `bron_ical_jij` | Unieke sleutel |
| `type` | enum | `ical` | `ical`, `pdf`, `handmatig`, `screenshot`, `planner`, `voorspelling` |
| `naam` | string | `Intus iCal jij` | Weergavenaam |
| `persoonId` | string | `persoon_jij` | Optioneel |
| `maandPlanningId` | string | `2026-09` | Optioneel |
| `betrouwbaarheid` | enum | `hoog` | `laag`, `normaal`, `hoog`, `leidend` |
| `laatstGeimporteerd` | datetime | `2026-07-13T12:00:00` |  |

Bronlogica:

| Bron | Rol |
| --- | --- |
| iCal | Hoofdbron voor gepubliceerde roosters en schoolvakanties |
| PDF | Controle/aanvulling, en bruikbaar voor ronde 2 als dezelfde info beschikbaar is |
| Handmatig | Wensen, ronde-2-notities, uitzonderingen |
| Screenshot | Mogelijke fallback als PDF/iCal niet genoeg is |
| Planner | Voorstellen zoals instructeursdagen |
| Voorspelling | Later voor voorbeeldroosters of OR-Tools |

### 11. ContextPeriode

Een periode die invloed heeft op de beoordeling, zoals schoolvakantie.

| Veld | Type | Voorbeeld |
| --- | --- | --- |
| `id` | string | `vakantie_herfst_2026` |
| `type` | enum | `schoolvakantie` |
| `naam` | string | `Herfstvakantie` |
| `startDatum` | date | `2026-10-17` |
| `eindDatum` | date | `2026-10-25` |
| `bronId` | string | `bron_ical_school` |
| `impactNiveau` | enum | `hoog` |

### 12. GezinsVerplichting

Een harde of zachte verplichting rondom kinderen, opvang, school of gezin.

| Veld | Type | Voorbeeld | Opmerking |
| --- | --- | --- | --- |
| `id` | string | `opvang_dinsdag` | Unieke sleutel |
| `type` | enum | `school_halen` | `school_brengen`, `school_halen`, `opvang`, `sport`, `afspraak`, `overig` |
| `kindId` | string | `kind_1` | Optioneel |
| `datum` | date | `2026-09-15` |  |
| `start` | time | `15:00` |  |
| `einde` | time | `17:30` |  |
| `hardheid` | enum | `hard` | `hard`, `zacht` |
| `dekkingNodig` | boolean | `true` | Moet er een ouder beschikbaar zijn? |
| `opmerking` | string | `school uit` |  |

### 13. Beschikbaarheid

Beschikbaarheid kan per persoon of per gezin gelden.

| Veld | Type | Voorbeeld |
| --- | --- | --- |
| `id` | string | `beschik_jij_2026-09-15` |
| `persoonId` | string | `persoon_jij` |
| `datum` | date | `2026-09-15` |
| `start` | time | `15:00` |
| `einde` | time | `18:00` |
| `status` | enum | `niet_beschikbaar` |
| `reden` | string | `kind ophalen` |

### 14. Wens

Een wens is zachter dan een harde voorwaarde, maar telt mee in advies.

| Veld | Type | Voorbeeld |
| --- | --- | --- |
| `id` | string | `wens_jij_geen_laat_dinsdag` |
| `persoonId` | string | `persoon_jij` |
| `type` | enum | `liever_geen_dienst` |
| `datum` | date | `2026-09-15` |
| `dienstType` | enum | `laat` |
| `prioriteit` | enum | `hoog` |
| `reden` | string | `opvang` |

### 15. Regel

Regels zijn de controlepunten voor de roostercoach.

| Veld | Type | Voorbeeld |
| --- | --- | --- |
| `id` | string | `regel_geen_dubbele_dienst` |
| `naam` | string | `Geen overlappende diensten` |
| `categorie` | enum | `werk` |
| `hardheid` | enum | `hard` |
| `actief` | boolean | `true` |
| `parameters` | object | `{}` |

Regelcategorieen:

| Categorie | Voorbeelden |
| --- | --- |
| `gezin` | Kind halen, opvang, beide ouders tegelijk bezet |
| `werk` | Geen overlap, contracturen, dienstcodes |
| `arbeidstijden` | Rusttijd, nachtdiensten, maximale belasting |
| `standaardrooster` | Afwijking van basisrooster, manager-risico |
| `reistijd` | Spitsbuffer, overdracht, woon-werkdruk |
| `voorkeur` | Wensen, samen vrij, vermijden van bepaalde dagen |

### 16. AnalyseResultaat

Een resultaat is wat de app teruggeeft na controle.

| Veld | Type | Voorbeeld |
| --- | --- | --- |
| `id` | string | `analyse_2026-09-15_1` |
| `maandPlanningId` | string | `2026-09` |
| `datum` | date | `2026-09-15` |
| `ernst` | enum | `conflict` |
| `categorie` | enum | `gezin` |
| `regelId` | string | `regel_kind_dekking` |
| `betrokkenDienstIds` | array | `["dienst_1", "dienst_2"]` |
| `melding` | string | `Beide ouders werken tijdens school ophalen` |
| `advies` | string | `Zoek ruil voor late dienst of regel opvang` |
| `actieStatus` | enum | `open` |

Ernstwaarden:

| Waarde | Betekenis |
| --- | --- |
| `info` | Alleen context |
| `aandacht` | Let op, maar geen direct probleem |
| `keuze_nodig` | Gebruiker moet kiezen of reageren |
| `waarschuwing` | Mogelijk probleem |
| `conflict` | Hard probleem |
| `blokkade` | Mag niet volgens harde regels |

### 17. RuilKandidaat

Voor gepubliceerde roosters of ronde-2/3-scenario's.

| Veld | Type | Voorbeeld |
| --- | --- | --- |
| `id` | string | `ruil_2026-09-15` |
| `oorspronkelijkeDienstId` | string | `dienst_laat_dinsdag` |
| `alternatieveDienstId` | string | `dienst_vroeg_maandag` |
| `score` | number | `78` |
| `effectGezin` | enum | `verbetert` |
| `effectRust` | enum | `neutraal` |
| `effectUren` | enum | `neutraal` |
| `effectReistijd` | enum | `verbetert` |
| `uitleg` | string | `Lost opvangconflict op zonder extra rustprobleem` |

### 18. ActieItem

De app moet vooral een werkbare actielijst maken.

| Veld | Type | Voorbeeld |
| --- | --- | --- |
| `id` | string | `actie_aug_1` |
| `maandPlanningId` | string | `2026-08` |
| `titel` | string | `1 opvangconflict oplossen` |
| `type` | enum | `ruil_nodig` |
| `prioriteit` | enum | `hoog` |
| `status` | enum | `open` |
| `deadline` | date | `2026-07-20` |
| `gekoppeldeAnalyseIds` | array | `["analyse_1"]` |

## Status per maand volgens huidige afspraak

Omdat rondes door het jaar heen parallel lopen, moet dit als data worden opgeslagen en niet als globale appstand.

| Maand | PlanningStage |
| --- | --- |
| Juli 2026 | nader te bepalen |
| Augustus 2026 | `R4_gepubliceerd` |
| September 2026 | `R4_gepubliceerd` |
| Oktober 2026 | `R3_manager` |
| November 2026 | `R2_afstemming` |
| December 2026 en later | `R1_wensen` |

## Minimale JSON-structuur

```json
{
  "personen": [],
  "kinderen": [],
  "maandPlanningen": [],
  "diensten": [],
  "keuzeAanvragen": [],
  "keuzeOpties": [],
  "bronnen": [],
  "contextPeriodes": [],
  "gezinsVerplichtingen": [],
  "beschikbaarheid": [],
  "wensen": [],
  "regels": [],
  "analyseResultaten": [],
  "ruilKandidaten": [],
  "actieItems": []
}
```

## Voorbeeld

```json
{
  "maandPlanningen": [
    {
      "id": "2026-09",
      "jaar": 2026,
      "maand": 9,
      "planningStage": "R4_gepubliceerd",
      "samenvattingStatus": "aandacht",
      "laatstBijgewerkt": "2026-07-13T12:00:00"
    },
    {
      "id": "2026-11",
      "jaar": 2026,
      "maand": 11,
      "planningStage": "R2_afstemming",
      "samenvattingStatus": "onvolledig",
      "laatstBijgewerkt": "2026-07-13T12:00:00"
    }
  ],
  "diensten": [
    {
      "id": "dienst_2026-09-15_jij_laat",
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
  ],
  "keuzeAanvragen": [
    {
      "id": "keuze_instr_week42",
      "persoonId": "persoon_vrouw",
      "type": "instructeursdag",
      "planningStageVanaf": "R1_wensen",
      "deadline": "2026-09-20",
      "responseStatus": "nog_beoordelen",
      "voorkeursOptieId": null,
      "toelichting": "Planner legt instructeursdagen voor"
    }
  ]
}
```

## Wat Module 1 beslist

Deze module legt vast:

1. De maand is de centrale cockpit.
2. Ronde/status hoort bij de maand, niet bij de hele app.
3. Iedere dienst heeft een persoon, bron, roosterlaag en status.
4. Instructeursdagen worden als keuze-aanvraag en later als dienst gemodelleerd.
5. iCal is hoofdbron voor gepubliceerde roosters en schoolvakanties.
6. PDF is controle/aanvulling en kan ook ronde-2-data voeden als die beschikbaar is.
7. De app moet analyses omzetten naar actie-items, niet alleen naar waarschuwingen.

## Volgende module

De logische volgende module is:

**Module 2 - Import en invoer**

Daarin bepalen we hoe iCal, PDF, handmatige invoer en eventueel screenshots naar dit datamodel worden vertaald.

