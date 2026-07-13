# Module 4 - Maandcockpit en gebruikersinterface

## Waar deze module over gaat

Deze module beschrijft hoe de gebruiker met de roostercoach werkt. Module 1 legt vast welke data bestaat, Module 2 hoe data binnenkomt, en Module 3 hoe de app analyseert. Module 4 bepaalt hoe dat alles zichtbaar, begrijpelijk en afhandelbaar wordt.

De kernvraag is:

> Hoe ziet de gebruiker per maand snel wat er speelt, welke actie nu nodig is en waar de onderliggende informatie vandaan komt?

De gebruikersinterface moet vooral helpen bij:

1. Snel zien welke maanden goed, onvolledig of problematisch zijn.
2. Acties afhandelen zonder door alle ruwe roosterdata te zoeken.
3. Conflicten controleren met broninformatie.
4. Import en handmatige invoer starten vanuit de juiste maand.
5. Ruiladvies en keuze-opties praktisch beoordelen.

## Hoofdprincipes

1. **De maand is het startpunt**
   De gebruiker denkt in maanden. Iedere maand heeft een eigen ronde, status, acties en importstand.

2. **Acties staan boven meldingen**
   Een melding is pas nuttig als duidelijk is wat de volgende stap is: ruilen, controleren, opvang regelen, keuze maken of wachten op iemand.

3. **Normale dagen blijven rustig**
   De app hoeft niet elke gewone dienst prominent uit te leggen. De interface benadrukt conflicten, ontbrekende gegevens, deadlines, keuzes en ruilkansen.

4. **Bronnen blijven controleerbaar**
   De gebruiker moet bij een conflict kunnen zien of informatie uit iCal, PDF, handmatige invoer, plannertekst of een screenshot komt.

5. **Mobiel moet volwaardig werken**
   De app wordt waarschijnlijk vaak tussendoor gebruikt. De maandcockpit, actielijst en snelle invoer moeten op telefoon bruikbaar blijven.

6. **Elke ronde heeft een andere focus**
   Ronde 1 vraagt om wensen en blokkades. Ronde 2 om afstemming. Ronde 3 om risico's. Ronde 4 om definitieve conflicten en ruilen.

## Navigatiestructuur

De eerste versie heeft vijf hoofdweergaven.

| Weergave | Doel | Belangrijkste data |
| --- | --- | --- |
| Maandoverzicht | Alle maanden scannen | `MaandPlanning`, open acties, importstatus |
| Maandcockpit | Een maand beoordelen | status, kalender, acties, risico's |
| Actielijst | Werkvoorraad afhandelen | `ActieItem`, gekoppelde analyse |
| Import en invoer | Data toevoegen of bijwerken | bronnen, importprofielen, handmatige invoer |
| Detailpanelen | Controleren en beslissen | diensten, analyse, ruiladvies, keuze-opties |

Een aparte instellingenpagina kan later worden toegevoegd voor personen, kinderen, profielen, regels en standaardroosters.

## Startscherm: maandoverzicht

Doel: in een paar seconden zien welke maanden aandacht nodig hebben.

Toont per maand:

| Onderdeel | Voorbeeld | Opmerking |
| --- | --- | --- |
| Maand | September 2026 | Klikt door naar maandcockpit |
| Ronde | `R4_gepubliceerd` | Met menselijk label: Gepubliceerd |
| SamenvattingStatus | `conflict` | Kleur en icoon |
| Open acties | 3 | Alleen niet-afgehandelde acties |
| Hoogste prioriteit | `hoog` | Urgent boven hoog boven normaal |
| Laatste import | `iCal jij vandaag 09:12` | Kortste relevante bron |
| Eerste deadline | `12 september` | Dichtstbijzijnde open actie |

### Statuskleuren

| Status | Kleurbetekenis | Gebruik |
| --- | --- | --- |
| `goed` | Rustig groen | Geen open problemen |
| `aandacht` | Geel/oranje | Er is iets te bekijken |
| `conflict` | Rood | Eerst oplossen |
| `onvolledig` | Blauw/grijs | Data ontbreekt nog |

Kleur mag nooit de enige informatie zijn. Er moet altijd tekst of een icoon bij staan.

### Maandkaart

Een maandkaart bevat maximaal:

1. Maandnaam en jaar.
2. Ronde-label.
3. Statuslabel.
4. Aantal open acties.
5. Hoogste melding of deadline.
6. Korte importstand.

Voorbeeld:

```text
September 2026
Gepubliceerd - conflict
3 open acties, hoogste: school halen oplossen
Laatste import: iCal jij vandaag, iCal vrouw gisteren
```

## Maandcockpit

Doel: een maand openen en meteen weten wat belangrijk is.

De maandcockpit bestaat uit:

1. Kopbalk met maand, ronde en totaalstatus.
2. Actiestrook met belangrijkste open acties.
3. Kalenderweergave met risicodagen.
4. Dagdetail voor geselecteerde datum.
5. Bron- en importstatus.
6. Snelle invoerknoppen.

### Kopbalk

Toont:

| Onderdeel | Voorbeeld |
| --- | --- |
| Maand | September 2026 |
| Ronde | Gepubliceerd rooster |
| Status | Conflict |
| Laatst bijgewerkt | Vandaag 09:14 |
| Primaire actie | `Los 1 conflict op` |

De primaire actie wordt afgeleid uit open acties:

| Situatie | Primaire actie |
| --- | --- |
| Open conflict | `Los conflict op` |
| Onvolledige data | `Vul gegevens aan` |
| Keuze nodig | `Maak keuze` |
| Oude import | `Importeer opnieuw` |
| Geen open acties | `Bekijk maand` |

### Actiestrook

De actiestrook toont de belangrijkste acties boven de kalender.

Sortering:

1. Prioriteit: urgent, hoog, normaal, laag.
2. Deadline dichtstbij.
3. Conflicten boven aandachtspunten.
4. Acties met datum in de maand boven algemene maandacties.

Per actie:

| Veld | Voorbeeld |
| --- | --- |
| Titel | `School halen op 15 september oplossen` |
| Type | opvang regelen |
| Deadline | 12 september |
| Status | open |
| Knoppen | Open, Zet bezig, Markeer opgelost |

Acties met status `opgelost`, `genegeerd` of `vervallen` staan niet in de actiestrook, maar zijn wel zichtbaar in detail of historie.

## Kalenderweergave

De kalender is een compacte maandkalender waarin uitzonderingen direct zichtbaar zijn.

### Dagcel

Iedere dagcel toont:

| Element | Voorbeeld |
| --- | --- |
| Datum | `15` |
| Diensten jij | `Jij C 14-23` |
| Diensten vrouw | `Vrouw D 08-17` |
| Gezinsmarkering | `School halen` |
| Analyse-indicator | conflict, waarschuwing, keuze |

Normale werkdagen mogen compact blijven. Risicodagen krijgen visuele nadruk.

### Dagstatus

| Dagstatus | Wanneer |
| --- | --- |
| `normaal` | Geen analyse met zichtbare ernst |
| `aandacht` | Minstens een aandachtspunt |
| `keuze` | Keuze nodig op of voor deze dag |
| `waarschuwing` | Reeel risico of ontbrekende informatie |
| `conflict` | Hard open conflict |
| `onvolledig` | Dag kan niet betrouwbaar beoordeeld worden |

### Mobiele kalender

Op telefoon is een volledige maandgrid vaak te krap. De mobiele versie gebruikt:

1. Horizontale maandwisselaar.
2. Weekstroken of agenda-lijst.
3. Dagregels met datum, diensten en statusicoon.
4. Sticky actiestrook voor urgente acties.

Voor telefoon is de agenda-lijst belangrijker dan een kleine maandgrid.

## Dagdetail

Als de gebruiker een dag opent, toont de app alles wat nodig is om die dag te begrijpen.

### Inhoud

| Sectie | Inhoud |
| --- | --- |
| Diensten | Diensten van jou en je vrouw |
| Gezin | School, opvang, afspraken, blokkades |
| Analyse | Meldingen voor deze dag |
| Acties | Gekoppelde actie-items |
| Bronnen | iCal, PDF, handmatig of planner |

### Dienstregel

Een dienstregel toont:

| Veld | Voorbeeld |
| --- | --- |
| Persoon | Jij |
| Tijd | 14:00-23:00 |
| Code/type | C, laat |
| Locatie | Zuid |
| Status | gepubliceerd |
| Bron | iCal |
| Ruilstatus | ruilbaar |

De dienstregel heeft acties:

1. Bewerken.
2. Markeer ruil gewenst.
3. Toon bron.
4. Koppel opmerking.
5. Verwijderen alleen bij handmatige of foutieve invoer.

## Actielijst

De actielijst is de werkvoorraad van de app.

### Filters

| Filter | Opties |
| --- | --- |
| Maand | Alle maanden, huidige maand, specifieke maand |
| Status | open, bezig, wacht op ander, opgelost, genegeerd |
| Prioriteit | urgent, hoog, normaal, laag |
| Type | ruil, opvang, keuze, controle, gegevens |
| Persoon | jij, vrouw, gezin |

Standaard toont de actielijst alleen open, bezig en wacht-op-ander acties.

### Actiekaart

Per actie:

| Veld | Voorbeeld |
| --- | --- |
| Titel | `Late dienst dinsdag ruilen` |
| Maand | September 2026 |
| Datum | 15 september |
| Type | ruil nodig |
| Prioriteit | hoog |
| Deadline | 12 september |
| Status | open |
| Advies | `Zoek ruil of regel opvang` |

Beschikbare knoppen:

1. Open detail.
2. Zet op bezig.
3. Zet op wacht op ander.
4. Markeer opgelost.
5. Negeer bewust.

### Statuswijzigingen

| Nieuwe status | Effect |
| --- | --- |
| `bezig` | Blijft zichtbaar, minder urgent dan open |
| `wacht_op_ander` | Blijft zichtbaar met wachtlabel |
| `opgelost` | Verdwijnt uit standaardlijst |
| `genegeerd` | Verdwijnt, maar blijft auditbaar |
| `vervallen` | Wordt automatisch gezet als analyse niet meer bestaat |

Bij `genegeerd` vraagt de app om een korte reden.

## Analyse-detail

Doel: vertrouwen geven in de melding.

Toont:

| Onderdeel | Vraag die het beantwoordt |
| --- | --- |
| Regel | Welke regel ging af? |
| Ernst | Waarom is dit conflict/waarschuwing/aandacht? |
| Betrokken data | Welke diensten of gezinsafspraken tellen mee? |
| Bronnen | Waar komt deze informatie vandaan? |
| Advies | Wat is de logische volgende stap? |
| Actie-item | Welke taak hoort hierbij? |

Voorbeeld:

```text
Geen ouder beschikbaar tijdens school halen
Ernst: conflict
Regel: kinddekking
Betrokken: Jij C 14:00-23:00, vrouw dag 08:00-17:00, school halen 15:00-15:30
Advies: zoek ruil voor late dienst, vraag opvang of regel iemand voor school halen
Bronnen: iCal jij, iCal vrouw, handmatige schoolafspraak
```

## Ruiladvies

Ruiladvies verschijnt vanuit een actie of dienstdetail.

### Ruilkaart

| Onderdeel | Voorbeeld |
| --- | --- |
| Probleemdienst | Jij C 15 september 14:00-23:00 |
| Reden | School halen ongedekt |
| Beste alternatief | Vroege dienst 16 september |
| Score | 82 |
| Gezinsimpact | verbetert |
| Rustimpact | neutraal |
| Urenimpact | neutraal |
| Locatieimpact | verbetert |
| Zekerheid | gepubliceerd |

### Knoppen

1. Markeer als voorkeursruil.
2. Zet actie op collega vragen.
3. Kopieer ruiltekst.
4. Markeer als niet bruikbaar.

De app voert de ruil niet automatisch door. De gebruiker blijft degene die met collega of planner afstemt.

### Ruiltekst

Voorbeeldtekst:

```text
Kan iemand mijn late dienst op dinsdag 15 september 14:00-23:00 overnemen of ruilen?
Reden: opvang/school halen knelt. Voorkeur voor vroege dienst of vrije dag rond 16 september.
```

## Keuze-aanvragen en instructeursopties

Instructeursdagen krijgen een aparte keuzeweergave omdat de gebruiker meerdere opties moet vergelijken.

### Keuzescherm

Toont:

| Onderdeel | Voorbeeld |
| --- | --- |
| Aanvraag | Instructeursdag week 42 |
| Persoon | vrouw |
| Deadline | 20 september |
| Status | nog beoordelen |
| Beste optie | woensdag 14 oktober |
| Reden | geen opvangconflict en normale reistijd |

