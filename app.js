"use strict";

const APP_VERSION = "0.1.1-lokaal";
const DATA_VERSION = 1;
const STORAGE_KEY = "roostercoach.data.v1";
const SETTINGS_KEY = "roostercoach.settings.v1";
const SNAPSHOT_KEY = "roostercoach.snapshots.v1";
const SYNC_KEY = "roostercoach.sync.v1";
const IMPORT_DRAFT_KEY = "roostercoach.importDraft.v1";

const PLANNING_STAGES = [
  { value: "R1_wensen", label: "R1 - wensen" },
  { value: "R2_afstemming", label: "R2 - afstemming" },
  { value: "R3_manager", label: "R3 - managerfase" },
  { value: "R4_gepubliceerd", label: "R4 - gepubliceerd" }
];

const STATUS_LABELS = {
  goed: "Goed",
  aandacht: "Aandacht",
  conflict: "Conflict",
  onvolledig: "Onvolledig"
};

const ACTION_PRIORITY_ORDER = {
  urgent: 0,
  hoog: 1,
  normaal: 2,
  laag: 3
};

const PERSON_LABELS = {
  persoon_jij: "Jij",
  persoon_vrouw: "Vrouw"
};

const SERVICE_TYPES = [
  "vroeg",
  "dag",
  "laat",
  "nacht",
  "vrij",
  "opleiding",
  "instructie",
  "overig"
];

const SERVICE_STATUSES = [
  "wens",
  "aangevraagd",
  "optie",
  "voorgesteld",
  "onzeker",
  "waarschijnlijk",
  "bevestigd",
  "gepubliceerd",
  "ruil_gewenst"
];

const FAMILY_BLOCK_TYPES = [
  "school_brengen",
  "school_halen",
  "opvang",
  "sport",
  "afspraak",
  "overig"
];

const WISH_TYPES = [
  "liever_geen_dienst",
  "liefst_vrij",
  "voorkeur_dienst",
  "samen_vrij",
  "overig"
];

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maart",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Augustus",
  "September",
  "Oktober",
  "November",
  "December"
];

const MODULE_1_ARRAYS = [
  "personen",
  "kinderen",
  "maandPlanningen",
  "diensten",
  "keuzeAanvragen",
  "keuzeOpties",
  "bronnen",
  "contextPeriodes",
  "gezinsVerplichtingen",
  "beschikbaarheid",
  "wensen",
  "regels",
  "analyseResultaten",
  "ruilKandidaten",
  "actieItems"
];

let state = {
  data: createEmptyData(),
  currentView: "months"
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
      standaardPlanningStage: "R1_wensen"
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
  normalized.bronHistorie = Array.isArray(incoming.bronHistorie) ? incoming.bronHistorie : [];
  normalized.wijzigingsLog = Array.isArray(incoming.wijzigingsLog) ? incoming.wijzigingsLog : [];
  normalized.dataVersion = Number(incoming.dataVersion) || DATA_VERSION;
  normalized.appVersion = incoming.appVersion || APP_VERSION;

  return normalized;
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
  saveData("maand_aangemaakt");
  showView("cockpit");
  return monthPlanning;
}

