"use strict";

let state = {
  data: createEmptyData(),
  currentView: "months",
  editing: null,
  quickEntry: null,
  selectedDate: null,
  pendingFocusDate: null,
  pendingProblemId: null,
  cockpitFilter: "all",
  editingDutyNameId: null,
  editingFamilyTemplateId: null,
  editingWishTemplateId: null
};

function createEmptyData() {
  const data = {
    dataVersion: DATA_VERSION,
    appVersion: APP_VERSION,
    revisionId: "",
    lastModified: "",
    lastModifiedBy: "browser",
    bronHistorie: [],
    instellingen: {
      actieveMaandId: null,
      standaardPlanningStage: "R1_wensen",
      contractUren: getDefaultContractHours(),
      dienstNamen: getDefaultDutyNames(),
      reistijdStandaardIngesteld: true,
      evaDienstnamenIngesteld: true,
      evaDienstnamenNoordLabelIngesteld: true,
      ronaldOostDienstnamenIngesteld: true,
      gezinsSjablonen: [],
      wensSjablonen: []
    },
    wijzigingsLog: []
  };

  MODULE_1_ARRAYS.forEach((key) => {
    data[key] = [];
  });

  return data;
}

function normalizeData(raw) {
  const base = createEmptyData();
  const incoming = raw && typeof raw === "object" ? raw : {};
  const normalized = { ...base, ...incoming };

  MODULE_1_ARRAYS.forEach((key) => {
    normalized[key] = Array.isArray(incoming[key]) ? incoming[key] : [];
  });

  normalized.instellingen = {
    ...base.instellingen,
    ...(incoming.instellingen || {})
  };
  normalized.instellingen.dienstNamen = normalizeDutyNames(incoming.instellingen?.dienstNamen);
  normalized.instellingen.reistijdStandaardIngesteld = Boolean(incoming.instellingen?.reistijdStandaardIngesteld);
  if (!normalized.instellingen.reistijdStandaardIngesteld) {
    normalized.instellingen.dienstNamen = applyDefaultTravelMinutes(normalized.instellingen.dienstNamen);
    normalized.instellingen.reistijdStandaardIngesteld = true;
  }
  normalized.instellingen.evaDienstnamenIngesteld = Boolean(incoming.instellingen?.evaDienstnamenIngesteld);
  if (!normalized.instellingen.evaDienstnamenIngesteld) {
    normalized.instellingen.dienstNamen = addMissingDefaultDutyNames(normalized.instellingen.dienstNamen, "persoon_vrouw");
    normalized.instellingen.evaDienstnamenIngesteld = true;
  }
  normalized.instellingen.evaDienstnamenNoordLabelIngesteld = Boolean(incoming.instellingen?.evaDienstnamenNoordLabelIngesteld);
  if (!normalized.instellingen.evaDienstnamenNoordLabelIngesteld) {
    normalized.instellingen.dienstNamen = renameDefaultDutyNames(normalized.instellingen.dienstNamen, "persoon_vrouw");
    normalized.instellingen.evaDienstnamenNoordLabelIngesteld = true;
  }
  normalized.instellingen.ronaldOostDienstnamenIngesteld = Boolean(incoming.instellingen?.ronaldOostDienstnamenIngesteld);
  if (!normalized.instellingen.ronaldOostDienstnamenIngesteld) {
    normalized.instellingen.dienstNamen = addMissingDefaultDutyNames(normalized.instellingen.dienstNamen, "persoon_jij", "Oost");
    normalized.instellingen.ronaldOostDienstnamenIngesteld = true;
  }
  normalized.instellingen.contractUren = normalizeContractHours(incoming.instellingen?.contractUren);
  normalized.instellingen.gezinsSjablonen = normalizeFamilyTemplates(incoming.instellingen?.gezinsSjablonen);
  normalized.instellingen.wensSjablonen = normalizeWishTemplates([
    ...normalizeWishTemplates(incoming.instellingen?.wensSjablonen),
    ...legacyRecoveryRulesToWishTemplates(incoming.instellingen?.herstelRegels)
  ]);
  delete normalized.instellingen.herstelRegels;
  normalized.instellingen.schoolTijden = normalizeSchoolTimes(incoming.instellingen?.schoolTijden);
  normalized.instellingen.schoolIcalUrl = String(incoming.instellingen?.schoolIcalUrl || "").trim();
  normalized.kinderen = normalizeChildren(normalized.kinderen);
  normalized.contextPeriodes = normalizeContextPeriods(normalized.contextPeriodes);
  normalized.bronHistorie = Array.isArray(incoming.bronHistorie) ? incoming.bronHistorie : [];
  normalized.wijzigingsLog = Array.isArray(incoming.wijzigingsLog) ? incoming.wijzigingsLog : [];
  normalized.dataVersion = Number(incoming.dataVersion) || DATA_VERSION;
  normalized.appVersion = incoming.appVersion || APP_VERSION;

  return normalized;
}

function getDefaultDutyNames() {
  return DEFAULT_DUTY_NAMES.map((dutyName) => ({ ...dutyName }));
}

function getDefaultContractHours() {
  return Object.fromEntries(Object.entries(CONTRACT_HOURS).map(([personId, contract]) => {
    return [personId, { ...contract }];
  }));
}

function normalizeContractHours(value) {
  const incoming = value && typeof value === "object" ? value : {};
  return Object.fromEntries(Object.entries(CONTRACT_HOURS).map(([personId, defaults]) => {
    const contract = incoming[personId] && typeof incoming[personId] === "object" ? incoming[personId] : {};
    return [personId, {
      weeklyHours: toPositiveNumber(contract.weeklyHours, defaults.weeklyHours),
      monthlyToleranceHours: toPositiveNumber(contract.monthlyToleranceHours, defaults.monthlyToleranceHours)
    }];
  }));
}

function getPlanningStageLabels() {
  return PLANNING_STAGES.reduce((labels, stage) => {
    labels[stage.value] = stage.label;
    return labels;
  }, {});
}

function normalizeDutyNames(value) {
  const source = Array.isArray(value) ? value : getDefaultDutyNames();
  return source
    .map((dutyName) => ({
      id: dutyName.id || generateId("dienstnaam"),
      naam: String(dutyName.naam || "").trim(),
      persoonId: DUTY_PERSON_OPTIONS[dutyName.persoonId] ? dutyName.persoonId : "persoon_jij",
      beschikbaarVanaf: PLANNING_STAGES.some((stage) => stage.value === dutyName.beschikbaarVanaf) ? dutyName.beschikbaarVanaf : "R1_wensen",
      post: String(dutyName.post || dutyName.locatie || "").trim(),
      dienstType: SERVICE_TYPES.includes(dutyName.dienstType) ? dutyName.dienstType : "overig",
      start: dutyName.start || "",
      einde: dutyName.einde || "",
      locatie: String(dutyName.locatie || "").trim(),
      reistijdVoorMinuten: toPositiveNumber(dutyName.reistijdVoorMinuten, 0),
      reistijdNaMinuten: toPositiveNumber(dutyName.reistijdNaMinuten, 0),
      reisOpmerking: String(dutyName.reisOpmerking || "").trim(),
      beschikbareDagen: normalizeDutyWeekdays(dutyName.beschikbareDagen)
    }))
    .filter((dutyName) => dutyName.naam);
}

function applyDefaultTravelMinutes(dutyNames) {
  return dutyNames.map((dutyName) => {
    if (!["persoon_jij", "persoon_vrouw", "beiden"].includes(dutyName.persoonId)) return dutyName;
    return {
      ...dutyName,
      reistijdVoorMinuten: dutyName.reistijdVoorMinuten || DEFAULT_TRAVEL_MINUTES,
      reistijdNaMinuten: dutyName.reistijdNaMinuten || DEFAULT_TRAVEL_MINUTES
    };
  });
}

function addMissingDefaultDutyNames(dutyNames, personId, post = "") {
  const existingIds = new Set(dutyNames.map((dutyName) => dutyName.id));
  const existingKeys = new Set(dutyNames.map(getDutyNameKey));
  const missing = getDefaultDutyNames().filter((dutyName) => {
    return dutyName.persoonId === personId &&
      (!post || dutyName.post === post) &&
      !existingIds.has(dutyName.id) &&
      !existingKeys.has(getDutyNameKey(dutyName));
  });
  return [...dutyNames, ...missing];
}

function renameDefaultDutyNames(dutyNames, personId) {
  const defaultNamesById = new Map(getDefaultDutyNames()
    .filter((dutyName) => dutyName.persoonId === personId)
    .map((dutyName) => [dutyName.id, dutyName.naam]));
  return dutyNames.map((dutyName) => {
    const defaultName = defaultNamesById.get(dutyName.id);
    return defaultName ? { ...dutyName, naam: defaultName } : dutyName;
  });
}

function normalizeDutyWeekdays(value) {
  const validDays = new Set(WEEKDAY_OPTIONS.map((day) => day.value));
  const source = Array.isArray(value) && value.length ? value : WEEKDAY_OPTIONS.map((day) => day.value);
  return [...new Set(source.map(String).filter((day) => validDays.has(day)))];
}

function normalizeFamilyTemplates(value) {
  const source = Array.isArray(value) ? value : [];
  return source
    .map((template) => ({
      id: template.id || generateId("gezin_sjabloon"),
      naam: String(template.naam || "").trim(),
      type: FAMILY_BLOCK_TYPES.includes(template.type) ? template.type : "overig",
      beschikbareDagen: normalizeDutyWeekdays(template.beschikbareDagen),
      start: template.start || "",
      einde: template.einde || "",
      hardheid: template.hardheid === "zacht" ? "zacht" : "hard",
      dekkingNodig: template.dekkingNodig !== false && template.dekkingNodig !== "false",
      opmerking: String(template.opmerking || "").trim()
    }))
    .filter((template) => template.naam);
}

function normalizeWishTemplates(value) {
  const source = Array.isArray(value) ? value : [];
  return source
    .map((template) => ({
      id: template.id || generateId("wens_sjabloon"),
      naam: String(template.naam || "").trim(),
      categorie: WISH_TEMPLATE_CATEGORIES[template.categorie] ? template.categorie : "overig",
      scope: WISH_TEMPLATE_SCOPE[template.scope] ? template.scope : "gezin",
      hardheid: WISH_TEMPLATE_STRENGTH[template.hardheid] ? template.hardheid : "normaal",
      timing: WISH_TEMPLATE_TIMING[template.timing] ? template.timing : "hele_maand",
      kernzin: String(template.kernzin || template.naam || "").trim(),
      wanneerTekst: String(template.wanneerTekst || (WISH_TEMPLATE_TIMING[template.timing] || "")).trim(),
      voorWieTekst: String(template.voorWieTekst || (WISH_TEMPLATE_SCOPE[template.scope] || "")).trim(),
      vermijdTekst: String(template.vermijdTekst || "").trim(),
      magWelTekst: String(template.magWelTekst || "").trim(),
      beschrijving: String(template.beschrijving || template.opmerking || "").trim(),
      actief: template.actief !== false && template.actief !== "false"
    }))
    .filter((template) => template.naam);
}

function legacyRecoveryRulesToWishTemplates(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((rule) => rule && rule.herstelTot)
    .map((rule) => {
      const contextLabel = rule.context === "reeks" ? "in een reeks" : "bij een losse dienst";
      const targetLabel = rule.geldtVoorSchoolGezin === false || rule.geldtVoorSchoolGezin === "false"
        ? "alleen werkdiensten"
        : "diensten en school/gezin";
      return {
        id: `wens_${rule.id || generateId("oud_herstel")}`,
        naam: `Herstel na ${formatCodeLabel(rule.dienstType || "dienst")} tot ${rule.herstelTot}`,
        categorie: "herstel",
        scope: PERSON_LABELS[rule.persoonId] ? rule.persoonId : "persoon_jij",
        hardheid: WISH_TEMPLATE_STRENGTH[rule.hardheid] ? rule.hardheid : "sterk",
        timing: rule.dienstType === "nacht" ? "na_nachtdienst" : "hele_maand",
        kernzin: `Na ${formatCodeLabel(rule.dienstType || "dienst")} herstellen tot ${rule.herstelTot}`,
        wanneerTekst: contextLabel,
        voorWieTekst: getPersonLabel(rule.persoonId || "persoon_jij"),
        vermijdTekst: `Geen conflicterende ${targetLabel} voor ${rule.herstelTot}.`,
        magWelTekst: "",
        beschrijving: `Omgezet uit oude herstelregel: ${contextLabel}, ${targetLabel}.`,
        actief: rule.actief !== false && rule.actief !== "false"
      };
    });
}

function createMonth(year, month, planningStage) {
  const monthId = `${year}-${String(month).padStart(2, "0")}`;
  const existing = getMonth(monthId);
  if (existing) {
    openMonth(monthId);
    return existing;
  }

  const monthPlanning = {
    id: monthId,
    jaar: Number(year),
    maand: Number(month),
    planningStage,
    samenvattingStatus: "onvolledig",
    laatstBijgewerkt: new Date().toISOString()
  };

  state.data.maandPlanningen.push(monthPlanning);
  state.data.maandPlanningen.sort((a, b) => a.id.localeCompare(b.id));
  state.data.instellingen.actieveMaandId = monthId;
  state.quickEntry = null;
  state.selectedDate = `${monthId}-01`;
  placeFamilyTemplatesInMonth(monthPlanning);
  runAnalysis(monthId);
  saveData("maand_aangemaakt");
  showView("cockpit");
  return monthPlanning;
}

function openMonth(monthId, selectedDate = null) {
  state.editing = null;
  state.quickEntry = null;
  state.selectedDate = selectedDate;
  state.data.instellingen.actieveMaandId = monthId;
  saveData("maand_geopend");
  showView("cockpit");
}

function deleteMonth(monthId) {
  const month = getMonth(monthId);
  if (!month) return;

  const counts = getMonthDataCounts(monthId);
  const ok = window.confirm(`Maand ${getMonthLabel(monthId)} verwijderen?\n\nDiensten: ${counts.services}\nOverige gezinsafspraken: ${counts.familyBlocks}\nWensen: ${counts.wishes}\nActies: ${counts.actions}\n\nEr wordt eerst een lokale snapshot gemaakt.`);
  if (!ok) return;

  createSnapshot(`voor_maand_verwijderen_${monthId}`);
  removeMonthData(monthId);
  state.data.maandPlanningen = state.data.maandPlanningen.filter((item) => item.id !== monthId);

  if (state.data.instellingen.actieveMaandId === monthId) {
    state.data.instellingen.actieveMaandId = null;
    state.editing = null;
    state.quickEntry = null;
    state.selectedDate = null;
  }

  saveData("maand_verwijderd");
  showView("months");
}

function duplicateMonth(monthId) {
  const month = getMonth(monthId);
  if (!month) return;

  const targetId = getNextDuplicateMonthId(monthId);
  const [targetYear, targetMonth] = targetId.split("-").map(Number);
  const duplicatedMonth = {
    ...month,
    id: targetId,
    jaar: targetYear,
    maand: targetMonth,
    samenvattingStatus: "onvolledig",
    laatstBijgewerkt: new Date().toISOString()
  };

  state.data.maandPlanningen.push(duplicatedMonth);
  state.data.maandPlanningen.sort((a, b) => a.id.localeCompare(b.id));
  duplicateMonthCollection("diensten", monthId, targetId, copyServiceForMonth);
  duplicateMonthCollection("gezinsVerplichtingen", monthId, targetId, copyFamilyBlockForMonth);
  duplicateMonthCollection("wensen", monthId, targetId, copyWishForMonth);
  state.data.instellingen.actieveMaandId = targetId;
  state.quickEntry = null;
  state.selectedDate = null;
  runAnalysis(targetId);
  saveData("maand_gedupliceerd");
  showView("cockpit");
}

function getNextDuplicateMonthId(monthId) {
  const [year, month] = monthId.split("-").map(Number);
  let date = new Date(year, month, 1);
  let candidate = dateToMonthIdFromParts(date.getFullYear(), date.getMonth() + 1);
  while (getMonth(candidate)) {
    date = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    candidate = dateToMonthIdFromParts(date.getFullYear(), date.getMonth() + 1);
  }
  return candidate;
}

function dateToMonthIdFromParts(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function duplicateMonthCollection(collectionName, sourceMonthId, targetMonthId, copyFn) {
  const copies = getMonthItems(sourceMonthId, collectionName).map((item) => copyFn(item, targetMonthId));
  state.data[collectionName].push(...copies);
}

function copyServiceForMonth(service, targetMonthId) {
  return {
    ...service,
    id: generateId("dienst"),
    maandPlanningId: targetMonthId,
    datum: moveDateToMonth(service.datum, targetMonthId)
  };
}

function copyFamilyBlockForMonth(block, targetMonthId) {
  return {
    ...block,
    id: generateId("gezin"),
    maandPlanningId: targetMonthId,
    datum: moveDateToMonth(block.datum, targetMonthId)
  };
}

function copyWishForMonth(wish, targetMonthId) {
  return {
    ...wish,
    id: generateId("wens"),
    maandPlanningId: targetMonthId,
    datum: moveDateToMonth(wish.datum, targetMonthId)
  };
}

function moveDateToMonth(dateValue, targetMonthId) {
  const day = Number(String(dateValue || "").slice(8, 10)) || 1;
  const [year, month] = targetMonthId.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${targetMonthId}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

function getMonthLabel(monthId) {
  const month = getMonth(monthId);
  if (!month) return "Geen maand";
  return `${MONTH_NAMES[month.maand - 1]} ${month.jaar}`;
}

function getStageLabel(stage) {
  const match = PLANNING_STAGES.find((item) => item.value === stage);
  return match ? match.label : stage;
}

function getNextPlanningStage(stage) {
  const index = PLANNING_STAGES.findIndex((item) => item.value === stage);
  if (index === -1 || index >= PLANNING_STAGES.length - 1) return null;
  return PLANNING_STAGES[index + 1];
}

function showView(viewName) {
  state.currentView = viewName;
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === `view-${viewName}`);
  });
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });
  renderApp();
}

