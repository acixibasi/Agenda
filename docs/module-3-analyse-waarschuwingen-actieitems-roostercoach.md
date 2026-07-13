# Module 3 - Analyse, waarschuwingen en actie-items

## Waar deze module over gaat

Deze module beschrijft wat de roostercoach met de geimporteerde data doet. Module 1 zegt welke data we bewaren, Module 2 zegt hoe data binnenkomt, en Module 3 zegt wat de app ermee concludeert.

De kernvraag is:

> Hoe ziet de app per maand wat goed gaat, wat onzeker is, wat echt botst en welke volgende actie nodig is?

Daarin bepalen we:

1. Wanneer iets een conflict is.
2. Wanneer beide ouders tegelijk bezet zijn.
3. Wanneer opvang of school halen in gevaar komt.
4. Wanneer een instructeursdag een goede of slechte keuze is.
5. Wanneer ruilen nodig is.
6. Hoe dit wordt omgezet naar een korte actielijst per maand.

De analyse is geen los rapport. De uitkomst moet direct bruikbaar zijn in de maandcockpit: wat is veilig geregeld, wat ontbreekt, wat botst en wat moet de gebruiker nu doen?

## Hoofdprincipes

1. **Acties zijn belangrijker dan meldingen**
   Een waarschuwing zonder vervolgstap is te vaag. De app moet zo veel mogelijk vertalen naar een `ActieItem`.

2. **Ronde bepaalt de strengheid**
   Een onzekerheid in ronde 1 is normaal. Dezelfde onzekerheid in ronde 4 kan een probleem zijn.

3. **Harde conflicten gaan boven voorkeuren**
   Kinddekking, dubbele diensten, rusttijd en onmogelijke tijden krijgen voorrang boven wensen.

4. **De app toont uitzonderingen**
   Normale dagen hoeven niet uitgelegd te worden. De maandcockpit toont vooral conflicten, risico's, keuzes en ruilkansen.

5. **Iedere melding moet herleidbaar zijn**
   Een `AnalyseResultaat` verwijst naar regels, diensten, gezinsverplichtingen en broninformatie zodat de gebruiker kan controleren waarom iets gemeld wordt.

## Analyseproces

De analyse draait per maand. Na iedere import, handmatige wijziging of statuswijziging wordt alleen de relevante maand opnieuw beoordeeld.

### Stap 1. Analysecontext opbouwen

De app verzamelt voor de maand:

| Gegeven | Bron |
| --- | --- |
| Maandstatus | `MaandPlanning.planningStage` |
| Diensten | `Dienst` |
| Wensen | `Wens` |
| Gezinsverplichtingen | `GezinsVerplichting` |
| Beschikbaarheid | `Beschikbaarheid` |
| Keuze-aanvragen | `KeuzeAanvraag` en `KeuzeOptie` |
| Context | `ContextPeriode`, zoals vakantie |
| Bronnen | `Bron` en `BronHistorie` |

### Stap 2. Basiscontrole op volledigheid

Voordat inhoudelijke regels worden beoordeeld, controleert de app of de maand genoeg gegevens heeft.

| Controle | Voorbeeldmelding | Ernst |
| --- | --- | --- |
| Geen diensten voor persoon | `Nog geen rooster voor vrouw in november` | `aandacht` |
| Onbekende tijden | `Dienst op 10 november mist start/einde` | `waarschuwing` |
| Oude import | `iCal jij is langer dan 7 dagen niet bijgewerkt` | `aandacht` |
| Onbekende dienstcode | `Dienstcode X3 is nog niet herkend` | `aandacht` |
| Ontbrekende maandstatus | `PlanningStage voor december ontbreekt` | `waarschuwing` |

Volledigheidsproblemen worden meestal actie-items van type `gegevens_aanvullen`.

### Stap 3. Harde conflicten zoeken

Harde conflicten zijn problemen die niet genegeerd mogen worden.

