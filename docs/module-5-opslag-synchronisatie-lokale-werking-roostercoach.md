# Module 5 - Opslag, synchronisatie en lokale werking

## Waar deze module over gaat

Deze module beschrijft hoe de roostercoach gegevens bewaart en veilig beschikbaar houdt. Module 1 bepaalt welke data bestaat, Module 2 hoe data binnenkomt, Module 3 wat de app concludeert, en Module 4 hoe de gebruiker ermee werkt. Module 5 bepaalt hoe die gegevens niet kwijtraken en hoe de app betrouwbaar blijft werken.

De kernvraag is:

> Hoe bewaart de roostercoach alle maanden, imports, acties en handmatige keuzes zo dat de app lokaal snel werkt, veilig kan synchroniseren en altijd herstelbaar blijft?

Daarin bepalen we:

1. Welke gegevens lokaal worden opgeslagen.
2. Wanneer automatisch wordt opgeslagen.
3. Hoe importgeschiedenis en wijzigingen bewaard blijven.
4. Hoe backups en exports werken.
5. Hoe synchronisatie met een webserver later veilig kan.
6. Hoe de app omgaat met conflicten tussen lokale en serverdata.

## Hoofdprincipes

1. **Lokaal eerst**
   De app moet ook werken als er geen internet is. Invoer, acties en analyse moeten lokaal kunnen doorgaan.

2. **Autosave is standaard**
   Wijzigingen worden direct lokaal bewaard. De gebruiker hoeft niet steeds op opslaan te drukken.

3. **Wissen gebeurt alleen expliciet**
   Data verdwijnt niet door refresh, import of synchronisatie. Verwijderen is een bewuste actie of een vastgelegde vervalregel.

4. **Import overschrijft niet blind**
   Nieuwe iCal- of PDF-data mag handmatige wensen, opmerkingen, ruilstatussen en actiehistorie niet ongemerkt verwijderen.

5. **Alles wat belangrijk is, is herstelbaar**
   De app bewaart snapshots, importhistorie en wijzigingsmomenten zodat fouten terug te draaien of te controleren zijn.

6. **Synchronisatie is voorzichtig**
   Als lokale en serverdata verschillen, kiest de app niet stilletjes een winnaar bij gevoelige gegevens. De gebruiker krijgt verschillen te zien.

## Opslaglagen

De roostercoach gebruikt drie opslaglagen.

| Laag | Doel | Voorbeeld |
| --- | --- | --- |
| Browseropslag | Direct lokaal werken | `localStorage` of `IndexedDB` |
| Exportbestand | Backup en overdracht | JSON-export |
| Serveropslag | Delen tussen apparaten of webserver | PHP/JSON of API |

### Eerste versie

Voor de eerste implementatie is genoeg:

1. Browseropslag als hoofdopslag.
2. JSON-export en JSON-import voor backup.
3. Handmatige server-upload pas later.

Server-synchronisatie mag pas komen nadat lokaal opslaan en export betrouwbaar zijn.

## Lokale opslag

### Wat lokaal wordt opgeslagen