function renderApp() {
  document.getElementById("app-version").textContent = `Appversie ${APP_VERSION}`;
  renderMonthOverview();
  renderMonthCockpit();
  renderQuickEntry();
  renderActionList();
  renderSettingsPanel();
  renderStoragePanel();
  focusPendingDay();
}

function renderMonthOverview() {
  const list = document.getElementById("month-list");
  if (state.data.maandPlanningen.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        Er zijn nog geen maanden. Maak de eerste maand aan om de cockpit te openen.
      </div>
    `;
    return;
  }

  list.innerHTML = state.data.maandPlanningen.map((month) => {
    const actions = getOpenActions(month.id);
    const serviceCount = getMonthItems(month.id, "diensten").length;
    const familyCount = getMonthItems(month.id, "gezinsVerplichtingen").length;
    const isActive = state.data.instellingen.actieveMaandId === month.id;
    return `
      <article class="month-card ${isActive ? "month-card-active" : ""}">
        <h3>${escapeHtml(getMonthLabel(month.id))}</h3>
        <div class="cockpit-badges">
          ${isActive ? "<span class=\"active-month-pill\">Actief</span>" : ""}
          <span class="stage-pill">${escapeHtml(getStageLabel(month.planningStage))}</span>
          <span class="status-pill status-${month.samenvattingStatus}">
            ${escapeHtml(STATUS_LABELS[month.samenvattingStatus] || month.samenvattingStatus)}
          </span>
        </div>
        <dl>
          <div><dt>Open acties</dt><dd>${actions.length}</dd></div>
          <div><dt>Diensten</dt><dd>${serviceCount}</dd></div>
          <div><dt>Gezin overig</dt><dd>${familyCount}</dd></div>
          <div><dt>Laatst bijgewerkt</dt><dd>${formatDateTime(month.laatstBijgewerkt)}</dd></div>
        </dl>
        <div class="month-actions">
          <button type="button" data-open-month="${month.id}">Open maand</button>
          <button type="button" class="subtle-button" data-duplicate-month="${month.id}">Dupliceer</button>
          <button type="button" class="danger-outline-button" data-delete-month="${month.id}">Verwijder</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderMonthCockpit() {
  const content = document.getElementById("cockpit-content");
  const activeMonthId = state.data.instellingen.actieveMaandId;
  const month = activeMonthId ? getMonth(activeMonthId) : null;

  if (!month) {
    content.innerHTML = `
      <div class="empty-state">
        Er is nog geen maand geopend. Maak een maand aan of open er een vanuit het maandoverzicht.
      </div>
    `;
    return;
  }

  const days = buildMonthDays(month);
  const selectedDay = getSelectedDayForMonth(month, days);
  const nextStage = getNextPlanningStage(month.planningStage);

  content.innerHTML = `
    <div class="cockpit-header">
      <div class="cockpit-title">
        <p class="eyebrow">Maandbeheer</p>
        <h2 id="cockpit-title">${escapeHtml(getMonthLabel(month.id))}</h2>
        <div class="cockpit-badges">
          <span class="stage-pill">${escapeHtml(getStageLabel(month.planningStage))}</span>
          <span class="status-pill status-${month.samenvattingStatus}">
            ${escapeHtml(STATUS_LABELS[month.samenvattingStatus] || month.samenvattingStatus)}
          </span>
        </div>
      </div>
      <div class="toolbar">
        <button type="button" class="subtle-button" data-view-target="months">Maanden</button>
        <button type="button" data-request-ai-roster="${escapeHtml(month.id)}">AI rooster aanvullen</button>
        ${nextStage ? `<button type="button" data-advance-month-stage="${escapeHtml(month.id)}">Zet naar ${escapeHtml(nextStage.label)}</button>` : "<button type=\"button\" class=\"subtle-button\" disabled>Laatste ronde</button>"}
        <label class="stage-select-label">
          Ronde
          <select data-month-stage-select="${escapeHtml(month.id)}">
            ${PLANNING_STAGES.map((stage) => `<option value="${escapeHtml(stage.value)}"${selectedAttr(month.planningStage, stage.value)}>${escapeHtml(stage.label)}</option>`).join("")}
          </select>
        </label>
        <button type="button" class="subtle-button" data-duplicate-month="${month.id}">Dupliceer maand</button>
        <button type="button" class="danger-outline-button" data-delete-month="${month.id}">Verwijder maand</button>
      </div>
    </div>

    <div class="month-management-layout">
      ${renderMonthBoard(month, days)}
      ${renderDayDetail(selectedDay)}
    </div>
  `;
}

function buildControlSummary(month, days) {
  const analyses = getVisibleAnalyses(month.id);
  const openActions = getOpenActions(month.id);
  const conflicts = analyses.filter((item) => item.ernst === "conflict");
  const checks = analyses.filter((item) => ["aandacht", "waarschuwing", "keuze_nodig"].includes(item.ernst));
  const incomplete = analyses.filter((item) => item.ernst === "onvolledig");
  const notifications = analyses.filter((item) => item.ernst === "notificatie");
  const closedNotifications = getClosedNotifications(month.id);
  const wishTemplates = getWishTemplates().filter((template) => template.actief);
  const okDays = days.filter((day) => {
    const hasContent = day.services.length || day.familyBlocks.length || day.wishes.length || day.schoolEvents.length;
    const hasProblem = day.analyses.length || day.actions.length;
    return hasContent && !hasProblem;
  });
  const oordeel = getHardAdviceLabel({ conflicts, checks, incomplete, notifications, openActions, month });

  return {
    month,
    oordeel,
    conflicts,
    checks,
    incomplete,
    notifications,
    closedNotifications,
    wishTemplates,
    openActions,
    okDays,
    checkedAt: month.laatstBijgewerkt
  };
}

function getHardAdviceLabel(summary) {
  if (summary.conflicts.length) return "Actie nodig";
  if (summary.incomplete.length) return "Invoer aanvullen";
  if (summary.checks.length || summary.openActions.length) return "Controleer";
  if (summary.notifications.length) return "Notificaties bekijken";
  if (summary.month.samenvattingStatus === "goed") return "Kan blijven staan";
  return "Controle beperkt";
}

function renderControlCenter(summary) {
  return `
    <section class="panel control-center control-${escapeHtml(summary.month.samenvattingStatus)}">
      <div class="control-header">
        <div>
          <p class="eyebrow">Controlecentrum</p>
          <h3 class="form-section-title">${escapeHtml(summary.oordeel)}</h3>
          <p class="control-meta">Laatste controle: ${escapeHtml(formatDateTime(summary.checkedAt))}</p>
        </div>
        <div class="toolbar">
          <button type="button" data-run-analysis="${escapeHtml(summary.month.id)}">Controle opnieuw uitvoeren</button>
        </div>
      </div>

      <div class="control-score-grid">
        ${renderControlScore("Conflicten", summary.conflicts.length, "conflict")}
        ${renderControlScore("Te controleren", summary.checks.length, "attention")}
        ${renderControlScore("Notificaties", summary.notifications.length, "notification")}
        ${renderControlScore("Onvolledig", summary.incomplete.length, "incomplete")}
        ${renderControlScore("Open acties", summary.openActions.length, "actions")}
        ${renderControlScore("Geen probleem", summary.okDays.length, "good")}
      </div>

      <div class="control-columns">
        ${renderWishTemplateContext(summary.wishTemplates)}
        ${renderControlSection("Conflicten", summary.conflicts, "Geen harde conflicten.", "conflict")}
        ${renderControlSection("Te controleren", summary.checks, "Geen controlepunten.", "attention")}
        ${renderControlSection("Notificaties", summary.notifications, "Geen zachte notificaties.", "notification")}
        ${renderControlSection("Afgehandelde notificaties", summary.closedNotifications, "Nog geen notificaties afgehandeld.", "notification-closed")}
        ${renderControlSection("Onvolledig", summary.incomplete, "Geen ontbrekende basisgegevens.", "incomplete")}
        ${renderOkDays(summary.okDays)}
      </div>
    </section>
  `;
}

function buildSleutelSummary(month, days) {
  const services = getMonthItems(month.id, "diensten");
  const checked = services.filter((service) => service.sleutelAkkoord);
  const open = services.filter((service) => !service.sleutelAkkoord);
  const openByDay = days
    .map((day) => ({
      date: day.date,
      services: day.services.filter((service) => !service.sleutelAkkoord)
    }))
    .filter((day) => day.services.length);
  const stageIndex = getPlanningStageIndex(month.planningStage);
  return {
    month,
    services,
    checked,
    open,
    openByDay,
    active: stageIndex >= getPlanningStageIndex("R2_afstemming")
  };
}

function renderSleutelPanel(summary) {
  const percentage = summary.services.length ? Math.round((summary.checked.length / summary.services.length) * 100) : 0;
  return `
    <section class="panel sleutel-panel ${summary.active ? "sleutel-panel-active" : ""}">
      <div class="control-header">
        <div>
          <p class="eyebrow">Ronde 2 sleutelen</p>
          <h3 class="form-section-title">${summary.open.length ? `${summary.open.length} dienst(en) nog checken` : "Alles afgevinkt"}</h3>
          <p class="control-meta">${summary.active ? "Vink diensten af als ze overeenkomen met het werkgeversysteem en er niet gesleuteld hoeft te worden." : "Deze checklist is vooral bedoeld voor R2. Je kunt hem alvast vullen."}</p>
        </div>
        <span class="status-pill ${summary.open.length ? "advice-status-aanvullen" : "advice-status-klaar"}">${percentage}% klaar</span>
      </div>

      <div class="advice-grid">
        ${renderAdviceMetric("Diensten", summary.services.length)}
        ${renderAdviceMetric("Afgevinkt", summary.checked.length)}
        ${renderAdviceMetric("Nog checken", summary.open.length)}
        ${renderAdviceMetric("Dagen open", summary.openByDay.length)}
      </div>

      ${summary.open.length ? `
        <div class="sleutel-list">
          ${summary.open.slice(0, 12).map(renderSleutelServiceRow).join("")}
        </div>
        ${summary.open.length > 12 ? `<p class="control-meta">Nog ${summary.open.length - 12} dienst(en) niet getoond in deze lijst. Ze staan wel in de maandkalender.</p>` : ""}
      ` : "<p class=\"muted-text\">Geen sleutelpunt open. De maand is lokaal afgevinkt tegen het werkgeversysteem.</p>"}
    </section>
  `;
}

function renderSleutelServiceRow(service) {
  const suggestions = buildServiceSwitchSuggestions(service).slice(0, 3);
  return `
    <article class="sleutel-row">
      <div class="sleutel-row-main">
        <div>
          <strong>${escapeHtml(formatLongDate(service.datum))}</strong>
          <span>${escapeHtml(formatServiceLabel(service))}</span>
        </div>
        <span class="switch-list-title">Opties zonder beschikbaarheidsclaim</span>
        ${renderSwitchSuggestionList(suggestions, true)}
      </div>
      <div class="sleutel-row-actions">
        <button type="button" class="tiny-button" data-edit-item="service" data-item-id="${escapeHtml(service.id)}">Bewerk dienst</button>
        <button type="button" class="tiny-button danger-text-button" data-delete-item="service" data-item-id="${escapeHtml(service.id)}">Verwijder dienst</button>
        <button type="button" class="tiny-button" data-toggle-sleutel-service="${escapeHtml(service.id)}">Klopt, geen sleutelen nodig</button>
      </div>
    </article>
  `;
}

function buildServiceSwitchSuggestions(service) {
  const month = getMonth(service.maandPlanningId || dateToMonthId(service.datum));
  const activeStage = month?.planningStage || state.data.instellingen.standaardPlanningStage;
  const currentDutyName = findDutyNameForServiceInput(service);
  const candidates = getDutyNames()
    .filter((dutyName) => isDutyNameAvailableFor(dutyName, service.persoonId, activeStage, service.datum))
    .filter((dutyName) => !isSameDutySuggestion(service, dutyName, currentDutyName))
    .map((dutyName) => scoreServiceSwitchSuggestion(service, dutyName, month))
    .sort((a, b) => a.score - b.score || a.startMinutes - b.startMinutes || a.label.localeCompare(b.label, "nl"));

  return candidates.slice(0, 6);
}

function isSameDutySuggestion(service, dutyName, currentDutyName) {
  const serviceCode = String(service.dienstCode || "").trim().toLowerCase();
  const dutyNameCode = String(dutyName.naam || "").trim().toLowerCase();
  if (currentDutyName && currentDutyName.id === dutyName.id) return true;
  return serviceCode === dutyNameCode &&
    service.start === dutyName.start &&
    service.einde === dutyName.einde &&
    String(service.locatie || "").trim().toLowerCase() === String(dutyName.post || dutyName.locatie || "").trim().toLowerCase();
}

function scoreServiceSwitchSuggestion(service, dutyName, month) {
  const simulated = buildSimulatedServiceFromDutyName(service, dutyName);
  const details = getServiceSwitchImpact(service, simulated, dutyName, month);
  return {
    dutyName,
    service: simulated,
    score: details.score,
    impactLabel: details.impactLabel,
    reasons: details.reasons,
    startMinutes: timeToMinutes(dutyName.start) ?? 9999,
    label: dutyName.naam
  };
}

function buildSimulatedServiceFromDutyName(service, dutyName) {
  return {
    ...service,
    dienstCode: dutyName.naam,
    dienstType: dutyName.dienstType,
    start: dutyName.start,
    einde: dutyName.einde,
    locatie: dutyName.post || dutyName.locatie || service.locatie,
    reistijdVoorMinuten: toPositiveNumber(dutyName.reistijdVoorMinuten, getServiceTravelMinutes(service, "before")),
    reistijdNaMinuten: toPositiveNumber(dutyName.reistijdNaMinuten, getServiceTravelMinutes(service, "after")),
    reisOpmerking: dutyName.reisOpmerking || service.reisOpmerking || ""
  };
}

function getServiceSwitchImpact(original, simulated, dutyName, month) {
  let score = 0;
  const reasons = [];

  if (original.dienstType === simulated.dienstType) {
    reasons.push("zelfde soort dienst");
  } else {
    score += 6;
    reasons.push(`ander type: ${formatCodeLabel(simulated.dienstType)}`);
  }

  const startShift = getTimeShiftMinutes(original.start, simulated.start);
  if (startShift <= 30) {
    reasons.push("bijna dezelfde starttijd");
  } else if (startShift <= 90) {
    score += 1;
    reasons.push(`start ${Math.round(startShift / 60 * 10) / 10} uur anders`);
  } else if (startShift <= 240) {
    score += 3;
    reasons.push(`start ${Math.round(startShift / 60 * 10) / 10} uur anders`);
  } else {
    score += 5;
    reasons.push("grote tijdschuif");
  }

  const durationShift = Math.abs(getServiceDurationHours(original) - getServiceDurationHours(simulated));
  if (durationShift > 0.5) {
    score += durationShift > 2 ? 4 : 2;
    reasons.push(`uren wijzigen ${formatHours(durationShift)}`);
  }

  const originalPost = String(original.locatie || "").trim().toLowerCase();
  const candidatePost = String(dutyName.post || dutyName.locatie || "").trim().toLowerCase();
  if (candidatePost && originalPost && candidatePost !== originalPost) {
    score += 2;
    reasons.push(`andere post: ${dutyName.post || dutyName.locatie}`);
  }

  const risk = getServiceSwitchRisk(simulated, month);
  if (risk.doubleCoverageHits) {
    score += risk.doubleCoverageHits * 8;
    reasons.push("raakt school/gezin terwijl jullie beiden bezet zijn");
  } else if (risk.coverageHits) {
    score += risk.coverageHits * 2;
    reasons.push("raakt school/gezin, check dekking");
  }
  if (risk.partnerOverlap) {
    score += risk.partnerOverlap * 2;
    reasons.push("overlap met dienst partner");
  }
  if (risk.wishHits) {
    score += risk.wishHits * 3;
    reasons.push("botst mogelijk met wens");
  }
  if (!risk.coverageHits && !risk.partnerOverlap && !risk.wishHits) {
    reasons.push("geen harde botsing gevonden");
  }

  return {
    score,
    reasons: [...new Set(reasons)].slice(0, 4),
    impactLabel: getSwitchImpactLabel(score)
  };
}

function getServiceSwitchRisk(service, month) {
  if (!month) return { coverageHits: 0, doubleCoverageHits: 0, partnerOverlap: 0, wishHits: 0 };
  const familyBlocks = [
    ...getMonthItems(month.id, "gezinsVerplichtingen"),
    ...getSchoolCoverageBlocksForMonth(month)
  ].filter((block) => block.dekkingNodig && block.datum === service.datum);
  const partnerServices = getMonthItems(month.id, "diensten")
    .filter((item) => item.id !== service.id && item.persoonId !== service.persoonId && item.datum === service.datum);
  const coverageHits = familyBlocks.filter((block) => serviceBusyOverlapsBlock(service, block));
  const doubleCoverageHits = coverageHits.filter((block) => {
    return partnerServices.some((partnerService) => serviceBusyOverlapsBlock(partnerService, block));
  });
  const wishHits = getMonthItems(month.id, "wensen").filter((wish) => {
    if (wish.datum !== service.datum) return false;
    if (wish.type === "samen_vrij") return true;
    return wish.persoonId === service.persoonId && ["liever_geen_dienst", "liefst_vrij"].includes(wish.type);
  });
  return {
    coverageHits: coverageHits.length,
    doubleCoverageHits: doubleCoverageHits.length,
    partnerOverlap: partnerServices.filter((partnerService) => serviceBusyWindowsOverlap(service, partnerService)).length,
    wishHits: wishHits.length
  };
}

function getTimeShiftMinutes(first, second) {
  const firstMinutes = timeToMinutes(first);
  const secondMinutes = timeToMinutes(second);
  if (firstMinutes === null || secondMinutes === null) return 999;
  const raw = Math.abs(firstMinutes - secondMinutes);
  return Math.min(raw, 1440 - raw);
}

function getSwitchImpactLabel(score) {
  if (score <= 2) return "Minst ingrijpend";
  if (score <= 6) return "Beperkt";
  if (score <= 12) return "Middel";
  return "Ingrijpend";
}

function renderSwitchSuggestionList(suggestions, compact = false) {
  if (!suggestions.length) {
    return `<p class="muted-text ${compact ? "switch-suggestion-empty" : ""}">Geen passende dienstopties gevonden in Beheer voor deze dag/ronde.</p>`;
  }
  return `
    <div class="switch-suggestions ${compact ? "switch-suggestions-compact" : ""}">
      ${suggestions.map(renderSwitchSuggestion).join("")}
    </div>
  `;
}

function renderSwitchSuggestion(suggestion) {
  return `
    <div class="switch-suggestion">
      <div>
        <strong>${escapeHtml(suggestion.dutyName.naam)}</strong>
        <span>${escapeHtml(formatTimeRange(suggestion.dutyName.start, suggestion.dutyName.einde))}${suggestion.dutyName.post ? ` - ${escapeHtml(suggestion.dutyName.post)}` : ""}</span>
      </div>
      <div>
        <span class="switch-impact">${escapeHtml(suggestion.impactLabel)}</span>
        <span>${escapeHtml(suggestion.reasons.join(" / "))}</span>
        <span class="switch-availability">Beschikbaarheid onbekend: check werkgeversysteem.</span>
      </div>
    </div>
  `;
}

function buildAdviceReadiness(month, days, controlSummary) {
  const services = getMonthItems(month.id, "diensten");
  const familyBlocks = getMonthItems(month.id, "gezinsVerplichtingen");
  const wishes = getMonthItems(month.id, "wensen");
  const activeWishTemplates = getWishTemplates().filter((template) => template.actief);
  const schoolEvents = days.flatMap((day) => day.schoolEvents);
  const openSwitchServices = services.filter((service) => !service.sleutelAkkoord);
  const hardTemplates = activeWishTemplates.filter((template) => template.hardheid === "hard");
  const strongTemplates = activeWishTemplates.filter((template) => template.hardheid === "sterk");
  const softTemplates = activeWishTemplates.filter((template) => !["hard", "sterk"].includes(template.hardheid));
  const conflictDays = days.filter((day) => dayMatchesFilter(day, "conflict"));
  const attentionDays = days.filter((day) => dayMatchesFilter(day, "attention"));
  const notificationDays = days.filter((day) => dayMatchesFilter(day, "notification"));
  const missing = [
    !services.length ? "Diensten ontbreken" : "",
    !familyBlocks.length && !schoolEvents.length ? "School/gezin ontbreekt" : "",
    !wishes.length && !activeWishTemplates.length ? "Wensen ontbreken" : "",
    controlSummary.incomplete.length ? "Open onvolledige basisgegevens" : ""
  ].filter(Boolean);
  const blockers = [
    controlSummary.conflicts.length ? `${controlSummary.conflicts.length} conflict(en)` : "",
    controlSummary.openActions.length ? `${controlSummary.openActions.length} open actie(s)` : ""
  ].filter(Boolean);
  const status = blockers.length
    ? "niet_klaar"
    : missing.length
      ? "aanvullen"
      : "klaar";

  return {
    month,
    status,
    missing,
    blockers,
    services,
    familyBlocks,
    wishes,
    schoolEvents,
    openSwitchServices,
    activeWishTemplates,
    hardTemplates,
    strongTemplates,
    softTemplates,
    conflictDays,
    attentionDays,
    notificationDays,
    contextText: buildAdviceContextText({
      month,
      services,
      familyBlocks,
      wishes,
      schoolEvents,
      openSwitchServices,
      hardTemplates,
      strongTemplates,
      softTemplates,
      conflictDays,
      attentionDays,
      notificationDays,
      controlSummary
    })
  };
}

function renderAdvicePreparation(scan) {
  const statusLabel = {
    klaar: "Klaar voor advies",
    aanvullen: "Nog aanvullen",
    niet_klaar: "Eerst oplossen"
  }[scan.status];
  const aiAdvices = getAiAdvicesForMonth(scan.month.id);
  return `
    <section class="panel advice-prep advice-prep-${escapeHtml(scan.status)}">
      <div class="control-header">
        <div>
          <p class="eyebrow">AI-adviesvoorbereiding</p>
          <h3 class="form-section-title">${escapeHtml(statusLabel)}</h3>
          <p class="control-meta">Lokale context voor later AI-advies. AI wijzigt niets en kent geen beschikbaarheid in het werkgeversysteem.</p>
        </div>
        <span class="status-pill advice-status-${escapeHtml(scan.status)}">${escapeHtml(statusLabel)}</span>
      </div>

      <div class="advice-grid">
        ${renderAdviceMetric("Diensten", scan.services.length)}
        ${renderAdviceMetric("School/gezin", scan.familyBlocks.length + scan.schoolEvents.length)}
        ${renderAdviceMetric("Wensen", scan.wishes.length + scan.activeWishTemplates.length)}
        ${renderAdviceMetric("Harde wensen", scan.hardTemplates.length)}
        ${renderAdviceMetric("Open R2", scan.openSwitchServices.length)}
        ${renderAdviceMetric("Conflictdagen", scan.conflictDays.length)}
        ${renderAdviceMetric("Controledagen", scan.attentionDays.length + scan.notificationDays.length)}
      </div>

      <div class="advice-columns">
        <div class="advice-block">
          <h4>Ontbreekt of blokkeert</h4>
          ${scan.blockers.length || scan.missing.length ? `
            <ul class="compact-list">
              ${scan.blockers.map((item) => `<li class="list-blocker">${escapeHtml(item)}</li>`).join("")}
              ${scan.missing.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          ` : "<p class=\"muted-text\">Geen harde blokkades of ontbrekende basisinvoer.</p>"}
        </div>
        <div class="advice-block">
          <h4>Voorkeuren</h4>
          <ul class="compact-list">
            <li>${scan.hardTemplates.length} hard</li>
            <li>${scan.strongTemplates.length} sterk</li>
            <li>${scan.softTemplates.length} normaal/zacht</li>
          </ul>
        </div>
      </div>

      <div class="advice-context">
        <div class="advice-context-header">
          <h4>AI-context</h4>
          <div class="ai-context-actions">
            <button type="button" class="tiny-button" data-request-ai-advice="${escapeHtml(scan.month.id)}">Vraag AI advies</button>
            <button type="button" class="tiny-button" data-copy-ai-context>Kopieer context</button>
          </div>
        </div>
        <textarea class="ai-context-text" readonly data-ai-context-output>${escapeHtml(scan.contextText)}</textarea>
      </div>

      <div class="ai-response-panel">
        <div class="advice-context-header">
          <h4>AI-testantwoord</h4>
          <span class="control-meta">${aiAdvices.length} opgeslagen</span>
        </div>
        <p class="control-meta">AI wijzigt geen diensten. Gebruik opties alleen als actie, keuze of controlepunt.</p>
        <textarea class="ai-response-input" data-ai-advice-input placeholder="Plak hier het AI-antwoord na je test. De app bewaart het lokaal bij deze maand en probeert de opties als losse punten te tonen."></textarea>
        <div class="form-actions">
          <button type="button" data-save-ai-advice="${escapeHtml(scan.month.id)}">AI-advies opslaan</button>
        </div>
        ${renderAiAdviceList(aiAdvices)}
      </div>
    </section>
  `;
}

function getAiAdvicesForMonth(monthId) {
  return state.data.keuzeOpties
    .filter((option) => option.maandPlanningId === monthId && option.type === "ai_advies")
    .sort((a, b) => String(b.aangemaaktOp || "").localeCompare(String(a.aangemaaktOp || "")));
}

function renderAiAdviceList(advices) {
  if (!advices.length) {
    return "<p class=\"muted-text\">Nog geen AI-testadvies opgeslagen.</p>";
  }

  return `
    <div class="ai-advice-list">
      ${advices.map(renderAiAdviceCard).join("")}
    </div>
  `;
}

function renderAiAdviceCard(advice) {
  const options = getAiAdviceOptionObjects(advice);
  return `
    <article class="ai-advice-card">
      <div class="ai-advice-card-header">
        <div>
          <strong>AI-advies</strong>
          <span>${escapeHtml(formatDateTime(advice.aangemaaktOp))}</span>
        </div>
        <button type="button" class="tiny-button danger-text-button" data-delete-ai-advice="${escapeHtml(advice.id)}">Verwijder advies</button>
      </div>
      ${options.length ? `
        <ol class="ai-option-list">
          ${options.map((option, index) => renderAiAdviceOption(advice, option, index)).join("")}
        </ol>
      ` : `<pre class="ai-advice-raw">${escapeHtml(advice.tekst)}</pre>`}
    </article>
  `;
}

function getAiAdviceOptionObjects(advice) {
  if (!Array.isArray(advice.opties)) return [];
  return advice.opties.map((option) => {
    if (option && typeof option === "object") {
      return {
        tekst: String(option.tekst || "").trim(),
        status: option.status || "open",
        actieId: option.actieId || "",
        dienstId: option.dienstId || "",
        voorstel: option.voorstel && typeof option.voorstel === "object" ? option.voorstel : null,
        bijgewerktOp: option.bijgewerktOp || ""
      };
    }
    return {
      tekst: String(option || "").trim(),
      status: "open",
      actieId: "",
      bijgewerktOp: ""
    };
  }).filter((option) => option.tekst);
}

function renderAiAdviceOption(advice, option, index) {
  const statusLabel = getAiOptionStatusLabel(option.status);
  const proposal = option.voorstel?.soort === "dienst" ? option.voorstel : null;
  return `
    <li class="ai-option ai-option-${escapeHtml(option.status || "open")}">
      <div class="ai-option-text">
        <span>${escapeHtml(option.tekst)}</span>
        ${proposal ? `<small>Voorstel: ${escapeHtml(formatLongDate(proposal.datum))} ${escapeHtml(getPersonLabel(proposal.persoonId))} ${escapeHtml(proposal.dienstNaam || proposal.dienstCode || "dienst")}</small>` : ""}
        ${option.status && option.status !== "open" ? `<strong>${escapeHtml(statusLabel)}</strong>` : ""}
      </div>
      <div class="ai-option-actions">
        ${proposal && option.status !== "geaccepteerd" ? `<button type="button" class="tiny-button" data-accept-ai-duty="${escapeHtml(advice.id)}" data-ai-option-index="${index}">Accepteer dienst</button>` : ""}
        <button type="button" class="tiny-button" data-ai-option-status="${escapeHtml(advice.id)}" data-ai-option-index="${index}" data-ai-option-value="gekozen">Markeer gekozen</button>
        <button type="button" class="tiny-button" data-ai-option-action="${escapeHtml(advice.id)}" data-ai-option-index="${index}">Gebruik als actie</button>
        <button type="button" class="tiny-button danger-text-button" data-ai-option-status="${escapeHtml(advice.id)}" data-ai-option-index="${index}" data-ai-option-value="nagaan">Klopt niet / nagaan</button>
      </div>
    </li>
  `;
}

function getAiOptionStatusLabel(status) {
  const labels = {
    gekozen: "Gekozen",
    actie: "Actie gemaakt",
    nagaan: "Klopt niet / nagaan",
    genegeerd: "Genegeerd",
    geaccepteerd: "Dienst geaccepteerd",
    open: "Open"
  };
  return labels[status] || formatCodeLabel(status || "open");
}

function renderAdviceMetric(label, value) {
  return `
    <div class="advice-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function buildAdviceContextText(input) {
  const lines = [
    "OPDRACHT VOOR AI:",
    "Je bent roostercoach voor Ronald en Eva.",
    "Maak een concreet werkroostervoorstel of aanvulling voor de actuele ronde.",
    "Geef maximaal 10 concrete dienstvoorstellen en maximaal 5 korte controleadviezen.",
    "Sorteer van minst ingrijpend naar meest ingrijpend.",
    "Houd rekening met werk, gezin, school, reistijd, wensen en gezamenlijke vrije tijd.",
    "Doe geen aannames over beschikbaarheid in het werkgeversysteem.",
    "Gebruik alleen dienstnamen uit TOEGESTANE DIENSTNAMEN.",
    "Wijzig niets automatisch. De gebruiker accepteert elke voorgestelde dienst zelf.",
    "Zet elke voorgestelde dienst exact in dit formaat op een eigen regel:",
    "DIENSTVOORSTEL: datum=JJJJ-MM-DD; persoon=Ronald of Eva; dienst=exacte dienstnaam; reden=korte reden",
    "Zet overige opmerkingen als korte regels met OPTIE:",
    "",
    "CONTEXT:",
    `Maand: ${getMonthLabel(input.month.id)} (${getStageLabel(input.month.planningStage)})`,
    `Status controle: ${STATUS_LABELS[input.month.samenvattingStatus] || input.month.samenvattingStatus}`,
    `Diensten: ${input.services.length}`,
    `School/gezin: ${input.familyBlocks.length} overige gezinsafspraken, ${input.schoolEvents.length} schoolitems`,
    `Wensen: ${input.wishes.length} dagwensen, ${input.hardTemplates.length} hard, ${input.strongTemplates.length} sterk, ${input.softTemplates.length} normaal/zacht`,
    `Open Ronde 2 diensten: ${input.openSwitchServices.length}`,
    `Conflictdagen: ${input.conflictDays.map((day) => formatLongDate(day.date)).join(", ") || "geen"}`,
    `Controledagen: ${[...input.attentionDays, ...input.notificationDays].map((day) => formatLongDate(day.date)).join(", ") || "geen"}`,
    "",
    "Diensten:",
    ...formatServicesForAiContext(input.services),
    "",
    "TOEGESTANE DIENSTNAMEN:",
    ...formatDutyNamesForAiContext(input.month),
    "",
    "Open Ronde 2 diensten met mogelijke opties:",
    ...formatOpenSwitchServicesForAiContext(input.openSwitchServices),
    "",
    "School en gezin:",
    ...formatFamilyAndSchoolForAiContext(input.familyBlocks, input.schoolEvents),
    "",
    "Dagwensen:",
    ...formatWishesForAiContext(input.wishes),
    "",
    "Actieve wenssjablonen:",
    ...input.hardTemplates.map((template) => `- HARD: ${template.naam} (${formatWishTemplateForContext(template)})`),
    ...input.strongTemplates.map((template) => `- STERK: ${template.naam} (${formatWishTemplateForContext(template)})`),
    ...input.softTemplates.map((template) => `- ZACHT/NORMAAL: ${template.naam} (${formatWishTemplateForContext(template)})`),
    "",
    "Open controlepunten:",
    ...[
      ...input.controlSummary.conflicts,
      ...input.controlSummary.checks,
      ...input.controlSummary.notifications,
      ...input.controlSummary.incomplete
    ].slice(0, 12).map((result) => `- ${formatLongDate(result.datum)}: ${result.melding}`)
  ];
  return lines.join("\n").trim();
}

function formatServicesForAiContext(services) {
  if (!services.length) return ["- geen diensten ingevoerd"];
  return [...services]
    .sort((a, b) => `${a.datum} ${a.start}`.localeCompare(`${b.datum} ${b.start}`))
    .map((service) => {
      const check = service.sleutelAkkoord ? "R2 akkoord" : "R2 open";
      return `- ${formatLongDate(service.datum)} ${getPersonLabel(service.persoonId)}: ${service.dienstCode || formatCodeLabel(service.dienstType)} ${formatTimeRange(service.start, service.einde)} ${service.locatie || ""} (${check}, ${getServiceTravelLabel(service) || "geen reistijd"})`;
    });
}

function formatDutyNamesForAiContext(month) {
  const activeStage = month?.planningStage || state.data.instellingen.standaardPlanningStage;
  const dates = month ? getMonthDateValues(month) : [];
  const lines = [];

  Object.keys(PERSON_LABELS).forEach((personId) => {
    const personDates = dates.length ? dates : [""];
    const available = getDutyNames().filter((dutyName) => {
      if (!(dutyName.persoonId === "beiden" || dutyName.persoonId === personId)) return false;
      if (getPlanningStageIndex(activeStage) < getPlanningStageIndex(dutyName.beschikbaarVanaf)) return false;
      return personDates.some((date) => isDutyNameAvailableOnDate(dutyName, date));
    });

    if (!available.length) {
      lines.push(`- ${getPersonLabel(personId)}: geen beheerde dienstnamen beschikbaar in ${getStageLabel(activeStage)}`);
      return;
    }

    available.forEach((dutyName) => {
      lines.push(`- ${getPersonLabel(personId)}: ${dutyName.naam} ${formatTimeRange(dutyName.start, dutyName.einde)} ${dutyName.post || dutyName.locatie || ""} (${getDutyNameWeekdayLabel(dutyName)})`);
    });
  });

  return lines.slice(0, 80);
}

function getDutyNameWeekdayLabel(dutyName) {
  const days = normalizeDutyWeekdays(dutyName.beschikbareDagen);
  if (days.length === 7) return "hele week";
  return WEEKDAY_OPTIONS
    .filter((option) => days.includes(option.value))
    .map((option) => option.label)
    .join(", ");
}

function formatOpenSwitchServicesForAiContext(services) {
  if (!services.length) return ["- geen open Ronde 2 diensten"];
  return services.flatMap((service) => {
    const suggestions = buildServiceSwitchSuggestions(service).slice(0, 5);
    return [
      `- OPEN ${formatLongDate(service.datum)} ${formatServiceLabel(service)}:`,
      ...(
        suggestions.length
          ? suggestions.map((suggestion, index) => `  ${index + 1}. ${suggestion.dutyName.naam} ${formatTimeRange(suggestion.dutyName.start, suggestion.dutyName.einde)} ${suggestion.dutyName.post || ""} - ${suggestion.impactLabel}; ${suggestion.reasons.join("; ")}; beschikbaarheid onbekend`)
          : ["  geen passende dienstopties gevonden in Beheer voor deze dag/ronde"]
      )
    ];
  });
}

function formatFamilyAndSchoolForAiContext(familyBlocks, schoolEvents) {
  const lines = [
    ...familyBlocks.map((block) => `- ${formatLongDate(block.datum)} gezin: ${formatCodeLabel(block.type)} ${formatTimeRange(block.start, block.einde)} (${block.dekkingNodig ? "dekking nodig" : "geen dekking nodig"})${block.opmerking ? ` - ${block.opmerking}` : ""}`),
    ...schoolEvents.map((event) => `- ${formatLongDate(event.date)} school: ${event.label || formatCodeLabel(event.type)} ${formatTimeRange(event.start, event.einde)}${formatSchoolCoverageLabel(event) ? ` - ${formatSchoolCoverageLabel(event)}` : ""}`)
  ];
  if (!lines.length) return ["- geen school/gezin ingevoerd"];
  return lines.slice(0, 60);
}

function formatWishesForAiContext(wishes) {
  if (!wishes.length) return ["- geen dagwensen ingevoerd"];
  return [...wishes]
    .sort((a, b) => `${a.datum} ${a.persoonId}`.localeCompare(`${b.datum} ${b.persoonId}`))
    .map((wish) => `- ${formatLongDate(wish.datum)} ${getPersonLabel(wish.persoonId)}: ${formatCodeLabel(wish.type)} (${formatCodeLabel(wish.prioriteit || "normaal")})${wish.reden ? ` - ${wish.reden}` : ""}`);
}

function formatWishTemplateForContext(template) {
  return [
    template.kernzin ? `kern: ${template.kernzin}` : "",
    template.voorWieTekst ? `voor wie: ${template.voorWieTekst}` : "",
    template.wanneerTekst ? `wanneer: ${template.wanneerTekst}` : "",
    template.vermijdTekst ? `vermijd: ${template.vermijdTekst}` : "",
    template.magWelTekst ? `mag wel: ${template.magWelTekst}` : "",
    template.beschrijving ? `toelichting: ${template.beschrijving}` : ""
  ].filter(Boolean).join(" | ");
}

function renderWishTemplateContext(templates) {
  const grouped = groupBy(templates, "hardheid");
  const order = ["hard", "sterk", "normaal", "zacht"];
  return `
    <div class="control-section control-section-preferences">
      <h4>Voorkeuren voor deze maand</h4>
      ${templates.length ? order.map((hardheid) => {
        const items = grouped[hardheid] || [];
        if (!items.length) return "";
        return `
          <div class="preference-group">
            <strong>${escapeHtml(WISH_TEMPLATE_STRENGTH[hardheid] || formatCodeLabel(hardheid))}</strong>
            ${items.map(renderWishTemplateContextItem).join("")}
          </div>
        `;
      }).join("") : "<p class=\"muted-text\">Geen actieve wenssjablonen.</p>"}
      ${templates.length ? "<p class=\"control-meta\">Deze voorkeuren zijn context. Ze tellen nog niet automatisch mee als waarschuwing.</p>" : ""}
    </div>
  `;
}

function renderWishTemplateContextItem(template) {
  return `
    <article class="control-finding preference-finding">
      <strong>${escapeHtml(template.naam)}</strong>
      ${template.kernzin ? `<span>${escapeHtml(template.kernzin)}</span>` : ""}
      ${template.voorWieTekst || template.wanneerTekst ? `<span>${escapeHtml([template.voorWieTekst, template.wanneerTekst].filter(Boolean).join(" - "))}</span>` : ""}
      ${template.vermijdTekst ? `<span>Vermijd: ${escapeHtml(template.vermijdTekst)}</span>` : ""}
      ${template.magWelTekst ? `<span>Mag wel: ${escapeHtml(template.magWelTekst)}</span>` : ""}
      ${template.beschrijving ? `<span>${escapeHtml(template.beschrijving)}</span>` : ""}
    </article>
  `;
}

function renderControlScore(label, value, type) {
  return `
    <div class="control-score control-score-${escapeHtml(type)}">
      <span>${escapeHtml(label)}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function renderControlSection(title, analyses, emptyText, type) {
  return `
    <div class="control-section control-section-${escapeHtml(type)}">
      <h4>${escapeHtml(title)}</h4>
      ${analyses.length ? analyses.map(renderControlFinding).join("") : `<p class="muted-text">${escapeHtml(emptyText)}</p>`}
    </div>
  `;
}

function buildDayFilters(days) {
  return [
    { value: "all", label: "Alles", count: days.length },
    { value: "conflict", label: "Conflicten", count: filterMonthDays(days, "conflict").length },
    { value: "attention", label: "Te controleren", count: filterMonthDays(days, "attention").length },
    { value: "notification", label: "Notificaties", count: filterMonthDays(days, "notification").length },
    { value: "incomplete", label: "Onvolledig", count: filterMonthDays(days, "incomplete").length },
    { value: "actions", label: "Open acties", count: filterMonthDays(days, "actions").length },
    { value: "ok", label: "Geen probleem", count: filterMonthDays(days, "ok").length }
  ];
}

function renderCockpitFilters(filters) {
  return `
    <section class="panel cockpit-filter-panel">
      <p class="eyebrow">Dagfilter</p>
      <div class="filter-bar" role="list" aria-label="Filter dagen">
        ${filters.map((filter) => `
          <button type="button" class="filter-button ${state.cockpitFilter === filter.value ? "active" : ""}" data-cockpit-filter="${escapeHtml(filter.value)}">
            ${escapeHtml(filter.label)} <span>${filter.count}</span>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function renderMonthBoard(month, days) {
  const firstDay = new Date(`${month.id}-01T12:00:00`).getDay();
  const leadingEmptyDays = (firstDay + 6) % 7;
  const cells = [
    ...Array.from({ length: leadingEmptyDays }, () => null),
    ...days
  ];
  const trailingEmptyDays = (7 - (cells.length % 7)) % 7;
  cells.push(...Array.from({ length: trailingEmptyDays }, () => null));

  return `
    <section class="panel month-board-panel" aria-label="Volledig maandbord">
      <div class="month-board-header">
        <div>
          <p class="eyebrow">Volledig maandbord</p>
          <h3 class="form-section-title">${escapeHtml(getMonthLabel(month.id))}</h3>
        </div>
        <div class="month-board-legend" aria-label="Legenda">
          <span class="legend-item legend-good"><span>✓</span> Geen conflict</span>
          <span class="legend-item legend-attention"><span>!</span> Controle</span>
          <span class="legend-item legend-conflict"><span>X</span> Conflict</span>
        </div>
      </div>
      <div class="month-board-scroll">
        <div class="month-board-weekdays" aria-hidden="true">
          ${WEEKDAY_OPTIONS.map((day) => `<div>${escapeHtml(day.label)}</div>`).join("")}
        </div>
        <div class="month-board-grid">
          ${cells.map((day) => day ? renderMonthBoardDay(day) : "<div class=\"month-board-empty\" aria-hidden=\"true\"></div>").join("")}
        </div>
      </div>
    </section>
  `;
}

function renderMonthBoardDay(day) {
  const status = getDayBoardStatus(day);
  const isSelected = state.selectedDate === day.date;
  const schoolDeviations = getMonthBoardSchoolDeviations(day);
  const coveredAnalyses = getMonthBoardCoveredAnalyses(day);
  const itemCount = day.services.length + day.familyBlocks.length + day.wishes.length + schoolDeviations.length + coveredAnalyses.length;
  const signalCount = day.analyses.length;
  return `
    <article class="month-board-day month-board-day-${status.type} ${isSelected ? "month-board-day-selected" : ""}" data-open-day="${escapeHtml(day.date)}" role="button" tabindex="0" aria-label="${escapeHtml(formatLongDate(day.date))}: ${escapeHtml(status.label)}">
      <span class="month-board-day-top">
        <strong>${Number(day.date.slice(-2))}</strong>
        <span class="month-board-status" aria-hidden="true">${escapeHtml(status.icon)}</span>
      </span>
      <span class="month-board-summary">${itemCount} items - ${signalCount} signalen</span>
      <span class="month-board-items">
        ${day.services.map(renderMonthBoardService).join("")}
        ${day.familyBlocks.map(renderMonthBoardFamilyBlock).join("")}
        ${schoolDeviations.map(renderMonthBoardSchoolEvent).join("")}
        ${day.wishes.map(renderMonthBoardWish).join("")}
        ${coveredAnalyses.map(renderMonthBoardCoveredAnalysis).join("")}
        ${day.analyses.map(renderMonthBoardAnalysis).join("")}
        ${!itemCount && !signalCount ? "<span class=\"month-board-item month-board-item-empty\">Geen invoer</span>" : ""}
      </span>
    </article>
  `;
}

function getDayBoardStatus(day) {
  const activeAnalyses = day.analyses.filter((result) => !["gezien", "bewust_akkoord", "vervallen"].includes(result.actieStatus));
  if (activeAnalyses.some((result) => result.ernst === "conflict")) {
    return { type: "conflict", icon: "X", label: "conflict" };
  }
  if (activeAnalyses.length) {
    return { type: "attention", icon: "!", label: "controle nodig" };
  }
  return { type: "good", icon: "✓", label: "geen conflict" };
}

function getMonthBoardSchoolDeviations(day) {
  return day.schoolEvents.filter((event) => event.type !== "schooltijd");
}

function getMonthBoardCoveredAnalyses(day) {
  return (day.coveredAnalyses || []).filter((result) => String(result.afdekNotitie || "").trim());
}

function renderMonthBoardService(service) {
  return `
    <span class="month-board-item month-board-item-service ${service.sleutelAkkoord ? "month-board-item-checked" : "month-board-item-unchecked"}">
      <span class="sleutel-mark">${service.sleutelAkkoord ? "[x]" : "[ ]"}</span>
      ${escapeHtml(formatServiceLabel(service))}${getServiceTravelLabel(service) ? ` - ${escapeHtml(getServiceTravelLabel(service))}` : ""}
    </span>
  `;
}

function formatServiceLabel(service) {
  return `${getPersonLabel(service.persoonId)}: ${service.dienstCode || formatCodeLabel(service.dienstType || "dienst")} ${formatTimeRange(service.start, service.einde)}`;
}

function renderMonthBoardFamilyBlock(block) {
  return `
    <span class="month-board-item month-board-item-family">
      ${escapeHtml(formatFamilyBlockDisplayLabel(block))}
    </span>
  `;
}

function formatFamilyBlockDisplayLabel(block) {
  const text = String(block.opmerking || "").trim() || formatCodeLabel(block.type || "afspraak");
  const time = formatTimeRange(block.start, block.einde);
  return [text, time].filter(Boolean).join(" ");
}

function renderMonthBoardSchoolEvent(event) {
  const coverage = formatSchoolCoverageLabel(event);
  return `
    <span class="month-board-item month-board-item-school-deviation">
      School: ${escapeHtml(event.label || formatCodeLabel(event.type))} ${escapeHtml(formatTimeRange(event.start, event.einde))}${coverage ? ` - ${escapeHtml(coverage)}` : ""}
    </span>
  `;
}

function renderMonthBoardWish(wish) {
  return `
    <span class="month-board-item month-board-item-wish">
      Wens: ${escapeHtml(formatMonthBoardWishLabel(wish))}
    </span>
  `;
}

function formatMonthBoardWishLabel(wish) {
  const text = String(wish.reden || "").trim();
  if (text) return text;
  return formatCodeLabel(wish.type || "wens");
}

function renderMonthBoardCoveredAnalysis(result) {
  return `
    <button type="button" class="month-board-item month-board-item-covered month-board-item-button" data-open-problem="${escapeHtml(getAnalysisProblemId(result))}" data-open-day="${escapeHtml(result.datum)}">
      Oplossing: ${escapeHtml(result.afdekNotitie || "afgedekt")}
    </button>
  `;
}

function renderMonthBoardAnalysis(result) {
  return `
    <button type="button" class="month-board-item month-board-item-analysis month-board-item-button signal-${escapeHtml(result.ernst)}" data-open-problem="${escapeHtml(getAnalysisProblemId(result))}" data-open-day="${escapeHtml(result.datum)}">
      ${escapeHtml(formatCodeLabel(result.ernst))}: ${escapeHtml(result.melding || "controlepunt")}
    </button>
  `;
}

function filterMonthDays(days, filter) {
  if (filter === "all") return days;
  return days.filter((day) => dayMatchesFilter(day, filter));
}

function dayMatchesFilter(day, filter) {
  const activeAnalyses = day.analyses.filter((result) => !["gezien", "bewust_akkoord", "vervallen"].includes(result.actieStatus));
  if (filter === "conflict") return activeAnalyses.some((result) => result.ernst === "conflict");
  if (filter === "attention") return activeAnalyses.some((result) => ["aandacht", "waarschuwing", "keuze_nodig"].includes(result.ernst));
  if (filter === "notification") return activeAnalyses.some((result) => result.ernst === "notificatie");
  if (filter === "incomplete") return activeAnalyses.some((result) => result.ernst === "onvolledig");
  if (filter === "actions") return day.actions.length > 0;
  if (filter === "ok") {
    const hasContent = day.services.length || day.familyBlocks.length || day.wishes.length || day.schoolEvents.length;
    return hasContent && !activeAnalyses.length && !day.actions.length;
  }
  return true;
}

function renderControlFinding(result) {
  const isNotification = result.ernst === "notificatie";
  const isClosedNotification = isNotification && ["gezien", "bewust_akkoord"].includes(result.actieStatus);
  return `
    <article class="control-finding control-finding-link ${isClosedNotification ? "control-finding-closed" : ""}" data-open-day="${escapeHtml(result.datum)}" role="button" tabindex="0">
      <span class="day-link-label">Ga naar dag: ${escapeHtml(formatLongDate(result.datum))}</span>
      <strong>${escapeHtml(result.melding || "Controlepunt")}</strong>
      ${result.advies ? `<span>${isNotification ? "Notificatie" : "Hard advies"}: ${escapeHtml(result.advies)}</span>` : ""}
      ${isClosedNotification ? `<span class="control-meta">Status: ${escapeHtml(formatCodeLabel(result.actieStatus))}</span>` : ""}
      ${renderLinkedServiceActions(result)}
      ${isNotification ? renderNotificationButtons(result) : ""}
      ${!isNotification ? renderCoverageNoteForm(result) : ""}
    </article>
  `;
}

function renderCoverageNoteForm(result) {
  const isCovered = result.actieStatus === "afgedekt";
  return `
    <form class="coverage-note-form" data-coverage-note-form="${escapeHtml(result.id)}">
      <label>
        ${isCovered ? "Afdekking aanpassen" : "Afdekking zonder roosterwijziging"}
        <textarea data-coverage-note="${escapeHtml(result.id)}" placeholder="Bijv. buurmeisje past op van 21:00-23:00">${escapeHtml(result.afdekNotitie || "")}</textarea>
      </label>
      <div class="coverage-note-actions">
        <button type="submit" class="tiny-button">${isCovered ? "Afdeknotitie opslaan" : "Opslaan als afgedekt"}</button>
      </div>
    </form>
  `;
}

function renderNotificationButtons(result) {
  if (["gezien", "bewust_akkoord"].includes(result.actieStatus)) {
    return `
      <div class="notification-actions">
        <button type="button" class="tiny-button" data-notification-status="open" data-analysis-id="${escapeHtml(result.id)}">Heropen</button>
      </div>
    `;
  }

  return `
    <div class="notification-actions">
      <button type="button" class="tiny-button" data-notification-status="gezien" data-analysis-id="${escapeHtml(result.id)}">Gezien</button>
      <button type="button" class="tiny-button" data-notification-status="bewust_akkoord" data-analysis-id="${escapeHtml(result.id)}">Bewust akkoord</button>
    </div>
  `;
}

function renderLinkedServiceActions(result) {
  const services = getLinkedServices(result);
  if (!services.length) return "";
  return `
    <div class="linked-service-actions">
      ${services.map((service) => `
        <div class="linked-service-action-row">
          <span>${escapeHtml(getPersonLabel(service.persoonId))}: ${escapeHtml(service.dienstCode || formatCodeLabel(service.dienstType || "dienst"))} ${escapeHtml(formatTimeRange(service.start, service.einde))}</span>
          <button type="button" class="tiny-button" data-edit-item="service" data-item-id="${escapeHtml(service.id)}">Bewerk</button>
          <button type="button" class="tiny-button danger-text-button" data-delete-item="service" data-item-id="${escapeHtml(service.id)}">Verwijder</button>
        </div>
      `).join("")}
    </div>
  `;
}

function getLinkedServices(result) {
  const ids = Array.isArray(result.betrokkenDienstIds) ? result.betrokkenDienstIds : [];
  if (!ids.length) return [];
  return ids
    .map((id) => state.data.diensten.find((service) => service.id === id))
    .filter(Boolean);
}

function renderOkDays(days) {
  const visibleDays = days.slice(0, 6);
  return `
    <div class="control-section control-section-good">
      <h4>Geen probleem</h4>
      ${visibleDays.length ? visibleDays.map((day) => `
        <article class="control-finding control-finding-link" data-open-day="${escapeHtml(day.date)}" role="button" tabindex="0">
          <span class="day-link-label">Ga naar dag: ${escapeHtml(formatLongDate(day.date))}</span>
          <span>Invoer aanwezig, geen open controlepunt.</span>
        </article>
      `).join("") : "<p class=\"muted-text\">Nog geen dag zonder aandachtspunt.</p>"}
      ${days.length > visibleDays.length ? `<p class="control-meta">Nog ${days.length - visibleDays.length} normale dagen.</p>` : ""}
    </div>
  `;
}

function renderDayRow(day) {
  const hasItems = day.services.length || day.familyBlocks.length || day.wishes.length || day.schoolEvents.length;
  const hasSignals = day.analyses.length || day.actions.length;
  const isSelected = state.selectedDate === day.date;
  return `
    <article class="day-row ${hasSignals ? "day-row-signal" : ""} ${isSelected ? "day-row-selected" : ""}" data-day-row="${escapeHtml(day.date)}">
      <div>
        <div class="day-date">${escapeHtml(formatLongDate(day.date))}</div>
        <div class="day-actions">
          <button type="button" class="tiny-button" data-open-day="${escapeHtml(day.date)}">${isSelected ? "Open" : "Bekijk"}</button>
          <button type="button" class="tiny-button" data-quick-add="service" data-date="${escapeHtml(day.date)}">Dienst</button>
          <button type="button" class="tiny-button" data-quick-add="family" data-date="${escapeHtml(day.date)}">Gezin overig</button>
          <button type="button" class="tiny-button" data-quick-add="wish" data-date="${escapeHtml(day.date)}">Wens</button>
        </div>
      </div>
      <div>
        ${hasItems || hasSignals ? `
          <div class="item-list">
            ${day.services.map((service) => `
              <span class="mini-item editable-item">
                <span>${service.sleutelAkkoord ? "[x]" : "[ ]"} ${escapeHtml(getPersonLabel(service.persoonId))} ${escapeHtml(service.dienstCode || service.dienstType || "dienst")} ${escapeHtml(formatTimeRange(service.start, service.einde))}${getServiceTravelLabel(service) ? ` - ${escapeHtml(getServiceTravelLabel(service))}` : ""}</span>
                ${renderItemButtons("service", service.id)}
              </span>
            `).join("")}
            ${day.familyBlocks.map((block) => `
              <span class="mini-item editable-item">
                <span>${escapeHtml(formatFamilyBlockDisplayLabel(block))}</span>
                ${renderItemButtons("family", block.id)}
              </span>
            `).join("")}
            ${day.schoolEvents.map((event) => `
              <span class="mini-item">
                <span>School: ${escapeHtml(event.label || formatCodeLabel(event.type))} ${escapeHtml(formatTimeRange(event.start, event.einde))}${formatSchoolCoverageLabel(event) ? ` - ${escapeHtml(formatSchoolCoverageLabel(event))}` : ""}</span>
              </span>
            `).join("")}
            ${day.wishes.map((wish) => `
              <span class="mini-item editable-item">
                <span>Wens: ${escapeHtml(formatMonthBoardWishLabel(wish))}</span>
                ${renderItemButtons("wish", wish.id)}
              </span>
            `).join("")}
            ${day.analyses.map((result) => `
              <span class="mini-item signal-${escapeHtml(result.ernst)}">${escapeHtml(formatCodeLabel(result.ernst))}: ${escapeHtml(result.melding)}</span>
            `).join("")}
          </div>
        ` : "<span class=\"mini-item\">Geen items</span>"}
      </div>
    </article>
  `;
}

function getSelectedDayForMonth(month, days) {
  if (!days.length) return null;
  const selectedDate = state.selectedDate && dateToMonthId(state.selectedDate) === month.id
    ? state.selectedDate
    : findFirstRelevantDay(days).date;
  state.selectedDate = selectedDate;
  return days.find((day) => day.date === selectedDate) || days[0];
}

function findFirstRelevantDay(days) {
  return days.find((day) => {
    return day.services.length || day.familyBlocks.length || day.wishes.length || day.schoolEvents.length || day.analyses.length || day.actions.length;
  }) || days[0];
}

function renderDayDetail(day) {
  if (!day) return "";
  const hasServices = day.services.length > 0;
  const hasFamilyBlocks = day.familyBlocks.length > 0;
  const hasSchoolEvents = day.schoolEvents.length > 0;
  const hasWishes = day.wishes.length > 0;
  const hasAnalyses = day.analyses.length > 0;
  const hasCoveredAnalyses = Array.isArray(day.coveredAnalyses) && day.coveredAnalyses.length > 0;
  const hasActions = day.actions.length > 0;
  const hasClosedActions = Array.isArray(day.closedActions) && day.closedActions.length > 0;
  const dutyProposals = (day.dutyProposals || []).filter((proposal) => proposal.status !== "geaccepteerd");
  const hasDutyProposals = dutyProposals.length > 0;

  return `
    <section class="panel day-detail" data-day-detail="${escapeHtml(day.date)}" tabindex="-1" aria-live="polite">
      <div class="day-detail-header">
        <div>
          <p class="eyebrow">Dagmenu</p>
          <h3 class="form-section-title">${escapeHtml(formatLongDate(day.date))}</h3>
        </div>
        <div class="toolbar">
          <button type="button" class="subtle-button" data-quick-add="service" data-date="${escapeHtml(day.date)}">Dienst toevoegen</button>
          <button type="button" class="subtle-button" data-quick-add="family" data-date="${escapeHtml(day.date)}">Gezin overig toevoegen</button>
          <button type="button" class="subtle-button" data-quick-add="wish" data-date="${escapeHtml(day.date)}">Wens toevoegen</button>
        </div>
      </div>

      <div class="day-detail-grid">
        <div class="day-detail-block">
          <h4>Diensten</h4>
          ${hasServices ? day.services.map(renderServiceDetail).join("") : "<p class=\"muted-text\">Geen diensten op deze dag.</p>"}
        </div>
        <div class="day-detail-block">
          <h4>Gezin overig</h4>
          ${hasFamilyBlocks ? day.familyBlocks.map(renderFamilyDetail).join("") : "<p class=\"muted-text\">Geen overige gezinsafspraken op deze dag.</p>"}
        </div>
        <div class="day-detail-block">
          <h4>School</h4>
          ${hasSchoolEvents ? day.schoolEvents.map(renderSchoolEventDetail).join("") : "<p class=\"muted-text\">Geen schoolitems op deze dag.</p>"}
        </div>
        <div class="day-detail-block">
          <h4>Wensen</h4>
          ${hasWishes ? day.wishes.map(renderWishDetail).join("") : "<p class=\"muted-text\">Geen wensen op deze dag.</p>"}
        </div>
        <div class="day-detail-block">
          <h4>Aandacht en acties</h4>
          ${hasDutyProposals ? `
            <div class="covered-analysis-list">
              <strong>AI dienstvoorstellen</strong>
              ${dutyProposals.map(renderDutyProposalDetail).join("")}
            </div>
          ` : ""}
          ${hasAnalyses ? day.analyses.map(renderAnalysisDetail).join("") : (!hasCoveredAnalyses ? "<p class=\"muted-text\">Geen analysepunten.</p>" : "")}
          ${hasActions ? day.actions.map(renderCompactActionDetail).join("") : "<p class=\"muted-text\">Geen open acties.</p>"}
          ${hasClosedActions ? `
            <div class="covered-analysis-list">
              <strong>Afgehandelde acties</strong>
              ${day.closedActions.map(renderCompactActionDetail).join("")}
            </div>
          ` : ""}
          ${hasCoveredAnalyses ? `
            <div class="covered-analysis-list">
              <strong>Afgedekt zonder roosterwijziging</strong>
              ${day.coveredAnalyses.map(renderAnalysisDetail).join("")}
            </div>
          ` : ""}
        </div>
      </div>
    </section>
  `;
}

function renderDutyProposalDetail(proposal) {
  const statusLabel = getAiOptionStatusLabel(proposal.status);
  return `
    <article class="detail-item detail-item-proposal" data-day-problem="${escapeHtml(getDutyProposalProblemId(proposal))}" tabindex="-1">
      <strong>${escapeHtml(getPersonLabel(proposal.persoonId))}: ${escapeHtml(proposal.dienstNaam || proposal.dienstCode || "Dienstvoorstel")}</strong>
      <span>${escapeHtml(formatTimeRange(proposal.start || "", proposal.einde || ""))}${proposal.locatie ? ` - ${escapeHtml(proposal.locatie)}` : ""}</span>
      ${proposal.reden ? `<span>${escapeHtml(proposal.reden)}</span>` : ""}
      ${proposal.status && proposal.status !== "open" ? `<span>Status: ${escapeHtml(statusLabel)}</span>` : ""}
      <div class="action-buttons">
        <button type="button" class="tiny-button" data-accept-ai-duty="${escapeHtml(proposal.adviesId)}" data-ai-option-index="${proposal.optieIndex}">Accepteer dienst</button>
        <button type="button" class="tiny-button danger-text-button" data-ai-option-status="${escapeHtml(proposal.adviesId)}" data-ai-option-index="${proposal.optieIndex}" data-ai-option-value="nagaan">Klopt niet / nagaan</button>
      </div>
    </article>
  `;
}

function renderServiceDetail(service) {
  const suggestions = !service.sleutelAkkoord ? buildServiceSwitchSuggestions(service).slice(0, 4) : [];
  return `
    <article class="detail-item">
      <strong>${escapeHtml(getPersonLabel(service.persoonId))}: ${escapeHtml(service.dienstCode || formatCodeLabel(service.dienstType || "dienst"))}</strong>
      <span>${escapeHtml(formatTimeRange(service.start, service.einde))} ${service.locatie ? `- ${escapeHtml(service.locatie)}` : ""}</span>
      <span>Ronde 2 check: ${service.sleutelAkkoord ? "klopt / geen sleutelen nodig" : "nog controleren of sleutelen"}</span>
      ${getServiceTravelLabel(service) ? `<span>${escapeHtml(getServiceTravelLabel(service))}${service.reisOpmerking ? ` - ${escapeHtml(service.reisOpmerking)}` : ""}</span>` : ""}
      <span>${escapeHtml(formatCodeLabel(service.status || "status onbekend"))}</span>
      ${service.opmerking ? `<span>${escapeHtml(service.opmerking)}</span>` : ""}
      ${suggestions.length ? `
        <div class="service-switch-box">
          <strong>Mogelijke opties</strong>
          ${renderSwitchSuggestionList(suggestions)}
        </div>
      ` : ""}
      <div class="action-buttons">
        <button type="button" class="tiny-button" data-edit-item="service" data-item-id="${escapeHtml(service.id)}">Bewerk dienst</button>
        <button type="button" class="tiny-button danger-text-button" data-delete-item="service" data-item-id="${escapeHtml(service.id)}">Verwijder dienst</button>
        <button type="button" class="tiny-button" data-toggle-sleutel-service="${escapeHtml(service.id)}">${service.sleutelAkkoord ? "Zet terug naar checken" : "Klopt, geen sleutelen nodig"}</button>
      </div>
    </article>
  `;
}

function renderFamilyDetail(block) {
  return `
    <article class="detail-item">
      <strong>${escapeHtml(formatFamilyBlockDisplayLabel(block))}</strong>
      ${block.opmerking ? `<span>Type: ${escapeHtml(formatCodeLabel(block.type || "afspraak"))}</span>` : ""}
      <span>${block.dekkingNodig ? "Dekking nodig" : "Geen dekking nodig"} - ${escapeHtml(formatCodeLabel(block.hardheid || "onbekend"))}</span>
      ${renderItemButtons("family", block.id)}
    </article>
  `;
}

function renderSchoolEventDetail(event) {
  const coverage = formatSchoolCoverageLabel(event);
  return `
    <article class="detail-item">
      <strong>${escapeHtml(event.label || formatCodeLabel(event.type || "School"))}</strong>
      ${event.start || event.einde ? `<span>${escapeHtml(formatTimeRange(event.start, event.einde))}</span>` : ""}
      ${coverage ? `<span>${escapeHtml(coverage)}</span>` : ""}
      <span>${escapeHtml(formatCodeLabel(event.type || "school"))}</span>
      ${event.opmerking ? `<span>${escapeHtml(event.opmerking)}</span>` : ""}
    </article>
  `;
}

function formatSchoolCoverageLabel(event) {
  if (event.type !== "schooltijd") return "";
  const parts = [];
  if (event.brengenNodig) parts.push("brengen");
  if (event.halenNodig) parts.push("halen");
  return parts.length ? `${parts.join(" en ")} nodig` : "geen brengen/halen";
}

function renderWishDetail(wish) {
  return `
    <article class="detail-item">
      <strong>${escapeHtml(getPersonLabel(wish.persoonId))}: ${escapeHtml(formatMonthBoardWishLabel(wish))}</strong>
      <span>Prioriteit: ${escapeHtml(formatCodeLabel(wish.prioriteit || "normaal"))}</span>
      ${wish.reden ? `<span>Type: ${escapeHtml(formatCodeLabel(wish.type || "wens"))}</span>` : ""}
      ${renderItemButtons("wish", wish.id)}
    </article>
  `;
}

function renderAnalysisDetail(result) {
  const isCovered = result.actieStatus === "afgedekt";
  return `
    <article class="detail-item detail-item-${escapeHtml(result.ernst || "aandacht")} ${isCovered ? "detail-item-covered" : ""}" data-day-problem="${escapeHtml(getAnalysisProblemId(result))}" tabindex="-1">
      <strong>${escapeHtml(formatCodeLabel(result.ernst || "Aandacht"))}: ${escapeHtml(result.melding || "Analysepunt")}</strong>
      ${result.advies ? `<span>${escapeHtml(result.advies)}</span>` : ""}
      ${isCovered ? `<span>Status: afgedekt${result.afgedektOp ? ` op ${escapeHtml(formatDateTime(result.afgedektOp))}` : ""}</span>` : ""}
      ${isCovered && result.afdekNotitie ? `<span>Afgedekt: ${escapeHtml(result.afdekNotitie)}</span>` : ""}
      ${result.ernst !== "notificatie" ? renderCoverageNoteForm(result) : ""}
    </article>
  `;
}

function renderCompactActionDetail(action) {
  return `
    <article class="detail-item" data-day-problem="${escapeHtml(getActionProblemId(action))}" tabindex="-1">
      <strong>${escapeHtml(action.titel || "Actie")}</strong>
      <span>${escapeHtml(formatCodeLabel(action.prioriteit || "normaal"))} - ${escapeHtml(formatCodeLabel(action.status || "open"))}</span>
      ${action.advies ? `<span>${escapeHtml(action.advies)}</span>` : ""}
      ${action.afdekNotitie ? `<span>Afgedekt: ${escapeHtml(action.afdekNotitie)}</span>` : ""}
      ${renderActionCoverageNoteForm(action)}
      <div class="action-buttons">${renderActionButtons(action)}</div>
    </article>
  `;
}

function getAnalysisProblemId(result) {
  return `analysis:${result.id}`;
}

function getActionProblemId(action) {
  return `action:${action.id}`;
}

function getDutyProposalProblemId(proposal) {
  return `proposal:${proposal.adviesId}:${proposal.optieIndex}`;
}

function renderItemButtons(type, id) {
  return `
    <span class="item-actions">
      <button type="button" class="tiny-button" data-edit-item="${escapeHtml(type)}" data-item-id="${escapeHtml(id)}">Bewerk</button>
      <button type="button" class="tiny-button danger-text-button" data-delete-item="${escapeHtml(type)}" data-item-id="${escapeHtml(id)}">Verwijder</button>
    </span>
  `;
}

function renderActionList() {
  const list = document.getElementById("action-list");
  const actions = getOpenActions();
  const closedActions = getClosedActions();

  list.innerHTML = `
    <section class="panel">
      <p class="eyebrow">Open</p>
      ${actions.length ? actions.map(renderActionCard).join("") : "<div class=\"empty-state\">Er zijn geen open acties.</div>"}
    </section>
    <section class="panel">
      <p class="eyebrow">Afgehandeld</p>
      ${closedActions.length ? closedActions.map(renderActionCard).join("") : "<div class=\"empty-state\">Er zijn nog geen afgehandelde acties.</div>"}
    </section>
  `;
}

function renderActionCard(action) {
  const statusMeta = action.laatstBijgewerkt ? `<p class="action-meta">Bijgewerkt: ${escapeHtml(formatDateTime(action.laatstBijgewerkt))}</p>` : "";
  const isCovered = action.status === "afgedekt";
  return `
    <article class="action-card action-status-${escapeHtml(action.status || "open")}">
      <h3>${escapeHtml(action.titel || "Actie")}</h3>
      <p>${escapeHtml(action.type || "actie")} - ${escapeHtml(action.prioriteit || "normaal")} - ${escapeHtml(action.status || "open")}</p>
      ${action.deadline ? `<p>Deadline: ${escapeHtml(formatLongDate(action.deadline))}</p>` : ""}
      ${action.advies ? `<p>${escapeHtml(action.advies)}</p>` : ""}
      ${isCovered && action.afdekNotitie ? `<p>Afgedekt: ${escapeHtml(action.afdekNotitie)}</p>` : ""}
      <p>${escapeHtml(getMonthLabel(action.maandPlanningId))}</p>
      ${statusMeta}
      ${renderActionCoverageNoteForm(action)}
      <div class="action-buttons">
        ${renderActionButtons(action)}
      </div>
    </article>
  `;
}

function renderActionCoverageNoteForm(action) {
  if (!action.generated || (isClosedAction(action) && action.status !== "afgedekt")) return "";
  const isCovered = action.status === "afgedekt";
  return `
    <form class="coverage-note-form" data-action-coverage-note-form="${escapeHtml(action.id)}">
      <label>
        ${isCovered ? "Afdekking aanpassen" : "Afdekking zonder roosterwijziging"}
        <textarea data-action-coverage-note="${escapeHtml(action.id)}" placeholder="Bijv. buurmeisje past op van 21:00-23:00">${escapeHtml(action.afdekNotitie || "")}</textarea>
      </label>
      <div class="coverage-note-actions">
        <button type="submit" class="tiny-button">${isCovered ? "Afdeknotitie opslaan" : "Opslaan als afgedekt"}</button>
      </div>
    </form>
  `;
}

function renderActionButtons(action) {
  if (isClosedAction(action)) {
    return renderActionStatusButton(action, "open", "Heropen");
  }

  return `
    ${renderActionStatusButton(action, "bezig", "Zet bezig")}
    ${renderActionStatusButton(action, "wacht_op_ander", "Wacht op ander")}
    ${renderActionStatusButton(action, "opgelost", "Markeer opgelost")}
    ${renderActionStatusButton(action, "genegeerd", "Negeer")}
  `;
}

function renderActionStatusButton(action, status, label) {
  if (action.status === status) return "";
  const dangerClass = status === "genegeerd" ? " danger-outline-button" : "";
  return `<button type="button" class="subtle-button${dangerClass}" data-action-status="${status}" data-action-id="${escapeHtml(action.id)}">${label}</button>`;
}

function renderMonthlyHoursPanel(month) {
  const rows = getMonthlyHoursRows(month);
  return `
    <section class="panel">
      <p class="eyebrow">Maanduren</p>
      <div class="settings-grid">
        ${rows.map((row) => `
          <div class="settings-tile ${row.outsideBand ? "settings-tile-warning" : ""}">
            <strong>${escapeHtml(row.personLabel)}</strong>
            <span>${escapeHtml(formatHours(row.actualHours))} gewerkt / ${escapeHtml(formatHours(row.targetHours))} norm</span>
            <span>Verschil ${escapeHtml(formatSignedHours(row.difference))} uur</span>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function getMonthlyHoursRows(month) {
  const services = month ? getMonthItems(month.id, "diensten").filter(isWorkingService) : [];
  const servicesByPerson = groupBy(services, "persoonId");
  return Object.entries(getContractHours()).map(([personId, contract]) => {
    const personServices = servicesByPerson[personId] || [];
    const actualHours = personServices.reduce((total, service) => total + getServiceDurationHours(service), 0);
    const targetHours = getMonthlyContractTargetHours(month, contract.weeklyHours);
    const difference = actualHours - targetHours;
    return {
      personId,
      personLabel: getPersonLabel(personId),
      actualHours,
      targetHours,
      difference,
      outsideBand: Math.abs(difference) > contract.monthlyToleranceHours
    };
  });
}

function renderDutyNameSelectOptions(dutyNames, selectedDutyNameId = "") {
  return dutyNames.map((dutyName) => {
    const selected = dutyName.id === selectedDutyNameId ? " selected" : "";
    return `<option value="${escapeHtml(dutyName.id)}"${selected}>${escapeHtml(dutyName.naam)} - ${escapeHtml(getDutyNameMeta(dutyName))}</option>`;
  }).join("");
}

function renderFamilyTemplateManager(templates) {
  const buttons = templates.length
    ? templates.map((template) => `
        <button type="button" class="duty-preset-button" data-apply-family-template="${escapeHtml(template.id)}">
          <strong>${escapeHtml(template.naam)}</strong>
          <span>${escapeHtml(getFamilyTemplateMeta(template))}</span>
        </button>
      `).join("")
    : "<p class=\"muted-text\">Geen vaste gezinsmomenten ingesteld.</p>";

  return `
    <div class="duty-name-manager">
      <div class="duty-preset-grid">
        ${buttons}
      </div>
      <p class="muted-text duty-empty-message" data-family-template-empty-message>Geen vast gezinsmoment voor deze datum.</p>
      <div class="toolbar">
        <button type="button" data-auto-place-family-templates>Zet alles in deze maand</button>
        <button type="button" class="subtle-button" data-view-target="settings">Beheer vaste gezinsmomenten</button>
      </div>
    </div>
  `;
}

function renderQuickEntry() {
  const content = document.getElementById("quick-entry-content");
  const activeMonthId = state.data.instellingen.actieveMaandId;
  const month = activeMonthId ? getMonth(activeMonthId) : null;

  if (!month) {
    content.innerHTML = `
      <div class="empty-state">
        Open eerst een maand. Daarna kun je diensten, overige gezinsafspraken en wensen toevoegen.
      </div>
    `;
    return;
  }

  const lastDay = String(new Date(month.jaar, month.maand, 0).getDate()).padStart(2, "0");
  const minDate = `${month.id}-01`;
  const maxDate = `${month.id}-${lastDay}`;
  const editingService = getEditingItem("service") || {};
  const editingFamilyBlock = getEditingItem("family") || {};
  const editingWish = getEditingItem("wish") || {};
  const dutyNames = getDutyNames();
  const familyTemplates = getFamilyTemplates();
  const quickDate = state.quickEntry?.date || "";
  const quickLabel = quickDate ? formatLongDate(quickDate) : "";
  const serviceSubmitLabel = state.editing?.type === "service" ? "Dienst bijwerken" : "Dienst opslaan";
  const familySubmitLabel = state.editing?.type === "family" ? "Gezinsafspraak bijwerken" : "Gezinsafspraak opslaan";
  const wishSubmitLabel = state.editing?.type === "wish" ? "Wens bijwerken" : "Wens opslaan";
  const selectedDutyNameId = findDutyNameForServiceInput(editingService)?.id || "";

  content.innerHTML = `
    <div class="stack">
      <section class="panel">
        <p class="eyebrow">Actieve maand</p>
        <h3 class="form-section-title">${escapeHtml(getMonthLabel(month.id))}</h3>
        ${quickDate ? `<p class="quick-entry-note">Nieuwe invoer voor ${escapeHtml(quickLabel)}. De datum is alvast ingevuld.</p>` : ""}
        <div class="toolbar">
          <button type="button" class="subtle-button" data-view-target="cockpit">Terug naar cockpit</button>
          ${quickDate ? "<button type=\"button\" class=\"subtle-button\" data-clear-quick-entry>Datum loslaten</button>" : ""}
        </div>
      </section>

      <section class="panel ${state.quickEntry?.type === "service" ? "quick-entry-target" : ""}">
        <h3 class="form-section-title">${state.editing?.type === "service" ? "Dienst bewerken" : "Dienst toevoegen"}</h3>
        <form id="service-form" class="form-grid">
          <label>
            Persoon
            <select name="persoonId" required>
              ${renderOptions(Object.keys(PERSON_LABELS), PERSON_LABELS, editingService.persoonId || "persoon_jij")}
            </select>
          </label>
          <label>
            Datum
            <input name="datum" type="date" min="${minDate}" max="${maxDate}" value="${escapeHtml(editingService.datum || quickDate)}" required>
          </label>
          <label>
            Start
            <input name="start" type="time" value="${escapeHtml(editingService.start || "")}" required>
          </label>
          <label>
            Einde
            <input name="einde" type="time" value="${escapeHtml(editingService.einde || "")}" required>
          </label>
          <label>
            Diensttype
            <select name="dienstType" required>
              ${renderOptions(SERVICE_TYPES, null, editingService.dienstType || "")}
            </select>
          </label>
          <label>
            Status
            <select name="status" required>
              ${renderOptions(SERVICE_STATUSES, null, editingService.status || "gepubliceerd")}
            </select>
          </label>
          <label>
            Dienstcode
            <select name="dienstNaamId" data-duty-name-select required>
              <option value="">Kies dienst</option>
              ${renderDutyNameSelectOptions(dutyNames, selectedDutyNameId)}
            </select>
          </label>
          <div class="duty-select-helper full-width">
            <p class="muted-text duty-empty-message" data-duty-empty-message>Geen dienst beschikbaar voor deze persoon, datum en ronde.</p>
            <button type="button" class="tiny-button" data-view-target="settings">Beheer dienstkeuzes</button>
          </div>
          <label>
            Locatie
            <input name="locatie" type="text" value="${escapeHtml(editingService.locatie || "")}" placeholder="Bijv. Zuid">
          </label>
          <input name="dienstCode" type="hidden" value="${escapeHtml(editingService.dienstCode || "")}">
          <input name="reistijdVoorMinuten" type="hidden" value="${escapeHtml(editingService.reistijdVoorMinuten || 0)}">
          <input name="reistijdNaMinuten" type="hidden" value="${escapeHtml(editingService.reistijdNaMinuten || 0)}">
          <input name="reisOpmerking" type="hidden" value="${escapeHtml(editingService.reisOpmerking || "")}">
          <label class="full-width">
            Opmerking
            <textarea name="opmerking" placeholder="Korte notitie">${escapeHtml(editingService.opmerking || "")}</textarea>
          </label>
          <div class="form-actions full-width">
            <button type="submit">${serviceSubmitLabel}</button>
            ${state.editing?.type === "service" ? "<button type=\"button\" class=\"subtle-button\" data-cancel-edit>Annuleer bewerken</button>" : ""}
          </div>
        </form>
      </section>

      <section class="panel ${state.quickEntry?.type === "family" ? "quick-entry-target" : ""}">
        <h3 class="form-section-title">${state.editing?.type === "family" ? "Overige gezinsafspraak bewerken" : "Overige gezinsafspraak toevoegen"}</h3>
        ${renderFamilyTemplateManager(familyTemplates)}
        <form id="family-block-form" class="form-grid">
          <label>
            Type
            <select name="type" required>
              ${renderOptions(FAMILY_BLOCK_TYPES, null, editingFamilyBlock.type || "")}
            </select>
          </label>
          <label>
            Datum
            <input name="datum" type="date" min="${minDate}" max="${maxDate}" value="${escapeHtml(editingFamilyBlock.datum || quickDate)}" required>
          </label>
          <label>
            Start
            <input name="start" type="time" value="${escapeHtml(editingFamilyBlock.start || "")}" required>
          </label>
          <label>
            Einde
            <input name="einde" type="time" value="${escapeHtml(editingFamilyBlock.einde || "")}" required>
          </label>
          <label>
            Hardheid
            <select name="hardheid" required>
              <option value="hard"${selectedAttr(editingFamilyBlock.hardheid || "hard", "hard")}>Hard</option>
              <option value="zacht"${selectedAttr(editingFamilyBlock.hardheid || "hard", "zacht")}>Zacht</option>
            </select>
          </label>
          <label>
            Dekking nodig
            <select name="dekkingNodig" required>
              <option value="true"${selectedAttr(String(editingFamilyBlock.dekkingNodig ?? true), "true")}>Ja</option>
              <option value="false"${selectedAttr(String(editingFamilyBlock.dekkingNodig ?? true), "false")}>Nee</option>
            </select>
          </label>
          <label class="full-width">
            Opmerking
            <textarea name="opmerking" placeholder="Bijv. opvang dicht, sport, afspraak">${escapeHtml(editingFamilyBlock.opmerking || "")}</textarea>
          </label>
          <div class="form-actions full-width">
            <button type="submit">${familySubmitLabel}</button>
            ${state.editing?.type === "family" ? "<button type=\"button\" class=\"subtle-button\" data-cancel-edit>Annuleer bewerken</button>" : ""}
          </div>
        </form>
      </section>

      <section class="panel ${state.quickEntry?.type === "wish" ? "quick-entry-target" : ""}">
        <h3 class="form-section-title">${state.editing?.type === "wish" ? "Wens bewerken" : "Wens toevoegen"}</h3>
        <form id="wish-form" class="form-grid">
          <label>
            Persoon
            <select name="persoonId" required>
              ${renderOptions(Object.keys(PERSON_LABELS), PERSON_LABELS, editingWish.persoonId || "persoon_jij")}
            </select>
          </label>
          <label>
            Datum
            <input name="datum" type="date" min="${minDate}" max="${maxDate}" value="${escapeHtml(editingWish.datum || quickDate)}" required>
          </label>
          <label>
            Type
            <select name="type" required>
              ${renderOptions(WISH_TYPES, null, editingWish.type || "")}
            </select>
          </label>
          <label>
            Prioriteit
            <select name="prioriteit" required>
              <option value="hoog"${selectedAttr(editingWish.prioriteit || "normaal", "hoog")}>Hoog</option>
              <option value="normaal"${selectedAttr(editingWish.prioriteit || "normaal", "normaal")}>Normaal</option>
              <option value="laag"${selectedAttr(editingWish.prioriteit || "normaal", "laag")}>Laag</option>
            </select>
          </label>
          <label class="full-width">
            Reden
            <textarea name="reden" placeholder="Waarom is deze wens belangrijk?">${escapeHtml(editingWish.reden || "")}</textarea>
          </label>
          <div class="form-actions full-width">
            <button type="submit">${wishSubmitLabel}</button>
            ${state.editing?.type === "wish" ? "<button type=\"button\" class=\"subtle-button\" data-cancel-edit>Annuleer bewerken</button>" : ""}
          </div>
        </form>
      </section>
    </div>
  `;
  updateDutyNameVisibility();
  updateFamilyTemplateVisibility();
}

function renderStoragePanel() {
  const panel = document.getElementById("storage-panel");
  const data = state.data;
  const snapshots = loadSnapshots();
  panel.innerHTML = `
    <div class="storage-list">
      <div class="storage-row"><span>Opslagsleutel</span><strong>${STORAGE_KEY}</strong></div>
      <div class="storage-row"><span>Syncstatus</span><strong>Alleen lokaal</strong></div>
      <div class="storage-row"><span>DataVersion</span><strong>${data.dataVersion}</strong></div>
      <div class="storage-row"><span>RevisionId</span><strong>${escapeHtml(data.revisionId || "nog geen revisie")}</strong></div>
      <div class="storage-row"><span>Laatst opgeslagen</span><strong>${formatDateTime(data.lastModified)}</strong></div>
      <div class="storage-row"><span>Maanden</span><strong>${data.maandPlanningen.length}</strong></div>
      <div class="storage-row"><span>Diensten</span><strong>${data.diensten.length}</strong></div>
      <div class="storage-row"><span>Overige gezinsafspraken</span><strong>${data.gezinsVerplichtingen.length}</strong></div>
      <div class="storage-row"><span>Acties</span><strong>${data.actieItems.length}</strong></div>
      <div class="storage-row"><span>Snapshots</span><strong>${snapshots.length}</strong></div>
    </div>
    <div class="storage-actions">
      <button type="button" data-backup-download>Backup downloaden</button>
      <label class="file-button">
        Backup terugzetten
        <input id="backup-file-input" type="file" accept="application/json,.json" data-backup-file>
      </label>
      <button type="button" class="danger-button" data-clear-local>Lokale data wissen</button>
    </div>
    <p class="empty-state" id="backup-message">
      Backups bevatten alleen lokale roostercoach-data. Er wordt niets naar een server gesynchroniseerd.
    </p>
  `;
}

function focusPendingDay() {
  if (!state.pendingFocusDate || state.currentView !== "cockpit") return;
  const date = state.pendingFocusDate;
  const problemId = state.pendingProblemId;
  state.pendingFocusDate = null;
  state.pendingProblemId = null;
  const schedule = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 0));
  schedule(() => {
    const detail = document.querySelector(`[data-day-detail="${cssEscape(date)}"]`);
    const problem = problemId ? document.querySelector(`[data-day-problem="${cssEscape(problemId)}"]`) : null;
    const row = document.querySelector(`[data-day-row="${cssEscape(date)}"]`);
    const target = problem || detail || row;
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    if (typeof target.focus === "function") target.focus({ preventScroll: true });
  });
}

function advanceMonthStage(monthId) {
  const month = getMonth(monthId);
  const nextStage = month ? getNextPlanningStage(month.planningStage) : null;
  if (!month || !nextStage) return;
  setMonthStage(monthId, nextStage.value);
}

function setMonthStage(monthId, stageValue) {
  const month = getMonth(monthId);
  if (!month || !PLANNING_STAGES.some((stage) => stage.value === stageValue)) return;
  if (month.planningStage === stageValue) return;
  month.planningStage = stageValue;
  runAnalysis(monthId);
  saveData("maandronde_bijgewerkt");
  renderApp();
}

function deleteScheduleItem(type, id) {
  const item = getItemByType(type, id);
  if (!item) return;
  const label = getItemTypeLabel(type);
  const ok = window.confirm(`${label} verwijderen?\n\nDe analyse en acties worden daarna opnieuw bijgewerkt.`);
  if (!ok) return;

  const monthId = item.maandPlanningId;
  const collectionName = getCollectionNameForType(type);
  state.data[collectionName] = state.data[collectionName].filter((entry) => entry.id !== id);
  if (state.editing?.type === type && state.editing.id === id) {
    state.editing = null;
  }
  runAnalysis(monthId);
  saveData(`${getItemTypeLogName(type)}_verwijderd`);
  renderApp();
}

function getEditingItem(type) {
  if (state.editing?.type !== type) return null;
  return getItemByType(type, state.editing.id);
}

function getItemByType(type, id) {
  const collectionName = getCollectionNameForType(type);
  if (!collectionName) return null;
  return state.data[collectionName].find((item) => item.id === id) || null;
}

function getCollectionNameForType(type) {
  const collections = {
    service: "diensten",
    family: "gezinsVerplichtingen",
    wish: "wensen"
  };
  return collections[type] || "";
}

function getItemTypeLabel(type) {
  const labels = {
    service: "Dienst",
    family: "Overige gezinsafspraak",
    wish: "Wens"
  };
  return labels[type] || "Item";
}

function getItemTypeLogName(type) {
  const names = {
    service: "dienst",
    family: "overige gezinsafspraak",
    wish: "wens"
  };
  return names[type] || "item";
}

function populateForms() {
  const currentYear = new Date().getFullYear();
  document.getElementById("month-year").value = currentYear;
  document.getElementById("month-number").innerHTML = MONTH_NAMES.map((name, index) => {
    const month = index + 1;
    return `<option value="${month}">${name}</option>`;
  }).join("");
  document.getElementById("month-number").value = String(new Date().getMonth() + 1);
  document.getElementById("month-stage").innerHTML = PLANNING_STAGES.map((stage) => {
    return `<option value="${stage.value}">${stage.label}</option>`;
  }).join("");
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.view === "cockpit" && !state.data.instellingen.actieveMaandId) {
        showView("months");
        return;
      }
      if (button.dataset.view !== "quick-entry") {
        state.editing = null;
        state.quickEntry = null;
      }
      showView(button.dataset.view);
    });
  });

  document.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-open-month]");
    if (openButton) {
      openMonth(openButton.dataset.openMonth);
    }

    const duplicateMonthButton = event.target.closest("[data-duplicate-month]");
    if (duplicateMonthButton) {
      duplicateMonth(duplicateMonthButton.dataset.duplicateMonth);
    }

    const deleteMonthButton = event.target.closest("[data-delete-month]");
    if (deleteMonthButton) {
      deleteMonth(deleteMonthButton.dataset.deleteMonth);
    }

    const runAnalysisButton = event.target.closest("[data-run-analysis]");
    if (runAnalysisButton) {
      rerunMonthControl(runAnalysisButton.dataset.runAnalysis);
    }

    if (event.target.closest("[data-copy-ai-context]")) {
      copyAiContextToClipboard();
      return;
    }

    const requestAiAdviceButton = event.target.closest("[data-request-ai-advice]");
    if (requestAiAdviceButton) {
      requestAiAdvice(requestAiAdviceButton.dataset.requestAiAdvice);
      return;
    }

    const requestAiRosterButton = event.target.closest("[data-request-ai-roster]");
    if (requestAiRosterButton) {
      requestAiRoster(requestAiRosterButton.dataset.requestAiRoster);
      return;
    }

    const saveAiAdviceButton = event.target.closest("[data-save-ai-advice]");
    if (saveAiAdviceButton) {
      saveAiAdvice(saveAiAdviceButton.dataset.saveAiAdvice);
      return;
    }

    const deleteAiAdviceButton = event.target.closest("[data-delete-ai-advice]");
    if (deleteAiAdviceButton) {
      deleteAiAdvice(deleteAiAdviceButton.dataset.deleteAiAdvice);
      return;
    }

    const aiOptionStatusButton = event.target.closest("[data-ai-option-status]");
    if (aiOptionStatusButton) {
      setAiAdviceOptionStatus(
        aiOptionStatusButton.dataset.aiOptionStatus,
        aiOptionStatusButton.dataset.aiOptionIndex,
        aiOptionStatusButton.dataset.aiOptionValue
      );
      return;
    }

    const aiOptionActionButton = event.target.closest("[data-ai-option-action]");
    if (aiOptionActionButton) {
      createActionFromAiAdviceOption(aiOptionActionButton.dataset.aiOptionAction, aiOptionActionButton.dataset.aiOptionIndex);
      return;
    }

    const acceptAiDutyButton = event.target.closest("[data-accept-ai-duty]");
    if (acceptAiDutyButton) {
      acceptAiDutyProposal(acceptAiDutyButton.dataset.acceptAiDuty, acceptAiDutyButton.dataset.aiOptionIndex);
      return;
    }

    const advanceStageButton = event.target.closest("[data-advance-month-stage]");
    if (advanceStageButton) {
      advanceMonthStage(advanceStageButton.dataset.advanceMonthStage);
      return;
    }

    const filterButton = event.target.closest("[data-cockpit-filter]");
    if (filterButton) {
      setCockpitFilter(filterButton.dataset.cockpitFilter);
      return;
    }

    const notificationStatusButton = event.target.closest("[data-notification-status]");
    if (notificationStatusButton) {
      updateNotificationStatus(notificationStatusButton.dataset.analysisId, notificationStatusButton.dataset.notificationStatus);
      return;
    }

    const applyFamilyTemplateButton = event.target.closest("[data-apply-family-template]");
    if (applyFamilyTemplateButton) {
      applyFamilyTemplate(applyFamilyTemplateButton.dataset.applyFamilyTemplate);
      return;
    }

    if (event.target.closest("[data-auto-place-family-templates]")) {
      autoPlaceFamilyTemplatesForActiveMonth();
      return;
    }

    if (event.target.closest("[data-import-school-ical-url]")) {
      importSchoolIcalUrl();
      return;
    }

    const editDutyNameButton = event.target.closest("[data-edit-duty-name]");
    if (editDutyNameButton) {
      startEditDutyName(editDutyNameButton.dataset.editDutyName);
      return;
    }

    const deleteDutyNameButton = event.target.closest("[data-delete-duty-name]");
    if (deleteDutyNameButton) {
      deleteDutyName(deleteDutyNameButton.dataset.deleteDutyName);
      return;
    }

    const editFamilyTemplateButton = event.target.closest("[data-edit-family-template]");
    if (editFamilyTemplateButton) {
      startEditFamilyTemplate(editFamilyTemplateButton.dataset.editFamilyTemplate);
      return;
    }

    const deleteFamilyTemplateButton = event.target.closest("[data-delete-family-template]");
    if (deleteFamilyTemplateButton) {
      deleteFamilyTemplate(deleteFamilyTemplateButton.dataset.deleteFamilyTemplate);
      return;
    }

    const editWishTemplateButton = event.target.closest("[data-edit-wish-template]");
    if (editWishTemplateButton) {
      startEditWishTemplate(editWishTemplateButton.dataset.editWishTemplate);
      return;
    }

    const deleteWishTemplateButton = event.target.closest("[data-delete-wish-template]");
    if (deleteWishTemplateButton) {
      deleteWishTemplate(deleteWishTemplateButton.dataset.deleteWishTemplate);
      return;
    }

    const deleteChildButton = event.target.closest("[data-delete-child]");
    if (deleteChildButton) {
      deleteChild(deleteChildButton.dataset.deleteChild);
      return;
    }

    const deleteSchoolTimeButton = event.target.closest("[data-delete-school-time]");
    if (deleteSchoolTimeButton) {
      deleteSchoolTime(deleteSchoolTimeButton.dataset.deleteSchoolTime);
      return;
    }

    const deleteSchoolPeriodButton = event.target.closest("[data-delete-school-period]");
    if (deleteSchoolPeriodButton) {
      deleteSchoolPeriod(deleteSchoolPeriodButton.dataset.deleteSchoolPeriod);
      return;
    }

    if (event.target.closest("[data-cancel-duty-edit]")) {
      cancelEditDutyName();
      return;
    }

    if (event.target.closest("[data-cancel-family-template-edit]")) {
      cancelEditFamilyTemplate();
      return;
    }

    if (event.target.closest("[data-cancel-wish-template-edit]")) {
      cancelEditWishTemplate();
      return;
    }

    const viewButton = event.target.closest("[data-view-target]");
    if (viewButton) {
      if (viewButton.dataset.viewTarget !== "quick-entry") {
        state.editing = null;
        state.quickEntry = null;
      }
      showView(viewButton.dataset.viewTarget);
    }

    if (event.target.closest("[data-backup-download]")) {
      downloadBackup();
    }

    if (event.target.closest("[data-clear-local]")) {
      clearLocalData();
    }

    const actionStatusButton = event.target.closest("[data-action-status]");
    if (actionStatusButton) {
      updateActionStatus(actionStatusButton.dataset.actionId, actionStatusButton.dataset.actionStatus);
      return;
    }

    const toggleSleutelButton = event.target.closest("[data-toggle-sleutel-service]");
    if (toggleSleutelButton) {
      toggleServiceSleutelStatus(toggleSleutelButton.dataset.toggleSleutelService);
      return;
    }

    const editButton = event.target.closest("[data-edit-item]");
    if (editButton) {
      startEditItem(editButton.dataset.editItem, editButton.dataset.itemId);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-item]");
    if (deleteButton) {
      deleteScheduleItem(deleteButton.dataset.deleteItem, deleteButton.dataset.itemId);
      return;
    }

    const openProblemButton = event.target.closest("[data-open-problem]");
    if (openProblemButton) {
      openDay(openProblemButton.dataset.openDay, openProblemButton.dataset.openProblem);
      return;
    }

    const openDayButton = event.target.closest("[data-open-day]");
    if (openDayButton) {
      if (event.target.closest("button, input, textarea, select, label")) return;
      openDay(openDayButton.dataset.openDay);
      return;
    }

    if (event.target.closest("[data-cancel-edit]")) {
      cancelEditItem();
    }

    const quickAddButton = event.target.closest("[data-quick-add]");
    if (quickAddButton) {
      startQuickEntry(quickAddButton.dataset.quickAdd, quickAddButton.dataset.date);
    }

    if (event.target.closest("[data-clear-quick-entry]")) {
      clearQuickEntry();
    }
  });

  document.getElementById("create-month-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    createMonth(form.get("year"), form.get("month"), form.get("stage"));
  });

  document.addEventListener("submit", (event) => {
    if (event.target.matches("[data-coverage-note-form]")) {
      event.preventDefault();
      saveCoverageNote(event.target.dataset.coverageNoteForm);
      return;
    }

    if (event.target.matches("[data-action-coverage-note-form]")) {
      event.preventDefault();
      saveActionCoverageNote(event.target.dataset.actionCoverageNoteForm);
      return;
    }

    if (event.target.id === "contract-hours-form") {
      event.preventDefault();
      updateContractHours(formToObject(event.target));
      return;
    }

    if (event.target.id === "settings-duty-name-form") {
      event.preventDefault();
      addDutyName(formToObject(event.target));
      event.target.reset();
      return;
    }

    if (event.target.id === "family-template-form") {
      event.preventDefault();
      addFamilyTemplate(formToObject(event.target));
      event.target.reset();
      return;
    }

    if (event.target.id === "wish-template-form") {
      event.preventDefault();
      addWishTemplate(formToObject(event.target));
      event.target.reset();
      return;
    }

    if (event.target.id === "child-form") {
      event.preventDefault();
      addChild(formToObject(event.target));
      event.target.reset();
      return;
    }

    if (event.target.id === "school-time-form") {
      event.preventDefault();
      addSchoolTime(formToObject(event.target));
      event.target.reset();
      return;
    }

    if (event.target.id === "school-ical-url-form") {
      event.preventDefault();
      saveSchoolIcalUrl(formToObject(event.target));
      return;
    }

    if (event.target.id === "school-period-form") {
      event.preventDefault();
      addSchoolPeriod(formToObject(event.target));
      event.target.reset();
      return;
    }

    if (event.target.id === "service-form") {
      event.preventDefault();
      addService(formToObject(event.target));
    }

    if (event.target.id === "family-block-form") {
      event.preventDefault();
      addFamilyBlock(formToObject(event.target));
    }

    if (event.target.id === "wish-form") {
      event.preventDefault();
      addWish(formToObject(event.target));
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-month-stage-select]")) {
      setMonthStage(event.target.dataset.monthStageSelect, event.target.value);
      return;
    }

    if (event.target.matches("#service-form select[name='persoonId'], #service-form input[name='datum']")) {
      updateDutyNameVisibility();
    }

    if (event.target.matches("#service-form select[name='dienstNaamId']")) {
      if (event.target.value) {
        applyDutyName(event.target.value);
      } else {
        clearDutyNameFields(event.target.form);
      }
    }

    if (event.target.matches("#family-block-form input[name='datum']")) {
      updateFamilyTemplateVisibility();
    }

    if (event.target.matches("[data-backup-file]")) {
      restoreBackup(event.target.files[0]);
      event.target.value = "";
    }

    if (event.target.matches("[data-school-ical-file]")) {
      importSchoolIcalFile(event.target.files[0]);
      event.target.value = "";
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.target.closest("[data-notification-status]")) return;
    if (event.target.closest("button, input, textarea, select, label")) return;
    const openDayTarget = event.target.closest("[data-open-day]");
    if (!openDayTarget || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    openDay(openDayTarget.dataset.openDay, openDayTarget.dataset.openProblem || "");
  });
}

