# Module 8 - Bouwplan en implementatiestappen

## Waar deze module over gaat

Module 1 tot en met 7 beschrijven wat de roostercoach moet zijn: datamodel, import, analyse, maandcockpit, opslag, technische basis, uitbreiding, testen en deployment.

Module 8 vertaalt dat naar echt bouwwerk.

De kernvraag is:

> Welke bestanden, schermen, JavaScript-functies, PHP-endpoints en tests bouwen we in welke volgorde, zodat er stap voor stap een werkende roostercoach ontstaat?

Daarin bepalen we:

1. Welke bestanden er komen.
2. Welke HTML-schermen nodig zijn.
3. Welke JavaScript-onderdelen eerst gebouwd worden.
4. Welke PHP-endpoints nodig zijn.
5. In welke volgorde de basisapp wordt gemaakt.
6. Welke tests per stap horen.
7. Wanneer een stap klaar genoeg is om door te gaan.

## Hoofdprincipes

1. **Eerst bruikbaar, daarna slim**
   De eerste app moet maanden, diensten, gezinsblokkades, acties, autosave en backup echt kunnen gebruiken voordat import, sync of AI belangrijk wordt.

2. **Lokaal werkt altijd**
   `index.html`, `style.css` en `app.js` vormen de basis. De app moet zonder server kunnen openen en doorwerken.

3. **Elke bouwstap heeft een zichtbare test**
   Een stap is pas klaar als je hem in de browser kunt controleren of met een endpoint-test kunt bewijzen.

4. **Import komt via controle**
   iCal, PDF en tekstimport mogen nooit stil gegevens overschrijven. Importregels worden eerst conceptregels.

5. **Server-sync komt pas na lokale veiligheid**
   `save.php`, `load.php`, `backup.php` en `health.php` worden pas leidend nadat localStorage, backup en restore betrouwbaar zijn.

6. **Geen grote frameworks in de eerste versie**
   De basis wordt gewone HTML, CSS, JavaScript en PHP. Later kan dit worden opgesplitst of gemoderniseerd als de app te groot wordt.

## Doelstructuur van de bestanden

### Fase A: lokale basisapp

```text
index.html
style.css
app.js
```

Deze drie bestanden moeten samen al een bruikbare lokale roostercoach vormen.

### Fase B: voorbeelddata en testdata

```text
tests/
  fixtures/
    basis-september-2026.json
    conflict-kinddekking-2026-09.json
    backup-minimaal-v1.json
```

Deze bestanden helpen om vaste scenario's opnieuw te testen.

### Fase C: importuitbreiding

```text
app.js
tests/
  fixtures/
    intus-jij-voorbeeld.ics
    intus-vrouw-voorbeeld.ics
    pdf-tekst-rooster-voorbeeld.txt
```

In de eerste versie blijft importcode in `app.js`. Pas als het bestand te groot wordt, splitsen we naar losse modules.

Mogelijke latere splitsing:

```text
js/
  data-store.js
  render.js
  analysis.js
  import-ical.js
  import-pdf.js
  sync.js
```

### Fase D: serveropslag

```text
health.php
load.php
save.php
backup.php
data/
  .htaccess
  roostercoach-data.json
  backups/
    .htaccess
```

### Fase E: deployment en controle

```text
webserver.example.env
webserver.env
upload-to-strato.ps1
download-from-strato.ps1
test-webserver.ps1
publish-to-strato.ps1
STRATO-KOPPELING.md
```

`webserver.env` wordt lokaal ingevuld en bevat geen wachtwoorden in documentatie of chat.

## HTML-schermen

De eerste `index.html` bevat geen losse pagina's, maar meerdere views die JavaScript toont en verbergt.

```html
<section id="view-months"></section>
<section id="view-cockpit"></section>
<section id="view-day-detail"></section>
<section id="view-actions"></section>
<section id="view-quick-entry"></section>
<section id="view-import"></section>
<section id="view-backup"></section>
<section id="view-settings"></section>
```

### 1. Maandoverzicht

Doel: snel zien welke maanden aandacht vragen.

Moet tonen:

1. Maandnaam.
2. PlanningStage.
3. SamenvattingStatus.
4. Aantal open acties.
5. Laatste importstatus.
6. Knop om maand te openen.
7. Knop om nieuwe maand aan te maken.

Eerste test:

| Actie | Verwacht resultaat |
| --- | --- |
| Open lege app | Maandoverzicht verschijnt |
| Maak maand September 2026 | Maandkaart verschijnt |
| Refresh browser | Maandkaart blijft staan |

### 2. Maandcockpit

Doel: de maand beoordelen en bewerken.

Moet tonen:

1. Maandkop met ronde, status en primaire actie.
2. Actiestrook met urgente open acties.
3. Agenda-lijst per dag.
4. Diensten van jou en je vrouw.
5. Gezinsverplichtingen en blokkades.
6. Importstatusblok.
7. Knoppen voor snelle invoer, analyse opnieuw draaien en backup.

Eerste test:

| Actie | Verwacht resultaat |
| --- | --- |
| Open September 2026 | Cockpit opent met daglijst |
| Voeg dienst toe | Dienst verschijnt op juiste datum |
| Voeg gezinsblokkade toe | Blokkade verschijnt op juiste datum |

### 3. Dagdetail

Doel: een dag kunnen inspecteren zonder de hele maand te overladen.

Moet tonen:

1. Alle diensten op die datum.
2. Alle gezinsblokkades op die datum.
3. Gekoppelde analyse-resultaten.
4. Gekoppelde acties.
5. Bewerken of verwijderen van handmatige items.

Eerste test:

| Actie | Verwacht resultaat |
| --- | --- |
| Klik dag met conflict | Dagdetail toont dienst, blokkade en actie |
| Bewerk handmatige blokkade | Analyse draait opnieuw |

### 4. Actielijst

Doel: werkvoorraad afhandelen.

Moet tonen:

1. Open, bezig en wacht-op-ander acties.
2. Filter op maand.
3. Filter op prioriteit of type.
4. Statusknoppen.
5. Analyse-detail bij de actie.

Eerste test:

| Actie | Verwacht resultaat |
| --- | --- |
| Maak conflict | Actie verschijnt in actielijst |
| Zet actie op `wacht_op_ander` | Status blijft na refresh |
| Zet actie op `opgelost` | Actie verdwijnt uit standaard open lijst |

### 5. Snelle invoer

Doel: zonder import toch echte roosterdata kunnen invullen.

Moet invoer ondersteunen voor:

1. Dienst.
2. Gezinsverplichting.
3. Wens.
4. Ruilbehoefte.
5. Keuze-aanvraag of instructeursoptie in eenvoudige vorm.

Eerste test:

| Actie | Verwacht resultaat |
| --- | --- |
| Voeg dienst voor jou toe | Dienst staat in data en maandcockpit |
| Voeg school-halen moment toe | Gezinsverplichting staat in cockpit |
| Voeg wens toe | Wens wordt bewaard en zichtbaar in maandcontext |

### 6. Importcontrole

Doel: iCal, PDF of tekst eerst controleren voordat de app data definitief opslaat.

Moet tonen:

1. Bronkeuze.
2. Bestand uploaden of tekst plakken.
3. Importprofiel kiezen: jij, vrouw, school, overig.
4. Gevonden regels.
5. Nieuwe regels, wijzigingen, duplicaten en conflicten.
6. Bevestigen, overslaan of annuleren.

Eerste test:

| Actie | Verwacht resultaat |
| --- | --- |
| Plak iCal-tekst | Importregels verschijnen |
| Bevestig import | Diensten verschijnen in maandcockpit |
| Importeer zelfde tekst opnieuw | Geen dubbele diensten |

### 7. Backup en herstel

Doel: data veilig houden.

Moet kunnen:

1. Backup downloaden.
2. Backup terugzetten.
3. Snapshot maken.
4. Lokale data wissen na bevestiging.
5. Autosave- en syncstatus tonen.

Eerste test:

| Actie | Verwacht resultaat |
| --- | --- |
| Download backup | JSON-bestand bevat roostercoach-data |
| Wis lokale data | App keert terug naar lege start |
| Zet backup terug | Maanden, diensten en acties zijn terug |

### 8. Instellingen en sync

