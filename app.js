"use strict";

let state = {
  data: createEmptyData(),
  currentView: "months",
  editing: null,
  quickEntry: null,
  selectedDate: null,
  pendingFocusDate: null,
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
  normalized.instellingen.contractUren = normalizeContractHours(incoming.instellingen?.contractUren);
  normalized.instellingen.gezinsSjablonen = normalizeFamilyTemplates(incoming.instellingen?.gezinsSjablonen);
  normalized.instellingen.wensSjablonen = normalizeWishTemplates(incoming.instellingen?.wensSjablonen);
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
      beschikbareDagen: normalizeDutyWeekdays(dutyName.beschikbareDagen)
    }))
    .filter((dutyName) => dutyName.naam);
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
      beschrijving: String(template.beschrijving || template.opmerking || "").trim(),
      actief: template.actief !== false && template.actief !== "false"
    }))
    .filter((template) => template.naam);
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

  const services = getMonthItems(month.id, "diensten");
  const familyBlocks = getMonthItems(month.id, "gezinsVerplichtingen");
  const analyses = getVisibleAnalyses(month.id);
  const actions = getOpenActions(month.id);
  const closedActions = getClosedActions(month.id);
  const days = buildMonthDays(month);
  const selectedDay = getSelectedDayForMonth(month, days);
  const controlSummary = buildControlSummary(month, days);
  const dayFilters = buildDayFilters(days);
  const filteredDays = filterMonthDays(days, state.cockpitFilter);
  const nextStage = getNextPlanningStage(month.planningStage);

  content.innerHTML = `
    <div class="cockpit-header">
      <div class="cockpit-title">
        <p class="eyebrow">Maandcockpit</p>
        <h2 id="cockpit-title">${escapeHtml(getMonthLabel(month.id))}</h2>
        <div class="cockpit-badges">
          <span class="stage-pill">${escapeHtml(getStageLabel(month.planningStage))}</span>
          <span class="status-pill status-${month.samenvattingStatus}">
            ${escapeHtml(STATUS_LABELS[month.samenvattingStatus] || month.samenvattingStatus)}
          </span>
        </div>
      </div>
      <div class="toolbar">
        <button type="button" class="subtle-button" data-view-target="months">Terug</button>
        <button type="button" data-view-target="quick-entry">Snelle invoer</button>
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

    <div class="stack">
      ${renderControlCenter(controlSummary)}
      ${renderMonthlyHoursPanel(month)}
      ${renderMonthBoard(month, days)}

      <section class="panel">
        <p class="eyebrow">Actiestrook</p>
        ${actions.length ? actions.map(renderActionCard).join("") : "<p>Geen open acties voor deze maand.</p>"}
        ${closedActions.length ? `
          <div class="action-history">
            <h3 class="subsection-title">Afgehandeld deze maand</h3>
            ${closedActions.map(renderActionCard).join("")}
          </div>
        ` : ""}
      </section>

      <section class="panel">
        <p class="eyebrow">Maandinhoud</p>
        <div class="storage-list">
          <div class="storage-row"><span>Diensten</span><strong>${services.length}</strong></div>
        <div class="storage-row"><span>Overige gezinsafspraken</span><strong>${familyBlocks.length}</strong></div>
          <div class="storage-row"><span>Wensen</span><strong>${getMonthItems(month.id, "wensen").length}</strong></div>
          <div class="storage-row"><span>Analysepunten</span><strong>${analyses.length}</strong></div>
        </div>
      </section>

      ${renderDayDetail(selectedDay)}

      ${renderCockpitFilters(dayFilters)}

      <section class="stack">
        ${filteredDays.length ? filteredDays.map(renderDayRow).join("") : "<div class=\"empty-state\">Geen dagen voor dit filter.</div>"}
      </section>
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
  const category = WISH_TEMPLATE_CATEGORIES[template.categorie] || formatCodeLabel(template.categorie);
  const scope = WISH_TEMPLATE_SCOPE[template.scope] || formatCodeLabel(template.scope);
  const timing = WISH_TEMPLATE_TIMING[template.timing] || formatCodeLabel(template.timing);
  return `
    <article class="control-finding preference-finding">
      <strong>${escapeHtml(template.naam)}</strong>
      <span>${escapeHtml(category)} - ${escapeHtml(scope)} - ${escapeHtml(timing)}</span>
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
  const itemCount = day.services.length + day.familyBlocks.length + day.wishes.length + day.schoolEvents.length;
  const signalCount = day.analyses.length + day.actions.length;
  return `
    <button type="button" class="month-board-day month-board-day-${status.type} ${isSelected ? "month-board-day-selected" : ""}" data-open-day="${escapeHtml(day.date)}" aria-label="${escapeHtml(formatLongDate(day.date))}: ${escapeHtml(status.label)}">
      <span class="month-board-day-top">
        <strong>${Number(day.date.slice(-2))}</strong>
        <span class="month-board-status" aria-hidden="true">${escapeHtml(status.icon)}</span>
      </span>
      <span class="month-board-summary">${itemCount} items - ${signalCount} signalen</span>
      <span class="month-board-items">
        ${day.services.map(renderMonthBoardService).join("")}
        ${day.familyBlocks.map(renderMonthBoardFamilyBlock).join("")}
        ${day.schoolEvents.map(renderMonthBoardSchoolEvent).join("")}
        ${day.wishes.map(renderMonthBoardWish).join("")}
        ${day.actions.map(renderMonthBoardAction).join("")}
        ${day.analyses.map(renderMonthBoardAnalysis).join("")}
        ${!itemCount && !signalCount ? "<span class=\"month-board-item month-board-item-empty\">Geen invoer</span>" : ""}
      </span>
    </button>
  `;
}

function getDayBoardStatus(day) {
  const activeAnalyses = day.analyses.filter((result) => !["gezien", "bewust_akkoord", "vervallen"].includes(result.actieStatus));
  if (activeAnalyses.some((result) => result.ernst === "conflict")) {
    return { type: "conflict", icon: "X", label: "conflict" };
  }
  if (activeAnalyses.length || day.actions.length) {
    return { type: "attention", icon: "!", label: "controle nodig" };
  }
  return { type: "good", icon: "✓", label: "geen conflict" };
}

function renderMonthBoardService(service) {
  return `
    <span class="month-board-item month-board-item-service">
      ${escapeHtml(getPersonLabel(service.persoonId))}: ${escapeHtml(service.dienstCode || formatCodeLabel(service.dienstType || "dienst"))} ${escapeHtml(formatTimeRange(service.start, service.einde))}
    </span>
  `;
}