function setSaveStatus(message, isError = false) {
  const status = document.getElementById("save-status");
  if (!status) return;
  status.textContent = message;
  status.style.color = isError ? "var(--conflict-text)" : "var(--good-text)";
}

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function dateToMonthId(date) {
  return String(date || "").slice(0, 7);
}

function formToObject(form) {
  const data = {};
  const formData = new FormData(form);
  formData.forEach((value, key) => {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      data[key] = Array.isArray(data[key]) ? [...data[key], value] : [data[key], value];
      return;
    }
    data[key] = value;
  });
  return data;
}

function toggleServiceSleutelStatus(serviceId) {
  const service = state.data.diensten.find((item) => item.id === serviceId);
  if (!service) return;
  service.sleutelAkkoord = !service.sleutelAkkoord;
  state.selectedDate = service.datum;
  saveData(service.sleutelAkkoord ? "dienst_sleutel_akkoord" : "dienst_sleutel_heropend");
  renderApp();
}

function copyAiContextToClipboard() {
  const output = document.querySelector("[data-ai-context-output]");
  const text = output?.value || output?.textContent || "";
  if (!text.trim()) {
    setSaveStatus("Geen AI-context gevonden", true);
    return;
  }

  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    navigator.clipboard.writeText(text)
      .then(() => setSaveStatus("AI-context gekopieerd"))
      .catch(() => copyTextWithFallback(text));
    return;
  }

  copyTextWithFallback(text);
}