### Optietabel

| Optie | Score | Gezin | Rust | Locatie | Advies |
| --- | --- | --- | --- | --- | --- |
| ma 12 okt | 61 | neutraal | goed | Oost | mogelijk |
| wo 14 okt | 82 | goed | goed | Zuid | beste optie |
| vr 16 okt | 44 | risico | neutraal | Oost | liever niet |

Beschikbare acties:

1. Kies als voorkeur.
2. Kopieer antwoordtekst.
3. Zet op wacht op planner.
4. Markeer afgehandeld.

## Import en invoer vanuit de interface

Import hoort op twee plekken bereikbaar te zijn:

1. Vanuit het maandoverzicht voor algemene bijwerking.
2. Vanuit de maandcockpit voor die specifieke maand.

### Importstatusblok

In de maandcockpit toont de app:

| Bron | Status | Actie |
| --- | --- | --- |
| iCal jij | Vandaag 09:12 | Bijwerken |
| iCal vrouw | Gisteren 21:04 | Bijwerken |
| PDF | Niet gecontroleerd | PDF importeren |
| Handmatig | 2 notities | Openen |
| Plannertekst | 1 keuze open | Beoordelen |

### Snelle invoer

Snelknoppen:

1. Dienst toevoegen.
2. Wens toevoegen.
3. Blokkade of gezinsafspraak.
4. Ruilwens.
5. Instructeursopties plakken.
6. Onzekerheid in ronde 2.

Na opslaan:

1. Data wordt opgeslagen met bron `handmatig`.
2. Analyse draait opnieuw voor de maand.
3. De gebruiker keert terug naar de maandcockpit.
4. Nieuwe actie-items worden bovenaan zichtbaar.

## Ronde-afhankelijke interface

De maandcockpit past de nadruk aan op basis van `PlanningStage`.

### Ronde 1: wensen

Nadruk:

1. Wensen invullen.
2. Harde blokkades toevoegen.
3. Instructeursopties beoordelen.
4. Ontbrekende basisdata aanvullen.

Primaire knoppen:

| Knop | Doel |
| --- | --- |
| Wens toevoegen | Ronde-1-wens vastleggen |
| Blokkade toevoegen | Gezins- of werkblokkade |
| Instructeursopties | Plannerkeuzes invoeren |

### Ronde 2: afstemming

Nadruk:

1. Onzekerheden volgen.
2. Afspraken met collega's vastleggen.
3. Plan B en ruilkansen bijhouden.

Primaire knoppen:

| Knop | Doel |
| --- | --- |
| Onzekerheid toevoegen | Ronde-2-risico vastleggen |
| Afspraak bevestigen | Status naar bevestigd |
| Collega vragen | Actie-item maken of bijwerken |

### Ronde 3: managerfase

Nadruk:

1. Waarschijnlijke roosteruitkomst controleren.
2. Afwijking standaardrooster markeren.
3. Manager- of plannerpunten voorbereiden.

Primaire knoppen:

| Knop | Doel |
| --- | --- |
| Concept importeren | PDF of informatie toevoegen |
| Risico controleren | Analyse openen |
| Planner vragen | Actie-item maken |

### Ronde 4: gepubliceerd

Nadruk:

1. Definitieve conflicten oplossen.
2. iCal actueel houden.
3. Ruilwensen en opvangoplossingen afhandelen.

Primaire knoppen:

| Knop | Doel |
| --- | --- |
| iCal bijwerken | Gepubliceerd rooster verversen |
| Ruil zoeken | Ruiladvies openen |
| Opgelost markeren | Actie afronden |

## Bewerk- en bevestigingsregels

### Wat mag direct worden aangepast

| Item | Regel |
| --- | --- |
| Handmatige dienst | Direct bewerkbaar |
| Wens | Direct bewerkbaar |
| Gezinsverplichting | Direct bewerkbaar |
| ActieItem-status | Direct bewerkbaar |
| Opmerking | Direct bewerkbaar |

### Wat vraagt bevestiging

| Item | Waarom |
| --- | --- |
| Geimporteerde iCal-dienst wijzigen | Bron kan later opnieuw importeren |
| Actie negeren | Bewuste afwijking moet controleerbaar zijn |
| Conflict als opgelost markeren zonder datawijziging | Analyse kan nog steeds conflict vinden |
| Bronverschil accepteren | Kan impact hebben op maandstatus |

