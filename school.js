"use strict";

function normalizeSchoolTimes(value) {
  const source = Array.isArray(value) ? value : [];
  return source
    .map((schoolTime) => ({
      id: schoolTime.id || generateId("schooltijd"),
      kindId: String(schoolTime.kindId || "alle_kinderen"),
      dag: WEEKDAY_OPTIONS.some((day) => day.value === String(schoolTime.dag)) ? String(schoolTime.dag) : "1",
      start: schoolTime.start || "",
      einde: schoolTime.einde || "",
      brengenNodig: schoolTime.brengenNodig !== false && schoolTime.brengenNodig !== "false",
      halenNodig: schoolTime.halenNodig !== false && schoolTime.halenNodig !== "false",
      opmerking: String(schoolTime.opmerking || "").trim()
    }))
    .filter((schoolTime) => schoolTime.start && schoolTime.einde);
}

function normalizeChildren(value) {
  const source = Array.isArray(value) ? value : [];
  return source
    .map((child) => ({
      id: child.id || generateId("kind"),
      naam: String(child.naam || child.name || "").trim(),
      schoolNaam: String(child.schoolNaam || child.school || "").trim()
    }))
    .filter((child) => child.naam);
}

function normalizeContextPeriods(value) {
  const source = Array.isArray(value) ? value : [];
  return source
    .map((period) => ({
      id: period.id || generateId("context"),
      type: String(period.type || "schoolvakantie").trim(),
      naam: String(period.naam || period.summary || "").trim(),
      startDatum: period.startDatum || period.start || "",
      eindDatum: period.eindDatum || period.einde || period.end || "",
      bronId: period.bronId || "bron_school_handmatig",
      opmerking: String(period.opmerking || "").trim()
    }))
    .filter((period) => period.naam && period.startDatum && period.eindDatum);
}

function getChildren() {
  state.data.kinderen = normalizeChildren(state.data.kinderen);
  return state.data.kinderen;
}

function getSchoolTimes() {
  if (!Array.isArray(state.data.instellingen.schoolTijden)) {
    state.data.instellingen.schoolTijden = [];
  }
  state.data.instellingen.schoolTijden = normalizeSchoolTimes(state.data.instellingen.schoolTijden);
  return state.data.instellingen.schoolTijden;
}

function getSchoolPeriods() {
  state.data.contextPeriodes = normalizeContextPeriods(state.data.contextPeriodes);
  return state.data.contextPeriodes.filter((period) => ["schoolvakantie", "studiedag"].includes(period.type));
}

function getSchoolEventsForMonth(month) {
  if (!month) return [];
  const dates = getMonthDateValues(month);
  const periods = getSchoolPeriods();
  const schoolTimes = getSchoolTimes();
  const events = [];

  dates.forEach((date) => {
    const datePeriods = periods.filter((period) => isDateInRange(date, period.startDatum, period.eindDatum));
    datePeriods.forEach((period) => {
      events.push({
        id: `schoolperiode_${period.id}_${date}`,
        date,
        type: period.type,
        label: period.naam || formatCodeLabel(period.type),
        start: "",
        einde: "",
        opmerking: period.opmerking || "",
        sourceId: period.id
      });
    });

    if (datePeriods.some((period) => ["schoolvakantie", "studiedag"].includes(period.type))) return;

    const weekday = String(new Date(`${date}T12:00:00`).getDay());
    schoolTimes
      .filter((schoolTime) => String(schoolTime.dag) === weekday)
      .forEach((schoolTime) => {
        events.push({
          id: `schooltijd_${schoolTime.id}_${date}`,
          date,
          type: "schooltijd",
          label: getSchoolTimeLabel(schoolTime),
          start: schoolTime.start,
          einde: schoolTime.einde,
          brengenNodig: schoolTime.brengenNodig,
          halenNodig: schoolTime.halenNodig,
          opmerking: schoolTime.opmerking || "",
          sourceId: schoolTime.id
        });
      });
  });

  return events;
}