function copyTextWithFallback(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand && document.execCommand("copy");
  textarea.remove();
  setSaveStatus(copied ? "AI-context gekopieerd" : "Kopieer de AI-context handmatig", !copied);
}

function saveCoverageNote(analysisId) {
  const result = state.data.analyseResultaten.find((item) => item.id === analysisId);
  const field = document.querySelector(`[data-coverage-note="${cssEscape(analysisId)}"]`);
  const note = String(field?.value || "").trim();
  if (!result) return;
  if (!note) {
    setSaveStatus("Vul eerst in wat er geregeld is", true);
    if (field && typeof field.focus === "function") field.focus();
    return;
  }

  result.afdekNotitie = note;
  result.afgedektOp = new Date().toISOString();
  result.actieStatus = "afgedekt";
  updateGeneratedActionForCoveredAnalysis(result);
  updateMonthStatus(result.maandPlanningId);
  saveData("controlepunt_afgedekt");
  renderApp();
}

function saveActionCoverageNote(actionId) {
  const action = state.data.actieItems.find((item) => item.id === actionId);
  const field = document.querySelector(`[data-action-coverage-note="${cssEscape(actionId)}"]`);
  const note = String(field?.value || "").trim();
  if (!action) return;
  if (!note) {
    setSaveStatus("Vul eerst in wat er geregeld is", true);
    if (field && typeof field.focus === "function") field.focus();
    return;
  }

  const result = findAnalysisForAction(action);
  if (result) {
    result.afdekNotitie = note;
    result.afgedektOp = new Date().toISOString();
    result.actieStatus = "afgedekt";
    updateGeneratedActionForCoveredAnalysis(result);
    updateMonthStatus(result.maandPlanningId);
  } else {
    action.status = "afgedekt";
    action.afdekNotitie = note;
    action.laatstBijgewerkt = new Date().toISOString();
    updateMonthStatus(action.maandPlanningId);
  }

  saveData("actie_afgedekt");
  renderApp();
}