### Niet automatisch doen

De interface mag niet automatisch:

1. Een gepubliceerde dienst verwijderen omdat een handmatige notitie afwijkt.
2. Een ruil doorvoeren zonder bevestiging.
3. Een conflict als opgelost markeren zonder statuswijziging of bewuste keuze.
4. Een actie definitief wissen uit historie.

## Meldingen en tekststijl

Teksten moeten kort, concreet en handelingsgericht zijn.

| Slecht | Beter |
| --- | --- |
| `Conflict gedetecteerd` | `School halen op 15 september is ongedekt` |
| `Data incompleet` | `Tijd van late dienst op 10 november ontbreekt` |
| `Keuze vereist` | `Kies instructeursdag voor week 42` |
| `Import verouderd` | `iCal vrouw is 8 dagen niet bijgewerkt` |

## Eerste implementatie

Voor een eerste werkende gebruikersinterface is genoeg:

1. Maandoverzicht met maandstatus, ronde, open acties en laatste import.
2. Maandcockpit met actiestrook, compacte kalender of agenda-lijst en dagdetail.
3. Actielijst met filters op maand, status, prioriteit en type.
4. Analyse-detail met regel, betrokken gegevens, bronnen en advies.
5. Snelle handmatige invoer voor dienst, wens, blokkade, ruilwens en instructeursopties.
6. Importstatusblok met knoppen naar iCal-import en handmatige invoer.
7. Ruiladviesdetail met score, effecten en kopieerbare ruiltekst.

Kan later volgen:

1. Volledige instellingenpagina.
2. Geavanceerde ruilvergelijking.
3. PDF-verschillen visueel naast bestaande data.
4. Screenshot-importscherm.
5. Historie/auditlog per actie en analyse.
6. Pushmeldingen of herinneringen voor deadlines.

## Voorbeeld gebruikersflow: conflict oplossen

1. Gebruiker opent maandoverzicht.
2. September 2026 staat op `conflict`.
3. Gebruiker opent de maandcockpit.
4. Actiestrook toont `School halen op 15 september oplossen`.
5. Gebruiker opent de actie.
6. Analyse-detail toont beide diensten, schoolafspraak en bronnen.
7. Gebruiker opent ruiladvies.
8. App toont beste ruilkandidaat en kopieerbare tekst.
9. Gebruiker zet actie op `wacht_op_ander`.
10. Na akkoord van collega markeert gebruiker actie als `opgelost`.
11. Analyse draait opnieuw en maandstatus wordt bijgewerkt.

## Voorbeeld gebruikersflow: ronde-1-wensen voorbereiden

1. Gebruiker opent December 2026.
2. Ronde staat op `R1_wensen`.
3. Maandcockpit toont dat wensen nog ontbreken.
4. Gebruiker voegt harde gezinsblokkades toe.
5. Gebruiker voegt gewenste vrije dagen toe.
6. Plannertekst met instructeursopties wordt geplakt.
7. App maakt keuze-aanvraag en vergelijkt opties.
8. Gebruiker kiest voorkeursoptie en kopieert antwoordtekst.
9. Actie wordt `wacht_op_ander` of `opgelost`.

## Wat Module 4 beslist

Deze module legt vast:

1. De gebruiker start in een maandoverzicht en werkt door naar een maandcockpit.
2. De maandcockpit toont status, acties, kalender/daglijst, importstand en snelle invoer.
3. De actielijst is de centrale werkvoorraad en toont standaard alleen nog relevante acties.
4. Analyse-details moeten altijd regel, betrokken data, bronnen, advies en actie-item tonen.
5. Ruiladvies en instructeursopties krijgen aparte beslisschermen.
6. De interface past de nadruk aan per planningstage.
7. Handmatige invoer en import zijn direct gekoppeld aan heranalyse van de maand.
8. De eerste implementatie richt zich op maandoverzicht, maandcockpit, actielijst, analyse-detail, snelle invoer en ruiladvies.

## Volgende module

De logische volgende module is:

**Module 5 - Opslag, synchronisatie en lokale werking**

Daarin bepalen we hoe de roostercoach gegevens bewaart, lokaal veilig doorwerkt, synchroniseert, exports maakt en eventueel op de webserver draait.