Doel: bronprofielen, appversie en serverkoppeling beheren.

Moet tonen:

1. Personen en standaardnamen.
2. Importprofielen.
3. Appversie.
4. Serverstatus.
5. Knoppen voor online laden, online opslaan en synchroniseren.

Deze view mag in de eerste lokale versie nog beperkt zijn.

## JavaScript-bouwblokken

De eerste `app.js` wordt in duidelijke blokken opgebouwd.

### 1. Configuratie en constante waarden

```js
const APP_VERSION = "2026-07-13-module8-basis-1";
const STORAGE_KEY = "roostercoach.data.v1";
const SNAPSHOT_KEY = "roostercoach.snapshots.v1";
const IMPORT_DRAFT_KEY = "roostercoach.importDraft.v1";
```

Nodig voor:

1. Versie tonen.
2. Cachecontrole.
3. LocalStorage.
4. Backup-validatie.

### 2. Data aanmaken en migreren

Eerst bouwen:

| Functie | Doel |
| --- | --- |
| `createEmptyData()` | Lege dataset met standaardpersonen |
| `createDefaultMonths()` | Startmaanden met juiste PlanningStage |
| `normalizeData(raw)` | Ontbrekende arrays en velden aanvullen |
| `migrateData(raw)` | Later dataversies omzetten |
| `validateData(data)` | Basiscontrole voor backup en restore |

Eerste test:

1. App opent zonder bestaande localStorage.
2. Data bevat personen, maandPlanningen, diensten, acties en instellingen.
3. Oude of incomplete backup wordt niet blind geaccepteerd.

### 3. Opslag, autosave en backup

Eerst bouwen:

| Functie | Doel |
| --- | --- |
| `loadData()` | Data uit localStorage lezen |
| `saveData(reason)` | Data opslaan met revisionId en lastModified |
| `createSnapshot(reason)` | Herstelpunt maken |
| `downloadBackup()` | JSON-backup downloaden |
| `restoreBackup(file)` | Backup valideren en terugzetten |
| `clearLocalData()` | Alles lokaal wissen na bevestiging |
| `logChange(type, details)` | Wijzigingslog bijhouden |

Eerste test:

1. Dienst toevoegen.
2. Browser refreshen.
3. Dienst blijft bestaan.
4. Backup downloaden.
5. Data wissen.
6. Backup terugzetten.

### 4. Maanden en navigatie

Eerst bouwen:

| Functie | Doel |
| --- | --- |
| `createMonth(year, month, planningStage)` | Maand aanmaken |
| `openMonth(monthId)` | Actieve maand instellen |
| `getMonth(monthId)` | Maand ophalen |
| `getMonthLabel(monthId)` | Nederlandse maandnaam |
| `showView(viewName)` | View wisselen |
| `renderApp()` | Huidige view renderen |

Eerste test:

1. Maand aanmaken.
2. Maand openen.
3. Terug naar overzicht.
4. Refresh behoudt actieve maand.

### 5. Handmatige invoer

Eerst bouwen:

| Functie | Doel |
| --- | --- |
| `addService(input)` | Dienst toevoegen |
| `updateService(serviceId, patch)` | Handmatige dienst bewerken |
| `deleteManualService(serviceId)` | Handmatige dienst verwijderen na bevestiging |
| `addFamilyBlock(input)` | Gezinsverplichting toevoegen |
| `updateFamilyBlock(blockId, patch)` | Blokkade bewerken |
| `addWish(input)` | Wens toevoegen |
| `markSwapWanted(serviceId)` | Ruilbehoefte markeren |

Eerste test:

1. Dienst voor jou toevoegen.
2. Dienst voor vrouw toevoegen.
3. Gezinsmoment toevoegen.
4. Wens toevoegen.
5. Alle items zichtbaar in de maandcockpit.

### 6. Analyse-engine

Eerst bouwen:

| Functie | Doel |
| --- | --- |
| `runAnalysis(monthId)` | Alle regels voor een maand draaien |
| `buildAnalysisContext(monthId)` | Diensten, blokkades, wensen en bronnen verzamelen |
| `clearGeneratedAnalysis(monthId)` | Oude gegenereerde analyse vervangen |
| `checkMissingCoverage(context)` | Kind/gezinsdekking controleren |
| `checkServiceBlockConflicts(context)` | Dienst tegenover blokkade controleren |
| `checkBothParentsBusy(context)` | Overlap ouders controleren |
| `checkStageNeedsAction(context)` | Ronde-status beoordelen |
| `createOrUpdateAction(result)` | Analyse omzetten naar actie |
| `syncActionsWithAnalysis(monthId)` | Verdwenen acties laten vervallen |
| `updateMonthStatus(monthId)` | Maandstatus bepalen |

Eerste test:

1. Maak een school-haalmoment met dekking nodig.
2. Voeg overlappende diensten voor beide ouders toe.
3. App maakt `conflict`.
4. App maakt actie-item.
5. Maandstatus wordt `conflict`.

### 7. Rendering

Eerst bouwen:

| Functie | Doel |
| --- | --- |
| `renderMonthOverview()` | Maandkaarten tonen |
| `renderMonthCockpit(monthId)` | Cockpit tonen |
| `renderDayDetail(date)` | Dagdetails tonen |
| `renderActionList(filters)` | Actielijst tonen |
| `renderQuickEntry()` | Formulieren tonen |
| `renderImportControl()` | Importcontrole tonen |
| `renderBackupView()` | Backup/herstel tonen |
| `renderSettingsView()` | Instellingen en sync tonen |
| `bindEvents()` | Klikken en formulieren koppelen |

Eerste test:

1. Geen knop geeft een JavaScript-fout.
2. View wisselen werkt op desktop en mobiel.
3. Dynamische data past na iedere wijziging.

### 8. iCal-import

Eerst bouwen:

| Functie | Doel |
| --- | --- |
| `parseIcalText(text, profile)` | iCal-events uitlezen |
| `mapIcalEventToImportItem(event, profile)` | Event vertalen naar importitem |
| `matchImportItem(item, data)` | Bestaande dienst zoeken |
| `classifyImportItem(item, match)` | Nieuw, gelijk, gewijzigd of conflict |
| `saveImportDraft(draft)` | Controle tijdelijk bewaren |
| `confirmImportDraft(draftId)` | Bevestigde regels opslaan |
| `cancelImportDraft(draftId)` | Concept weggooien na bevestiging |

Eerste test:

1. iCal uploaden of plakken.
2. Tien events worden tien importregels.
3. Bevestigen maakt diensten.
4. Tweede import maakt geen duplicaten.
5. Gewijzigde tijd komt in controle.

### 9. PDF- en tekstcontrole

Eerst bouwen:

| Functie | Doel |
| --- | --- |
| `parseRosterText(text, profile)` | Geplakte PDF-tekst omzetten naar conceptregels |
| `comparePdfItemsWithServices(items, monthId)` | PDF naast bestaande diensten leggen |
| `createSourceConflict(item, service)` | Bronconflict maken |
| `renderSourceDiffs(diffs)` | Verschillen tonen |

Eerste test:

1. Plak PDF-tekst met bekende dienst.
2. App vindt overeenkomst.
3. Andere eindtijd wordt bronconflict.
4. Onleesbare regel wordt nette waarschuwing.

### 10. Server-sync

Eerst bouwen:

| Functie | Doel |
| --- | --- |
| `checkServerHealth()` | `health.php` controleren |
| `loadFromServer()` | Serverdata ophalen |
| `saveToServer()` | Lokale data uploaden |
| `syncWithServer()` | Revisies vergelijken |
| `detectSyncConflict(localMeta, serverMeta)` | Conflicten bepalen |
| `downloadServerBackup()` | Serverbackup ophalen |

Eerste test:

1. `health.php` geeft JSON.
2. Online opslaan werkt.
3. Online laden werkt in een lege browser.
4. Bij dubbele wijziging verschijnt syncconflict.

## PHP-endpoints

Serverbestanden komen pas nadat de lokale versie werkt.

### health.php

Doel: controleren of de serverroute leeft.

Moet teruggeven:

```json
{
  "ok": true,
  "app": "roostercoach",
  "version": "1",
  "time": "2026-07-13T16:00:00+02:00"
}
```