function findAnalysisForAction(action) {
  const linkedIds = Array.isArray(action.gekoppeldeAnalyseIds) ? action.gekoppeldeAnalyseIds : [];
  return state.data.analyseResultaten.find((result) => {
    const linkedById = linkedIds.includes(result.id);
    const linkedBySignature = action.analyseSignature && result.signature === action.analyseSignature;
    return linkedById || linkedBySignature;
  }) || null;
}

function updateGeneratedActionForCoveredAnalysis(result) {
  state.data.actieItems.forEach((action) => {
    const linkedIds = Array.isArray(action.gekoppeldeAnalyseIds) ? action.gekoppeldeAnalyseIds : [];
    const linkedById = linkedIds.includes(result.id);
    const linkedBySignature = action.analyseSignature && action.analyseSignature === result.signature;
    if (!linkedById && !linkedBySignature) return;
    action.status = "afgedekt";
    action.afdekNotitie = result.afdekNotitie;
    action.laatstBijgewerkt = result.afgedektOp;
  });
}

function saveAiAdvice(monthId) {
  const month = getMonth(monthId);
  const input = document.querySelector("[data-ai-advice-input]");
  const text = String(input?.value || "").trim();
  if (!month || !text) {
    setSaveStatus("Geen AI-advies om op te slaan", true);
    return;
  }

  saveAiAdviceText(monthId, text, "bron_ai_test_handmatig");
  if (input) input.value = "";
  renderApp();
}

