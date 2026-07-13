# Module 6 - Eerste technische implementatie roostercoach

## Waar deze module over gaat

Deze module vertaalt Module 1 tot en met 5 naar een eerste werkende versie van de roostercoach. Dit is geen extra conceptueel ontwerp, maar een bouwplan: welke bestanden maken we, welke functies moeten bestaan, welke schermen komen eerst en wat is de minimale app die je echt kunt openen en gebruiken.

De kernvraag is:

> Wat moet er technisch minimaal gebouwd worden zodat de roostercoach lokaal werkt, maanden kan tonen, diensten en blokkades kan opslaan, analyse-acties maakt en backups kan downloaden of terugzetten?

Daarin bepalen we:

1. De eerste bestandsstructuur.
2. De minimale schermen.
3. De JavaScript-datastructuur.
4. De kernfuncties voor maand, invoer, analyse, autosave en backup.
5. De implementatievolgorde.
6. Wat bewust nog niet in versie 1 hoeft.

## Hoofdprincipes

1. **Eerst een werkende lokale app**
   De eerste versie moet zonder server te openen zijn via `index.html` en alle data lokaal bewaren.

2. **Een klein aantal bestanden**
   Start met gewone HTML, CSS en JavaScript. Geen framework zolang de app nog compact is.

3. **De maandcockpit is het hart**
   De gebruiker moet een maand kunnen openen, diensten en blokkades kunnen invoeren en direct acties of waarschuwingen zien.

4. **Analyse mag simpel zijn, maar moet echt draaien**
   Liever vijf betrouwbare regels die zichtbaar actie-items maken dan een grote adviesmotor die nog niet bruikbaar is.

5. **Autosave en backup zitten vanaf het begin in de app**
   Data mag niet verdwijnen door verversen. De gebruiker moet altijd een JSON-backup kunnen downloaden.

6. **Import wordt voorbereid, maar niet leidend**
   De eerste versie krijgt een importcontrole-scherm als plaats in de interface, maar echte iCal/PDF-parsers kunnen later volgen.

## Eerste bestandsstructuur

Voor de eerste lokale versie zijn drie bestanden genoeg.

```text
index.html
style.css
app.js
```

Later kunnen serverbestanden worden toegevoegd.

```text
save.php
load.php
backup.php
health.php
data/roostercoach-data.json
data/backups/
```

### Bestand: index.html

Doel:

1. Basisstructuur van de app.
2. Navigatie tussen maandoverzicht, maandcockpit, actielijst, snelle invoer, importcontrole en backup.
3. Containers waarin JavaScript de actuele data rendert.
4. Forms voor handmatige invoer.
5. Knoppen voor backup downloaden, backup terugzetten en lokale data wissen.

Belangrijke onderdelen:

```html
<section id="view-months"></section>
<section id="view-cockpit"></section>
<section id="view-actions"></section>
<section id="view-quick-entry"></section>
<section id="view-import"></section>
<section id="view-backup"></section>
```

### Bestand: style.css

Doel:

1. Rustige, mobiele layout.
2. Statuskleuren voor `goed`, `aandacht`, `conflict` en `onvolledig`.
3. Compacte maandkaarten.
4. Agenda-lijst of eenvoudige maandgrid.
5. Duidelijke actiekaarten.
6. Formulieren die op telefoon goed te gebruiken zijn.

Eerste CSS-onderdelen:

```text
.app-shell
.topbar
.view
.month-card
.status-good
.status-attention
.status-conflict
.status-incomplete
.action-card
.day-row
.quick-form
.toolbar
```

### Bestand: app.js

Doel:

1. Data laden en opslaan.
2. Maanden aanmaken en openen.
3. Diensten, wensen en gezinsblokkades toevoegen of bewerken.
4. Analyse draaien.
5. Acties genereren en status wijzigen.
6. Schermen renderen.
7. Backup exporteren en importeren.

## Minimale datastructuur in JavaScript

De eerste versie gebruikt een compacte vorm van het datamodel uit Module 1.