Test:

| Actie | Verwacht resultaat |
| --- | --- |
| Open `health.php` | JSON met `ok: true` |
| PHP-fout veroorzaken | Geen HTML-fout als appantwoord |

### load.php

Doel: laatst opgeslagen serverdata ophalen.

Moet:

1. Alleen JSON teruggeven.
2. Melden als er nog geen serverdata is.
3. `serverRevisionId` meesturen.
4. Nooit ruwe PHP-errors naar de app sturen.

Test:

| Actie | Verwacht resultaat |
| --- | --- |
| Open lege server | `hasData: false` |
| Na save opnieuw openen | `hasData: true` met data |

### save.php

Doel: dataset opslaan op de server.

Moet:

1. Alleen `POST` accepteren.
2. JSON body lezen.
3. `dataVersion`, `revisionId` en `lastModified` controleren.
4. Vorige serverdata backuppen.
5. Atomair schrijven.
6. JSON-resultaat geven.

Test:

| Actie | Verwacht resultaat |
| --- | --- |
| `GET save.php` | Nette fout, geen opslag |
| `POST` geldige data | `ok: true` |
| `POST` ongeldige JSON | Nette fout |
| Tweede save | Backup van vorige data bestaat |

### backup.php

Doel: serverbackup downloaden of maken.

Moet:

1. Bestaande serverdata als download kunnen geven.
2. Backupmap gebruiken.
3. Geen directorylisting lekken.
4. JSON of downloadresponse teruggeven.

Test:

| Actie | Verwacht resultaat |
| --- | --- |
| Download serverbackup | Bestand bevat geldige dataset |
| Geen data aanwezig | Nette foutmelding |

### data/.htaccess

Doel: directe toegang tot serverdata blokkeren waar hosting dat ondersteunt.

Minimale inhoud:

```apache
Require all denied
```

Als de hosting deze syntax niet ondersteunt, moet deploymenttest dit zichtbaar maken.

## Bouwvolgorde

### Stap 1: lege app-shell

Maak:

1. `index.html`.
2. `style.css`.
3. `app.js`.
4. Topnavigatie.
5. Lege views.
6. Versietekst.

Klaar als:

1. App opent zonder consolefouten.
2. Views wisselen.
3. Layout bruikbaar is op mobiel.

### Stap 2: lokaal datamodel en autosave

Maak:

1. `createEmptyData()`.
2. `loadData()`.
3. `saveData()`.
4. `createDefaultMonths()`.
5. Autosave-status.

Klaar als:

1. Data na refresh blijft.
2. Een nieuwe maand bewaard blijft.
3. LocalStorage wissen een schone start geeft.

### Stap 3: maandoverzicht en cockpit

Maak:

1. Maandkaarten.
2. Maand openen.
3. Cockpitkop.
4. Daglijst.
5. Dagdetail.

Klaar als:

1. September 2026 kan worden aangemaakt.
2. De maand opent.
3. Daglijst rendert.

### Stap 4: handmatige invoer

Maak:

1. Dienstformulier.
2. Gezinsverplichtingformulier.
3. Wensformulier.
4. Bewerken van handmatige items.
5. Verwijderen met bevestiging.

Klaar als:

1. Diensten en blokkades zichtbaar zijn in de cockpit.
2. Refresh niets kwijtraakt.
3. Bewerking analyse opnieuw kan starten.

### Stap 5: eerste analyse en actie-items

Maak:

1. Analysecontext.
2. Dekkingregel.
3. Overlapregel.
4. Ronde-statusregel.
5. Actie-item generatie.
6. Maandstatus.

Klaar als:

1. Beide ouders bezet tijdens kindmoment geeft conflict.
2. Actie verschijnt in cockpit en actielijst.
3. Actiestatus blijft na refresh.

### Stap 6: backup, restore en snapshots

Maak:

1. Backup downloaden.
2. Backup terugzetten.
3. Snapshot voor restore.
4. Lokale data wissen.
5. Backup-validatie.

Klaar als:

1. Complete dataset exporteert.
2. Restore alle maanden, diensten en acties terugzet.
3. Ongeldige backup wordt geweigerd.

### Stap 7: iCal-import