async function requestAiAdvice(monthId) {
  const month = getMonth(monthId);
  const output = document.querySelector("[data-ai-context-output]");
  const context = String(output?.value || "").trim();
  if (!month || !context) {
    setSaveStatus("Geen AI-context gevonden", true);
    return;
  }

  setSaveStatus("AI-advies wordt opgehaald...");
  try {
    const response = await fetch(getAiEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "AI-aanvraag mislukt.");
    saveAiAdviceText(monthId, data.text || "", "bron_openai_lokaal");
    renderApp();
    setSaveStatus("AI-advies opgeslagen");
  } catch (error) {
    setSaveStatus(`AI niet bereikbaar: ${error.message}`, true);
  }
}

async function requestAiRoster(monthId) {
  const month = getMonth(monthId);
  if (!month) {
    setSaveStatus("Geen maand gevonden voor AI-rooster", true);
    return;
  }

  const scan = buildAdviceScanForMonth(month);
  const context = scan.contextText;
  if (!context) {
    setSaveStatus("Geen AI-context gevonden", true);
    return;
  }

  setSaveStatus("AI-roostervoorstel wordt opgehaald...");
  try {
    const response = await fetch(getAiEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "AI-aanvraag mislukt.");
    saveAiAdviceText(monthId, data.text || "", "bron_openai_rooster");
    renderApp();
    setSaveStatus("AI-roostervoorstel opgeslagen");
  } catch (error) {
    setSaveStatus(`AI niet bereikbaar: ${error.message}`, true);
  }
}