| Regel | Conflict wanneer | Voorbeeldactie |
| --- | --- | --- |
| `regel_geen_dubbele_dienst` | Een persoon heeft overlappende diensten | Dienst controleren of corrigeren |
| `regel_kind_dekking` | Geen ouder beschikbaar bij harde gezinsverplichting | Ruil, opvang of familiehulp regelen |
| `regel_rusttijd` | Rusttijd tussen diensten is te kort | Ruil zoeken of rooster laten aanpassen |
| `regel_onmogelijke_tijd` | Eindtijd ligt voor starttijd of dienst duurt onlogisch lang | Gegevens controleren |
| `regel_beide_ouders_afwezig` | Beide ouders zijn tegelijk bezet terwijl dekking nodig is | Oplossing kiezen |

Harde conflicten krijgen ernst `conflict` of `blokkade`.

### Stap 4. Ronde-afhankelijke risico's beoordelen

Niet iedere onzekerheid is even ernstig. De `PlanningStage` bepaalt hoe zwaar iets telt.

| PlanningStage | Onzekerheid betekent | Standaard ernst |
| --- | --- | --- |
| `R1_wensen` | Normaal, hoort bij wensenfase | `info` of `keuze_nodig` |
| `R2_afstemming` | Bewaken of bespreken | `aandacht` |
| `R3_manager` | Risico dat het rooster verkeerd valt | `waarschuwing` |
| `R4_gepubliceerd` | Mogelijk ontbrekende of foutieve definitieve informatie | `waarschuwing` of `conflict` |

Voorbeeld:

Een late dienst zonder exacte tijd in ronde 2 is `aandacht`. Dezelfde dienst zonder tijd in een gepubliceerde maand is `waarschuwing`, omdat ruil en gezinsplanning dan niet betrouwbaar kunnen worden beoordeeld.

### Stap 5. Wensen en voorkeuren toetsen

Wensen zijn belangrijk, maar niet altijd harde eisen.

| Wens | Analyse |
| --- | --- |
| Liever geen late dienst op dinsdag | Waarschuwing als er toch een late dienst staat |
| Samen vrij weekend | Aandacht als dat niet lukt |
| Voorkeur instructeursoptie | Keuzeadvies maken |
| Liever vaste post | Aandacht bij afwijkende locatie |
| Minder nachtdiensten | Belasting over maand tellen |

Voorkeuren leiden meestal tot ernst `info`, `aandacht` of `keuze_nodig`, tenzij de wens als harde blokkade is ingevoerd.

### Stap 6. Ruilkansen bepalen

Als een dienst een conflict of ruilwens heeft, zoekt de app naar mogelijke alternatieven.

Een ruilkandidaat krijgt een score op:

| Factor | Betekenis |
| --- | --- |
| Gezinsdekking | Lost de ruil een haal/breng/opvangprobleem op? |
| Rusttijd | Wordt rust beter of slechter? |
| Uren | Blijven contracturen ongeveer kloppen? |
| Locatie | Wordt reistijd beter of slechter? |
| Voorkeur | Past de ruil beter bij wensen? |
| Zekerheid | Is de alternatieve dienst gepubliceerd, bevestigd of onzeker? |

Scoreadvies:

| Score | Label |
| --- | --- |
| 80-100 | `sterke_ruil` |
| 60-79 | `mogelijke_ruil` |
| 40-59 | `alleen_als_nodig` |
| 0-39 | `niet_aanraden` |

## Ernst, prioriteit en status

### Ernst van AnalyseResultaat

| Ernst | Wanneer gebruiken | Zichtbaarheid |
| --- | --- | --- |
| `info` | Context zonder actie | Alleen in detail |
| `aandacht` | Let op, mogelijk later relevant | Maandcockpit |
| `keuze_nodig` | Gebruiker moet kiezen of reageren | Actielijst |
| `waarschuwing` | Reeel risico of ontbrekende informatie | Bovenaan maand |
| `conflict` | Hard probleem in planning | Hoogste prioriteit |
| `blokkade` | Onmogelijke of niet-toegestane situatie | Hoogste prioriteit |

