"use strict";

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

function getOpenActions(monthId) {
  return state.data.actieItems.filter((action) => {
    const inMonth = !monthId || action.maandPlanningId === monthId;
    const isOpen = !["opgelost", "genegeerd", "vervallen", "afgedekt"].includes(action.status);
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
  return ["opgelost", "genegeerd", "afgedekt"].includes(action.status);
}

function sortActions(a, b) {
  const priorityDiff = (ACTION_PRIORITY_ORDER[a.prioriteit] ?? 9) - (ACTION_PRIORITY_ORDER[b.prioriteit] ?? 9);
  if (priorityDiff !== 0) return priorityDiff;
  return String(a.deadline || "").localeCompare(String(b.deadline || ""));
}

function getVisibleAnalyses(monthId) {
  return state.data.analyseResultaten.filter((result) => {
    const inMonth = !monthId || result.maandPlanningId === monthId;
    return inMonth && !["vervallen", "gezien", "bewust_akkoord", "afgedekt"].includes(result.actieStatus);
  });
}

function getCoveredAnalyses(monthId) {
  return state.data.analyseResultaten.filter((result) => {
    const inMonth = !monthId || result.maandPlanningId === monthId;
    return inMonth && result.actieStatus === "afgedekt";
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

function isFamilyTemplateAvailableOnDate(template, dateValue) {
  if (!dateValue) return true;
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return true;
  return normalizeDutyWeekdays(template.beschikbareDagen).includes(String(date.getDay()));
}

function isDutyNameAvailableFor(dutyName, selectedPersonId, activeStage, selectedDate = "") {
  const personMatches = dutyName.persoonId === "beiden" || dutyName.persoonId === selectedPersonId;
  if (!personMatches) return false;
  const roundMatches = getPlanningStageIndex(activeStage) >= getPlanningStageIndex(dutyName.beschikbaarVanaf);
  if (!roundMatches) return false;
  return isDutyNameAvailableOnDate(dutyName, selectedDate);
}

function isDutyNameAvailableOnDate(dutyName, dateValue) {
  if (!dateValue) return true;
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return true;
  return normalizeDutyWeekdays(dutyName.beschikbareDagen).includes(String(date.getDay()));
}

function getPlanningStageIndex(stageValue) {
  const index = PLANNING_STAGES.findIndex((stage) => stage.value === stageValue);
  return index === -1 ? 0 : index;
}

function buildMonthDays(month) {
  const daysInMonth = new Date(month.jaar, month.maand, 0).getDate();
  const services = getMonthItems(month.id, "diensten");
  const familyBlocks = getMonthItems(month.id, "gezinsVerplichtingen");
  const wishes = getMonthItems(month.id, "wensen");
  const schoolEvents = getSchoolEventsForMonth(month);
  const analyses = getVisibleAnalyses(month.id);
  const coveredAnalyses = getCoveredAnalyses(month.id);
  const actions = getOpenActions(month.id);
  const closedActions = getClosedActions(month.id);
  const dutyProposals = getAiDutyProposalsForMonth(month.id);

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const date = `${month.id}-${String(day).padStart(2, "0")}`;
    return {
      date,
      services: services.filter((item) => item.datum === date),
      familyBlocks: familyBlocks.filter((item) => item.datum === date),
      wishes: wishes.filter((item) => item.datum === date),
      schoolEvents: schoolEvents.filter((item) => item.date === date),
      analyses: analyses.filter((item) => item.datum === date),
      coveredAnalyses: coveredAnalyses.filter((item) => item.datum === date),
      actions: actions.filter((item) => item.datum === date || item.deadline === date),
      closedActions: closedActions.filter((item) => item.datum === date || item.deadline === date),
      dutyProposals: dutyProposals.filter((item) => item.datum === date)
    };
  });
}

function getAiDutyProposalsForMonth(monthId) {
  return state.data.keuzeOpties.flatMap((advice) => {
    if (advice.type !== "ai_advies" || advice.maandPlanningId !== monthId || !Array.isArray(advice.opties)) return [];
    return advice.opties
      .map((option, index) => ({ advice, option, index }))
      .filter(({ option }) => option?.voorstel?.soort === "dienst")
      .map(({ advice, option, index }) => ({
        adviesId: advice.id,
        optieIndex: index,
        status: option.status || "open",
        tekst: option.tekst || "",
        aangemaaktOp: advice.aangemaaktOp || "",
        ...option.voorstel
      }));
  });
}

function addService(input) {
  const monthId = dateToMonthId(input.datum);
  if (state.editing?.type === "service") {
    updateService(state.editing.id, input);
    return;
  }

  if (!validateServiceDutyAvailability(input)) return;
  const travel = getServiceTravelInput(input);

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
    sleutelAkkoord: false,
    reistijdVoorMinuten: travel.reistijdVoorMinuten,
    reistijdNaMinuten: travel.reistijdNaMinuten,
    reisOpmerking: travel.reisOpmerking,
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

  if (!validateServiceDutyAvailability(input)) return;
  const travel = getServiceTravelInput(input);

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
    reistijdVoorMinuten: travel.reistijdVoorMinuten,
    reistijdNaMinuten: travel.reistijdNaMinuten,
    reisOpmerking: travel.reisOpmerking,
    opmerking: input.opmerking.trim()
  });

  finishItemMutation(previousMonthId, monthId, "dienst_bijgewerkt", input.datum);
}

function validateServiceDutyAvailability(input) {
  const dutyName = findDutyNameForServiceInput(input);
  if (!dutyName || isDutyNameAvailableOnDate(dutyName, input.datum)) return true;

  const message = `${dutyName.naam} is niet beschikbaar op ${formatLongDate(input.datum)}. Pas de datum aan of kies een andere dienst.`;
  window.alert(message);
  setSaveStatus("Dienst niet beschikbaar op deze dag", true);
  return false;
}

function getServiceTravelInput(input) {
  const dutyName = findDutyNameForServiceInput(input);
  const beforeInput = toPositiveNumber(input.reistijdVoorMinuten, 0);
  const afterInput = toPositiveNumber(input.reistijdNaMinuten, 0);
  return {
    reistijdVoorMinuten: beforeInput || toPositiveNumber(dutyName?.reistijdVoorMinuten, 0),
    reistijdNaMinuten: afterInput || toPositiveNumber(dutyName?.reistijdNaMinuten, 0),
    reisOpmerking: String(input.reisOpmerking || dutyName?.reisOpmerking || "").trim()
  };
}

function findDutyNameForServiceInput(input) {
  const code = String(input.dienstCode || "").trim().toLowerCase();
  if (!code) return null;
  const location = String(input.locatie || "").trim().toLowerCase();
  const activeMonth = getMonth(dateToMonthId(input.datum));
  const activeStage = activeMonth?.planningStage || state.data.instellingen.standaardPlanningStage;

  return getDutyNames().find((dutyName) => {
    const nameMatches = String(dutyName.naam || "").trim().toLowerCase() === code;
    if (!nameMatches) return false;
    const personMatches = dutyName.persoonId === "beiden" || dutyName.persoonId === input.persoonId;
    if (!personMatches) return false;
    const typeMatches = !input.dienstType || dutyName.dienstType === input.dienstType;
    if (!typeMatches) return false;
    const post = String(dutyName.post || dutyName.locatie || "").trim().toLowerCase();
    const locationMatches = !post || !location || post === location;
    if (!locationMatches) return false;
    return getPlanningStageIndex(activeStage) >= getPlanningStageIndex(dutyName.beschikbaarVanaf);
  }) || null;
}

function autoPlaceFamilyTemplatesForActiveMonth() {
  const monthId = state.data.instellingen.actieveMaandId;
  const month = monthId ? getMonth(monthId) : null;
  if (!month) {
    window.alert("Open eerst een maand. Daarna kunnen overige vaste gezinsmomenten automatisch worden geplaatst.");
    return;
  }

  const templates = getFamilyTemplates();
  if (!templates.length) {
    window.alert("Er zijn nog geen overige vaste gezinsmomenten ingesteld in Beheer.");
    return;
  }

  const { added, skipped, firstDate } = placeFamilyTemplatesInMonth(month);

  if (!added) {
    window.alert(`Geen nieuwe overige gezinsmomenten toegevoegd. ${skipped} moment(en) stonden al in ${getMonthLabel(month.id)}.`);
    return;
  }

  state.selectedDate = firstDate || `${month.id}-01`;
  runAnalysis(month.id);
  saveData("overige_gezinsmomenten_automatisch_geplaatst");
  window.alert(`${added} overige gezinsmoment(en) toegevoegd aan ${getMonthLabel(month.id)}. ${skipped} bestaande moment(en) overgeslagen.`);
  showView("cockpit");
}

function placeFamilyTemplatesInMonth(month) {
  const templates = getFamilyTemplates();
  const dates = getMonthDateValues(month);
  let added = 0;
  let skipped = 0;
  let firstDate = "";

  templates.forEach((template) => {
    dates.forEach((date) => {
      if (!isFamilyTemplateAvailableOnDate(template, date)) return;
      const familyBlock = createFamilyBlockFromTemplate(template, date, month.id);
      if (familyBlockExists(familyBlock)) {
        skipped += 1;
        return;
      }
      state.data.gezinsVerplichtingen.push(familyBlock);
      added += 1;
      if (!firstDate) firstDate = date;
    });
  });

  return { added, skipped, firstDate };
}

function getMonthDateValues(month) {
  const daysInMonth = new Date(month.jaar, month.maand, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => {
    return `${month.id}-${String(index + 1).padStart(2, "0")}`;
  });
}

function createFamilyBlockFromTemplate(template, date, monthId) {
  return {
    id: generateId("gezin"),
    maandPlanningId: monthId,
    type: template.type,
    kindId: "",
    datum: date,
    start: template.start,
    einde: template.einde,
    hardheid: template.hardheid,
    dekkingNodig: Boolean(template.dekkingNodig),
    opmerking: template.opmerking || template.naam,
    sourceTemplateId: template.id
  };
}

function familyBlockExists(candidate) {
  return state.data.gezinsVerplichtingen.some((block) => {
    if (block.maandPlanningId !== candidate.maandPlanningId || block.datum !== candidate.datum) return false;
    if (block.sourceTemplateId && block.sourceTemplateId === candidate.sourceTemplateId) return true;
    return block.type === candidate.type &&
      block.start === candidate.start &&
      block.einde === candidate.einde &&
      String(block.opmerking || "").trim().toLowerCase() === String(candidate.opmerking || "").trim().toLowerCase();
  });
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

function rerunMonthControl(monthId) {
  if (!getMonth(monthId)) return;
  runAnalysis(monthId);
  saveData("controle_opnieuw_uitgevoerd");
  renderApp();
}