function buildAdviceScanForMonth(month) {
  const days = buildMonthDays(month);
  const controlSummary = buildControlSummary(month, days);
  return buildAdviceReadiness(month, days, controlSummary);
}

function getAiEndpoint() {
  if (window.location.protocol === "file:") return "http://127.0.0.1:8787/api/ai-advies";
  return "/api/ai-advies";
}

function saveAiAdviceText(monthId, text, sourceId) {
  const cleaned = String(text || "").trim();
  if (!cleaned) {
    setSaveStatus("Geen AI-advies om op te slaan", true);
    return false;
  }

  const extractedOptions = extractAiAdviceOptions(cleaned);
  state.data.keuzeOpties.push({
    id: generateId("ai_advies"),
    maandPlanningId: monthId,
    type: "ai_advies",
    bronId: sourceId,
    aangemaaktOp: new Date().toISOString(),
    status: "concept",
    tekst: cleaned,
    opties: extractedOptions.map((option) => ({
      tekst: typeof option === "string" ? option : option.tekst,
      status: "open",
      actieId: "",
      dienstId: "",
      voorstel: typeof option === "object" ? option.voorstel : null,
      bijgewerktOp: ""
    }))
  });
  saveData("ai_advies_opgeslagen");
  return true;
}

function setAiAdviceOptionStatus(adviceId, optionIndex, status) {
  const advice = getAiAdviceById(adviceId);
  const index = Number(optionIndex);
  if (!advice || !Number.isInteger(index)) return;
  const options = normalizeAiAdviceOptions(advice);
  if (!options[index]) return;

  options[index].status = status || "open";
  options[index].bijgewerktOp = new Date().toISOString();
  advice.opties = options;
  saveData(`ai_optie_${status || "open"}`);
  renderApp();
}