Maak:

1. Upload/plakveld.
2. iCal-parser.
3. Importitems.
4. Deduplicatie.
5. Importcontrole.
6. Bevestigen naar diensten.

Klaar als:

1. iCal voor jou importeerbaar is.
2. iCal voor vrouw importeerbaar is.
3. Herimport geen dubbele diensten maakt.
4. Wijzigingen in controle komen.

### Stap 8: PDF-tekstcontrole

Maak:

1. Tekstplakveld.
2. Simpele datum/tijd/dienst herkenning.
3. Vergelijking met iCal-diensten.
4. Bronconflict als actie of analyse.

Klaar als:

1. Gelijke PDF-regel rustig blijft.
2. Andere tijd conflict geeft.
3. Onleesbare regel niet crasht.

### Stap 9: server-endpoints

Maak:

1. `health.php`.
2. `load.php`.
3. `save.php`.
4. `backup.php`.
5. `data/.htaccess`.
6. `data/backups/.htaccess`.

Klaar als:

1. `health.php` JSON geeft.
2. `save.php` data opslaat.
3. `load.php` data teruggeeft.
4. `backup.php` backup levert.

### Stap 10: sync in de app

Maak:

1. Serverstatus.
2. Online opslaan.
3. Online laden.
4. Revisievergelijking.
5. Conflictmelding.

Klaar als:

1. Lokale data online kan worden opgeslagen.
2. Lege browser online data kan laden.
3. Twee gewijzigde versies niet stil overschrijven.

### Stap 11: deployment-flow

Maak:

1. `webserver.example.env`.
2. `upload-to-strato.ps1`.
3. `download-from-strato.ps1`.
4. `test-webserver.ps1`.
5. `publish-to-strato.ps1`.
6. `STRATO-KOPPELING.md`.

Klaar als:

1. Upload alle releasebestanden verstuurt.
2. Download controlekopie kan ophalen.
3. Online test `health.php`, `load.php` en herkenbare apptekst controleert.

### Stap 12: regressietestset

Maak:

1. Vaste testfixtures.
2. Handmatige testlijst.
3. Releasechecklist.
4. Versie-afspraak.

Klaar als na iedere wijziging dit werkt:

1. App opent.
2. Maand aanmaken.
3. Dienst toevoegen.
4. Gezinsconflict maken.
5. Actie afhandelen.
6. Backup downloaden.
7. Backup terugzetten.
8. iCal importeren zonder dubbelen.
9. Server health-check.
10. Online versie toont juiste versie.

## Eerste mijlpaal: lokale versie 0.1

Versie 0.1 is de eerste versie die echt dagelijks getest kan worden.

Moet bevatten:

1. `index.html`.
2. `style.css`.
3. `app.js`.
4. Maandoverzicht.
5. Maandcockpit.
6. Snelle invoer.
7. Actielijst.
8. Analyse voor kinddekking en overlap.
9. Autosave.
10. Backup downloaden en terugzetten.

Nog niet nodig:

1. Echte iCal-parser.
2. PDF-controle.
3. Server-sync.
4. Deployment-scripts.
5. AI.

Acceptatiecheck:

| Test | Verwacht resultaat |
| --- | --- |
| Open app | Maandoverzicht verschijnt |
| Maak September 2026 | Maandkaart staat in overzicht |
| Voeg dienst jij 14:00-23:00 toe | Dienst staat in cockpit |
| Voeg dienst vrouw 08:00-17:00 toe | Dienst staat naast andere dienst |
| Voeg school halen 15:00-15:30 toe | Conflict en actie verschijnen |
| Zet actie op `wacht_op_ander` | Status blijft na refresh |
| Download backup | JSON-bestand wordt gemaakt |
| Wis lokaal | App is leeg |
| Zet backup terug | Alles is terug |

## Tweede mijlpaal: importversie 0.2

Versie 0.2 maakt import bruikbaar.

Moet bevatten:

1. iCal uploaden of plakken.
2. Importprofiel per persoon.
3. Importcontrole.
4. Deduplicatie.
5. PDF-tekstcontrole als eenvoudige vergelijking.
6. Importdrafts in localStorage.
7. Snapshot voor importbevestiging.