De volledige minimale JSON-structuur uit Module 1 wordt lokaal opgeslagen:

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
  "actieItems": [],
  "bronHistorie": [],
  "instellingen": {},
  "wijzigingsLog": []
}
```

### Opslagsleutels

Voor browseropslag gebruikt de app vaste sleutels.

| Sleutel | Inhoud |
| --- | --- |
| `roostercoach.data.v1` | Actuele hoofddata |
| `roostercoach.settings.v1` | Lokale instellingen |
| `roostercoach.snapshots.v1` | Laatste herstelpunten |
| `roostercoach.sync.v1` | Synchronisatiestatus |
| `roostercoach.importDraft.v1` | Tijdelijke importcontrole |

Versienummers in sleutels maken latere datamigratie mogelijk.

### localStorage of IndexedDB

| Optie | Voordeel | Nadeel |
| --- | --- | --- |
| `localStorage` | Simpel, snel te bouwen, goed voor eerste versie | Beperkte ruimte, hele JSON tegelijk |
| `IndexedDB` | Beter voor grotere data, bestanden en historie | Meer code |

Keuze voor eerste versie:

1. Start met `localStorage` zolang de data klein blijft.
2. Stap over naar `IndexedDB` als PDF-imports, veel snapshots of grote historie nodig zijn.
3. Bewaar PDF-bestanden zelf niet in `localStorage`; bewaar alleen metadata en eventueel tekstextract.

## Autosave

Autosave draait bij iedere betekenisvolle wijziging.

### Wanneer opslaan

| Gebeurtenis | Autosave |
| --- | --- |
| Dienst toegevoegd of gewijzigd | Direct |
| Wens toegevoegd | Direct |
| Actiestatus gewijzigd | Direct |
| Import bevestigd | Direct na opslaan import |
| Analyse opnieuw gedraaid | Direct na analyse |
| Instelling gewijzigd | Direct |
| Tekst in importwizard | Als tijdelijke draft |

### Autosave-status

De interface toont subtiel:

| Status | Betekenis |
| --- | --- |
| `Opgeslagen` | Laatste lokale save is gelukt |
| `Opslaan...` | Wijziging wordt verwerkt |
| `Niet opgeslagen` | Er is een fout |
| `Alleen lokaal` | Nog niet gesynchroniseerd |
| `Gesynchroniseerd` | Server heeft dezelfde versie |

### Foutgedrag

Als autosave faalt:

1. Toon een duidelijke melding.
2. Laat de gebruiker de data exporteren.
3. Voorkom navigatieverlies waar mogelijk.
4. Bewaar noodkopie in geheugen zolang de pagina open is.

## Snapshots en herstel

De app maakt automatisch herstelpunten.

### Wanneer snapshot maken

| Moment | Reden |
| --- | --- |
| Voor importbevestiging | Import kan veel wijzigen |
| Voor server-sync | Sync kan conflicten geven |
| Voor bulkverwijdering | Herstelbaar houden |
| Dagelijks bij eerste gebruik | Backup per dag |
| Voor datamigratie | Oude versie kunnen herstellen |

### Snapshotinhoud

```json
{
  "id": "snapshot_2026-07-13T14-30-00",
  "gemaaktOp": "2026-07-13T14:30:00",
  "reden": "voor_import",
  "dataVersion": 1,
  "aantalMaanden": 6,
  "data": {}
}
```

### Bewaarbeleid

Voor de eerste versie:

1. Bewaar de laatste 10 snapshots.
2. Bewaar maximaal 1 automatische snapshot per dag.
3. Bewaar altijd de laatste snapshot voor import.
4. Laat de gebruiker handmatig een backup exporteren.

## Wijzigingslog

Het wijzigingslog helpt om te begrijpen wat er is gebeurd.

### Logitem

| Veld | Voorbeeld |
| --- | --- |
| `id` | `log_2026-07-13_001` |
| `tijd` | `2026-07-13T14:30:00` |
| `type` | `actie_status_gewijzigd` |
| `entiteitType` | `ActieItem` |
| `entiteitId` | `actie_2026-09-15_kinddekking` |
| `samenvatting` | `Actie op wacht_op_ander gezet` |
| `bron` | `gebruiker` |

### Wat loggen

| Wijziging | Loggen |
| --- | --- |
| Import bevestigd | Ja |
| Actie opgelost/genegeerd | Ja |
| Ruilwens gezet | Ja |
| Handmatige dienst toegevoegd | Ja |
| Analyse opnieuw gedraaid | Alleen samenvatting |
| Kleine tekstwijziging | Alleen als relevant |

Het wijzigingslog hoeft in de eerste versie niet prominent zichtbaar te zijn, maar moet wel exporteerbaar zijn.

## Importdrafts

Tijdens import mag onvoltooide controle niet zomaar verdwijnen.

### Drafts bewaren

De app bewaart tijdelijke importdata als:

```json
{
  "id": "draft_import_2026-09_ical_jij",
  "bronType": "ical",
  "persoonId": "persoon_jij",
  "maandPlanningId": "2026-09",
  "aangemaaktOp": "2026-07-13T14:30:00",
  "status": "in_controle",
  "items": []
}
```

### Draft vervalt wanneer

1. De gebruiker de import bevestigt.
2. De gebruiker de draft expliciet verwijdert.
3. De draft ouder is dan een ingestelde periode en de gebruiker akkoord geeft met opruimen.

Standaard mag een importdraft niet automatisch zonder melding verdwijnen.

## Export en import van backup

### JSON-export

De app biedt altijd een knop:

`Backup downloaden`

Deze export bevat:

1. Hoofddata.
2. Instellingen zonder geheime tokens.
3. Bronhistorie.
4. Wijzigingslog.
5. Data- en appversie.

Voorbeeld bestandsnaam:

```text
roostercoach-backup-2026-07-13-1430.json
```

### JSON-import

Bij import van een backup:

1. Valideer of het bestand een roostercoach-backup is.
2. Toon datum, versie en aantallen.
3. Maak snapshot van huidige data.
4. Vraag of gebruiker wil vervangen of samenvoegen.
5. Draai analyse opnieuw na import.

Voor eerste versie is `vervangen na bevestiging` genoeg. Samenvoegen kan later.

## Serveropslag

Serveropslag is nuttig als de app op meerdere apparaten wordt gebruikt of via webserver draait.

### Mogelijke servervormen

| Vorm | Past bij | Opmerking |
| --- | --- | --- |
| JSON-bestand op webserver | Kleine persoonlijke app | Simpel, maar vergrendeling nodig |
| PHP-endpoints | Upload/download en basisbeveiliging | Goed voor eerste webserverversie |
| Database | Meerdere gebruikers of grote historie | Later pas nodig |

Voor deze roostercoach is een eenvoudige webserverroute genoeg zolang het een persoonlijke familie-app blijft.

### Minimale serverbestanden

| Bestand | Doel |
| --- | --- |
| `load.php` | Laatste data ophalen |
| `save.php` | Nieuwe data opslaan |
| `backup.php` | Serverbackup downloaden |
| `health.php` | Testen of server bereikbaar is |
| `data/roostercoach-data.json` | Actuele data |
| `data/backups/` | Serverbackups |

Gevoelige configuratie hoort niet in het publieke JavaScript-bestand.

## Synchronisatie

Synchronisatie vergelijkt lokale data met serverdata.

### Syncstatus

| Status | Betekenis |
| --- | --- |
| `alleen_lokaal` | Nog nooit gesynchroniseerd |
| `sync_ok` | Lokaal en server gelijk |
| `lokale_wijzigingen` | Lokaal nieuwer dan server |
| `server_wijzigingen` | Server nieuwer dan lokaal |
| `conflict` | Beide kanten gewijzigd |
| `sync_fout` | Upload/download mislukte |

### Versievelden

Iedere dataset krijgt:

| Veld | Doel |
| --- | --- |
| `dataVersion` | Structuurversie |
| `revisionId` | Unieke revisie |
| `lastModified` | Laatste wijziging |
| `lastModifiedBy` | Apparaat of gebruiker |
| `baseRevisionId` | Laatste bekende serverbasis |

Voorbeeld:

```json
{
  "dataVersion": 1,
  "revisionId": "rev_2026-07-13T14-30-00_laptop",
  "baseRevisionId": "rev_2026-07-13T09-12-00_server",
  "lastModified": "2026-07-13T14:30:00",
  "lastModifiedBy": "laptop"
}
```

### Syncproces

1. Laad lokale data.
2. Haal servermetadata op.
3. Vergelijk `baseRevisionId`, `revisionId` en `lastModified`.
4. Als alleen lokaal gewijzigd is: upload.
5. Als alleen server gewijzigd is: download na bevestiging of automatisch als er lokaal niets openstaat.
6. Als beide gewijzigd zijn: toon conflict.
7. Maak altijd een snapshot voor vervangen of samenvoegen.

## Syncconflicten

Een syncconflict ontstaat als lokale en serverdata sinds dezelfde basis allebei zijn gewijzigd.

### Eerste versie conflictstrategie

Voor de eerste versie hoeft de app nog geen slimme merge te doen. Genoeg is:

1. Toon dat er een conflict is.
2. Laat kiezen tussen lokale versie behouden of serverversie laden.
3. Maak altijd een snapshot van beide versies.
4. Bied export van beide versies aan.

### Later samenvoegen

Later kan de app per entiteit samenvoegen:

| Entiteit | Samenvoegstrategie |
| --- | --- |
| ActieItem-status | Nieuwste status, tenzij beide gewijzigd |
| Handmatige dienst | Per id vergelijken |
| Importhistorie | Toevoegen |
| AnalyseResultaten | Opnieuw berekenen |
| RuilKandidaten | Opnieuw berekenen |

Analyse en ruilkandidaten hoeven niet handmatig gemerged te worden; die kunnen opnieuw worden berekend uit brondata.

## Beveiliging en privacy

Roosterdata bevat persoonlijke informatie. De app moet daar zuinig mee zijn.

### Regels

1. Geen wachtwoorden of geheime tokens in exportbestanden.
2. Geen geheime servergegevens in frontend-code.
3. Serverdata-map afschermen waar mogelijk.
4. Backups duidelijke bestandsnamen geven, maar geen onnodige details.
5. Bij gedeelde computer: knop om lokale data bewust te wissen.

### Lokaal wissen

De app krijgt een duidelijke actie:

`Lokale gegevens wissen`

Deze actie:

1. Vraagt bevestiging.
2. Adviseert eerst backup te downloaden.
3. Wist hoofddata, drafts, snapshots en syncstatus.
4. Herstart naar lege beginstand.

Wissen gebeurt nooit automatisch door uitloggen of refresh.

## Datamigratie

Als de datastructuur later verandert, gebruikt de app migraties.

### Migratieproces

1. Lees `dataVersion`.
2. Maak snapshot.
3. Voer migratie stap voor stap uit.
4. Sla nieuwe versie op.
5. Draai analyse opnieuw.
6. Toon fout en hersteloptie als migratie mislukt.

Voorbeeld:

| Van | Naar | Wijziging |
| --- | --- | --- |
| 1 | 2 | `bronHistorie` toegevoegd |
| 2 | 3 | `lastModifiedBy` toegevoegd |

## Offline gedrag

Als de app geen server kan bereiken:

1. Lokale opslag blijft werken.
2. Interface toont `Alleen lokaal`.
3. Acties, invoer en analyse blijven beschikbaar.
4. Sync wordt later opnieuw geprobeerd of handmatig gestart.
5. De gebruiker kan altijd een JSON-backup downloaden.

Offline mag geen fouttoestand zijn; het is een normale modus.

## Eerste implementatie

Voor een eerste werkende versie is genoeg:

1. Hoofddata opslaan in `localStorage` onder `roostercoach.data.v1`.
2. Autosave na iedere wijziging.
3. Herladen uit lokale opslag bij openen van de app.
4. Backup downloaden als JSON.
5. Backup importeren na bevestiging.
6. Snapshot maken voor import en backup-herstel.
7. Importdraft bewaren tijdens controlescherm.
8. Syncstatus tonen als `alleen_lokaal`.

Kan later volgen:

1. Server `load.php` en `save.php`.
2. Serverbackups.
3. Synchronisatie met revisies.
4. Conflictkeuze tussen lokale en serverversie.
5. IndexedDB voor grotere opslag.
6. Datamigraties voor nieuwe versies.

## Voorbeeld gebruikersflow: autosave

1. Gebruiker opent September 2026.
2. Gebruiker markeert `School halen oplossen` als `wacht_op_ander`.
3. App schrijft direct naar lokale opslag.
4. Autosave-status toont `Opgeslagen`.
5. Gebruiker ververst de pagina.
6. Actie staat nog steeds op `wacht_op_ander`.

## Voorbeeld gebruikersflow: backup maken

1. Gebruiker opent instellingen of opslagmenu.
2. Gebruiker kiest `Backup downloaden`.
3. App maakt JSON-bestand met data, instellingen, bronhistorie en wijzigingslog.
4. Bestand krijgt naam `roostercoach-backup-2026-07-13-1430.json`.
5. App toont dat backup is gemaakt.

## Voorbeeld gebruikersflow: import met herstelpunt

1. Gebruiker importeert iCal voor vrouw.
2. App maakt snapshot voor import.
3. Importcontrole toont nieuw, gewijzigd en conflict.
4. Gebruiker bevestigt import.
5. App slaat data lokaal op.
6. Analyse draait opnieuw.
7. Als iets verkeerd ging, kan gebruiker terug naar snapshot.

## Wat Module 5 beslist

Deze module legt vast:

1. De roostercoach werkt lokaal eerst en blijft bruikbaar zonder internet.
2. Autosave is standaard bij iedere betekenisvolle wijziging.
3. Data wordt niet automatisch gewist door refresh, import of synchronisatie.
4. De eerste opslag gebruikt vaste browseropslagsleutels met versienummers.
5. Snapshots worden gemaakt voor risicovolle acties zoals import, sync en migratie.
6. JSON-export en JSON-import zijn de eerste backupmethode.
7. Serveropslag en sync komen later via voorzichtige revisies en conflictcontrole.
8. AnalyseResultaten en ruilKandidaten mogen opnieuw worden berekend in plaats van handmatig gemerged.

## Volgende module

De logische volgende module is:

**Module 6 - Eerste technische implementatie**

Daarin bepalen we welke bestanden, functies en schermen nodig zijn om van deze modules een eerste werkende roostercoach te bouwen.