```js
const STORAGE_KEY = "roostercoach.data.v1";
const SNAPSHOT_KEY = "roostercoach.snapshots.v1";

const roostercoachData = {
  dataVersion: 1,
  appVersion: "0.1.0",
  revisionId: "",
  lastModified: "",
  personen: [
    { id: "persoon_jij", naam: "Jij", rol: "ouder", actief: true },
    { id: "persoon_vrouw", naam: "Vrouw", rol: "ouder", actief: true }
  ],
  kinderen: [],
  maandPlanningen: [],
  diensten: [],
  gezinsVerplichtingen: [],
  wensen: [],
  bronnen: [
    { id: "bron_handmatig", type: "handmatig", naam: "Handmatig", betrouwbaarheid: "normaal" }
  ],
  imports: [],
  snapshots: [],
  analyseResultaten: [],
  actieItems: [],
  instellingen: {
    actieveMaandId: null,
    standaardPlanningStage: "R1_wensen"
  },
  wijzigingsLog: []
};
```

Voor versie 1 hoeven nog niet alle velden uit Module 1 in ieder object verplicht ingevuld te worden. De structuur moet wel zo gekozen zijn dat uitbreiden naar iCal, PDF, server-sync en ruiladvies later logisch blijft.

## Eerste schermen

### 1. Maandoverzicht

Doel: alle maanden snel scannen.

Moet kunnen:

1. Bestaande maanden tonen.
2. Nieuwe maand aanmaken.
3. Maand openen.
4. Per maand ronde, status en aantal open acties tonen.

Minimale kaart:

```text
September 2026
R4 - gepubliceerd
Status: conflict
3 open acties
Open maand
```

### 2. Maandcockpit

Doel: een maand echt gebruiken.

Moet tonen:

1. Maandnaam en planningstage.
2. SamenvattingStatus.
3. Belangrijkste open acties.
4. Daglijst met diensten en gezinsblokkades.
5. Knoppen voor snelle invoer.
6. Knop om analyse opnieuw te draaien.

Voor versie 1 is een agenda-lijst genoeg. Een volledige kalendergrid kan later.

### 3. Actielijst

Doel: werkvoorraad afhandelen.

Moet kunnen:

1. Open acties tonen.
2. Filteren op maand.
3. Status wijzigen naar `open`, `bezig`, `wacht_op_ander`, `opgelost` of `genegeerd`.
4. Bijbehorende analyse tonen.

### 4. Snelle invoer

Doel: zonder import toch bruikbare data invoeren.

Minimale invoertypes:

1. Dienst toevoegen.
2. Gezinsblokkade of kindmoment toevoegen.
3. Wens toevoegen.
4. Ruilwens bij bestaande dienst zetten.

Minimale velden voor dienst:

| Veld | Type |
| --- | --- |
| Maand | keuze |
| Persoon | keuze |
| Datum | datum |
| Start | tijd |
| Einde | tijd |
| Diensttype | keuze |
| Status | keuze |
| Opmerking | tekst |

Minimale velden voor gezinsblokkade:

| Veld | Type |
| --- | --- |
| Maand | keuze |
| Datum | datum |
| Start | tijd |
| Einde | tijd |
| Type | keuze |
| Dekking nodig | ja/nee |
| Hardheid | hard/zacht |
| Opmerking | tekst |

### 5. Importcontrole

Doel: alvast de plek hebben waar import later landt.

Voor versie 1 hoeft dit scherm alleen te tonen:

1. Import komt later.
2. Handmatige invoer is nu de hoofdroute.
3. Eventuele importdrafts uit localStorage.
4. Knop om een JSON-backup terug te zetten.

Echte iCal-import, PDF-parser en verschillencontrole mogen naar Module 7.

### 6. Backup/export

Doel: data veilig houden.

Moet kunnen:

1. Backup downloaden als JSON.
2. Backupbestand kiezen en terugzetten.
3. Snapshot maken voor terugzetten.
4. Lokale data wissen na bevestiging.
5. Autosave-status tonen.

## Kernfuncties

### Data en opslag