function getSchoolCoverageBlocksForMonth(month) {
  if (!month) return [];
  return getSchoolEventsForMonth(month)
    .filter((event) => event.type === "schooltijd")
    .flatMap((event) => {
      const blocks = [];
      if (event.brengenNodig) {
        blocks.push(createSchoolCoverageBlock(event, "school_brengen", event.start, addMinutesToTime(event.start, 15)));
      }
      if (event.halenNodig) {
        blocks.push(createSchoolCoverageBlock(event, "school_halen", addMinutesToTime(event.einde, -15), event.einde));
      }
      return blocks;
    });
}

function createSchoolCoverageBlock(event, type, start, einde) {
  return {
    id: `${event.id}_${type}`,
    maandPlanningId: dateToMonthId(event.date),
    type,
    kindId: "",
    datum: event.date,
    start,
    einde,
    hardheid: "hard",
    dekkingNodig: true,
    opmerking: event.label,
    sourceSchoolEventId: event.id,
    generated: true
  };
}

function addMinutesToTime(value, minutesToAdd) {
  const minutes = timeToMinutes(value);
  if (minutes === null) return value || "";
  const normalized = (minutes + minutesToAdd + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function isDateInRange(date, startDate, endDate) {
  return Boolean(date && startDate && endDate && date >= startDate && date <= endDate);
}

function getWeekdayLabels() {
  return WEEKDAY_OPTIONS.reduce((labels, day) => {
    labels[day.value] = day.label;
    return labels;
  }, {});
}

function addChild(input) {
  const child = {
    id: generateId("kind"),
    naam: String(input.naam || "").trim(),
    schoolNaam: String(input.schoolNaam || "").trim()
  };
  if (!child.naam) return;
  state.data.kinderen = [
    ...getChildren().filter((item) => item.naam.toLowerCase() !== child.naam.toLowerCase()),
    child
  ];
  saveData("kind_toegevoegd");
  renderSettingsPanel();
}

function deleteChild(id) {
  state.data.kinderen = getChildren().filter((child) => child.id !== id);
  state.data.instellingen.schoolTijden = getSchoolTimes().filter((schoolTime) => schoolTime.kindId !== id);
  saveData("kind_verwijderd");
  renderSettingsPanel();
}

function addSchoolTime(input) {
  const schoolTime = {
    id: generateId("schooltijd"),
    kindId: input.kindId || "alle_kinderen",
    dag: WEEKDAY_OPTIONS.some((day) => day.value === String(input.dag)) ? String(input.dag) : "1",
    start: input.start || "",
    einde: input.einde || "",
    brengenNodig: input.brengenNodig === "true",
    halenNodig: input.halenNodig === "true",
    opmerking: String(input.opmerking || "").trim()
  };
  if (!schoolTime.start || !schoolTime.einde) return;
  state.data.instellingen.schoolTijden = [
    ...getSchoolTimes().filter((item) => getSchoolTimeKey(item) !== getSchoolTimeKey(schoolTime)),
    schoolTime
  ];
  saveData("schooltijd_toegevoegd");
  renderSettingsPanel();
}

function deleteSchoolTime(id) {
  state.data.instellingen.schoolTijden = getSchoolTimes().filter((schoolTime) => schoolTime.id !== id);
  saveData("schooltijd_verwijderd");
  renderSettingsPanel();
}

function addSchoolPeriod(input) {
  const period = {
    id: generateId("context"),
    type: input.type === "studiedag" ? "studiedag" : "schoolvakantie",
    naam: String(input.naam || "").trim(),
    startDatum: input.startDatum || "",
    eindDatum: input.eindDatum || input.startDatum || "",
    bronId: "bron_school_handmatig",
    opmerking: String(input.opmerking || "").trim()
  };
  if (!period.naam || !period.startDatum || !period.eindDatum) return;
  state.data.contextPeriodes = [
    ...getSchoolPeriods().filter((item) => getSchoolPeriodKey(item) !== getSchoolPeriodKey(period)),
    period,
    ...state.data.contextPeriodes.filter((item) => !["schoolvakantie", "studiedag"].includes(item.type))
  ];
  rerunAllMonths();
  saveData("schoolperiode_toegevoegd");
  renderSettingsPanel();
}

function deleteSchoolPeriod(id) {
  state.data.contextPeriodes = state.data.contextPeriodes.filter((period) => period.id !== id);
  rerunAllMonths();
  saveData("schoolperiode_verwijderd");
  renderSettingsPanel();
}

function getSchoolTimeKey(schoolTime) {
  return [schoolTime.kindId, schoolTime.dag, schoolTime.start, schoolTime.einde].join("|");
}

function getSchoolPeriodKey(period) {
  return [
    period.type,
    String(period.naam || "").trim().toLowerCase(),
    period.startDatum,
    period.eindDatum
  ].join("|");
}

function getSchoolTimeLabel(schoolTime) {
  const child = getChildren().find((item) => item.id === schoolTime.kindId);
  const childLabel = child ? child.naam : "Alle kinderen";
  const dayLabel = getWeekdayLabels()[schoolTime.dag] || schoolTime.dag;
  return `${childLabel} - ${dayLabel}`;
}

function rerunAllMonths() {
  state.data.maandPlanningen.forEach((month) => runAnalysis(month.id));
}

function importSchoolIcalFile(file) {
  if (!file) return;
  file.text()
    .then((text) => importSchoolIcalText(text, file.name || "schoolagenda.ics"))
    .catch(() => window.alert("iCal-bestand kon niet worden gelezen."));
}

function saveSchoolIcalUrl(input) {
  state.data.instellingen.schoolIcalUrl = String(input.schoolIcalUrl || "").trim();
  saveData("school_ical_link_opgeslagen");
  renderSettingsPanel();
}

function importSchoolIcalUrl() {
  const url = String(state.data.instellingen.schoolIcalUrl || "").trim();
  if (!url) {
    window.alert("Vul eerst een iCal-link van school in en sla deze op.");
    return;
  }

  const fetchUrl = normalizeCalendarUrl(url);
  const fetchCalendar = window.fetch || fetch;
  return fetchCalendar(fetchUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    })
    .then((text) => importSchoolIcalText(text, url))
    .catch(() => {
      window.alert("De iCal-link kon niet worden ingelezen. Webcal-links worden automatisch als https geprobeerd, maar vaak blokkeert de schoolserver directe browser-toegang. Download dan het .ics-bestand en gebruik iCal school importeren.");
    });
}

function normalizeCalendarUrl(url) {
  const value = String(url || "").trim();
  if (value.toLowerCase().startsWith("webcal://")) {
    return `https://${value.slice(9)}`;
  }
  return value;
}

function importSchoolIcalText(text, sourceName = "schoolagenda.ics") {
  const events = parseIcalEvents(text);
  let added = 0;
  let skipped = 0;

  events.forEach((event) => {
    const period = mapSchoolIcalEventToPeriod(event, sourceName);
    if (!period) {
      skipped += 1;
      return;
    }
    if (getSchoolPeriods().some((item) => getSchoolPeriodKey(item) === getSchoolPeriodKey(period))) {
      skipped += 1;
      return;
    }
    state.data.contextPeriodes.push(period);
    added += 1;
  });

  if (added) {
    rerunAllMonths();
    saveData("school_ical_geimporteerd");
    renderSettingsPanel();
  }
  window.alert(`${added} vakantie/studiedag item(s) geimporteerd uit ${sourceName}. ${skipped} item(s) overgeslagen.`);
}

function importRosterIcalUrls() {
  const urls = getRosterIcalUrls();
  const entries = Object.entries(urls).filter(([, url]) => String(url || "").trim());
  if (!entries.length) {
    window.alert("Vul eerst minimaal een rooster-iCal link in en sla deze op.");
    return Promise.resolve();
  }

  return Promise.all(entries.map(([personId, url]) => importRosterIcalUrlForPerson(personId, url)))
    .then((results) => {
      const added = results.reduce((sum, result) => sum + result.added, 0);
      const skipped = results.reduce((sum, result) => sum + result.skipped, 0);
      window.alert(`${added} gepubliceerde roosteritem(s) geimporteerd. ${skipped} item(s) overgeslagen.`);
    });
}

function importRosterIcalUrlForPerson(personId, url) {
  const fetchUrl = normalizeCalendarUrl(url);
  const fetchCalendar = window.fetch || fetch;
  return fetchCalendar(fetchUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    })
    .then((text) => importRosterIcalText(personId, text, url, false))
    .catch(() => {
      window.alert(`De rooster-iCal link van ${getPersonLabel(personId)} kon niet worden ingelezen. Download dan het .ics-bestand en gebruik de bestand-import.`);
      return { added: 0, skipped: 0 };
    });
}