function openMonth(monthId) {
  state.data.instellingen.actieveMaandId = monthId;
  saveData("maand_geopend");
  showView("cockpit");
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

function sortActions(a, b) {
  const priorityDiff = (ACTION_PRIORITY_ORDER[a.prioriteit] ?? 9) - (ACTION_PRIORITY_ORDER[b.prioriteit] ?? 9);
  if (priorityDiff !== 0) return priorityDiff;
  return String(a.deadline || "").localeCompare(String(b.deadline || ""));
}

function getVisibleAnalyses(monthId) {
  return state.data.analyseResultaten.filter((result) => {
    const inMonth = !monthId || result.maandPlanningId === monthId;
    return inMonth && result.actieStatus !== "vervallen";
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
  renderStoragePanel();
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
    return `
      <article class="month-card">
        <h3>${escapeHtml(getMonthLabel(month.id))}</h3>
        <div class="cockpit-badges">
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
        <button type="button" data-open-month="${month.id}">Open maand</button>
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
  const days = buildMonthDays(month);

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
      </div>
    </div>

    <div class="stack">
      <section class="panel">
        <p class="eyebrow">Actiestrook</p>
        ${actions.length ? actions.map(renderActionCard).join("") : "<p>Geen open acties voor deze maand.</p>"}
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

      <section class="stack">
        ${days.map(renderDayRow).join("")}
      </section>
    </div>
  `;
}

function renderDayRow(day) {
  const hasItems = day.services.length || day.familyBlocks.length || day.wishes.length;
  const hasSignals = day.analyses.length || day.actions.length;
  return `
    <article class="day-row ${hasSignals ? "day-row-signal" : ""}">
      <div>
        <div class="day-date">${escapeHtml(formatLongDate(day.date))}</div>
      </div>
      <div>
        ${hasItems || hasSignals ? `
          <div class="item-list">
            ${day.services.map((service) => `
              <span class="mini-item">${escapeHtml(getPersonLabel(service.persoonId))} ${escapeHtml(service.dienstCode || service.dienstType || "dienst")} ${escapeHtml(formatTimeRange(service.start, service.einde))}</span>
            `).join("")}
            ${day.familyBlocks.map((block) => `
              <span class="mini-item">${escapeHtml(formatCodeLabel(block.type || "Gezin"))} ${escapeHtml(formatTimeRange(block.start, block.einde))}</span>
            `).join("")}
            ${day.wishes.map((wish) => `
              <span class="mini-item">Wens: ${escapeHtml(formatCodeLabel(wish.type || "wens"))}</span>
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

function renderActionList() {
  const list = document.getElementById("action-list");
  const actions = getOpenActions();
  if (!actions.length) {
    list.innerHTML = "<div class=\"empty-state\">Er zijn nog geen open acties.</div>";
    return;
  }

  list.innerHTML = actions.map(renderActionCard).join("");
}

function renderActionCard(action) {
  return `
    <article class="action-card">
      <h3>${escapeHtml(action.titel || "Actie")}</h3>
      <p>${escapeHtml(action.type || "actie")} - ${escapeHtml(action.prioriteit || "normaal")} - ${escapeHtml(action.status || "open")}</p>
      ${action.deadline ? `<p>Deadline: ${escapeHtml(formatLongDate(action.deadline))}</p>` : ""}
      ${action.advies ? `<p>${escapeHtml(action.advies)}</p>` : ""}
      <p>${escapeHtml(getMonthLabel(action.maandPlanningId))}</p>
    </article>
  `;
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

  content.innerHTML = `
    <div class="stack">
      <section class="panel">
        <p class="eyebrow">Actieve maand</p>
        <h3 class="form-section-title">${escapeHtml(getMonthLabel(month.id))}</h3>
        <div class="toolbar">
          <button type="button" class="subtle-button" data-view-target="cockpit">Terug naar cockpit</button>
        </div>
      </section>

      <section class="panel">
        <h3 class="form-section-title">Dienst toevoegen</h3>
        <form id="service-form" class="form-grid">
          <label>
            Persoon
            <select name="persoonId" required>
              ${renderOptions(Object.keys(PERSON_LABELS), PERSON_LABELS)}
            </select>
          </label>
          <label>
            Datum
            <input name="datum" type="date" min="${minDate}" max="${maxDate}" required>
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
            Diensttype
            <select name="dienstType" required>
              ${renderOptions(SERVICE_TYPES)}
            </select>
          </label>
          <label>
            Status
            <select name="status" required>
              ${renderOptions(SERVICE_STATUSES, null, "gepubliceerd")}
            </select>
          </label>
          <label>
            Dienstcode
            <input name="dienstCode" type="text" placeholder="Bijv. C, D, L">
          </label>
          <label>
            Locatie
            <input name="locatie" type="text" placeholder="Bijv. Zuid">
          </label>
          <label class="full-width">
            Opmerking
            <textarea name="opmerking" placeholder="Korte notitie"></textarea>
          </label>
          <button type="submit">Dienst opslaan</button>
        </form>
      </section>

      <section class="panel">
        <h3 class="form-section-title">Gezinsverplichting toevoegen</h3>
        <form id="family-block-form" class="form-grid">
          <label>
            Type
            <select name="type" required>
              ${renderOptions(FAMILY_BLOCK_TYPES)}
            </select>
          </label>
          <label>
            Datum
            <input name="datum" type="date" min="${minDate}" max="${maxDate}" required>
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
            Hardheid
            <select name="hardheid" required>
              <option value="hard">Hard</option>
              <option value="zacht">Zacht</option>
            </select>
          </label>
          <label>
            Dekking nodig
            <select name="dekkingNodig" required>
              <option value="true">Ja</option>
              <option value="false">Nee</option>
            </select>
          </label>
          <label class="full-width">
            Opmerking
            <textarea name="opmerking" placeholder="Bijv. school uit, opvang dicht"></textarea>
          </label>
          <button type="submit">Gezinsitem opslaan</button>
        </form>
      </section>

      <section class="panel">
        <h3 class="form-section-title">Wens toevoegen</h3>
        <form id="wish-form" class="form-grid">
          <label>
            Persoon
            <select name="persoonId" required>
              ${renderOptions(Object.keys(PERSON_LABELS), PERSON_LABELS)}
            </select>
          </label>
          <label>
            Datum
            <input name="datum" type="date" min="${minDate}" max="${maxDate}" required>
          </label>
          <label>
            Type
            <select name="type" required>
              ${renderOptions(WISH_TYPES)}
            </select>
          </label>
          <label>
            Prioriteit
            <select name="prioriteit" required>
              <option value="hoog">Hoog</option>
              <option value="normaal">Normaal</option>
              <option value="laag">Laag</option>
            </select>
          </label>
          <label class="full-width">
            Reden
            <textarea name="reden" placeholder="Waarom is deze wens belangrijk?"></textarea>
          </label>
          <button type="submit">Wens opslaan</button>
        </form>
      </section>
    </div>
  `;
}

function renderStoragePanel() {
  const panel = document.getElementById("storage-panel");
  const data = state.data;
  panel.innerHTML = `
    <div class="storage-list">
      <div class="storage-row"><span>Opslagsleutel</span><strong>${STORAGE_KEY}</strong></div>
      <div class="storage-row"><span>Syncstatus</span><strong>Alleen lokaal</strong></div>
      <div class="storage-row"><span>DataVersion</span><strong>${data.dataVersion}</strong></div>
      <div class="storage-row"><span>RevisionId</span><strong>${escapeHtml(data.revisionId || "nog geen revisie")}</strong></div>
      <div class="storage-row"><span>Laatst opgeslagen</span><strong>${formatDateTime(data.lastModified)}</strong></div>
      <div class="storage-row"><span>Maanden</span><strong>${data.maandPlanningen.length}</strong></div>
    </div>
    <p class="empty-state">
      Backup, restore en lokaal wissen komen in een volgende 0.1-stap. Deze versie bewaart de hoofddata al automatisch in localStorage.
    </p>
  `;
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
  runAnalysis(monthId);
  saveData("dienst_toegevoegd");
  showView("cockpit");
}

function addFamilyBlock(input) {
  const monthId = dateToMonthId(input.datum);
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
  runAnalysis(monthId);
  saveData("gezinsverplichting_toegevoegd");
  showView("cockpit");
}

function addWish(input) {
  const monthId = dateToMonthId(input.datum);
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
  runAnalysis(monthId);
  saveData("wens_toegevoegd");
  showView("cockpit");
}

function runAnalysis(monthId) {
  const context = buildAnalysisContext(monthId);
  clearGeneratedAnalysis(monthId);

  const results = [
    ...checkMissingCoverage(context),
    ...checkBothParentsBusy(context)
  ];

  state.data.analyseResultaten.push(...results);
  syncActionsWithAnalysis(monthId, results);
  updateMonthStatus(monthId);
}

function buildAnalysisContext(monthId) {
  return {
    monthId,
    month: getMonth(monthId),
    services: getMonthItems(monthId, "diensten"),
    familyBlocks: getMonthItems(monthId, "gezinsVerplichtingen"),
    analyses: getMonthItems(monthId, "analyseResultaten"),
    actions: getMonthItems(monthId, "actieItems")
  };
}

function clearGeneratedAnalysis(monthId) {
  state.data.analyseResultaten = state.data.analyseResultaten.filter((result) => {
    return result.maandPlanningId !== monthId || !result.generated;
  });
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
        advies: "Zoek ruil, regel opvang of pas een dienst aan.",
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
    .filter((result) => ["conflict", "waarschuwing", "keuze_nodig"].includes(result.ernst))
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
    type: result.categorie === "gezin" ? "opvang_regelen" : "controleren",
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

function updateMonthStatus(monthId) {
  const month = getMonth(monthId);
  if (!month) return;
  const openActions = getOpenActions(monthId);
  const analyses = getVisibleAnalyses(monthId);
  const services = getMonthItems(monthId, "diensten");

  month.laatstBijgewerkt = new Date().toISOString();
  if (openActions.some((action) => action.prioriteit === "hoog")) {
    month.samenvattingStatus = "conflict";
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
      showView(button.dataset.view);
    });
  });

  document.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-open-month]");
    if (openButton) {
      openMonth(openButton.dataset.openMonth);
    }

    const viewButton = event.target.closest("[data-view-target]");
    if (viewButton) {
      showView(viewButton.dataset.viewTarget);
    }
  });

  document.getElementById("create-month-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    createMonth(form.get("year"), form.get("month"), form.get("stage"));
  });

  document.addEventListener("submit", (event) => {
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
    const groupKey = item[key] || "";
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

document.addEventListener("DOMContentLoaded", () => {
  populateForms();
  bindEvents();
  loadData();
  renderApp();
});