Acceptatiecheck:

| Test | Verwacht resultaat |
| --- | --- |
| Importeer iCal jij | Diensten komen in controle |
| Bevestig import | Diensten staan in cockpit |
| Importeer opnieuw | Geen dubbele diensten |
| Importeer gewijzigde dienst | Wijziging komt in controle |
| Plak PDF-tekst met verschil | Bronconflict verschijnt |
| Annuleer import | Bestaande data blijft gelijk |

## Derde mijlpaal: serverversie 0.3

Versie 0.3 maakt gebruik op meerdere apparaten mogelijk, zonder lokale veiligheid kwijt te raken.

Moet bevatten:

1. `health.php`.
2. `save.php`.
3. `load.php`.
4. `backup.php`.
5. Online opslaan.
6. Online laden.
7. Syncstatus.
8. Conflictmelding.
9. Serverbackup.

Acceptatiecheck:

| Test | Verwacht resultaat |
| --- | --- |
| Open `health.php` | JSON met `ok: true` |
| Sla online op | Serverdata wordt bijgewerkt |
| Laad op ander apparaat | Data verschijnt |
| Server offline | Lokale app blijft bruikbaar |
| Twee apparaten wijzigen | Syncconflict wordt getoond |

## Vierde mijlpaal: deploymentversie 0.4

Versie 0.4 is online beheerbaar.

Moet bevatten:

1. Uploadscript.
2. Downloadscript.
3. Online testscript.
4. Publicatiescript.
5. Releaseversie.
6. Controle op cachebuster.
7. Documentatie voor webserverkoppeling.

Acceptatiecheck:

| Test | Verwacht resultaat |
| --- | --- |
| Upload release | Bestanden staan online |
| Download controlekopie | Serverkopie is vergelijkbaar |
| Test online | Health, load en apptekst kloppen |
| Open online app mobiel | Cockpit blijft bruikbaar |

## Wat we bewust nog niet bouwen in de basis

Deze onderdelen blijven later:

1. Automatische iCal-URL ophalen achter login.
2. Volledige PDF-parser met tabelherkenning.
3. Screenshot-herkenning.
4. Complexe ruiloptimalisatie.
5. Arbeidstijdenwet volledig narekenen.
6. Meerdere accounts met rechtenbeheer.
7. Pushmeldingen.
8. AI die roostertekst interpreteert.
9. AI-advies dat data extern verwerkt.
10. Drag-and-drop kalender.

Pas toevoegen als versie 0.1 tot en met 0.4 betrouwbaar zijn.

## Praktische eerste bouwtaak

De eerste echte bouwtaak is:

> Maak de lokale app-shell met `index.html`, `style.css` en `app.js`, inclusief maandoverzicht, view-navigatie, lege dataset, autosave en een zichtbare appversie.

Daarna volgen in deze volgorde:

1. Maand aanmaken en openen.
2. Dienst en gezinsblokkade handmatig toevoegen.
3. Analyse voor kinddekking en overlap.
4. Actielijst.
5. Backup en restore.
6. iCal-import.
7. Server-sync.
8. Deployment.

## Wat Module 8 beslist

Deze module legt vast:

1. De bouw start met een lokale drie-bestanden-app.
2. De eerste schermen zijn maandoverzicht, maandcockpit, dagdetail, actielijst, snelle invoer, importcontrole, backup en instellingen.
3. JavaScript wordt eerst gebouwd rond data, opslag, maanden, invoer, analyse en rendering.
4. iCal, PDF, server-sync en deployment komen pas nadat de lokale basis werkt.
5. PHP-endpoints zijn `health.php`, `load.php`, `save.php` en `backup.php`.
6. Iedere bouwstap heeft een eigen acceptatiecheck.
7. De eerste mijlpaal is een lokale versie die conflict, actie, autosave en backup echt kan.

## Volgende stap

Na Module 8 kan de documentatiereeks worden gebruikt als implementatieplan.

De logische volgende actie is niet nog een conceptmodule, maar starten met:

**Versie 0.1 - lokale roostercoach-app**

Daarbij bouwen we eerst de app-shell, lokale data, maandoverzicht en maandcockpit.