| Functie | Doel |
| --- | --- |
| `createEmptyData()` | Maakt een lege dataset met standaardpersonen en instellingen |
| `loadData()` | Leest `roostercoach.data.v1` uit `localStorage` |
| `saveData(reason)` | Schrijft hoofddata naar `localStorage` en werkt metadata bij |
| `createSnapshot(reason)` | Bewaart herstelpunt voor risicovolle acties |
| `downloadBackup()` | Downloadt volledige dataset als JSON |
| `restoreBackup(file)` | Valideert en zet JSON-backup terug |
| `clearLocalData()` | Wist lokale data alleen na bevestiging |

### Maanden

| Functie | Doel |
| --- | --- |
| `createMonth(year, month, planningStage)` | Maakt maandplanning als die nog niet bestaat |
| `openMonth(monthId)` | Zet actieve maand en toont maandcockpit |
| `getMonth(monthId)` | Haalt maandplanning op |
| `updateMonthStatus(monthId)` | Berekent `samenvattingStatus` |
| `getMonthLabel(monthId)` | Geeft bijvoorbeeld `September 2026` |

### Invoer

| Functie | Doel |
| --- | --- |
| `addService(input)` | Voegt dienst toe |
| `updateService(serviceId, patch)` | Bewerkt dienst |
| `deleteManualService(serviceId)` | Verwijdert alleen handmatige/foutieve dienst na bevestiging |
| `addFamilyBlock(input)` | Voegt gezinsverplichting toe |
| `addWish(input)` | Voegt wens toe |
| `markSwapWanted(serviceId)` | Zet dienst op ruilbehoefte |

### Analyse

| Functie | Doel |
| --- | --- |
| `runAnalysis(monthId)` | Draait alle minimale regels voor een maand |
| `clearGeneratedAnalysis(monthId)` | Verwijdert oude gegenereerde analyse voor die maand |
| `checkMissingCoverage(context)` | Controleert kind/gezinsdekking |
| `checkServiceBlockConflicts(context)` | Controleert dienst tegenover blokkade |
| `checkBothParentsBusy(context)` | Controleert of beide ouders tegelijk bezet zijn |
| `checkStageNeedsAction(context)` | Controleert ronde-status en ontbrekende data |
| `checkImportConflicts(context)` | Controleert importconflicten zodra importdata bestaat |
| `createOrUpdateAction(result)` | Maakt of werkt actie-item bij |
| `syncActionsWithAnalysis(monthId)` | Zet verdwenen acties eventueel op `vervallen` |

### Rendering

| Functie | Doel |
| --- | --- |
| `renderApp()` | Rendert huidige view |
| `renderMonthOverview()` | Toont maandoverzicht |
| `renderMonthCockpit(monthId)` | Toont maandcockpit |
| `renderActionList(filters)` | Toont actielijst |
| `renderQuickEntry()` | Toont snelle invoer |
| `renderImportControl()` | Toont importcontrole |
| `renderBackupView()` | Toont backup/export |
| `showView(viewName)` | Wisselt tussen schermen |

### Helpers

| Functie | Doel |
| --- | --- |
| `generateId(prefix)` | Maakt simpele unieke id |
| `dateToMonthId(date)` | Maakt `2026-09` uit datum |
| `timesOverlap(aStart, aEnd, bStart, bEnd)` | Controleert overlap |
| `serviceCoversPersonBusy(service, block)` | Bepaalt of dienst blokkeert |
| `isParentAvailable(personId, block, services)` | Bepaalt dekking |
| `formatDate(date)` | Nederlandse datumweergave |
| `formatTimeRange(start, end)` | `14:00-23:00` |

## Minimale analyse-engine

De eerste analyse-engine draait per maand en gebruikt alleen data die lokaal aanwezig is.

### Regel 1: kind of gezinsmoment heeft geen dekking

Voor iedere `GezinsVerplichting` met `dekkingNodig: true`:

1. Kijk of `persoon_jij` bezet is tijdens het blok.
2. Kijk of `persoon_vrouw` bezet is tijdens het blok.
3. Als beide bezet zijn: maak `AnalyseResultaat` met ernst `conflict`.
4. Maak of update `ActieItem` van type `opvang_regelen`.

### Regel 2: dienst botst met blokkade

Voor iedere dienst:

1. Zoek harde gezins- of persoonlijke blokkades op dezelfde datum.
2. Controleer tijdoverlap.
3. Maak waarschuwing of conflict afhankelijk van hardheid.
4. Koppel de betrokken dienst aan het analyse-resultaat.

### Regel 3: beide ouders tegelijk bezet

Voor iedere dag:

1. Vergelijk diensten van beide ouders.
2. Als ze overlappen, markeer dit als aandachtspunt.
3. Als er in die overlap ook dekking nodig is, wordt het conflict via regel 1 aangemaakt.

### Regel 4: ronde-status vraagt nog actie

Per maand:

| PlanningStage | Minimale controle |
| --- | --- |
| `R1_wensen` | Geen wensen of blokkades ingevuld geeft `keuze_nodig` |
| `R2_afstemming` | Onzekere diensten zonder actie geven `aandacht` |
| `R3_manager` | Waarschijnlijke diensten zonder controle geven `waarschuwing` |
| `R4_gepubliceerd` | Geen diensten voor een ouder geeft `onvolledig` |

### Regel 5: import heeft conflicten

Voor versie 1 is deze regel voorbereid:

1. Als `imports` items met `matchStatus: "conflict"` bevat, toon actie `controleren`.
2. Als er geen imports zijn, doet de regel niets.

## Eerste app-flow

### Opstarten

1. `loadData()` probeert lokale data te lezen.
2. Als er geen data is, maakt `createEmptyData()` een startdataset.
3. De app maakt eventueel de huidige en komende maanden aan.
4. `renderMonthOverview()` toont het startscherm.

### Handmatige dienst toevoegen

1. Gebruiker opent maandcockpit.
2. Gebruiker kiest `Dienst toevoegen`.
3. Formulier wordt ingevuld.
4. `addService(input)` schrijft dienst naar data.
5. `runAnalysis(monthId)` draait opnieuw.
6. `saveData("dienst_toegevoegd")` slaat lokaal op.
7. Maandcockpit wordt opnieuw gerenderd.

### Gezinsblokkade toevoegen

1. Gebruiker kiest `Blokkade toevoegen`.
2. App bewaart `GezinsVerplichting`.
3. Analyse controleert direct dekking.
4. Eventueel verschijnt actie `opvang_regelen`.

### Actie afhandelen

1. Gebruiker opent actielijst.
2. Gebruiker zet actie op `bezig`, `wacht_op_ander`, `opgelost` of `genegeerd`.
3. App logt wijziging.
4. App slaat lokaal op.
5. Maandstatus wordt bijgewerkt.

### Backup maken

1. Gebruiker opent backup/export.
2. Gebruiker klikt `Backup downloaden`.
3. App maakt JSON met data en metadata.
4. Browser downloadt `roostercoach-backup-jjjj-mm-dd-uu-mm.json`.

### Backup terugzetten

1. Gebruiker kiest backupbestand.
2. App valideert `dataVersion` en basisvelden.
3. App maakt snapshot van huidige data.
4. App vervangt lokale data na bevestiging.
5. Analyse draait opnieuw voor alle maanden.

## Implementatievolgorde

### Stap 1: basis HTML/CSS/JS

Maak:

1. `index.html`.
2. `style.css`.
3. `app.js`.
4. Navigatie tussen views.
5. Lege renderfuncties.

Resultaat: de app opent en wisselt tussen schermen.

### Stap 2: lokaal datamodel

Maak:

1. `createEmptyData()`.
2. `loadData()`.
3. `saveData()`.
4. Basisdata met personen en maanden.

Resultaat: data blijft bestaan na refresh.

### Stap 3: maandoverzicht en maandcockpit

Maak:

1. Maandkaarten.
2. Maand openen.
3. Cockpitkop met status.
4. Daglijst met diensten en blokkades.

Resultaat: de gebruiker kan een maand openen.

### Stap 4: handmatige invoer

Maak:

1. Dienstformulier.
2. Blokkadeformulier.
3. Wensformulier.
4. Bewerken of verwijderen van handmatige items.

Resultaat: de gebruiker kan echte roosterdata invoeren.

### Stap 5: analyse-acties

Maak:

1. `runAnalysis(monthId)`.
2. Regels voor dekking, overlap en ronde-status.
3. Actie-items genereren.
4. Maandstatus bijwerken.