function importRosterIcalFile(personId, file) {
  if (!file) return;
  file.text()
    .then((text) => {
      const result = importRosterIcalText(personId, text, file.name || "rooster.ics", false);
      window.alert(`${result.added} gepubliceerde roosteritem(s) geimporteerd voor ${getPersonLabel(personId)}. ${result.skipped} item(s) overgeslagen.`);
    })
    .catch(() => window.alert("Rooster-iCal bestand kon niet worden gelezen."));
}

function importRosterIcalText(personId, text, sourceName = "rooster.ics", showAlert = true) {
  const sourceId = getRosterIcalSourceId(personId);
  const events = parseIcalEvents(text);
  const services = events
    .map((event) => mapRosterIcalEventToService(event, personId, sourceName))
    .filter(Boolean);
  const skipped = events.length - services.length;
  const affectedMonthIds = new Set(services.map((service) => service.maandPlanningId));

  state.data.diensten = state.data.diensten.filter((service) => {
    if (service.bronId !== sourceId || !isPublishedRosterService(service)) return true;
    affectedMonthIds.add(service.maandPlanningId);
    return false;
  });
  state.data.diensten.push(...services);
  affectedMonthIds.forEach((monthId) => ensurePublishedRosterMonth(monthId));
  affectedMonthIds.forEach(runAnalysis);

  if (services.length || affectedMonthIds.size) {
    saveData("rooster_ical_geimporteerd");
    renderSettingsPanel();
    if (state.currentView === "cockpit") renderApp();
  }
  if (showAlert) {
    window.alert(`${services.length} gepubliceerde roosteritem(s) geimporteerd uit ${sourceName}. ${skipped} item(s) overgeslagen.`);
  }
  return { added: services.length, skipped };
}

