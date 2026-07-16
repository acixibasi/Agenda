"use strict";

function renderSettingsPanel() {
  const panel = document.getElementById("settings-panel");
  if (!panel) return;
  const dutyNames = getDutyNames();
  const familyTemplates = getFamilyTemplates();
  const wishTemplates = getWishTemplates();
  const contractHours = getContractHours();
  const children = getChildren();
  const rosterIcalUrls = getRosterIcalUrls();
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
      <p class="eyebrow">Gepubliceerd rooster</p>
      <div class="storage-list">
        ${Object.keys(PERSON_LABELS).map((personId) => `
          <div class="storage-row">
            <span>${escapeHtml(getPersonLabel(personId))} iCal</span>
            <strong>${rosterIcalUrls[personId] ? "ingesteld" : "niet ingesteld"}</strong>
          </div>
        `).join("")}
      </div>
      <form id="roster-ical-url-form" class="duty-name-form settings-duty-form">
        ${Object.keys(PERSON_LABELS).map((personId) => `
          <label class="full-width">
            iCal-link ${escapeHtml(getPersonLabel(personId))}
            <input name="${escapeHtml(personId)}" type="text" value="${escapeHtml(rosterIcalUrls[personId] || "")}" placeholder="webcal://... of https://.../rooster.ics">
          </label>
        `).join("")}
        <div class="form-actions full-width">
          <button type="submit">Rooster-iCal links opslaan</button>
          <button type="button" class="subtle-button" data-import-roster-ical-urls>Rooster-iCal links inlezen</button>
        </div>
        <div class="form-actions full-width">
          ${Object.keys(PERSON_LABELS).map((personId) => `
            <label class="file-button subtle-file-button">
              iCal-bestand ${escapeHtml(getPersonLabel(personId))}
              <input type="file" accept=".ics,.ical,text/calendar" data-roster-ical-file="${escapeHtml(personId)}">
            </label>
          `).join("")}
        </div>
        <p class="muted-text full-width">Deze links zijn bedoeld voor het gepubliceerde R4-rooster. Import slaat diensten op als aparte R4-laag en overschrijft je R2/R3-keuzes niet.</p>
      </form>
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
        <div class="settings-tile"><strong>app.js</strong><span>App-start, hoofdweergaven en events</span></div>
        <div class="settings-tile"><strong>settings.js</strong><span>Beheer, dienstkeuzes, voorkeuren en schoolinstellingen</span></div>
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
      <label>
        Reistijd vóór dienst
        <input name="reistijdVoorMinuten" type="number" min="0" step="5" value="${escapeHtml(dutyName.reistijdVoorMinuten || 0)}">
      </label>
      <label>
        Reistijd na dienst
        <input name="reistijdNaMinuten" type="number" min="0" step="5" value="${escapeHtml(dutyName.reistijdNaMinuten || 0)}">
      </label>
      <label class="full-width">
        Reisopmerking
        <textarea name="reisOpmerking" placeholder="Bijv. ochtendspits richting post duurt vaak langer">${escapeHtml(dutyName.reisOpmerking || "")}</textarea>
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

function renderWeekdayCheckboxes(selectedDays = null, inputName = "beschikbareDagen", defaultAll = true) {
  const selected = new Set(defaultAll ? normalizeDutyWeekdays(selectedDays) : normalizeExplicitWeekdays(selectedDays));
  return WEEKDAY_OPTIONS.map((day) => `
    <label class="checkbox-label">
      <input name="${escapeHtml(inputName)}" type="checkbox" value="${escapeHtml(day.value)}"${selected.has(day.value) ? " checked" : ""}>
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
        <input name="naam" type="text" value="${escapeHtml(template.naam || "")}" placeholder="Bijv. Marjolein weekend beschermen" required>
      </label>
      <label>
        Hardheid
        <select name="hardheid" required>
          ${renderOptions(Object.keys(WISH_TEMPLATE_STRENGTH), WISH_TEMPLATE_STRENGTH, template.hardheid || "normaal")}
        </select>
      </label>
      <label>
        Voor wie geldt dit?
        <input name="voorWieTekst" type="text" value="${escapeHtml(template.voorWieTekst || WISH_TEMPLATE_SCOPE[template.scope] || "")}" placeholder="Bijv. Ronald, Eva, gezin, Ronald en Marjolein">
      </label>
      <label>
        Actief
        <select name="actief" required>
          <option value="true"${selectedAttr(String(template.actief ?? true), "true")}>Ja</option>
          <option value="false"${selectedAttr(String(template.actief ?? true), "false")}>Nee</option>
        </select>
      </label>
      <label class="full-width">
        Kernzin
        <textarea name="kernzin" placeholder="Wat wil je dat het systeem onthoudt? Bijv. Als Marjolein bij ons is, werkt Ronald niet.">${escapeHtml(template.kernzin || "")}</textarea>
      </label>
      <label class="full-width">
        Wanneer speelt dit?
        <textarea name="wanneerTekst" placeholder="Bijv. weekend waarin Marjolein bij ons is, na een nachtdienst, schooldagen, vrijdagavond">${escapeHtml(template.wanneerTekst || WISH_TEMPLATE_TIMING[template.timing] || "")}</textarea>
      </label>
      <fieldset class="full-width">
        <legend>Tijdblok</legend>
        <div class="weekday-grid">
          ${renderWeekdayCheckboxes(template.tijdblokDagen, "tijdblokDagen", false)}
        </div>
        <div class="form-grid-compact">
          <label>
            Start
            <input name="tijdblokStart" type="time" value="${escapeHtml(template.tijdblokStart || "")}">
          </label>
          <label>
            Einde
            <input name="tijdblokEinde" type="time" value="${escapeHtml(template.tijdblokEinde || "")}">
          </label>
        </div>
      </fieldset>
      <label class="full-width">
        Wat moet vermeden worden?
        <textarea name="vermijdTekst" placeholder="Bijv. diensten tijdens haar verblijf, vroege dienst na late dienst, spitsdiensten">${escapeHtml(template.vermijdTekst || "")}</textarea>
      </label>
      <label class="full-width">
        Wat mag juist wel?
        <textarea name="magWelTekst" placeholder="Bijv. nachtdienst na vertrek zaterdag of zondag, dienst als Eva thuis is">${escapeHtml(template.magWelTekst || "")}</textarea>
      </label>
      <label class="full-width">
        Toelichting
        <textarea name="beschrijving" placeholder="Extra nuance, uitzonderingen of reden. Dit is vrije tekst voor later AI-advies.">${escapeHtml(template.beschrijving || "")}</textarea>
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
    WISH_TEMPLATE_STRENGTH[template.hardheid] || formatCodeLabel(template.hardheid),
    template.voorWieTekst || WISH_TEMPLATE_SCOPE[template.scope] || "",
    template.wanneerTekst || WISH_TEMPLATE_TIMING[template.timing] || "",
    getWishTemplateTimeBlockLabel(template),
    template.actief ? "actief" : "uit"
  ].filter(Boolean).join(" - ");
}

function getWishTemplateTimeBlockLabel(template) {
  if (!isCompleteWishTemplateTimeBlock(template)) return "";
  return `${getDutyWeekdayLabel(template.tijdblokDagen)} ${formatTimeRange(template.tijdblokStart, template.tijdblokEinde)}`;
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
    formatTimeRange(dutyName.start, dutyName.einde),
    getDutyTravelLabel(dutyName)
  ].filter(Boolean);
  return parts.join(" - ");
}

function getRosterIcalUrls() {
  state.data.instellingen.roosterIcalUrls = normalizeRosterIcalUrls(state.data.instellingen.roosterIcalUrls);
  return state.data.instellingen.roosterIcalUrls;
}

function saveRosterIcalUrls(input) {
  state.data.instellingen.roosterIcalUrls = normalizeRosterIcalUrls(input);
  saveData("rooster_ical_links_opgeslagen");
  renderSettingsPanel();
}

function getDutyTravelLabel(dutyName) {
  const before = toPositiveNumber(dutyName.reistijdVoorMinuten, 0);
  const after = toPositiveNumber(dutyName.reistijdNaMinuten, 0);
  if (!before && !after) return "";
  return `reis ${before}/${after} min`;
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
  const select = form?.elements.dienstNaamId || null;
  const buttons = Array.from(document.querySelectorAll("[data-apply-duty-name]"));
  const options = select ? Array.from(select.options).filter((option) => option.value) : [];
  let visibleCount = 0;

  buttons.forEach((button) => {
    const dutyName = getDutyNames().find((item) => item.id === button.dataset.applyDutyName);
    const visible = dutyName && isDutyNameAvailableFor(dutyName, selectedPersonId, activeStage, selectedDate);
    button.hidden = !visible;
    if (visible) visibleCount += 1;
  });

  options.forEach((option) => {
    const dutyName = getDutyNames().find((item) => item.id === option.value);
    const visible = dutyName && isDutyNameAvailableFor(dutyName, selectedPersonId, activeStage, selectedDate);
    option.hidden = !visible;
    option.disabled = !visible;
    if (visible && !buttons.length) visibleCount += 1;
  });

  if (select && select.value) {
    const selectedDutyName = getDutyNames().find((item) => item.id === select.value);
    if (!selectedDutyName || !isDutyNameAvailableFor(selectedDutyName, selectedPersonId, activeStage, selectedDate)) {
      select.value = "";
      clearDutyNameFields(form);
    }
  }

  const emptyMessage = document.querySelector("[data-duty-empty-message]");
  if (emptyMessage) emptyMessage.hidden = visibleCount > 0;
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
    categorie: "overig",
    scope: inferWishTemplateScope(input.voorWieTekst),
    hardheid: WISH_TEMPLATE_STRENGTH[input.hardheid] ? input.hardheid : "normaal",
    timing: inferWishTemplateTiming(input.wanneerTekst),
    kernzin: String(input.kernzin || "").trim(),
    wanneerTekst: String(input.wanneerTekst || "").trim(),
    voorWieTekst: String(input.voorWieTekst || "").trim(),
    vermijdTekst: String(input.vermijdTekst || "").trim(),
    magWelTekst: String(input.magWelTekst || "").trim(),
    beschrijving: String(input.beschrijving || "").trim(),
    tijdblokDagen: normalizeExplicitWeekdays(getFormArrayValue(input.tijdblokDagen)),
    tijdblokStart: normalizeTimeInput(input.tijdblokStart),
    tijdblokEinde: normalizeTimeInput(input.tijdblokEinde),
    actief: input.actief !== "false"
  };
  if (!isCompleteWishTemplateTimeBlock(template)) {
    template.tijdblokDagen = [];
    template.tijdblokStart = "";
    template.tijdblokEinde = "";
  }

  if (!template.naam || !template.kernzin) return;

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
    String(template.kernzin || "").trim().toLowerCase(),
    String(template.voorWieTekst || "").trim().toLowerCase(),
    String(template.wanneerTekst || "").trim().toLowerCase(),
    normalizeExplicitWeekdays(template.tijdblokDagen).join(","),
    String(template.tijdblokStart || ""),
    String(template.tijdblokEinde || "")
  ].join("|");
}

function inferWishTemplateScope(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("ronald") && text.includes("eva")) return "beiden";
  if (text.includes("ronald")) return "persoon_jij";
  if (text.includes("eva")) return "persoon_vrouw";
  if (text.includes("gezin") || text.includes("kind") || text.includes("marjolein")) return "gezin";
  return "gezin";
}

function inferWishTemplateTiming(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("nacht")) return "na_nachtdienst";
  if (text.includes("weekend") || text.includes("zaterdag") || text.includes("zondag")) return "weekend";
  if (text.includes("school")) return "schooldag";
  if (text.includes("spits") || text.includes("file")) return "spits";
  if (text.includes("weekdag") || text.includes("maandag") || text.includes("dinsdag") || text.includes("woensdag") || text.includes("donderdag") || text.includes("vrijdag")) return "weekdag";
  return "hele_maand";
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
    reistijdVoorMinuten: toPositiveNumber(input.reistijdVoorMinuten, 0),
    reistijdNaMinuten: toPositiveNumber(input.reistijdNaMinuten, 0),
    reisOpmerking: String(input.reisOpmerking || "").trim(),
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
  if (form.elements.dienstNaamId) {
    form.elements.dienstNaamId.value = dutyName.id;
  }
  form.elements.dienstCode.value = dutyName.naam;
  form.elements.dienstType.value = dutyName.dienstType;
  form.elements.start.value = dutyName.start;
  form.elements.einde.value = dutyName.einde;
  form.elements.reistijdVoorMinuten.value = dutyName.reistijdVoorMinuten || 0;
  form.elements.reistijdNaMinuten.value = dutyName.reistijdNaMinuten || 0;
  form.elements.reisOpmerking.value = dutyName.reisOpmerking || "";
  if (dutyName.post || dutyName.locatie) {
    form.elements.locatie.value = dutyName.post || dutyName.locatie;
  }
  updateDutyNameVisibility();
}

function clearDutyNameFields(form) {
  if (!form) return;
  form.elements.dienstCode.value = "";
  form.elements.dienstType.value = "";
  form.elements.start.value = "";
  form.elements.einde.value = "";
  form.elements.locatie.value = "";
  form.elements.reistijdVoorMinuten.value = "0";
  form.elements.reistijdNaMinuten.value = "0";
  form.elements.reisOpmerking.value = "";
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