function renderMonthBoardFamilyBlock(block) {
  return `
    <span class="month-board-item month-board-item-family">
      Gezin overig: ${escapeHtml(formatCodeLabel(block.type || "afspraak"))} ${escapeHtml(formatTimeRange(block.start, block.einde))}
    </span>
  `;
}

function renderMonthBoardSchoolEvent(event) {
  const coverage = formatSchoolCoverageLabel(event);
  return `
    <span class="month-board-item month-board-item-family">
      School: ${escapeHtml(event.label || formatCodeLabel(event.type))} ${escapeHtml(formatTimeRange(event.start, event.einde))}${coverage ? ` - ${escapeHtml(coverage)}` : ""}
    </span>
  `;
}

function renderMonthBoardWish(wish) {
  return `
    <span class="month-board-item month-board-item-wish">
      Wens: ${escapeHtml(formatCodeLabel(wish.type || "wens"))}
    </span>
  `;
}

function renderMonthBoardAction(action) {
  return `
    <span class="month-board-item month-board-item-action">
      Actie: ${escapeHtml(action.titel || "open actie")}
    </span>
  `;
}

function renderMonthBoardAnalysis(result) {
  return `
    <span class="month-board-item month-board-item-analysis signal-${escapeHtml(result.ernst)}">
      ${escapeHtml(formatCodeLabel(result.ernst))}: ${escapeHtml(result.melding || "controlepunt")}
    </span>
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
      ${isNotification ? renderNotificationButtons(result) : ""}
    </article>
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
                <span>${escapeHtml(getPersonLabel(service.persoonId))} ${escapeHtml(service.dienstCode || service.dienstType || "dienst")} ${escapeHtml(formatTimeRange(service.start, service.einde))}</span>
                ${renderItemButtons("service", service.id)}
              </span>
            `).join("")}
            ${day.familyBlocks.map((block) => `
              <span class="mini-item editable-item">
                <span>Gezin overig: ${escapeHtml(formatCodeLabel(block.type || "afspraak"))} ${escapeHtml(formatTimeRange(block.start, block.einde))}</span>
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
                <span>Wens: ${escapeHtml(formatCodeLabel(wish.type || "wens"))}</span>
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
  const hasActions = day.actions.length > 0;

  return `
    <section class="panel day-detail" data-day-detail="${escapeHtml(day.date)}" tabindex="-1" aria-live="polite">
      <div class="day-detail-header">
        <div>
          <p class="eyebrow">Dagdetails</p>
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
          ${hasAnalyses ? day.analyses.map(renderAnalysisDetail).join("") : "<p class=\"muted-text\">Geen analysepunten.</p>"}
          ${hasActions ? day.actions.map(renderCompactActionDetail).join("") : "<p class=\"muted-text\">Geen open acties.</p>"}
        </div>
      </div>
    </section>
  `;
}

function renderServiceDetail(service) {
  return `
    <article class="detail-item">
      <strong>${escapeHtml(getPersonLabel(service.persoonId))}: ${escapeHtml(service.dienstCode || formatCodeLabel(service.dienstType || "dienst"))}</strong>
      <span>${escapeHtml(formatTimeRange(service.start, service.einde))} ${service.locatie ? `- ${escapeHtml(service.locatie)}` : ""}</span>
      <span>${escapeHtml(formatCodeLabel(service.status || "status onbekend"))}</span>
      ${service.opmerking ? `<span>${escapeHtml(service.opmerking)}</span>` : ""}
      ${renderItemButtons("service", service.id)}
    </article>
  `;
}

function renderFamilyDetail(block) {
  return `
    <article class="detail-item">
      <strong>Gezin overig: ${escapeHtml(formatCodeLabel(block.type || "afspraak"))}</strong>
      <span>${escapeHtml(formatTimeRange(block.start, block.einde))}</span>
      <span>${block.dekkingNodig ? "Dekking nodig" : "Geen dekking nodig"} - ${escapeHtml(formatCodeLabel(block.hardheid || "onbekend"))}</span>
      ${block.opmerking ? `<span>${escapeHtml(block.opmerking)}</span>` : ""}
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
      <strong>${escapeHtml(getPersonLabel(wish.persoonId))}: ${escapeHtml(formatCodeLabel(wish.type || "Wens"))}</strong>
      <span>Prioriteit: ${escapeHtml(formatCodeLabel(wish.prioriteit || "normaal"))}</span>
      ${wish.reden ? `<span>${escapeHtml(wish.reden)}</span>` : ""}
      ${renderItemButtons("wish", wish.id)}
    </article>
  `;
}

function renderAnalysisDetail(result) {
  return `
    <article class="detail-item detail-item-${escapeHtml(result.ernst || "aandacht")}">
      <strong>${escapeHtml(formatCodeLabel(result.ernst || "Aandacht"))}: ${escapeHtml(result.melding || "Analysepunt")}</strong>
      ${result.advies ? `<span>${escapeHtml(result.advies)}</span>` : ""}
    </article>
  `;
}

function renderCompactActionDetail(action) {
  return `
    <article class="detail-item">
      <strong>${escapeHtml(action.titel || "Actie")}</strong>
      <span>${escapeHtml(formatCodeLabel(action.prioriteit || "normaal"))} - ${escapeHtml(formatCodeLabel(action.status || "open"))}</span>
      ${action.advies ? `<span>${escapeHtml(action.advies)}</span>` : ""}
      <div class="action-buttons">${renderActionButtons(action)}</div>
    </article>
  `;
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
  return `
    <article class="action-card action-status-${escapeHtml(action.status || "open")}">
      <h3>${escapeHtml(action.titel || "Actie")}</h3>
      <p>${escapeHtml(action.type || "actie")} - ${escapeHtml(action.prioriteit || "normaal")} - ${escapeHtml(action.status || "open")}</p>
      ${action.deadline ? `<p>Deadline: ${escapeHtml(formatLongDate(action.deadline))}</p>` : ""}
      ${action.advies ? `<p>${escapeHtml(action.advies)}</p>` : ""}
      <p>${escapeHtml(getMonthLabel(action.maandPlanningId))}</p>
      ${statusMeta}
      <div class="action-buttons">
        ${renderActionButtons(action)}
      </div>
    </article>
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

function renderSettingsPanel() {
  const panel = document.getElementById("settings-panel");
  if (!panel) return;
  const dutyNames = getDutyNames();
  const familyTemplates = getFamilyTemplates();
  const wishTemplates = getWishTemplates();
  const contractHours = getContractHours();
  const children = getChildren();
  const schoolTimes = getSchoolTimes();
  const schoolPeriods = getSchoolPeriods();
  const editingDutyName = getEditingDutyName();
  const editingFamilyTemplate = getEditingFamilyTemplate();
  const editingWishTemplate = getEditingWishTemplate();
  const dutyRows = dutyNames.length
    ? dutyNames.map((dutyName) => `
        <div class="duty-name-row">
          <div>
            <strong>${escapeHtml(dutyName.naam)}</strong>
            <span>${escapeHtml(getDutyNameMeta(dutyName))}</span>
          </div>
          <div class="item-actions">
            <button type="button" class="tiny-button" data-edit-duty-name="${escapeHtml(dutyName.id)}">Wijzig</button>
            <button type="button" class="tiny-button" data-delete-duty-name="${escapeHtml(dutyName.id)}">Verwijder</button>
          </div>
        </div>
      `).join("")
    : "<div class=\"empty-state\">Geen dienstnamen ingesteld.</div>";
  const familyTemplateRows = familyTemplates.length
    ? familyTemplates.map((template) => `
        <div class="duty-name-row">
          <div>
            <strong>${escapeHtml(template.naam)}</strong>
            <span>${escapeHtml(getFamilyTemplateMeta(template))}</span>
          </div>
          <div class="item-actions">
            <button type="button" class="tiny-button" data-edit-family-template="${escapeHtml(template.id)}">Wijzig</button>
            <button type="button" class="tiny-button" data-delete-family-template="${escapeHtml(template.id)}">Verwijder</button>
          </div>
        </div>
      `).join("")
    : "<div class=\"empty-state\">Geen vaste gezinsmomenten ingesteld.</div>";
  const wishTemplateRows = wishTemplates.length
    ? wishTemplates.map((template) => `
        <div class="duty-name-row">
          <div>
            <strong>${escapeHtml(template.naam)}</strong>
            <span>${escapeHtml(getWishTemplateMeta(template))}</span>
            ${template.beschrijving ? `<span>${escapeHtml(template.beschrijving)}</span>` : ""}
          </div>
          <div class="item-actions">
            <button type="button" class="tiny-button" data-edit-wish-template="${escapeHtml(template.id)}">Wijzig</button>
            <button type="button" class="tiny-button" data-delete-wish-template="${escapeHtml(template.id)}">Verwijder</button>
          </div>
        </div>
      `).join("")
    : "<div class=\"empty-state\">Geen wenssjablonen ingesteld.</div>";
  const childRows = children.length
    ? children.map((child) => `
        <div class="duty-name-row">
          <div>
            <strong>${escapeHtml(child.naam)}</strong>
            <span>${escapeHtml(child.schoolNaam || "Geen schoolnaam")}</span>
          </div>
          <div class="item-actions">
            <button type="button" class="tiny-button" data-delete-child="${escapeHtml(child.id)}">Verwijder</button>
          </div>
        </div>
      `).join("")
    : "<div class=\"empty-state\">Geen kinderen ingesteld.</div>";
  const schoolTimeRows = schoolTimes.length
    ? schoolTimes.map((schoolTime) => `
        <div class="duty-name-row">
          <div>
            <strong>${escapeHtml(getSchoolTimeLabel(schoolTime))}</strong>
            <span>${escapeHtml(formatTimeRange(schoolTime.start, schoolTime.einde))} - ${schoolTime.brengenNodig ? "brengen" : "niet brengen"} / ${schoolTime.halenNodig ? "halen" : "niet halen"}${schoolTime.opmerking ? ` - ${escapeHtml(schoolTime.opmerking)}` : ""}</span>
          </div>
          <div class="item-actions">
            <button type="button" class="tiny-button" data-delete-school-time="${escapeHtml(schoolTime.id)}">Verwijder</button>
          </div>
        </div>
      `).join("")
    : "<div class=\"empty-state\">Geen schooltijden ingesteld.</div>";
  const schoolPeriodRows = schoolPeriods.length
    ? schoolPeriods.map((period) => `
        <div class="duty-name-row">
          <div>
            <strong>${escapeHtml(period.naam)}</strong>
            <span>${escapeHtml(formatCodeLabel(period.type))}: ${escapeHtml(formatDateRange(period.startDatum, period.eindDatum))}${period.bronId ? ` - ${escapeHtml(formatCodeLabel(period.bronId))}` : ""}</span>
          </div>
          <div class="item-actions">
            <button type="button" class="tiny-button" data-delete-school-period="${escapeHtml(period.id)}">Verwijder</button>
          </div>
        </div>
      `).join("")
    : "<div class=\"empty-state\">Geen vakanties of studiedagen ingesteld.</div>";

  panel.innerHTML = `
    <section class="panel">
      <p class="eyebrow">Contracturen</p>
      <form id="contract-hours-form" class="settings-form">
        ${Object.entries(contractHours).map(([personId, contract]) => `
          <div class="settings-tile settings-edit-tile">
            <strong>${escapeHtml(getPersonLabel(personId))}</strong>
            <label>
              Uur per week
              <input name="${escapeHtml(personId)}_weeklyHours" type="number" min="0" step="0.5" value="${escapeHtml(contract.weeklyHours)}" required>
            </label>
            <label>
              Maandmarge
              <input name="${escapeHtml(personId)}_monthlyToleranceHours" type="number" min="0" step="0.5" value="${escapeHtml(contract.monthlyToleranceHours)}" required>
            </label>
          </div>
        `).join("")}
        <div class="form-actions full-width">
          <button type="submit">Contracturen opslaan</button>
        </div>
      </form>
    </section>

    <section class="panel">
      <p class="eyebrow">Dienstkeuzes</p>
      <div class="storage-list">
        <div class="storage-row"><span>Totaal dienstnamen</span><strong>${dutyNames.length}</strong></div>
        <div class="storage-row"><span>Ronald</span><strong>${dutyNames.filter((item) => item.persoonId === "persoon_jij").length}</strong></div>
        <div class="storage-row"><span>Eva</span><strong>${dutyNames.filter((item) => item.persoonId === "persoon_vrouw").length}</strong></div>
        <div class="storage-row"><span>Vanaf R2 extra</span><strong>${dutyNames.filter((item) => item.beschikbaarVanaf === "R2_afstemming").length}</strong></div>
      </div>
      ${renderSettingsDutyNameForm(editingDutyName)}
      <div class="duty-name-list settings-duty-list">
        ${dutyRows}
      </div>
    </section>

    <section class="panel">
      <p class="eyebrow">Overige vaste gezinsmomenten</p>
      <div class="storage-list">
        <div class="storage-row"><span>Totaal sjablonen</span><strong>${familyTemplates.length}</strong></div>
        <div class="storage-row"><span>Dekking nodig</span><strong>${familyTemplates.filter((item) => item.dekkingNodig).length}</strong></div>
      </div>
      <div class="toolbar family-template-actions">
        <button type="button" data-auto-place-family-templates>Overige gezinsmomenten in actieve maand zetten</button>
      </div>
      ${renderSettingsFamilyTemplateForm(editingFamilyTemplate)}
      <div class="duty-name-list settings-duty-list">
        ${familyTemplateRows}
      </div>
    </section>

    <section class="panel">
      <p class="eyebrow">Wenssjablonen</p>
      <div class="storage-list">
        <div class="storage-row"><span>Totaal sjablonen</span><strong>${wishTemplates.length}</strong></div>
        <div class="storage-row"><span>Hard/sterk</span><strong>${wishTemplates.filter((item) => ["hard", "sterk"].includes(item.hardheid)).length}</strong></div>
        <div class="storage-row"><span>Actief</span><strong>${wishTemplates.filter((item) => item.actief).length}</strong></div>
      </div>
      ${renderSettingsWishTemplateForm(editingWishTemplate)}
      <div class="duty-name-list settings-duty-list">
        ${wishTemplateRows}
      </div>
    </section>

    <section class="panel">
      <p class="eyebrow">Schoolbeheer</p>
      <div class="storage-list">
        <div class="storage-row"><span>Kinderen</span><strong>${children.length}</strong></div>
        <div class="storage-row"><span>Schooltijden</span><strong>${schoolTimes.length}</strong></div>
        <div class="storage-row"><span>Vakanties/studiedagen</span><strong>${schoolPeriods.length}</strong></div>
      </div>

      <h3 class="subsection-title">Kinderen</h3>
      <form id="child-form" class="duty-name-form settings-duty-form">
        <label>
          Naam kind
          <input name="naam" type="text" placeholder="Bijv. kind 1" required>
        </label>
        <label>
          School
          <input name="schoolNaam" type="text" placeholder="Bijv. basisschool">
        </label>
        <div class="form-actions">
          <button type="submit">Kind toevoegen</button>
        </div>
      </form>
      <div class="duty-name-list settings-duty-list">
        ${childRows}
      </div>

      <h3 class="subsection-title">Schooltijden</h3>
      <form id="school-time-form" class="duty-name-form settings-duty-form">
        <label>
          Kind
          <select name="kindId">
            <option value="alle_kinderen">Alle kinderen</option>
            ${children.map((child) => `<option value="${escapeHtml(child.id)}">${escapeHtml(child.naam)}</option>`).join("")}
          </select>
        </label>
        <label>
          Dag
          <select name="dag" required>
            ${renderOptions(WEEKDAY_OPTIONS.map((day) => day.value), getWeekdayLabels(), "1")}
          </select>
        </label>
        <label>
          Start school
          <input name="start" type="time" required>
        </label>
        <label>
          Einde school
          <input name="einde" type="time" required>
        </label>
        <label class="checkbox-label">
          <input name="brengenNodig" type="checkbox" value="true" checked>
          Brengen nodig
        </label>
        <label class="checkbox-label">
          <input name="halenNodig" type="checkbox" value="true" checked>
          Halen nodig
        </label>
        <label class="full-width">
          Opmerking
          <input name="opmerking" type="text" placeholder="Bijv. continurooster, korte dag">
        </label>
        <div class="form-actions">
          <button type="submit">Schooltijd toevoegen</button>
        </div>
      </form>
      <div class="duty-name-list settings-duty-list">
        ${schoolTimeRows}
      </div>

      <h3 class="subsection-title">Vakanties en studiedagen</h3>
      <form id="school-ical-url-form" class="duty-name-form settings-duty-form">
        <label class="full-width">
          iCal-link school
          <input name="schoolIcalUrl" type="text" value="${escapeHtml(state.data.instellingen.schoolIcalUrl || "")}" placeholder="webcal://... of https://.../schoolagenda.ics">
        </label>
        <div class="form-actions full-width">
          <button type="submit">iCal-link opslaan</button>
          <button type="button" class="subtle-button" data-import-school-ical-url>iCal-link inlezen</button>
        </div>
        <p class="muted-text full-width">Als de schoolserver browsertoegang blokkeert, gebruik dan de bestand-import hieronder.</p>
      </form>
      <form id="school-period-form" class="duty-name-form settings-duty-form">
        <label>
          Type
          <select name="type" required>
            <option value="schoolvakantie">Schoolvakantie</option>
            <option value="studiedag">Studiedag</option>
          </select>
        </label>
        <label>
          Naam
          <input name="naam" type="text" placeholder="Bijv. herfstvakantie" required>
        </label>
        <label>
          Startdatum
          <input name="startDatum" type="date" required>
        </label>
        <label>
          Einddatum
          <input name="eindDatum" type="date" required>
        </label>
        <label class="full-width">
          Opmerking
          <input name="opmerking" type="text" placeholder="Optioneel">
        </label>
        <div class="form-actions full-width">
          <button type="submit">Periode toevoegen</button>
          <label class="file-button subtle-file-button">
            iCal school importeren
            <input type="file" accept=".ics,.ical,text/calendar" data-school-ical-file>
          </label>
        </div>
      </form>
      <div class="duty-name-list settings-duty-list">
        ${schoolPeriodRows}
      </div>
    </section>

    <section class="panel">
      <p class="eyebrow">Code-indeling</p>
      <div class="settings-grid">
        <div class="settings-tile"><strong>config.js</strong><span>Versie, personen, rondes, normen, standaardlijsten</span></div>
        <div class="settings-tile"><strong>app.js</strong><span>Rendering, formulieren en events</span></div>
        <div class="settings-tile"><strong>storage.js</strong><span>Autosave, backup, herstel en snapshots</span></div>
        <div class="settings-tile"><strong>entries.js</strong><span>Maanddagen, diensten, gezinsitems, wensen en snelle invoer</span></div>
        <div class="settings-tile"><strong>analysis.js</strong><span>Controle, notificaties en actie-sync</span></div>
        <div class="settings-tile"><strong>school.js</strong><span>Schooltijden, kinderen en schoolagenda</span></div>
        <div class="settings-tile"><strong>style.css</strong><span>Vormgeving en responsive gedrag</span></div>
      </div>
    </section>
  `;
}

function renderSettingsDutyNameForm(editingDutyName = null) {
  const dutyName = editingDutyName || {};
  const submitLabel = editingDutyName ? "Dienstkeuze opslaan" : "Dienstkeuze toevoegen";
  return `
    <form id="settings-duty-name-form" class="duty-name-form settings-duty-form">
      <label>
        Dienstnaam/code
        <input name="naam" type="text" value="${escapeHtml(dutyName.naam || "")}" placeholder="Bijv. A, LD, Nacht 8" required>
      </label>
      <label>
        Persoon
        <select name="persoonId" required>
          ${renderOptions(Object.keys(DUTY_PERSON_OPTIONS), DUTY_PERSON_OPTIONS, dutyName.persoonId || "persoon_jij")}
        </select>
      </label>
      <label>
        Vanaf ronde
        <select name="beschikbaarVanaf" required>
          ${renderOptions(PLANNING_STAGES.map((stage) => stage.value), getPlanningStageLabels(), dutyName.beschikbaarVanaf || "R1_wensen")}
        </select>
      </label>
      <label>
        Post
        <input name="post" type="text" value="${escapeHtml(dutyName.post || "")}" placeholder="Bijv. post noord">
      </label>
      <label>
        Type
        <select name="dienstType" required>
          ${renderOptions(SERVICE_TYPES, null, dutyName.dienstType || "overig")}
        </select>
      </label>
      <label>
        Start
        <input name="start" type="time" value="${escapeHtml(dutyName.start || "")}" required>
      </label>
      <label>
        Einde
        <input name="einde" type="time" value="${escapeHtml(dutyName.einde || "")}" required>
      </label>
      <label>
        Locatie/detail
        <input name="locatie" type="text" value="${escapeHtml(dutyName.locatie || "")}" placeholder="Optioneel">
      </label>
      <fieldset class="weekday-fieldset">
        <legend>Dagen beschikbaar</legend>
        <div class="weekday-options">
          ${renderWeekdayCheckboxes(dutyName.beschikbareDagen)}
        </div>
      </fieldset>
      <div class="form-actions">
        <button type="submit">${submitLabel}</button>
        ${editingDutyName ? "<button type=\"button\" class=\"subtle-button\" data-cancel-duty-edit>Annuleer</button>" : ""}
      </div>
    </form>
  `;
}

function renderSettingsFamilyTemplateForm(editingTemplate = null) {
  const template = editingTemplate || {};
  const submitLabel = editingTemplate ? "Gezinsmoment opslaan" : "Overig gezinsmoment toevoegen";
  return `
    <form id="family-template-form" class="duty-name-form settings-duty-form">
      <label>
        Naam
        <input name="naam" type="text" value="${escapeHtml(template.naam || "")}" placeholder="Bijv. sport, opvang, afspraak">
      </label>
      <label>
        Type
        <select name="type" required>
          ${renderOptions(FAMILY_BLOCK_TYPES, null, template.type || "overig")}
        </select>
      </label>
      <label>
        Start
        <input name="start" type="time" value="${escapeHtml(template.start || "")}" required>
      </label>
      <label>
        Einde
        <input name="einde" type="time" value="${escapeHtml(template.einde || "")}" required>
      </label>
      <label>
        Hardheid
        <select name="hardheid" required>
          <option value="hard"${selectedAttr(template.hardheid || "hard", "hard")}>Hard</option>
          <option value="zacht"${selectedAttr(template.hardheid || "hard", "zacht")}>Zacht</option>
        </select>
      </label>
      <label>
        Dekking nodig
        <select name="dekkingNodig" required>
          <option value="true"${selectedAttr(String(template.dekkingNodig ?? true), "true")}>Ja</option>
          <option value="false"${selectedAttr(String(template.dekkingNodig ?? true), "false")}>Nee</option>
        </select>
      </label>
      <label class="full-width">
        Opmerking
        <textarea name="opmerking" placeholder="Bijv. wie haalt, vaste afspraak">${escapeHtml(template.opmerking || "")}</textarea>
      </label>
      <fieldset class="weekday-fieldset">
        <legend>Dagen beschikbaar</legend>
        <div class="weekday-options">
          ${renderWeekdayCheckboxes(template.beschikbareDagen)}
        </div>
      </fieldset>
      <div class="form-actions">
        <button type="submit">${submitLabel}</button>
        ${editingTemplate ? "<button type=\"button\" class=\"subtle-button\" data-cancel-family-template-edit>Annuleer</button>" : ""}
      </div>
    </form>
  `;
}

function renderWeekdayCheckboxes(selectedDays = null) {
  const selected = new Set(normalizeDutyWeekdays(selectedDays));
  return WEEKDAY_OPTIONS.map((day) => `
    <label class="checkbox-label">
      <input name="beschikbareDagen" type="checkbox" value="${escapeHtml(day.value)}"${selected.has(day.value) ? " checked" : ""}>
      ${escapeHtml(day.label)}
    </label>
  `).join("");
}

function getFamilyTemplateMeta(template) {
  return [
    formatCodeLabel(template.type),
    getDutyWeekdayLabel(template.beschikbareDagen),
    formatTimeRange(template.start, template.einde),
    template.hardheid === "zacht" ? "zacht" : "hard",
    template.dekkingNodig ? "dekking nodig" : "geen dekking"
  ].join(" - ");
}

function renderSettingsWishTemplateForm(editingTemplate = null) {
  const template = editingTemplate || {};
  const submitLabel = editingTemplate ? "Wenssjabloon opslaan" : "Wenssjabloon toevoegen";
  return `
    <form id="wish-template-form" class="duty-name-form settings-duty-form">
      <label>
        Naam
        <input name="naam" type="text" value="${escapeHtml(template.naam || "")}" placeholder="Bijv. samen vrij weekend" required>
      </label>
      <label>
        Categorie
        <select name="categorie" required>
          ${renderOptions(Object.keys(WISH_TEMPLATE_CATEGORIES), WISH_TEMPLATE_CATEGORIES, template.categorie || "samen_vrij")}
        </select>
      </label>
      <label>
        Geldt voor
        <select name="scope" required>
          ${renderOptions(Object.keys(WISH_TEMPLATE_SCOPE), WISH_TEMPLATE_SCOPE, template.scope || "gezin")}
        </select>
      </label>
      <label>
        Hardheid
        <select name="hardheid" required>
          ${renderOptions(Object.keys(WISH_TEMPLATE_STRENGTH), WISH_TEMPLATE_STRENGTH, template.hardheid || "normaal")}
        </select>
      </label>
      <label>
        Wanneer
        <select name="timing" required>
          ${renderOptions(Object.keys(WISH_TEMPLATE_TIMING), WISH_TEMPLATE_TIMING, template.timing || "hele_maand")}
        </select>
      </label>
      <label>
        Actief
        <select name="actief" required>
          <option value="true"${selectedAttr(String(template.actief ?? true), "true")}>Ja</option>
          <option value="false"${selectedAttr(String(template.actief ?? true), "false")}>Nee</option>
        </select>
      </label>
      <label class="full-width">
        Toelichting
        <textarea name="beschrijving" placeholder="Kort en concreet, bijvoorbeeld: minimaal 1 dagdeel samen vrij">${escapeHtml(template.beschrijving || "")}</textarea>
      </label>
      <div class="form-actions">
        <button type="submit">${submitLabel}</button>
        ${editingTemplate ? "<button type=\"button\" class=\"subtle-button\" data-cancel-wish-template-edit>Annuleer</button>" : ""}
      </div>
    </form>
  `;
}

function getWishTemplateMeta(template) {
  return [
    WISH_TEMPLATE_CATEGORIES[template.categorie] || formatCodeLabel(template.categorie),
    WISH_TEMPLATE_SCOPE[template.scope] || formatCodeLabel(template.scope),
    WISH_TEMPLATE_STRENGTH[template.hardheid] || formatCodeLabel(template.hardheid),
    WISH_TEMPLATE_TIMING[template.timing] || formatCodeLabel(template.timing),
    template.actief ? "actief" : "uit"
  ].join(" - ");
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

function renderDutyNameManager(dutyNames, activeStage) {
  const presetButtons = dutyNames.length
    ? dutyNames.map((dutyName) => `
        <button type="button" class="duty-preset-button" data-apply-duty-name="${escapeHtml(dutyName.id)}" data-duty-person="${escapeHtml(dutyName.persoonId)}" data-duty-round="${escapeHtml(dutyName.beschikbaarVanaf)}">
          <strong>${escapeHtml(dutyName.naam)}</strong>
          <span>${escapeHtml(getDutyNameMeta(dutyName))}</span>
        </button>
      `).join("")
    : "<p class=\"muted-text\">Nog geen dienstnamen opgeslagen.</p>";

  return `
    <div class="duty-name-manager">
      <div class="duty-preset-grid">
        ${presetButtons}
      </div>
      <p class="muted-text duty-empty-message" data-duty-empty-message>Geen dienstnamen voor deze persoon en ronde.</p>
      <div class="toolbar">
        <button type="button" class="subtle-button" data-view-target="settings">Beheer dienstkeuzes</button>
      </div>
    </div>
  `;
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

function getDutyNameMeta(dutyName) {
  const person = DUTY_PERSON_OPTIONS[dutyName.persoonId] || getPersonLabel(dutyName.persoonId);
  const stage = getPlanningStageLabels()[dutyName.beschikbaarVanaf] || formatCodeLabel(dutyName.beschikbaarVanaf);
  const parts = [
    person,
    `vanaf ${stage}`,
    dutyName.post || dutyName.locatie,
    getDutyWeekdayLabel(dutyName.beschikbareDagen),
    formatCodeLabel(dutyName.dienstType),
    formatTimeRange(dutyName.start, dutyName.einde)
  ].filter(Boolean);
  return parts.join(" - ");
}

function getDutyWeekdayLabel(days) {
  const normalized = normalizeDutyWeekdays(days);
  if (normalized.length === WEEKDAY_OPTIONS.length) return "alle dagen";
  const labels = WEEKDAY_OPTIONS
    .filter((day) => normalized.includes(day.value))
    .map((day) => day.label);
  return labels.join("/");
}

function updateDutyNameVisibility() {
  const form = document.getElementById("service-form");
  const activeMonth = getMonth(state.data.instellingen.actieveMaandId);
  const activeStage = activeMonth?.planningStage || state.data.instellingen.standaardPlanningStage;
  const selectedPersonId = form?.elements.persoonId?.value || "persoon_jij";
  const selectedDate = form?.elements.datum?.value || "";
  const buttons = Array.from(document.querySelectorAll("[data-apply-duty-name]"));
  let visibleCount = 0;

  buttons.forEach((button) => {
    const dutyName = getDutyNames().find((item) => item.id === button.dataset.applyDutyName);
    const visible = dutyName && isDutyNameAvailableFor(dutyName, selectedPersonId, activeStage, selectedDate);
    button.hidden = !visible;
    if (visible) visibleCount += 1;
  });

  const emptyMessage = document.querySelector("[data-duty-empty-message]");
  if (emptyMessage) emptyMessage.hidden = visibleCount > 0 || !buttons.length;
}

function updateFamilyTemplateVisibility() {
  const form = document.getElementById("family-block-form");
  const selectedDate = form?.elements.datum?.value || "";
  const buttons = Array.from(document.querySelectorAll("[data-apply-family-template]"));
  let visibleCount = 0;

  buttons.forEach((button) => {
    const template = getFamilyTemplates().find((item) => item.id === button.dataset.applyFamilyTemplate);
    const visible = template && isFamilyTemplateAvailableOnDate(template, selectedDate);
    button.hidden = !visible;
    if (visible) visibleCount += 1;
  });

  const emptyMessage = document.querySelector("[data-family-template-empty-message]");
  if (emptyMessage) emptyMessage.hidden = visibleCount > 0 || !buttons.length;
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
  const activeStage = month.planningStage || state.data.instellingen.standaardPlanningStage;
  const quickDate = state.quickEntry?.date || "";
  const quickLabel = quickDate ? formatLongDate(quickDate) : "";
  const serviceSubmitLabel = state.editing?.type === "service" ? "Dienst bijwerken" : "Dienst opslaan";
  const familySubmitLabel = state.editing?.type === "family" ? "Gezinsafspraak bijwerken" : "Gezinsafspraak opslaan";
  const wishSubmitLabel = state.editing?.type === "wish" ? "Wens bijwerken" : "Wens opslaan";

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
        ${renderDutyNameManager(dutyNames, activeStage)}
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
            <input name="dienstCode" type="text" value="${escapeHtml(editingService.dienstCode || "")}" placeholder="Bijv. C, D, L">
          </label>
          <label>
            Locatie
            <input name="locatie" type="text" value="${escapeHtml(editingService.locatie || "")}" placeholder="Bijv. Zuid">
          </label>
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

function getDutyNames() {
  if (!Array.isArray(state.data.instellingen.dienstNamen)) {
    state.data.instellingen.dienstNamen = getDefaultDutyNames();
  }
  return state.data.instellingen.dienstNamen;
}

function getContractHours() {
  if (!state.data.instellingen.contractUren || typeof state.data.instellingen.contractUren !== "object") {
    state.data.instellingen.contractUren = getDefaultContractHours();
  }
  state.data.instellingen.contractUren = normalizeContractHours(state.data.instellingen.contractUren);
  return state.data.instellingen.contractUren;
}

function getFamilyTemplates() {
  if (!Array.isArray(state.data.instellingen.gezinsSjablonen)) {
    state.data.instellingen.gezinsSjablonen = [];
  }
  state.data.instellingen.gezinsSjablonen = normalizeFamilyTemplates(state.data.instellingen.gezinsSjablonen);
  return state.data.instellingen.gezinsSjablonen;
}

function getWishTemplates() {
  if (!Array.isArray(state.data.instellingen.wensSjablonen)) {
    state.data.instellingen.wensSjablonen = [];
  }
  state.data.instellingen.wensSjablonen = normalizeWishTemplates(state.data.instellingen.wensSjablonen);
  return state.data.instellingen.wensSjablonen;
}

function updateContractHours(input) {
  const nextContracts = {};
  Object.keys(CONTRACT_HOURS).forEach((personId) => {
    nextContracts[personId] = {
      weeklyHours: toPositiveNumber(input[`${personId}_weeklyHours`], CONTRACT_HOURS[personId].weeklyHours),
      monthlyToleranceHours: toPositiveNumber(input[`${personId}_monthlyToleranceHours`], CONTRACT_HOURS[personId].monthlyToleranceHours)
    };
  });

  state.data.instellingen.contractUren = normalizeContractHours(nextContracts);
  state.data.maandPlanningen.forEach((month) => runAnalysis(month.id));
  saveData("contracturen_bijgewerkt");
  renderApp();
}

function addFamilyTemplate(input) {
  const template = {
    id: state.editingFamilyTemplateId || generateId("gezin_sjabloon"),
    naam: String(input.naam || "").trim(),
    type: FAMILY_BLOCK_TYPES.includes(input.type) ? input.type : "overig",
    beschikbareDagen: normalizeDutyWeekdays(getFormArrayValue(input.beschikbareDagen)),
    start: input.start || "",
    einde: input.einde || "",
    hardheid: input.hardheid === "zacht" ? "zacht" : "hard",
    dekkingNodig: input.dekkingNodig !== "false",
    opmerking: String(input.opmerking || "").trim()
  };

  if (!template.naam || !template.start || !template.einde) return;

  const reason = state.editingFamilyTemplateId ? "gezinssjabloon_bijgewerkt" : "gezinssjabloon_toegevoegd";
  state.data.instellingen.gezinsSjablonen = [
    ...getFamilyTemplates().filter((item) => {
      if (state.editingFamilyTemplateId) return item.id !== state.editingFamilyTemplateId;
      return getFamilyTemplateKey(item) !== getFamilyTemplateKey(template);
    }),
    template
  ];
  state.editingFamilyTemplateId = null;
  saveData(reason);
  renderQuickEntry();
  renderSettingsPanel();
}

function deleteFamilyTemplate(id) {
  state.data.instellingen.gezinsSjablonen = getFamilyTemplates().filter((template) => template.id !== id);
  if (state.editingFamilyTemplateId === id) state.editingFamilyTemplateId = null;
  saveData("gezinssjabloon_verwijderd");
  renderQuickEntry();
  renderSettingsPanel();
}

function startEditFamilyTemplate(id) {
  if (!getFamilyTemplates().some((template) => template.id === id)) return;
  state.editingFamilyTemplateId = id;
  renderSettingsPanel();
}

function cancelEditFamilyTemplate() {
  state.editingFamilyTemplateId = null;
  renderSettingsPanel();
}

function getEditingFamilyTemplate() {
  if (!state.editingFamilyTemplateId) return null;
  return getFamilyTemplates().find((template) => template.id === state.editingFamilyTemplateId) || null;
}

function getFamilyTemplateKey(template) {
  return [
    String(template.naam || "").trim().toLowerCase(),
    template.type || "",
    String(template.start || ""),
    String(template.einde || "")
  ].join("|");
}

function addWishTemplate(input) {
  const template = {
    id: state.editingWishTemplateId || generateId("wens_sjabloon"),
    naam: String(input.naam || "").trim(),
    categorie: WISH_TEMPLATE_CATEGORIES[input.categorie] ? input.categorie : "overig",
    scope: WISH_TEMPLATE_SCOPE[input.scope] ? input.scope : "gezin",
    hardheid: WISH_TEMPLATE_STRENGTH[input.hardheid] ? input.hardheid : "normaal",
    timing: WISH_TEMPLATE_TIMING[input.timing] ? input.timing : "hele_maand",
    beschrijving: String(input.beschrijving || "").trim(),
    actief: input.actief !== "false"
  };

  if (!template.naam) return;

  const reason = state.editingWishTemplateId ? "wenssjabloon_bijgewerkt" : "wenssjabloon_toegevoegd";
  state.data.instellingen.wensSjablonen = [
    ...getWishTemplates().filter((item) => {
      if (state.editingWishTemplateId) return item.id !== state.editingWishTemplateId;
      return getWishTemplateKey(item) !== getWishTemplateKey(template);
    }),
    template
  ];
  state.editingWishTemplateId = null;
  saveData(reason);
  renderSettingsPanel();
}

function deleteWishTemplate(id) {
  state.data.instellingen.wensSjablonen = getWishTemplates().filter((template) => template.id !== id);
  if (state.editingWishTemplateId === id) state.editingWishTemplateId = null;
  saveData("wenssjabloon_verwijderd");
  renderSettingsPanel();
}

function startEditWishTemplate(id) {
  if (!getWishTemplates().some((template) => template.id === id)) return;
  state.editingWishTemplateId = id;
  renderSettingsPanel();
}

function cancelEditWishTemplate() {
  state.editingWishTemplateId = null;
  renderSettingsPanel();
}

function getEditingWishTemplate() {
  if (!state.editingWishTemplateId) return null;
  return getWishTemplates().find((template) => template.id === state.editingWishTemplateId) || null;
}

function getWishTemplateKey(template) {
  return [
    String(template.naam || "").trim().toLowerCase(),
    template.categorie || "",
    template.scope || "",
    template.timing || ""
  ].join("|");
}

function addDutyName(input) {
  const dutyName = {
    id: state.editingDutyNameId || generateId("dienstnaam"),
    naam: String(input.naam || "").trim(),
    persoonId: DUTY_PERSON_OPTIONS[input.persoonId] ? input.persoonId : "persoon_jij",
    beschikbaarVanaf: PLANNING_STAGES.some((stage) => stage.value === input.beschikbaarVanaf) ? input.beschikbaarVanaf : "R1_wensen",
    post: String(input.post || "").trim(),
    dienstType: SERVICE_TYPES.includes(input.dienstType) ? input.dienstType : "overig",
    start: input.start || "",
    einde: input.einde || "",
    locatie: String(input.locatie || "").trim(),
    beschikbareDagen: normalizeDutyWeekdays(getFormArrayValue(input.beschikbareDagen))
  };

  if (!dutyName.naam || !dutyName.start || !dutyName.einde) return;

  const reason = state.editingDutyNameId ? "dienstnaam_bijgewerkt" : "dienstnaam_toegevoegd";
  state.data.instellingen.dienstNamen = [
    ...getDutyNames().filter((item) => {
      if (state.editingDutyNameId) return item.id !== state.editingDutyNameId;
      return getDutyNameKey(item) !== getDutyNameKey(dutyName);
    }),
    dutyName
  ];
  state.editingDutyNameId = null;
  saveData(reason);
  renderQuickEntry();
  renderSettingsPanel();
}

function deleteDutyName(id) {
  state.data.instellingen.dienstNamen = getDutyNames().filter((dutyName) => dutyName.id !== id);
  if (state.editingDutyNameId === id) {
    state.editingDutyNameId = null;
  }
  saveData("dienstnaam_verwijderd");
  renderQuickEntry();
  renderSettingsPanel();
}

function startEditDutyName(id) {
  if (!getDutyNames().some((dutyName) => dutyName.id === id)) return;
  state.editingDutyNameId = id;
  renderSettingsPanel();
}

function cancelEditDutyName() {
  state.editingDutyNameId = null;
  renderSettingsPanel();
}

function getEditingDutyName() {
  if (!state.editingDutyNameId) return null;
  return getDutyNames().find((dutyName) => dutyName.id === state.editingDutyNameId) || null;
}

function applyDutyName(id) {
  const dutyName = getDutyNames().find((item) => item.id === id);
  const form = document.getElementById("service-form");
  if (!dutyName || !form) return;
  if (!isDutyNameAvailableOnDate(dutyName, form.elements.datum.value)) {
    window.alert(`${dutyName.naam} is niet beschikbaar op ${formatLongDate(form.elements.datum.value)}.`);
    return;
  }

  if (dutyName.persoonId !== "beiden") {
    form.elements.persoonId.value = dutyName.persoonId;
  }
  form.elements.dienstCode.value = dutyName.naam;
  form.elements.dienstType.value = dutyName.dienstType;
  form.elements.start.value = dutyName.start;
  form.elements.einde.value = dutyName.einde;
  if (dutyName.post || dutyName.locatie) {
    form.elements.locatie.value = dutyName.post || dutyName.locatie;
  }
  updateDutyNameVisibility();
}

function applyFamilyTemplate(id) {
  const template = getFamilyTemplates().find((item) => item.id === id);
  const form = document.getElementById("family-block-form");
  if (!template || !form) return;
  if (!isFamilyTemplateAvailableOnDate(template, form.elements.datum.value)) {
    window.alert(`${template.naam} is niet beschikbaar op ${formatLongDate(form.elements.datum.value)}.`);
    return;
  }

  form.elements.type.value = template.type;
  form.elements.start.value = template.start;
  form.elements.einde.value = template.einde;
  form.elements.hardheid.value = template.hardheid;
  form.elements.dekkingNodig.value = String(template.dekkingNodig);
  form.elements.opmerking.value = template.opmerking || template.naam;
  updateFamilyTemplateVisibility();
}

function getDutyNameKey(dutyName) {
  return [
    String(dutyName.naam || "").trim().toLowerCase(),
    dutyName.persoonId || "",
    dutyName.beschikbaarVanaf || "",
    String(dutyName.post || "").trim().toLowerCase()
  ].join("|");
}

function getFormArrayValue(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function focusPendingDay() {
  if (!state.pendingFocusDate || state.currentView !== "cockpit") return;
  const date = state.pendingFocusDate;
  state.pendingFocusDate = null;
  const schedule = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 0));
  schedule(() => {
    const detail = document.querySelector(`[data-day-detail="${cssEscape(date)}"]`);
    const row = document.querySelector(`[data-day-row="${cssEscape(date)}"]`);
    const target = detail || row;
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

    const applyDutyNameButton = event.target.closest("[data-apply-duty-name]");
    if (applyDutyNameButton) {
      applyDutyName(applyDutyNameButton.dataset.applyDutyName);
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
    }

    const openDayButton = event.target.closest("[data-open-day]");
    if (openDayButton) {
      openDay(openDayButton.dataset.openDay);
    }

    const editButton = event.target.closest("[data-edit-item]");
    if (editButton) {
      startEditItem(editButton.dataset.editItem, editButton.dataset.itemId);
    }

    const deleteButton = event.target.closest("[data-delete-item]");
    if (deleteButton) {
      deleteScheduleItem(deleteButton.dataset.deleteItem, deleteButton.dataset.itemId);
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
    const openDayTarget = event.target.closest("[data-open-day]");
    if (!openDayTarget || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    openDay(openDayTarget.dataset.openDay);
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