function mapRosterIcalEventToService(event, personId, sourceName) {
  const start = parseIcalDateTime(event.DTSTART);
  const end = parseIcalDateTime(event.DTEND);
  if (!start || !end) return null;
  const summary = String(event.SUMMARY || "Gepubliceerde dienst").trim();
  const dutyName = findRosterDutyNameForEvent(personId, summary, start.time, end.time);
  const monthId = dateToMonthId(start.date);
  return {
    id: generateId("dienst"),
    persoonId: personId,
    maandPlanningId: monthId,
    datum: start.date,
    start: dutyName?.start || start.time,
    einde: dutyName?.einde || end.time,
    dienstCode: dutyName?.naam || summary,
    dienstType: dutyName?.dienstType || inferDutyTypeFromTime(start.time, end.time),
    locatie: dutyName?.locatie || dutyName?.post || String(event.LOCATION || "").trim(),
    roosterLaag: "gepubliceerd_rooster",
    status: "gepubliceerd",
    bronId: getRosterIcalSourceId(personId),
    ruilbaar: "nee",
    sleutelAkkoord: true,
    reistijdVoorMinuten: toPositiveNumber(dutyName?.reistijdVoorMinuten, DEFAULT_TRAVEL_MINUTES),
    reistijdNaMinuten: toPositiveNumber(dutyName?.reistijdNaMinuten, DEFAULT_TRAVEL_MINUTES),
    reisOpmerking: dutyName?.reisOpmerking || "",
    opmerking: `Geimporteerd uit ${sourceName}`
  };
}