function createActionFromAiAdviceOption(adviceId, optionIndex) {
  const advice = getAiAdviceById(adviceId);
  const index = Number(optionIndex);
  if (!advice || !Number.isInteger(index)) return;
  const options = normalizeAiAdviceOptions(advice);
  const option = options[index];
  if (!option) return;

  const existingAction = option.actieId ? state.data.actieItems.find((action) => action.id === option.actieId) : null;
  if (!existingAction) {
    const action = {
      id: generateId("actie"),
      maandPlanningId: advice.maandPlanningId,
      datum: `${advice.maandPlanningId}-01`,
      titel: `AI-advies checken: ${option.tekst.slice(0, 80)}`,
      type: "ai_advies_controleren",
      prioriteit: "normaal",
      deadline: `${advice.maandPlanningId}-01`,
      status: "open",
      gekoppeldeAnalyseIds: [],
      advies: option.tekst,
      generated: false,
      bronId: advice.id,
      aiOptieIndex: index
    };
    state.data.actieItems.push(action);
    option.actieId = action.id;
  }

  option.status = "actie";
  option.bijgewerktOp = new Date().toISOString();
  advice.opties = options;
  saveData("ai_optie_actie_gemaakt");
  renderApp();
}

function acceptAiDutyProposal(adviceId, optionIndex) {
  const advice = getAiAdviceById(adviceId);
  const index = Number(optionIndex);
  if (!advice || !Number.isInteger(index)) return;
  const options = normalizeAiAdviceOptions(advice);
  const option = options[index];
  const proposal = option?.voorstel?.soort === "dienst" ? option.voorstel : null;
  if (!proposal) {
    setSaveStatus("Geen dienstvoorstel gevonden", true);
    return;
  }
  if (option.status === "geaccepteerd" && option.dienstId) {
    setSaveStatus("Dit voorstel is al geaccepteerd", true);
    return;
  }

  const dutyName = findDutyNameForAiProposal(proposal, advice.maandPlanningId);
  if (!dutyName) {
    option.status = "nagaan";
    option.bijgewerktOp = new Date().toISOString();
    advice.opties = options;
    saveData("ai_dienstvoorstel_nagaan");
    renderApp();
    setSaveStatus("Dienstvoorstel matcht geen beheerde dienstnaam voor deze dag/ronde", true);
    return;
  }

  const duplicate = state.data.diensten.find((service) => {
    return service.datum === proposal.datum &&
      service.persoonId === proposal.persoonId &&
      String(service.dienstCode || "").trim().toLowerCase() === String(dutyName.naam || "").trim().toLowerCase();
  });
  if (duplicate) {
    const ok = window.confirm("Deze dienst lijkt al in de maand te staan. Toch nogmaals toevoegen?");
    if (!ok) return;
  }

  const service = createServiceFromDutyProposal(proposal, dutyName, advice);
  state.data.diensten.push(service);
  option.status = "geaccepteerd";
  option.dienstId = service.id;
  option.bijgewerktOp = new Date().toISOString();
  advice.opties = options;
  state.selectedDate = service.datum;
  runAnalysis(service.maandPlanningId);
  saveData("ai_dienstvoorstel_geaccepteerd");
  renderApp();
  setSaveStatus("AI-dienstvoorstel geaccepteerd");
}

function findDutyNameForAiProposal(proposal, monthId) {
  const month = getMonth(monthId || dateToMonthId(proposal.datum));
  const activeStage = month?.planningStage || state.data.instellingen.standaardPlanningStage;
  const targetName = normalizeAiText(proposal.dienstNaam || proposal.dienstCode);
  if (!targetName || !proposal.datum || !proposal.persoonId) return null;

  return getDutyNames().find((dutyName) => {
    if (normalizeAiText(dutyName.naam) !== targetName) return false;
    if (!(dutyName.persoonId === "beiden" || dutyName.persoonId === proposal.persoonId)) return false;
    return isDutyNameAvailableFor(dutyName, proposal.persoonId, activeStage, proposal.datum);
  }) || null;
}

function createServiceFromDutyProposal(proposal, dutyName, advice) {
  return {
    id: generateId("dienst"),
    persoonId: proposal.persoonId,
    maandPlanningId: advice.maandPlanningId,
    datum: proposal.datum,
    start: dutyName.start,
    einde: dutyName.einde,
    dienstCode: dutyName.naam,
    dienstType: dutyName.dienstType,
    locatie: dutyName.post || dutyName.locatie || proposal.locatie || "",
    roosterLaag: dutyName.dienstType === "instructie" ? "instructie" : "regulier",
    status: "wens",
    bronId: advice.id,
    ruilbaar: "onbekend",
    sleutelAkkoord: false,
    reistijdVoorMinuten: toPositiveNumber(dutyName.reistijdVoorMinuten, DEFAULT_TRAVEL_MINUTES),
    reistijdNaMinuten: toPositiveNumber(dutyName.reistijdNaMinuten, DEFAULT_TRAVEL_MINUTES),
    reisOpmerking: dutyName.reisOpmerking || "",
    opmerking: `AI-voorstel: ${proposal.reden || "geen reden opgegeven"}`
  };
}

function getAiAdviceById(adviceId) {
  return state.data.keuzeOpties.find((option) => option.id === adviceId && option.type === "ai_advies") || null;
}

function normalizeAiAdviceOptions(advice) {
  const options = getAiAdviceOptionObjects(advice);
  advice.opties = options;
  return options;
}

function deleteAiAdvice(adviceId) {
  const advice = state.data.keuzeOpties.find((option) => option.id === adviceId && option.type === "ai_advies");
  if (!advice) return;
  const ok = window.confirm("AI-advies verwijderen?\n\nAlleen dit lokale testadvies wordt verwijderd.");
  if (!ok) return;
  state.data.keuzeOpties = state.data.keuzeOpties.filter((option) => option.id !== adviceId);
  saveData("ai_advies_verwijderd");
  renderApp();
}

function extractAiAdviceOptions(text) {
  const cleaned = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];
  const lines = cleaned.split("\n").map((line) => line.trim()).filter(Boolean);
  const proposals = lines
    .map(parseAiDutyProposalLine)
    .filter(Boolean)
    .slice(0, 20);
  const options = [];
  let current = "";

  lines.forEach((line) => {
    if (/^dienstvoorstel\s*:/i.test(line)) return;
    const startsOption = /^(\d+[\).:-]\s+|optie\s+\d+[:.-]\s+)/i.test(line);
    if (startsOption) {
      if (current) options.push(current.trim());
      current = line.replace(/^(\d+[\).:-]\s+|optie\s+\d+[:.-]\s+)/i, "").trim();
      return;
    }
    if (current) {
      current = `${current} ${line}`;
    }
  });

  if (current) options.push(current.trim());
  if (proposals.length || options.length) {
    return [
      ...proposals,
      ...options.slice(0, 8).map((option) => ({ tekst: option, voorstel: null }))
    ];
  }

  return lines
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .slice(0, 8)
    .map((option) => ({ tekst: option, voorstel: null }));
}

function parseAiDutyProposalLine(line) {
  const match = String(line || "").match(/^dienstvoorstel\s*:\s*(.+)$/i);
  if (!match) return null;
  const fields = {};
  match[1].split(";").forEach((part) => {
    const [rawKey, ...rawValue] = part.split("=");
    const key = normalizeAiText(rawKey);
    const value = rawValue.join("=").trim();
    if (key && value) fields[key] = value;
  });

  const datum = fields.datum || fields.date || "";
  const personId = parseAiPerson(fields.persoon || fields.person || "");
  const dienstNaam = fields.dienst || fields.dienstnaam || fields.service || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || !personId || !dienstNaam) return null;

  const voorstel = {
    soort: "dienst",
    datum,
    persoonId: personId,
    dienstNaam: dienstNaam.trim(),
    dienstCode: dienstNaam.trim(),
    reden: fields.reden || fields.reason || "",
    start: "",
    einde: "",
    locatie: ""
  };

  return {
    tekst: `${formatLongDate(datum)} ${getPersonLabel(personId)}: ${dienstNaam}${voorstel.reden ? ` - ${voorstel.reden}` : ""}`,
    voorstel
  };
}

function parseAiPerson(value) {
  const normalized = normalizeAiText(value);
  if (["ronald", "ik", "jij", "persoonjij"].includes(normalized)) return "persoon_jij";
  if (["eva", "vrouw", "persoonvrouw"].includes(normalized)) return "persoon_vrouw";
  return "";
}

function normalizeAiText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function getPersonLabel(personId) {
  return PERSON_LABELS[personId] || personId || "Persoon";
}

function renderOptions(values, labels = null, selectedValue = "") {
  return values.map((value) => {
    const label = labels ? labels[value] : formatCodeLabel(value);
    const selected = value === selectedValue ? " selected" : "";
    return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
  }).join("");
}

function selectedAttr(currentValue, optionValue) {
  return String(currentValue) === String(optionValue) ? " selected" : "";
}

function formatCodeLabel(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatBackupTimestamp(date) {
  const parts = new Intl.DateTimeFormat("nl-NL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}-${parts.hour}${parts.minute}`;
}

function formatLongDate(value) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(date);
}

function formatDateRange(start, end) {
  if (!start && !end) return "";
  if (!end || start === end) return formatLongDate(start);
  return `${formatLongDate(start)} t/m ${formatLongDate(end)}`;
}

function formatTimeRange(start, end) {
  if (!start && !end) return "";
  return `${start || "?"}-${end || "?"}`;
}

function formatHours(value) {
  return Number(value || 0).toLocaleString("nl-NL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  });
}

function formatSignedHours(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatHours(value)}`;
}

function toPositiveNumber(value, fallback) {
  const number = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(number) || number < 0) return fallback;
  return number;
}

function getMonthlyContractTargetHours(month, weeklyHours) {
  if (!month) return 0;
  const daysInMonth = new Date(month.jaar, month.maand, 0).getDate();
  return (weeklyHours * daysInMonth) / 7;
}

function isWorkingService(service) {
  return service.dienstType !== "vrij" && getServiceDurationHours(service) > 0;
}

function getServiceTravelLabel(service) {
  const before = getServiceTravelMinutes(service, "before");
  const after = getServiceTravelMinutes(service, "after");
  if (!before && !after) return "";
  return `reis ${before}/${after} min`;
}

function serviceDateTime(service, point) {
  const time = point === "end" ? service.einde : service.start;
  const minutes = timeToMinutes(time);
  if (!service.datum || minutes === null) return null;
  const date = new Date(`${service.datum}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setMinutes(minutes);
  if (point === "end" && timeToMinutes(service.einde) <= timeToMinutes(service.start)) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

function serviceBusyDateTime(service, point) {
  const date = serviceDateTime(service, point === "end" ? "end" : "start");
  if (!date) return null;
  if (point === "start") {
    date.setMinutes(date.getMinutes() - getServiceTravelMinutes(service, "before"));
  } else {
    date.setMinutes(date.getMinutes() + getServiceTravelMinutes(service, "after"));
  }
  return date;
}

function getServiceTravelMinutes(service, direction) {
  const field = direction === "after" ? "reistijdNaMinuten" : "reistijdVoorMinuten";
  const direct = toPositiveNumber(service[field], 0);
  if (direct) return direct;
  const dutyName = findDutyNameForServiceInput(service);
  if (!dutyName) return 0;
  const fallbackField = direction === "after" ? "reistijdNaMinuten" : "reistijdVoorMinuten";
  return toPositiveNumber(dutyName[fallbackField], 0);
}

function getServiceDurationHours(service) {
  const start = serviceDateTime(service, "start");
  const end = serviceDateTime(service, "end");
  if (!start || !end) return 0;
  return (end - start) / 36e5;
}

function isValidTimeRange(start, end) {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return false;
  return startMinutes < endMinutes;
}

function isValidServiceTimeRange(service) {
  const startMinutes = timeToMinutes(service.start);
  const endMinutes = timeToMinutes(service.einde);
  if (startMinutes === null || endMinutes === null) return false;
  return startMinutes < endMinutes || service.dienstType === "nacht";
}

function timesOverlap(aStart, aEnd, bStart, bEnd) {
  const aStartMinutes = timeToMinutes(aStart);
  const aEndMinutes = timeToMinutes(aEnd);
  const bStartMinutes = timeToMinutes(bStart);
  const bEndMinutes = timeToMinutes(bEnd);

  if ([aStartMinutes, aEndMinutes, bStartMinutes, bEndMinutes].some((value) => value === null)) {
    return false;
  }

  return aStartMinutes < bEndMinutes && bStartMinutes < aEndMinutes;
}

function timeToMinutes(value) {
  if (!value || !value.includes(":")) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return (hours * 60) + minutes;
}

function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const groupKey = typeof key === "function" ? key(item) : item[key] || "";
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(item);
    return groups;
  }, {});
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(String(value));
  }
  return String(value).replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

document.addEventListener("DOMContentLoaded", () => {
  populateForms();
  bindEvents();
  loadData();
  renderApp();
});
