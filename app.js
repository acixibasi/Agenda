"use strict";

let state = {
  data: createEmptyData(),
  currentView: "months",
  editing: null,
  quickEntry: null,
  selectedDate: null,
  pendingFocusDate: null,
  cockpitFilter: "all"
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
      dienstNamen: getDefaultDutyNames()
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
      locatie: String(dutyName.locatie || "").trim()
    }))
    .filter((dutyName) => dutyName.naam);
}

function loadData() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    state.data = createEmptyData();
    saveData("eerste_start");
    return;
  }

  try {
    state.data = normalizeData(JSON.parse(stored));
    state.data.maandPlanningen.forEach((month) => runAnalysis(month.id));
  } catch (error) {
    console.error("Kon lokale data niet lezen", error);
    state.data = createEmptyData();
    setSaveStatus("Lokale datafout", true);
  }
}

function saveData(reason) {
  const now = new Date().toISOString();
  state.data.appVersion = APP_VERSION;
  state.data.dataVersion = DATA_VERSION;
  state.data.lastModified = now;
  state.data.revisionId = `rev_${now.replace(/[:.]/g, "-")}`;

  if (reason) {
    state.data.wijzigingsLog.push({
      id: generateId("log"),
      tijd: now,
      type: reason,
      entiteitType: "App",
      entiteitId: "",
      samenvatting: reason.replaceAll("_", " "),
      bron: "gebruiker"
    });
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
    setSaveStatus("Opgeslagen");
  } catch (error) {
    console.error("Autosave mislukt", error);
    setSaveStatus("Niet opgeslagen", true);
  }
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
  const ok = window.confirm(`Maand ${getMonthLabel(monthId)} verwijderen?\n\nDiensten: ${counts.services}\nGezinsitems: ${counts.familyBlocks}\nWensen: ${counts.wishes}\nActies: ${counts.actions}\n\nEr wordt eerst een lokale snapshot gemaakt.`);
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

function removeMonthData(monthId) {
  MODULE_1_ARRAYS
    .filter((collectionName) => collectionName !== "maandPlanningen")
    .forEach((collectionName) => {
      state.data[collectionName] = state.data[collectionName].filter((item) => item.maandPlanningId !== monthId);
  });
}

function getMonthDataCounts(monthId) {
  return {
    services: getMonthItems(monthId, "diensten").length,
    familyBlocks: getMonthItems(monthId, "gezinsVerplichtingen").length,
    wishes: getMonthItems(monthId, "wensen").length,
    analyses: getMonthItems(monthId, "analyseResultaten").length,
    actions: getMonthItems(monthId, "actieItems").length
  };
}

function getMonth(monthId) {
  return state.data.maandPlanningen.find((month) => month.id === monthId);
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

function getOpenActions(monthId) {
  return state.data.actieItems.filter((action) => {
    const inMonth = !monthId || action.maandPlanningId === monthId;
    const isOpen = !["opgelost", "genegeerd", "vervallen"].includes(action.status);
    return inMonth && isOpen;
  }).sort(sortActions);
}

function getClosedActions(monthId) {
  return state.data.actieItems.filter((action) => {
    const inMonth = !monthId || action.maandPlanningId === monthId;
    return inMonth && isClosedAction(action);
  }).sort(sortActions);
}

function isClosedAction(action) {
  return ["opgelost", "genegeerd"].includes(action.status);
}

function sortActions(a, b) {
  const priorityDiff = (ACTION_PRIORITY_ORDER[a.prioriteit] ?? 9) - (ACTION_PRIORITY_ORDER[b.prioriteit] ?? 9);
  if (priorityDiff !== 0) return priorityDiff;
  return String(a.deadline || "").localeCompare(String(b.deadline || ""));
}

function getVisibleAnalyses(monthId) {
  return state.data.analyseResultaten.filter((result) => {
    const inMonth = !monthId || result.maandPlanningId === monthId;
    return inMonth && !["vervallen", "gezien", "bewust_akkoord"].includes(result.actieStatus);
  });
}

function getClosedNotifications(monthId) {
  return state.data.analyseResultaten.filter((result) => {
    const inMonth = !monthId || result.maandPlanningId === monthId;
    return inMonth && result.ernst === "notificatie" && ["gezien", "bewust_akkoord"].includes(result.actieStatus);
  });
}

function getMonthItems(monthId, collectionName) {
  return state.data[collectionName].filter((item) => item.maandPlanningId === monthId);
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
          <div><dt>Gezinsitems</dt><dd>${familyCount}</dd></div>
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
        <button type="button" class="subtle-button" data-duplicate-month="${month.id}">Dupliceer maand</button>
        <button type="button" class="danger-outline-button" data-delete-month="${month.id}">Verwijder maand</button>
      </div>
    </div>

    <div class="stack">
      ${renderControlCenter(controlSummary)}
      ${renderMonthlyHoursPanel(month)}

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
          <div class="storage-row"><span>Gezinsverplichtingen</span><strong>${familyBlocks.length}</strong></div>
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
  const okDays = days.filter((day) => {
    const hasContent = day.services.length || day.familyBlocks.length || day.wishes.length;
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
    const hasContent = day.services.length || day.familyBlocks.length || day.wishes.length;
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
  const hasItems = day.services.length || day.familyBlocks.length || day.wishes.length;
  const hasSignals = day.analyses.length || day.actions.length;
  const isSelected = state.selectedDate === day.date;
  return `
    <article class="day-row ${hasSignals ? "day-row-signal" : ""} ${isSelected ? "day-row-selected" : ""}" data-day-row="${escapeHtml(day.date)}">
      <div>
        <div class="day-date">${escapeHtml(formatLongDate(day.date))}</div>
        <div class="day-actions">
          <button type="button" class="tiny-button" data-open-day="${escapeHtml(day.date)}">${isSelected ? "Open" : "Bekijk"}</button>
          <button type="button" class="tiny-button" data-quick-add="service" data-date="${escapeHtml(day.date)}">Dienst</button>
          <button type="button" class="tiny-button" data-quick-add="family" data-date="${escapeHtml(day.date)}">Gezin</button>
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
                <span>${escapeHtml(formatCodeLabel(block.type || "Gezin"))} ${escapeHtml(formatTimeRange(block.start, block.einde))}</span>
                ${renderItemButtons("family", block.id)}
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
    return day.services.length || day.familyBlocks.length || day.wishes.length || day.analyses.length || day.actions.length;
  }) || days[0];
}

function renderDayDetail(day) {
  if (!day) return "";
  const hasServices = day.services.length > 0;
  const hasFamilyBlocks = day.familyBlocks.length > 0;
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
          <button type="button" class="subtle-button" data-quick-add="family" data-date="${escapeHtml(day.date)}">Gezin toevoegen</button>
          <button type="button" class="subtle-button" data-quick-add="wish" data-date="${escapeHtml(day.date)}">Wens toevoegen</button>
        </div>
      </div>

      <div class="day-detail-grid">
        <div class="day-detail-block">
          <h4>Diensten</h4>
          ${hasServices ? day.services.map(renderServiceDetail).join("") : "<p class=\"muted-text\">Geen diensten op deze dag.</p>"}
        </div>
        <div class="day-detail-block">
          <h4>Gezin</h4>
          ${hasFamilyBlocks ? day.familyBlocks.map(renderFamilyDetail).join("") : "<p class=\"muted-text\">Geen gezinsafspraken op deze dag.</p>"}
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
      <strong>${escapeHtml(formatCodeLabel(block.type || "Gezin"))}</strong>
      <span>${escapeHtml(formatTimeRange(block.start, block.einde))}</span>
      <span>${block.dekkingNodig ? "Dekking nodig" : "Geen dekking nodig"} - ${escapeHtml(formatCodeLabel(block.hardheid || "onbekend"))}</span>
      ${block.opmerking ? `<span>${escapeHtml(block.opmerking)}</span>` : ""}
      ${renderItemButtons("family", block.id)}
    </article>
  `;
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
  const contractHours = getContractHours();
  const dutyRows = dutyNames.length
    ? dutyNames.map((dutyName) => `
        <div class="duty-name-row">
          <div>
            <strong>${escapeHtml(dutyName.naam)}</strong>
            <span>${escapeHtml(getDutyNameMeta(dutyName))}</span>
          </div>
          <button type="button" class="tiny-button" data-delete-duty-name="${escapeHtml(dutyName.id)}">Verwijder</button>
        </div>
      `).join("")
    : "<div class=\"empty-state\">Geen dienstnamen ingesteld.</div>";

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
      ${renderSettingsDutyNameForm()}
      <div class="duty-name-list settings-duty-list">
        ${dutyRows}
      </div>
    </section>

    <section class="panel">
      <p class="eyebrow">Code-indeling</p>
      <div class="settings-grid">
        <div class="settings-tile"><strong>config.js</strong><span>Versie, personen, rondes, normen, standaardlijsten</span></div>
        <div class="settings-tile"><strong>app.js</strong><span>Opslag, rendering, invoer, analyse en events</span></div>
        <div class="settings-tile"><strong>style.css</strong><span>Vormgeving en responsive gedrag</span></div>
      </div>
    </section>
  `;
}

function renderSettingsDutyNameForm() {
  return `
    <form id="settings-duty-name-form" class="duty-name-form settings-duty-form">
      <label>
        Dienstnaam/code
        <input name="naam" type="text" placeholder="Bijv. A, LD, Nacht 8" required>
      </label>
      <label>
        Persoon
        <select name="persoonId" required>
          ${renderOptions(Object.keys(DUTY_PERSON_OPTIONS), DUTY_PERSON_OPTIONS, "persoon_jij")}
        </select>
      </label>
      <label>
        Vanaf ronde
        <select name="beschikbaarVanaf" required>
          ${renderOptions(PLANNING_STAGES.map((stage) => stage.value), getPlanningStageLabels(), "R1_wensen")}
        </select>
      </label>
      <label>
        Post
        <input name="post" type="text" placeholder="Bijv. post noord">
      </label>
      <label>
        Type
        <select name="dienstType" required>
          ${renderOptions(SERVICE_TYPES, null, "overig")}
        </select>
      </label>
      <label>
        Start
        <input name="start" type="time" required>
      </label>
      <label>
        Einde
        <input name="einde" type="time" required>
      </label>
      <label>
        Locatie/detail
        <input name="locatie" type="text" placeholder="Optioneel">
      </label>
      <button type="submit">Dienstkeuze toevoegen</button>
    </form>
  `;
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

function getDutyNameMeta(dutyName) {
  const person = DUTY_PERSON_OPTIONS[dutyName.persoonId] || getPersonLabel(dutyName.persoonId);
  const stage = getPlanningStageLabels()[dutyName.beschikbaarVanaf] || formatCodeLabel(dutyName.beschikbaarVanaf);
  const parts = [
    person,
    `vanaf ${stage}`,
    dutyName.post || dutyName.locatie,
    formatCodeLabel(dutyName.dienstType),
    formatTimeRange(dutyName.start, dutyName.einde)
  ].filter(Boolean);
  return parts.join(" - ");
}

function updateDutyNameVisibility() {
  const form = document.getElementById("service-form");
  const activeMonth = getMonth(state.data.instellingen.actieveMaandId);
  const activeStage = activeMonth?.planningStage || state.data.instellingen.standaardPlanningStage;
  const selectedPersonId = form?.elements.persoonId?.value || "persoon_jij";
  const buttons = Array.from(document.querySelectorAll("[data-apply-duty-name]"));
  let visibleCount = 0;

  buttons.forEach((button) => {
    const visible = isDutyNameAvailableFor(button.dataset.dutyPerson, button.dataset.dutyRound, selectedPersonId, activeStage);
    button.hidden = !visible;
    if (visible) visibleCount += 1;
  });

  const emptyMessage = document.querySelector("[data-duty-empty-message]");
  if (emptyMessage) emptyMessage.hidden = visibleCount > 0 || !buttons.length;
}

function isDutyNameAvailableFor(dutyPersonId, dutyStage, selectedPersonId, activeStage) {
  const personMatches = dutyPersonId === "beiden" || dutyPersonId === selectedPersonId;
  if (!personMatches) return false;
  return getPlanningStageIndex(activeStage) >= getPlanningStageIndex(dutyStage);
}

function getPlanningStageIndex(stageValue) {
  const index = PLANNING_STAGES.findIndex((stage) => stage.value === stageValue);
  return index === -1 ? 0 : index;
}

function renderQuickEntry() {
  const content = document.getElementById("quick-entry-content");
  const activeMonthId = state.data.instellingen.actieveMaandId;
  const month = activeMonthId ? getMonth(activeMonthId) : null;

  if (!month) {
    content.innerHTML = `
      <div class="empty-state">
        Open eerst een maand. Daarna kun je diensten, gezinsverplichtingen en wensen toevoegen.
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
  const activeStage = month.planningStage || state.data.instellingen.standaardPlanningStage;
  const quickDate = state.quickEntry?.date || "";
  const quickLabel = quickDate ? formatLongDate(quickDate) : "";
  const serviceSubmitLabel = state.editing?.type === "service" ? "Dienst bijwerken" : "Dienst opslaan";
  const familySubmitLabel = state.editing?.type === "family" ? "Gezinsitem bijwerken" : "Gezinsitem opslaan";
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
        <h3 class="form-section-title">${state.editing?.type === "family" ? "Gezinsverplichting bewerken" : "Gezinsverplichting toevoegen"}</h3>
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
            <textarea name="opmerking" placeholder="Bijv. school uit, opvang dicht">${escapeHtml(editingFamilyBlock.opmerking || "")}</textarea>
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
      <div class="storage-row"><span>Gezinsitems</span><strong>${data.gezinsVerplichtingen.length}</strong></div>
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

function downloadBackup() {
  const backup = {
    backupType: "roostercoach-backup",
    backupVersion: 1,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data: state.data,
    snapshots: loadSnapshots()
  };
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `roostercoach-backup-${formatBackupTimestamp(new Date())}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setBackupMessage("Backupbestand is gemaakt.");
}

function restoreBackup(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || ""));
      const backupData = parsed && parsed.backupType === "roostercoach-backup" ? parsed.data : parsed;
      if (!validateBackupData(backupData)) {
        setBackupMessage("Dit bestand lijkt geen geldige roostercoach-backup.", true);
        return;
      }

      const monthCount = Array.isArray(backupData.maandPlanningen) ? backupData.maandPlanningen.length : 0;
      const serviceCount = Array.isArray(backupData.diensten) ? backupData.diensten.length : 0;
      const ok = window.confirm(`Backup terugzetten?\n\nMaanden: ${monthCount}\nDiensten: ${serviceCount}\n\nEr wordt eerst een snapshot gemaakt van je huidige lokale data.`);
      if (!ok) return;

      createSnapshot("voor_backup_restore");
      state.data = normalizeData(backupData);
      state.data.maandPlanningen.forEach((month) => runAnalysis(month.id));
      saveData("backup_teruggezet");
      showView("backup");
      setBackupMessage("Backup is teruggezet.");
    } catch (error) {
      console.error("Backup terugzetten mislukt", error);
      setBackupMessage("Backup terugzetten is mislukt. Controleer of het JSON-bestand klopt.", true);
    }
  };
  reader.readAsText(file);
}

function clearLocalData() {
  const hasData = state.data.maandPlanningen.length ||
    state.data.diensten.length ||
    state.data.gezinsVerplichtingen.length ||
    state.data.wensen.length ||
    state.data.actieItems.length;
  const message = hasData
    ? "Lokale data wissen?\n\nMaak eerst een backup als je deze gegevens wilt bewaren. Er wordt een snapshot gemaakt, maar de app keert terug naar een lege start."
    : "Lokale data wissen en terug naar lege start?";

  if (!window.confirm(message)) return;
  createSnapshot("voor_lokaal_wissen");
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(SYNC_KEY);
  localStorage.removeItem(IMPORT_DRAFT_KEY);
  state.data = createEmptyData();
  saveData("lokale_data_gewist");
  showView("months");
  setBackupMessage("Lokale data is gewist. De app staat weer op de lege start.");
}

function createSnapshot(reason) {
  const snapshots = loadSnapshots();
  const snapshot = {
    id: generateId("snapshot"),
    gemaaktOp: new Date().toISOString(),
    reden: reason,
    dataVersion: DATA_VERSION,
    aantalMaanden: state.data.maandPlanningen.length,
    data: state.data
  };
  snapshots.unshift(snapshot);
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots.slice(0, 10)));
  return snapshot;
}

function loadSnapshots() {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    const snapshots = raw ? JSON.parse(raw) : [];
    return Array.isArray(snapshots) ? snapshots : [];
  } catch (error) {
    console.error("Snapshots lezen mislukt", error);
    return [];
  }
}

function validateBackupData(data) {
  if (!data || typeof data !== "object") return false;
  return MODULE_1_ARRAYS.every((key) => Array.isArray(data[key] || [])) &&
    (!data.dataVersion || Number(data.dataVersion) === DATA_VERSION);
}

function setBackupMessage(message, isError = false) {
  const element = document.getElementById("backup-message");
  if (!element) return;
  element.textContent = message;
  element.style.color = isError ? "var(--conflict-text)" : "var(--muted)";
}

function buildMonthDays(month) {
  const daysInMonth = new Date(month.jaar, month.maand, 0).getDate();
  const services = getMonthItems(month.id, "diensten");
  const familyBlocks = getMonthItems(month.id, "gezinsVerplichtingen");
  const wishes = getMonthItems(month.id, "wensen");
  const analyses = getVisibleAnalyses(month.id);
  const actions = getOpenActions(month.id);

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const date = `${month.id}-${String(day).padStart(2, "0")}`;
    return {
      date,
      services: services.filter((item) => item.datum === date),
      familyBlocks: familyBlocks.filter((item) => item.datum === date),
      wishes: wishes.filter((item) => item.datum === date),
      analyses: analyses.filter((item) => item.datum === date),
      actions: actions.filter((item) => item.datum === date || item.deadline === date)
    };
  });
}

function addService(input) {
  const monthId = dateToMonthId(input.datum);
  if (state.editing?.type === "service") {
    updateService(state.editing.id, input);
    return;
  }

  const service = {
    id: generateId("dienst"),
    persoonId: input.persoonId,
    maandPlanningId: monthId,
    datum: input.datum,
    start: input.start,
    einde: input.einde,
    dienstCode: input.dienstCode.trim(),
    dienstType: input.dienstType,
    locatie: input.locatie.trim(),
    roosterLaag: input.dienstType === "instructie" ? "instructie" : "regulier",
    status: input.status,
    bronId: "bron_handmatig",
    ruilbaar: "onbekend",
    opmerking: input.opmerking.trim()
  };

  state.data.diensten.push(service);
  state.selectedDate = input.datum;
  runAnalysis(monthId);
  saveData("dienst_toegevoegd");
  showView("cockpit");
}

function updateService(id, input) {
  const service = state.data.diensten.find((item) => item.id === id);
  if (!service) return;
  const previousMonthId = service.maandPlanningId;
  const monthId = dateToMonthId(input.datum);

  Object.assign(service, {
    persoonId: input.persoonId,
    maandPlanningId: monthId,
    datum: input.datum,
    start: input.start,
    einde: input.einde,
    dienstCode: input.dienstCode.trim(),
    dienstType: input.dienstType,
    locatie: input.locatie.trim(),
    roosterLaag: input.dienstType === "instructie" ? "instructie" : "regulier",
    status: input.status,
    opmerking: input.opmerking.trim()
  });

  finishItemMutation(previousMonthId, monthId, "dienst_bijgewerkt", input.datum);
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

function addDutyName(input) {
  const dutyName = {
    id: generateId("dienstnaam"),
    naam: String(input.naam || "").trim(),
    persoonId: DUTY_PERSON_OPTIONS[input.persoonId] ? input.persoonId : "persoon_jij",
    beschikbaarVanaf: PLANNING_STAGES.some((stage) => stage.value === input.beschikbaarVanaf) ? input.beschikbaarVanaf : "R1_wensen",
    post: String(input.post || "").trim(),
    dienstType: SERVICE_TYPES.includes(input.dienstType) ? input.dienstType : "overig",
    start: input.start || "",
    einde: input.einde || "",
    locatie: String(input.locatie || "").trim()
  };

  if (!dutyName.naam || !dutyName.start || !dutyName.einde) return;

  state.data.instellingen.dienstNamen = [
    ...getDutyNames().filter((item) => getDutyNameKey(item) !== getDutyNameKey(dutyName)),
    dutyName
  ];
  saveData("dienstnaam_toegevoegd");
  renderQuickEntry();
  renderSettingsPanel();
}

function deleteDutyName(id) {
  state.data.instellingen.dienstNamen = getDutyNames().filter((dutyName) => dutyName.id !== id);
  saveData("dienstnaam_verwijderd");
  renderQuickEntry();
  renderSettingsPanel();
}

function applyDutyName(id) {
  const dutyName = getDutyNames().find((item) => item.id === id);
  const form = document.getElementById("service-form");
  if (!dutyName || !form) return;

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

function getDutyNameKey(dutyName) {
  return [
    String(dutyName.naam || "").trim().toLowerCase(),
    dutyName.persoonId || "",
    dutyName.beschikbaarVanaf || "",
    String(dutyName.post || "").trim().toLowerCase()
  ].join("|");
}

function addFamilyBlock(input) {
  const monthId = dateToMonthId(input.datum);
  if (state.editing?.type === "family") {
    updateFamilyBlock(state.editing.id, input);
    return;
  }

  const familyBlock = {
    id: generateId("gezin"),
    maandPlanningId: monthId,
    type: input.type,
    kindId: "",
    datum: input.datum,
    start: input.start,
    einde: input.einde,
    hardheid: input.hardheid,
    dekkingNodig: input.dekkingNodig === "true",
    opmerking: input.opmerking.trim()
  };

  state.data.gezinsVerplichtingen.push(familyBlock);
  state.selectedDate = input.datum;
  runAnalysis(monthId);
  saveData("gezinsverplichting_toegevoegd");
  showView("cockpit");
}

function updateFamilyBlock(id, input) {
  const familyBlock = state.data.gezinsVerplichtingen.find((item) => item.id === id);
  if (!familyBlock) return;
  const previousMonthId = familyBlock.maandPlanningId;
  const monthId = dateToMonthId(input.datum);

  Object.assign(familyBlock, {
    maandPlanningId: monthId,
    type: input.type,
    datum: input.datum,
    start: input.start,
    einde: input.einde,
    hardheid: input.hardheid,
    dekkingNodig: input.dekkingNodig === "true",
    opmerking: input.opmerking.trim()
  });

  finishItemMutation(previousMonthId, monthId, "gezinsverplichting_bijgewerkt", input.datum);
}

function addWish(input) {
  const monthId = dateToMonthId(input.datum);
  if (state.editing?.type === "wish") {
    updateWish(state.editing.id, input);
    return;
  }

  const wish = {
    id: generateId("wens"),
    persoonId: input.persoonId,
    maandPlanningId: monthId,
    type: input.type,
    datum: input.datum,
    dienstType: "",
    prioriteit: input.prioriteit,
    reden: input.reden.trim()
  };

  state.data.wensen.push(wish);
  state.selectedDate = input.datum;
  runAnalysis(monthId);
  saveData("wens_toegevoegd");
  showView("cockpit");
}

function updateWish(id, input) {
  const wish = state.data.wensen.find((item) => item.id === id);
  if (!wish) return;
  const previousMonthId = wish.maandPlanningId;
  const monthId = dateToMonthId(input.datum);

  Object.assign(wish, {
    persoonId: input.persoonId,
    maandPlanningId: monthId,
    type: input.type,
    datum: input.datum,
    prioriteit: input.prioriteit,
    reden: input.reden.trim()
  });

  finishItemMutation(previousMonthId, monthId, "wens_bijgewerkt", input.datum);
}

function finishItemMutation(previousMonthId, monthId, reason, selectedDate) {
  state.editing = null;
  if (previousMonthId && previousMonthId !== monthId) {
    runAnalysis(previousMonthId);
  }
  runAnalysis(monthId);
  saveData(reason);
  openMonth(monthId, selectedDate);
}

function startEditItem(type, id) {
  if (!getItemByType(type, id)) return;
  state.editing = { type, id };
  state.quickEntry = null;
  showView("quick-entry");
}

function cancelEditItem() {
  state.editing = null;
  renderQuickEntry();
}

function startQuickEntry(type, date) {
  const monthId = dateToMonthId(date);
  if (!getMonth(monthId)) return;
  state.data.instellingen.actieveMaandId = monthId;
  state.editing = null;
  state.quickEntry = { type, date };
  state.selectedDate = date;
  showView("quick-entry");
}

function clearQuickEntry() {
  state.quickEntry = null;
  renderQuickEntry();
}

function setCockpitFilter(filter) {
  state.cockpitFilter = filter || "all";
  renderMonthCockpit();
}

function openDay(date) {
  const monthId = dateToMonthId(date);
  if (!getMonth(monthId)) return;
  state.data.instellingen.actieveMaandId = monthId;
  state.editing = null;
  state.quickEntry = null;
  state.selectedDate = date;
  state.pendingFocusDate = date;
  showView("cockpit");
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

function rerunMonthControl(monthId) {
  if (!getMonth(monthId)) return;
  runAnalysis(monthId);
  saveData("controle_opnieuw_uitgevoerd");
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
    family: "Gezinsverplichting",
    wish: "Wens"
  };
  return labels[type] || "Item";
}

function getItemTypeLogName(type) {
  const names = {
    service: "dienst",
    family: "gezinsverplichting",
    wish: "wens"
  };
  return names[type] || "item";
}

function runAnalysis(monthId) {
  const context = buildAnalysisContext(monthId);
  const preservedNotificationStatuses = getPreservedNotificationStatuses(monthId);
  clearGeneratedAnalysis(monthId);

  const results = [
    ...checkCompleteness(context),
    ...checkInvalidTimes(context),
    ...checkOverlappingServicesForSamePerson(context),
    ...checkMissingCoverage(context),
    ...checkBothParentsBusy(context),
    ...checkSoftWorktimeNotifications(context),
    ...checkMonthlyContractHours(context),
    ...checkWishConflicts(context)
  ].map((result) => restoreNotificationStatus(result, preservedNotificationStatuses));

  state.data.analyseResultaten.push(...results);
  syncActionsWithAnalysis(monthId, results);
  updateMonthStatus(monthId);
}

function getPreservedNotificationStatuses(monthId) {
  return state.data.analyseResultaten.reduce((statuses, result) => {
    if (result.maandPlanningId === monthId && result.ernst === "notificatie" && ["gezien", "bewust_akkoord"].includes(result.actieStatus)) {
      statuses[result.signature] = result.actieStatus;
    }
    return statuses;
  }, {});
}

function restoreNotificationStatus(result, statuses) {
  if (result.ernst === "notificatie" && statuses[result.signature]) {
    return { ...result, actieStatus: statuses[result.signature] };
  }
  return result;
}

function buildAnalysisContext(monthId) {
  return {
    monthId,
    month: getMonth(monthId),
    services: getMonthItems(monthId, "diensten"),
    familyBlocks: getMonthItems(monthId, "gezinsVerplichtingen"),
    wishes: getMonthItems(monthId, "wensen"),
    analyses: getMonthItems(monthId, "analyseResultaten"),
    actions: getMonthItems(monthId, "actieItems")
  };
}

function clearGeneratedAnalysis(monthId) {
  state.data.analyseResultaten = state.data.analyseResultaten.filter((result) => {
    return result.maandPlanningId !== monthId || !result.generated;
  });
}

function checkCompleteness(context) {
  const results = [];

  if (!context.services.length) {
    results.push(createAnalysisResult({
      monthId: context.monthId,
      datum: `${context.monthId}-01`,
      ernst: "onvolledig",
      categorie: "gegevens",
      regelId: "regel_diensten_ontbreken",
      betrokkenDienstIds: [],
      betrokkenGezinsVerplichtingId: "",
      melding: "Er zijn nog geen diensten ingevoerd voor deze maand",
      advies: "Vul diensten in of laat de maand bewust in concept staan.",
      signature: `diensten_ontbreken_${context.monthId}`
    }));
  }

  if (!context.familyBlocks.length) {
    results.push(createAnalysisResult({
      monthId: context.monthId,
      datum: `${context.monthId}-01`,
      ernst: "onvolledig",
      categorie: "gegevens",
      regelId: "regel_gezin_ontbreekt",
      betrokkenDienstIds: [],
      betrokkenGezinsVerplichtingId: "",
      melding: "Er zijn nog geen gezinsafspraken of dekkingmomenten ingevoerd",
      advies: "Vul vaste gezinsmomenten in als die relevant zijn voor deze maand.",
      signature: `gezin_ontbreekt_${context.monthId}`
    }));
  }

  return results;
}

function checkInvalidTimes(context) {
  const results = [];

  context.services.forEach((service) => {
    if (isValidServiceTimeRange(service)) return;
    results.push(createAnalysisResult({
      monthId: context.monthId,
      datum: service.datum,
      ernst: "aandacht",
      categorie: "gegevens",
      regelId: "regel_diensttijd_controleren",
      betrokkenDienstIds: [service.id],
      betrokkenGezinsVerplichtingId: "",
      melding: `Diensttijd controleren voor ${getPersonLabel(service.persoonId)} op ${formatLongDate(service.datum)}`,
      advies: "Controleer start- en eindtijd; de app kan deze dienst nu niet betrouwbaar beoordelen.",
      signature: `diensttijd_${service.id}`
    }));
  });

  context.familyBlocks.forEach((block) => {
    if (isValidTimeRange(block.start, block.einde)) return;
    results.push(createAnalysisResult({
      monthId: context.monthId,
      datum: block.datum,
      ernst: "aandacht",
      categorie: "gegevens",
      regelId: "regel_gezinstijd_controleren",
      betrokkenDienstIds: [],
      betrokkenGezinsVerplichtingId: block.id,
      melding: `${formatCodeLabel(block.type)} heeft een onduidelijke tijd op ${formatLongDate(block.datum)}`,
      advies: "Controleer start- en eindtijd; dekking kan anders niet betrouwbaar worden berekend.",
      signature: `gezinstijd_${block.id}`
    }));
  });

  return results;
}

function checkOverlappingServicesForSamePerson(context) {
  const results = [];
  const servicesByPersonAndDate = groupBy(context.services, (service) => `${service.persoonId}_${service.datum}`);

  Object.values(servicesByPersonAndDate).forEach((services) => {
    services.forEach((service, index) => {
      services.slice(index + 1).forEach((otherService) => {
        if (!timesOverlap(service.start, service.einde, otherService.start, otherService.einde)) return;
        results.push(createAnalysisResult({
          monthId: context.monthId,
          datum: service.datum,
          ernst: "conflict",
          categorie: "gegevens",
          regelId: "regel_dubbele_dienst",
          betrokkenDienstIds: [service.id, otherService.id],
          betrokkenGezinsVerplichtingId: "",
          melding: `${getPersonLabel(service.persoonId)} heeft overlappende diensten op ${formatLongDate(service.datum)}`,
          advies: "Corrigeer of verwijder een van de overlappende diensten.",
          signature: `dubbele_dienst_${service.id}_${otherService.id}`
        }));
      });
    });
  });

  return results;
}

function checkMissingCoverage(context) {
  const results = [];
  context.familyBlocks
    .filter((block) => block.dekkingNodig)
    .forEach((block) => {
      const overlappingServices = context.services.filter((service) => {
        return service.datum === block.datum && timesOverlap(service.start, service.einde, block.start, block.einde);
      });
      const busyParents = new Set(overlappingServices.map((service) => service.persoonId));
      const bothParentsBusy = busyParents.has("persoon_jij") && busyParents.has("persoon_vrouw");

      if (!bothParentsBusy) return;

      results.push(createAnalysisResult({
        monthId: context.monthId,
        datum: block.datum,
        ernst: "conflict",
        categorie: "gezin",
        regelId: "regel_kinddekking",
        betrokkenDienstIds: overlappingServices.map((service) => service.id),
        betrokkenGezinsVerplichtingId: block.id,
        melding: `${formatCodeLabel(block.type)} op ${formatLongDate(block.datum)} is ongedekt`,
        advies: "Regel dekking of pas de dienst/gezinsafspraak aan.",
        signature: `kinddekking_${block.id}`
      }));
    });

  return results;
}

function checkBothParentsBusy(context) {
  const results = [];
  const servicesByDate = groupBy(context.services, "datum");

  Object.entries(servicesByDate).forEach(([date, services]) => {
    const jijServices = services.filter((service) => service.persoonId === "persoon_jij");
    const vrouwServices = services.filter((service) => service.persoonId === "persoon_vrouw");

    jijServices.forEach((jijService) => {
      vrouwServices.forEach((vrouwService) => {
        if (!timesOverlap(jijService.start, jijService.einde, vrouwService.start, vrouwService.einde)) return;

        const hasCoverageConflict = context.familyBlocks.some((block) => {
          return block.dekkingNodig &&
            block.datum === date &&
            timesOverlap(jijService.start, jijService.einde, block.start, block.einde) &&
            timesOverlap(vrouwService.start, vrouwService.einde, block.start, block.einde);
        });

        if (hasCoverageConflict) return;

        results.push(createAnalysisResult({
          monthId: context.monthId,
          datum: date,
          ernst: "aandacht",
          categorie: "gezin",
          regelId: "regel_beide_ouders_bezet",
          betrokkenDienstIds: [jijService.id, vrouwService.id],
          betrokkenGezinsVerplichtingId: "",
          melding: `Beide ouders werken tegelijk op ${formatLongDate(date)}`,
          advies: "Controleer of er op dat moment geen gezinsdekking nodig is.",
          signature: `beide_ouders_${jijService.id}_${vrouwService.id}`
        }));
      });
    });
  });

  return results;
}

function checkSoftWorktimeNotifications(context) {
  const results = [];
  const servicesByPerson = groupBy(context.services, "persoonId");

  Object.entries(servicesByPerson).forEach(([personId, services]) => {
    const sortedServices = services
      .filter((service) => serviceDateTime(service, "start") && serviceDateTime(service, "end"))
      .sort((a, b) => serviceDateTime(a, "start") - serviceDateTime(b, "start"));

    sortedServices.forEach((service) => {
      const durationHours = getServiceDurationHours(service);
      if (durationHours > 10) {
        results.push(createAnalysisResult({
          monthId: context.monthId,
          datum: service.datum,
          ernst: "notificatie",
          categorie: "arbeidstijd_wens",
          regelId: "notificatie_lange_dienst",
          betrokkenDienstIds: [service.id],
          betrokkenGezinsVerplichtingId: "",
          melding: `${getPersonLabel(personId)} heeft een lange dienst op ${formatLongDate(service.datum)}`,
          advies: "Controleer of deze lange dienst bewust akkoord is; werkgeverrooster blijft leidend.",
          signature: `lange_dienst_${service.id}`
        }));
      }
    });

    sortedServices.forEach((service, index) => {
      const nextService = sortedServices[index + 1];
      if (!nextService) return;
      const restHours = (serviceDateTime(nextService, "start") - serviceDateTime(service, "end")) / 36e5;
      if (restHours >= 0 && restHours < 11) {
        results.push(createAnalysisResult({
          monthId: context.monthId,
          datum: nextService.datum,
          ernst: "notificatie",
          categorie: "arbeidstijd_wens",
          regelId: "notificatie_korte_rust",
          betrokkenDienstIds: [service.id, nextService.id],
          betrokkenGezinsVerplichtingId: "",
          melding: `${getPersonLabel(personId)} heeft korte rust voor ${formatLongDate(nextService.datum)}`,
          advies: "Controleer of deze korte rust bewust akkoord is; dit is geen harde blokkade in deze app.",
          signature: `korte_rust_${service.id}_${nextService.id}`
        }));
      }
    });
  });

  return results;
}

function checkMonthlyContractHours(context) {
  const results = [];
  const servicesByPerson = groupBy(context.services.filter(isWorkingService), "persoonId");

  Object.entries(getContractHours()).forEach(([personId, contract]) => {
    const services = servicesByPerson[personId] || [];
    const actualHours = services.reduce((total, service) => total + getServiceDurationHours(service), 0);
    const targetHours = getMonthlyContractTargetHours(context.month, contract.weeklyHours);
    const difference = actualHours - targetHours;

    if (Math.abs(difference) <= contract.monthlyToleranceHours) return;

    const direction = difference > 0 ? "meer" : "minder";
    results.push(createAnalysisResult({
      monthId: context.monthId,
      datum: `${context.monthId}-01`,
      ernst: "notificatie",
      categorie: "arbeidstijd_wens",
      regelId: "notificatie_maanduren_bandbreedte",
      betrokkenDienstIds: services.map((service) => service.id),
      betrokkenGezinsVerplichtingId: "",
      melding: `${getPersonLabel(personId)} staat ${formatHours(Math.abs(difference))} uur ${direction} dan de maandnorm`,
      advies: `Norm ${formatHours(contract.weeklyHours)} uur/week. Maandnorm ${formatHours(targetHours)} uur, toegestaan ${formatHours(contract.monthlyToleranceHours)} uur meer of minder. Controleer of dit bewust akkoord is.`,
      signature: `maanduren_${context.monthId}_${personId}_${Math.round(actualHours * 100)}`
    }));
  });

  return results;
}

function checkWishConflicts(context) {
  const results = [];

  context.wishes
    .filter((wish) => ["liever_geen_dienst", "liefst_vrij", "samen_vrij"].includes(wish.type))
    .forEach((wish) => {
      const services = context.services.filter((service) => {
        if (service.datum !== wish.datum) return false;
        if (wish.type === "samen_vrij") return true;
        return service.persoonId === wish.persoonId;
      });
      if (!services.length) return;

      results.push(createAnalysisResult({
        monthId: context.monthId,
        datum: wish.datum,
        ernst: "notificatie",
        categorie: "wens",
        regelId: "notificatie_wens_botst",
        betrokkenDienstIds: services.map((service) => service.id),
        betrokkenGezinsVerplichtingId: "",
        melding: `Wens botst met geplande dienst op ${formatLongDate(wish.datum)}`,
        advies: "Controleer of deze wens bewust vervalt of dat de invoer/planning aangepast moet worden.",
        signature: `wens_botst_${wish.id}_${services.map((service) => service.id).join("_")}`
      }));
    });

  return results;
}

function createAnalysisResult(input) {
  return {
    id: generateId("analyse"),
    maandPlanningId: input.monthId,
    datum: input.datum,
    ernst: input.ernst,
    categorie: input.categorie,
    regelId: input.regelId,
    betrokkenDienstIds: input.betrokkenDienstIds,
    betrokkenGezinsVerplichtingId: input.betrokkenGezinsVerplichtingId,
    melding: input.melding,
    advies: input.advies,
    actieStatus: "open",
    signature: input.signature,
    generated: true
  };
}

function syncActionsWithAnalysis(monthId, results) {
  const activeSignatures = new Set(results.map((result) => result.signature));

  state.data.actieItems.forEach((action) => {
    if (action.maandPlanningId !== monthId || !action.generated) return;
    if (!activeSignatures.has(action.analyseSignature) && !["opgelost", "genegeerd"].includes(action.status)) {
      action.status = "vervallen";
    }
  });

  results
    .filter((result) => ["conflict", "waarschuwing", "keuze_nodig", "onvolledig"].includes(result.ernst))
    .forEach((result) => createOrUpdateAction(result));
}

function createOrUpdateAction(result) {
  const existing = state.data.actieItems.find((action) => {
    return action.generated && action.analyseSignature === result.signature;
  });
  const title = result.ernst === "conflict" ? result.melding : `Controleer: ${result.melding}`;
  const patch = {
    maandPlanningId: result.maandPlanningId,
    datum: result.datum,
    titel: title,
    type: result.categorie === "gegevens" ? "gegevens_aanvullen" : "controleren",
    prioriteit: result.ernst === "conflict" ? "hoog" : "normaal",
    deadline: result.datum,
    gekoppeldeAnalyseIds: [result.id],
    advies: result.advies,
    analyseSignature: result.signature,
    generated: true
  };

  if (existing) {
    Object.assign(existing, patch);
    if (existing.status === "vervallen") existing.status = "open";
    return existing;
  }

  const action = {
    id: generateId("actie"),
    status: "open",
    ...patch
  };
  state.data.actieItems.push(action);
  return action;
}

function updateActionStatus(actionId, status) {
  const action = state.data.actieItems.find((item) => item.id === actionId);
  if (!action) return;

  if (status === "genegeerd") {
    const ok = window.confirm("Deze actie bewust negeren? De actie verdwijnt uit de standaardlijst, maar blijft in de data staan.");
    if (!ok) return;
  }

  action.status = status;
  action.laatstBijgewerkt = new Date().toISOString();
  updateLinkedAnalysisStatus(action, status);
  updateMonthStatus(action.maandPlanningId);
  saveData(`actie_${status}`);
  renderApp();
}

function updateNotificationStatus(analysisId, status) {
  const result = state.data.analyseResultaten.find((item) => item.id === analysisId);
  if (!result || result.ernst !== "notificatie") return;

  if (status === "bewust_akkoord") {
    const ok = window.confirm("Deze notificatie bewust akkoord markeren? De melding verdwijnt uit de actieve notificaties, maar blijft in de historie staan.");
    if (!ok) return;
  }

  result.actieStatus = status;
  result.laatstBijgewerkt = new Date().toISOString();
  updateMonthStatus(result.maandPlanningId);
  saveData(`notificatie_${status}`);
  renderApp();
}

function updateLinkedAnalysisStatus(action, status) {
  const mappedStatus = ["opgelost", "genegeerd"].includes(status) ? status : "open";
  const linkedIds = Array.isArray(action.gekoppeldeAnalyseIds) ? action.gekoppeldeAnalyseIds : [];
  state.data.analyseResultaten.forEach((result) => {
    const linkedById = linkedIds.includes(result.id);
    const linkedBySignature = action.analyseSignature && result.signature === action.analyseSignature;
    if (linkedById || linkedBySignature) {
      result.actieStatus = mappedStatus;
    }
  });
}

function updateMonthStatus(monthId) {
  const month = getMonth(monthId);
  if (!month) return;
  const openActions = getOpenActions(monthId);
  const analyses = getVisibleAnalyses(monthId);
  const services = getMonthItems(monthId, "diensten");
  const hasIncomplete = analyses.some((result) => result.ernst === "onvolledig");
  const hasConflict = analyses.some((result) => result.ernst === "conflict");

  month.laatstBijgewerkt = new Date().toISOString();
  if (hasConflict || openActions.some((action) => action.prioriteit === "hoog")) {
    month.samenvattingStatus = "conflict";
  } else if (hasIncomplete) {
    month.samenvattingStatus = "onvolledig";
  } else if (analyses.length) {
    month.samenvattingStatus = "aandacht";
  } else if (!services.length) {
    month.samenvattingStatus = "onvolledig";
  } else {
    month.samenvattingStatus = "goed";
  }
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

    const deleteDutyNameButton = event.target.closest("[data-delete-duty-name]");
    if (deleteDutyNameButton) {
      deleteDutyName(deleteDutyNameButton.dataset.deleteDutyName);
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
    if (event.target.matches("#service-form select[name='persoonId']")) {
      updateDutyNameVisibility();
    }

    if (event.target.matches("[data-backup-file]")) {
      restoreBackup(event.target.files[0]);
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
  return Object.fromEntries(new FormData(form).entries());
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
