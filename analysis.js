"use strict";

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
    familyBlocks: [
      ...getMonthItems(monthId, "gezinsVerplichtingen"),
      ...getSchoolCoverageBlocksForMonth(getMonth(monthId))
    ],
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
      melding: "Er zijn nog geen school- of overige dekkingsmomenten ingevoerd",
      advies: "Vul school brengen/halen in via Schoolbeheer en overige gezinsafspraken via Gezin overig.",
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
    const label = getCoverageBlockLabel(block);
    results.push(createAnalysisResult({
      monthId: context.monthId,
      datum: block.datum,
      ernst: "aandacht",
      categorie: "gegevens",
      regelId: "regel_gezinstijd_controleren",
      betrokkenDienstIds: [],
      betrokkenGezinsVerplichtingId: block.id,
      melding: `${label} heeft een onduidelijke tijd op ${formatLongDate(block.datum)}`,
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
        return serviceBusyOverlapsBlock(service, block);
      });
      const busyParents = new Set(overlappingServices.map((service) => service.persoonId));
      const bothParentsBusy = busyParents.has("persoon_jij") && busyParents.has("persoon_vrouw");

      if (!bothParentsBusy) return;

      const isSchoolCoverage = isSchoolCoverageBlock(block);
      const label = getCoverageBlockLabel(block);
      results.push(createAnalysisResult({
        monthId: context.monthId,
        datum: block.datum,
        ernst: "conflict",
        categorie: isSchoolCoverage ? "school" : "gezin",
        regelId: "regel_kinddekking",
        betrokkenDienstIds: overlappingServices.map((service) => service.id),
        betrokkenGezinsVerplichtingId: block.id,
        melding: `${label} op ${formatLongDate(block.datum)} is ongedekt`,
        advies: isSchoolCoverage
          ? "Regel schooldekking of pas de dienst/schoolinstelling aan."
          : "Regel dekking of pas de dienst/overige gezinsafspraak aan.",
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
        if (!serviceBusyWindowsOverlap(jijService, vrouwService)) return;

        const hasCoverageConflict = context.familyBlocks.some((block) => {
          return block.dekkingNodig &&
            block.datum === date &&
            serviceBusyOverlapsBlock(jijService, block) &&
            serviceBusyOverlapsBlock(vrouwService, block);
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
          advies: "Controleer of er op dat moment schooldekking of overige gezinsdekking nodig is.",
          signature: `beide_ouders_${jijService.id}_${vrouwService.id}`
        }));
      });
    });
  });

  return results;
}

function serviceBusyOverlapsBlock(service, block) {
  const serviceStart = serviceBusyDateTime(service, "start");
  const serviceEnd = serviceBusyDateTime(service, "end");
  const blockStart = blockDateTime(block, "start");
  const blockEnd = blockDateTime(block, "end");
  return dateWindowsOverlap(serviceStart, serviceEnd, blockStart, blockEnd);
}

function serviceBusyWindowsOverlap(firstService, secondService) {
  return dateWindowsOverlap(
    serviceBusyDateTime(firstService, "start"),
    serviceBusyDateTime(firstService, "end"),
    serviceBusyDateTime(secondService, "start"),
    serviceBusyDateTime(secondService, "end")
  );
}

function blockDateTime(block, point) {
  const time = point === "end" ? block.einde : block.start;
  const minutes = timeToMinutes(time);
  if (!block.datum || minutes === null) return null;
  const date = new Date(`${block.datum}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setMinutes(minutes);
  if (point === "end" && timeToMinutes(block.einde) <= timeToMinutes(block.start)) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

function dateWindowsOverlap(aStart, aEnd, bStart, bEnd) {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart < bEnd && bStart < aEnd;
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

function isSchoolCoverageBlock(block) {
  return Boolean(block.sourceSchoolEventId || ["school_brengen", "school_halen"].includes(block.type));
}

function getCoverageBlockLabel(block) {
  if (block.type === "school_brengen") return "School brengen";
  if (block.type === "school_halen") return "School halen";
  if (isSchoolCoverageBlock(block)) return "Schoolmoment";
  return `Overige gezinsafspraak ${formatCodeLabel(block.type || "afspraak")}`;
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