### Prioriteit van ActieItem

| Prioriteit | Wanneer |
| --- | --- |
| `laag` | Kan later, geen directe impact |
| `normaal` | Moet voor de maand compleet is |
| `hoog` | Heeft invloed op gezin, werk of deadline |
| `urgent` | Vandaag of eerstvolgende dienst oplossen |

### Status van ActieItem

| Status | Betekenis |
| --- | --- |
| `open` | Nog niet opgepakt |
| `bezig` | Gebruiker is ermee bezig |
| `wacht_op_ander` | Collega, planner of opvang moet reageren |
| `opgelost` | Afgehandeld |
| `genegeerd` | Bewust niet oplossen |
| `vervallen` | Niet meer relevant door nieuwe import of wijziging |

## Regels

### Gezinsregels

| Regel | Type | Uitkomst |
| --- | --- | --- |
| Kind halen zonder beschikbare ouder | Hard | `conflict` |
| Beide ouders late dienst bij opvangmoment | Hard of zacht | `conflict` of `waarschuwing` |
| Schoolvakantie zonder dekking | Hard | `waarschuwing` |
| Sport/afspraak overlapt met dienst | Zacht | `aandacht` |

### Werkregels

| Regel | Type | Uitkomst |
| --- | --- | --- |
| Overlappende diensten voor dezelfde persoon | Hard | `blokkade` |
| Dienst zonder start/einde | Data | `waarschuwing` |
| Dienst op verkeerde persoon | Data | `waarschuwing` |
| PDF en iCal spreken elkaar tegen | Bron | `aandacht` of `waarschuwing` |

### Arbeidstijdregels

Deze regels kunnen in de eerste versie eenvoudig blijven en later verfijnd worden.

| Regel | Eerste versie |
| --- | --- |
| Rust na late dienst | Waarschuwen als volgende dienst vroeg begint |
| Nachtdiensten achter elkaar | Tellen en markeren bij te veel |
| Lange reeks werkdagen | Waarschuwen vanaf ingestelde grens |
| Contracturen | Alleen maandtotaal tonen als indicatie |

### Ronde- en bronregels

| Regel | Uitkomst |
| --- | --- |
| R4-maand zonder recente iCal | `waarschuwing` |
| R3-maand zonder conceptinformatie | `aandacht` |
| R2-maand met veel onbevestigde diensten | `aandacht` |
| R1-maand zonder wensen | `keuze_nodig` |
| Screenshotbron niet bevestigd | `gegevens_aanvullen` |

## Van analyse naar actie-item

Niet ieder `AnalyseResultaat` wordt een los actie-item. De app groepeert resultaten die bij dezelfde oplossing horen.

### Groepeerregels

| Situatie | Actie-item |
| --- | --- |
| Meerdere conflicten op dezelfde dag | Een dagactie |
| Een dienst veroorzaakt meerdere problemen | Een dienstactie |
| Meerdere ontbrekende tijden in dezelfde maand | Een gegevensactie |
| Een keuze-aanvraag met meerdere opties | Een keuzeactie |
| Een ruilwens met kandidaten | Een ruilactie |

### Actietypes

| Type | Betekenis |
| --- | --- |
| `gegevens_aanvullen` | Tijd, persoon, bron of code ontbreekt |
| `ruil_nodig` | Dienst geeft conflict of sterke wens tot ruil |
| `opvang_regelen` | Gezinsdekking ontbreekt |
| `keuze_maken` | Instructeursdag of optie kiezen |
| `planner_vragen` | Planner/manager moet bevestigen of aanpassen |
| `collega_vragen` | Collega nodig voor ruil of afstemming |
| `controleren` | Bronverschil of verdachte import controleren |
| `geen_actie` | Alleen zichtbaar als bewust afgehandelde melding |