function parseIcalDateTime(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
  if (!match) return null;
  return {
    date: `${match[1]}-${match[2]}-${match[3]}`,
    time: `${match[4]}:${match[5]}`
  };
}

function findRosterDutyNameForEvent(personId, summary, start, end) {
  const normalizedSummary = normalizeAiText(summary);
  return getDutyNames().find((dutyName) => {
    if (!(dutyName.persoonId === personId || dutyName.persoonId === "beiden")) return false;
    return normalizeAiText(dutyName.naam) && normalizedSummary.includes(normalizeAiText(dutyName.naam));
  }) || getDutyNames().find((dutyName) => {
    if (!(dutyName.persoonId === personId || dutyName.persoonId === "beiden")) return false;
    return dutyName.start === start && dutyName.einde === end;
  }) || null;
}

function inferDutyTypeFromTime(start, end) {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return "overig";
  if (endMinutes <= startMinutes || startMinutes >= 20 * 60) return "nacht";
  if (startMinutes >= 12 * 60) return "laat";
  if (startMinutes < 8 * 60) return "vroeg";
  return "dag";
}

function getRosterIcalSourceId(personId) {
  return `bron_rooster_ical_${personId}`;
}

function ensurePublishedRosterMonth(monthId) {
  if (getMonth(monthId)) return;
  const [year, month] = monthId.split("-").map(Number);
  state.data.maandPlanningen.push({
    id: monthId,
    jaar: year,
    maand: month,
    planningStage: "R4_gepubliceerd",
    samenvattingStatus: "goed",
    aangemaaktOp: new Date().toISOString()
  });
}

function parseIcalEvents(text) {
  const lines = unfoldIcalLines(String(text || ""));
  const events = [];
  let current = null;

  lines.forEach((line) => {
    if (line === "BEGIN:VEVENT") {
      current = {};
      return;
    }
    if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
      return;
    }
    if (!current || !line.includes(":")) return;
    const [rawKey, ...valueParts] = line.split(":");
    const key = rawKey.split(";")[0].toUpperCase();
    const value = unescapeIcalText(valueParts.join(":"));
    if (!current[key]) current[key] = value;
  });

  return events;
}

function unfoldIcalLines(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .reduce((lines, line) => {
      if (/^[ \t]/.test(line) && lines.length) {
        lines[lines.length - 1] += line.slice(1);
      } else {
        lines.push(line.trimEnd());
      }
      return lines;
    }, []);
}

function mapSchoolIcalEventToPeriod(event, sourceName) {
  const summary = String(event.SUMMARY || "Schoolagenda").trim();
  const type = getSchoolPeriodTypeFromSummary(summary);
  if (!type) return null;
  const startDatum = parseIcalDate(event.DTSTART);
  const rawEnd = parseIcalDate(event.DTEND) || startDatum;
  if (!startDatum || !rawEnd) return null;
  const eindDatum = event.DTEND ? previousDateValue(rawEnd) : rawEnd;
  return {
    id: generateId("context"),
    type,
    naam: summary,
    startDatum,
    eindDatum: eindDatum < startDatum ? startDatum : eindDatum,
    bronId: `bron_school_ical_${slugify(sourceName).slice(0, 24) || "bestand"}`,
    opmerking: sourceName
  };
}

function getSchoolPeriodTypeFromSummary(summary) {
  const value = summary.toLowerCase();
  if (value.includes("studiedag") || value.includes("studie dag")) return "studiedag";
  if (value.includes("vakantie") || value.includes("schoolvrij") || value.includes("vrije dag")) return "schoolvakantie";
  return null;
}

function parseIcalDate(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return "";
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function previousDateValue(dateValue) {
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

function unescapeIcalText(value) {
  return String(value || "")
    .replaceAll("\\n", " ")
    .replaceAll("\\,", ",")
    .replaceAll("\\;", ";")
    .replaceAll("\\\\", "\\");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