Resultaat: de app geeft waarschuwingen en concrete acties.

### Stap 6: actielijst

Maak:

1. Open acties tonen.
2. Status wijzigen.
3. Filter op maand.
4. Analyse-detail tonen.

Resultaat: de gebruiker kan de werkvoorraad afhandelen.

### Stap 7: autosave, backup en restore

Maak:

1. Autosave-status.
2. Backup downloaden.
3. Backup terugzetten.
4. Snapshot voor restore.
5. Lokale data wissen na bevestiging.

Resultaat: de lokale app is veilig bruikbaar.

### Stap 8: importvoorbereiding

Maak:

1. Importcontrole-scherm.
2. Plaats voor importdrafts.
3. Voorbereide functies en datastructuur.
4. Nog geen echte parser.

Resultaat: Module 7 kan import toevoegen zonder de appstructuur om te gooien.

## Wat nog niet in versie 1 hoeft

Bewust later:

1. Echte server-sync.
2. `save.php`, `load.php`, `backup.php` en `health.php`.
3. PDF-parser.
4. Volledige iCal-import.
5. Screenshotherkenning.
6. Complexe ruiloptimalisatie.
7. Arbeidstijdenwet volledig narekenen.
8. Meerdere gebruikersaccounts.
9. Inloggen of rechtenbeheer.
10. Pushmeldingen.
11. Automatische AI-advieslogica.
12. Geavanceerde kalenderweergave met drag-and-drop.

Deze onderdelen mogen pas komen als de lokale versie betrouwbaar data kan invoeren, analyseren, bewaren en herstellen.

## Minimale versie die echt bruikbaar is

Versie 1 is geslaagd als dit kan:

1. App openen via `index.html`.
2. Maand aanmaken.
3. Maand openen.
4. Dienst toevoegen voor jou of je vrouw.
5. Gezinsblokkade toevoegen.
6. App toont conflict als beide ouders bezet zijn tijdens een kindmoment.
7. App maakt een actie-item.
8. Actie kan op `wacht_op_ander` of `opgelost` worden gezet.
9. Data blijft staan na refresh.
10. Backup kan worden gedownload.
11. Backup kan worden teruggezet.
12. Lokale data kan bewust worden gewist.

## Eerste technische acceptatiecheck

Na bouwen van versie 1 moet dit handmatig getest worden:

| Test | Verwacht resultaat |
| --- | --- |
| Open `index.html` | Maandoverzicht verschijnt |
| Maak maand September 2026 | Maandkaart verschijnt |
| Voeg dienst jij 14:00-23:00 toe | Dienst staat in maandcockpit |
| Voeg dienst vrouw 08:00-17:00 toe | Beide diensten staan op dezelfde dag |
| Voeg school halen 15:00-15:30 toe | Conflict en actie verschijnen |
| Zet actie op `wacht_op_ander` | Status blijft zichtbaar na refresh |
| Download backup | JSON-bestand wordt gedownload |
| Wis lokale data | App keert terug naar lege start |
| Zet backup terug | Maand, diensten en acties zijn terug |

## Wat Module 6 beslist

Deze module legt vast:

1. De eerste app bestaat uit `index.html`, `style.css` en `app.js`.
2. De eerste versie werkt lokaal met `localStorage`.
3. De maandcockpit, actielijst, snelle invoer, importcontrole en backup/export komen eerst.
4. De JavaScript-data volgt het datamodel uit Module 1, maar start compact.
5. Analyse begint met eenvoudige regels voor dekking, overlap, ronde-status en importconflicten.
6. Autosave, backup downloaden en backup terugzetten zijn onderdeel van versie 1.
7. Server-sync, iCal, PDF, AI-advies en complexe ruiloptimalisatie komen pas na de eerste werkende app.

## Volgende module

De logische volgende module is:

**Module 7 - Uitbreiding, import, testen en deployment**

Daarin kunnen we bepalen hoe echte iCal-import, PDF-controle, serverkoppeling, testscenario's, webserver-deployment en later AI/advieslogica worden toegevoegd aan de werkende basis uit Module 6.