### Deadlines

Deadlines worden automatisch voorgesteld.

| Situatie | Deadline |
| --- | --- |
| Keuze-aanvraag met eigen deadline | Deadline uit `KeuzeAanvraag` |
| Conflict in gepubliceerde maand | Zo snel mogelijk, uiterlijk 3 dagen voor datum |
| Ronde-2-onzekerheid | Voor overgang naar ronde 3 |
| Ronde-3-risico | Voor publicatie of managerdeadline |
| Ontbrekende import | Vandaag of eerstvolgende controlemoment |

## Maandstatus bepalen

Na analyse krijgt iedere maand een `samenvattingStatus`.

| Status | Voorwaarde |
| --- | --- |
| `goed` | Geen open waarschuwingen, conflicten of urgente acties |
| `aandacht` | Alleen aandachtspunten of normale open acties |
| `conflict` | Minstens een open `conflict` of `blokkade` |
| `onvolledig` | Te weinig gegevens om betrouwbaar te analyseren |

Voorrang:

1. `conflict` als er een open hard conflict is.
2. `onvolledig` als basisdata mist.
3. `aandacht` als er waarschuwingen of keuzes openstaan.
4. `goed` als niets openstaat.

## Gebruikersschermen

### 1. Maandcockpit

Doel: in een oogopslag zien hoe de maand ervoor staat.

Toont:

| Onderdeel | Voorbeeld |
| --- | --- |
| Status | `conflict` |
| Ronde | `R4_gepubliceerd` |
| Open acties | 3 |
| Hoogste risico | `Kind halen 15 september` |
| Laatste import | `iCal jij vandaag 09:12` |

### 2. Actielijst

De actielijst is de belangrijkste werkweergave.

Kolommen:

| Kolom | Inhoud |
| --- | --- |
| Prioriteit | urgent, hoog, normaal, laag |
| Deadline | Datum waarop actie nodig is |
| Titel | Korte actie |
| Type | ruil, opvang, keuze, controle |
| Status | open, bezig, wacht op ander |
| Actie | openen, oplossen, negeren |

### 3. Analyse-detail

Voor controle kan de gebruiker een melding openen.

Toont:

1. Welke regel afging.
2. Welke diensten of verplichtingen betrokken zijn.
3. Welke bronnen gebruikt zijn.
4. Waarom deze ernst gekozen is.
5. Welk actie-item eraan gekoppeld is.

### 4. Ruiladvies

Bij een ruilactie toont de app:

| Onderdeel | Inhoud |
| --- | --- |
| Probleemdienst | Dienst die conflict geeft |
| Beste ruil | Hoogste `RuilKandidaat.score` |
| Effect gezin | verbetert, neutraal, verslechtert |
| Effect rust | verbetert, neutraal, verslechtert |
| Uitleg | Korte reden waarom dit advies logisch is |

## Voorbeeld: kind ophalen conflict

Situatie:

```json
{
  "diensten": [
    {
      "id": "dienst_2026-09-15_jij_laat",
      "persoonId": "persoon_jij",
      "datum": "2026-09-15",
      "start": "14:00",
      "einde": "23:00",
      "status": "gepubliceerd"
    },
    {
      "id": "dienst_2026-09-15_vrouw_dag",
      "persoonId": "persoon_vrouw",
      "datum": "2026-09-15",
      "start": "08:00",
      "einde": "17:00",
      "status": "gepubliceerd"
    }
  ],
  "gezinsVerplichtingen": [
    {
      "id": "gezin_2026-09-15_school_halen",
      "type": "school_halen",
      "datum": "2026-09-15",
      "start": "15:00",
      "einde": "15:30",
      "hardheid": "hard",
      "dekkingNodig": true
    }
  ]
}
```

AnalyseResultaat:

```json
{
  "id": "analyse_2026-09-15_kinddekking",
  "maandPlanningId": "2026-09",
  "datum": "2026-09-15",
  "ernst": "conflict",
  "categorie": "gezin",
  "regelId": "regel_kind_dekking",
  "betrokkenDienstIds": [
    "dienst_2026-09-15_jij_laat",
    "dienst_2026-09-15_vrouw_dag"
  ],
  "melding": "Geen ouder beschikbaar tijdens school halen",
  "advies": "Zoek ruil voor late dienst, vraag opvang of regel iemand voor school halen",
  "actieStatus": "open"
}
```

ActieItem:

```json
{
  "id": "actie_2026-09-15_kinddekking",
  "maandPlanningId": "2026-09",
  "titel": "School halen op 15 september oplossen",
  "type": "opvang_regelen",
  "prioriteit": "hoog",
  "status": "open",
  "deadline": "2026-09-12",
  "gekoppeldeAnalyseIds": [
    "analyse_2026-09-15_kinddekking"
  ]
}
```

## Voorbeeld: instructeursoptie kiezen

Situatie:

```json
{
  "keuzeAanvragen": [
    {
      "id": "keuze_instr_week42",
      "persoonId": "persoon_vrouw",
      "type": "instructeursdag",
      "deadline": "2026-09-20",
      "responseStatus": "nog_beoordelen"
    }
  ]
}
```

AnalyseResultaat:

```json
{
  "id": "analyse_keuze_instr_week42",
  "maandPlanningId": "2026-10",
  "datum": "2026-10-12",
  "ernst": "keuze_nodig",
  "categorie": "werk",
  "regelId": "regel_keuzeaanvraag_open",
  "betrokkenDienstIds": [],
  "melding": "Instructeursoptie moet nog gekozen worden",
  "advies": "Kies de optie met beste gezinsdekking en minste roosterimpact",
  "actieStatus": "open"
}
```

ActieItem:

```json
{
  "id": "actie_keuze_instr_week42",
  "maandPlanningId": "2026-10",
  "titel": "Instructeursdag week 42 kiezen",
  "type": "keuze_maken",
  "prioriteit": "hoog",
  "status": "open",
  "deadline": "2026-09-20",
  "gekoppeldeAnalyseIds": [
    "analyse_keuze_instr_week42"
  ]
}
```

## Minimale versie voor implementatie

Voor een eerste werkende versie is genoeg:

1. Analyse per maand na iedere wijziging.
2. Controle op ontbrekende gegevens.
3. Controle op overlappende diensten.
4. Controle op gezinsdekking bij harde gezinsverplichtingen.
5. Ronde-afhankelijke ernst voor onzekerheden.
6. Automatisch aanmaken en bijwerken van actie-items.
7. Maandstatus berekenen uit open analyses en acties.

Ruilscore, arbeidstijdregels en geavanceerde voorkeurweging kunnen daarna volgen.

## Wat Module 3 beslist

Deze module legt vast:

1. Analyse draait per maand en gebruikt de maandstatus als context.
2. Volledigheid wordt eerst gecontroleerd, daarna harde conflicten, daarna voorkeuren en ruilkansen.
3. Ernst is afhankelijk van probleemtype en planningstage.
4. Waarschuwingen moeten zoveel mogelijk naar concrete actie-items worden vertaald.
5. Actie-items worden gegroepeerd zodat de gebruiker geen dubbele taken krijgt.
6. De maandstatus wordt afgeleid uit open conflicten, onvolledigheid en acties.
7. De eerste implementatie richt zich op gegevenscontrole, gezinsdekking, overlap en actie-items.

## Volgende module

De logische volgende module is:

**Module 4 - Maandcockpit en gebruikersinterface**

Daarin bepalen we hoe de gebruiker maanden, acties, conflicten, import en ruiladvies snel kan bekijken en afhandelen.
