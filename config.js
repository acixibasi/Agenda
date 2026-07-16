"use strict";

const APP_VERSION = "0.1.84-lokaal";
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
  persoon_jij: "Ronald",
  persoon_vrouw: "Eva"
};

const DUTY_PERSON_OPTIONS = {
  persoon_jij: "Ronald",
  persoon_vrouw: "Eva",
  beiden: "Beiden"
};

const CONTRACT_HOURS = {
  persoon_jij: { weeklyHours: 31.5, monthlyToleranceHours: 9 },
  persoon_vrouw: { weeklyHours: 27, monthlyToleranceHours: 9 }
};

const DEFAULT_TRAVEL_MINUTES = 60;

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

const INSTRUCTION_DUTY_CODES = ["roc9"];

function isInstructionDutySummary(value) {
  const tokens = String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return tokens.some((token) => INSTRUCTION_DUTY_CODES.includes(token));
}

const WEEKDAY_OPTIONS = [
  { value: "1", label: "Ma" },
  { value: "2", label: "Di" },
  { value: "3", label: "Wo" },
  { value: "4", label: "Do" },
  { value: "5", label: "Vr" },
  { value: "6", label: "Za" },
  { value: "0", label: "Zo" }
];

const DEFAULT_DUTY_NAMES = [
  { id: "dienstnaam_vroeg", naam: "Vroeg", persoonId: "persoon_jij", beschikbaarVanaf: "R1_wensen", post: "", dienstType: "vroeg", start: "07:00", einde: "15:00", locatie: "", reistijdVoorMinuten: DEFAULT_TRAVEL_MINUTES, reistijdNaMinuten: DEFAULT_TRAVEL_MINUTES, reisOpmerking: "" },
  { id: "dienstnaam_dag", naam: "Dag", persoonId: "persoon_jij", beschikbaarVanaf: "R1_wensen", post: "", dienstType: "dag", start: "08:00", einde: "16:00", locatie: "", reistijdVoorMinuten: DEFAULT_TRAVEL_MINUTES, reistijdNaMinuten: DEFAULT_TRAVEL_MINUTES, reisOpmerking: "" },
  { id: "dienstnaam_laat", naam: "Laat", persoonId: "persoon_jij", beschikbaarVanaf: "R1_wensen", post: "", dienstType: "laat", start: "14:00", einde: "22:00", locatie: "", reistijdVoorMinuten: DEFAULT_TRAVEL_MINUTES, reistijdNaMinuten: DEFAULT_TRAVEL_MINUTES, reisOpmerking: "" },
  { id: "dienstnaam_nacht", naam: "Nacht", persoonId: "persoon_jij", beschikbaarVanaf: "R2_afstemming", post: "", dienstType: "nacht", start: "22:00", einde: "07:00", locatie: "", reistijdVoorMinuten: DEFAULT_TRAVEL_MINUTES, reistijdNaMinuten: DEFAULT_TRAVEL_MINUTES, reisOpmerking: "" },
  { id: "dienstnaam_eva_0700_1600b_noord", naam: "0700-1600B Noord", persoonId: "persoon_vrouw", beschikbaarVanaf: "R1_wensen", post: "Noord", dienstType: "dag", start: "07:00", einde: "16:00", locatie: "Noord", reistijdVoorMinuten: DEFAULT_TRAVEL_MINUTES, reistijdNaMinuten: DEFAULT_TRAVEL_MINUTES, reisOpmerking: "" },
  { id: "dienstnaam_eva_0800_1700a_noord", naam: "0800-1700A Noord", persoonId: "persoon_vrouw", beschikbaarVanaf: "R1_wensen", post: "Noord", dienstType: "dag", start: "08:00", einde: "17:00", locatie: "Noord", reistijdVoorMinuten: DEFAULT_TRAVEL_MINUTES, reistijdNaMinuten: DEFAULT_TRAVEL_MINUTES, reisOpmerking: "" },
  { id: "dienstnaam_eva_1400_2300a_noord", naam: "1400-2300A Noord", persoonId: "persoon_vrouw", beschikbaarVanaf: "R1_wensen", post: "Noord", dienstType: "laat", start: "14:00", einde: "23:00", locatie: "Noord", reistijdVoorMinuten: DEFAULT_TRAVEL_MINUTES, reistijdNaMinuten: DEFAULT_TRAVEL_MINUTES, reisOpmerking: "" },
  { id: "dienstnaam_eva_1400_2300b_noord", naam: "1400-2300B Noord", persoonId: "persoon_vrouw", beschikbaarVanaf: "R1_wensen", post: "Noord", dienstType: "laat", start: "14:00", einde: "23:00", locatie: "Noord", reistijdVoorMinuten: DEFAULT_TRAVEL_MINUTES, reistijdNaMinuten: DEFAULT_TRAVEL_MINUTES, reisOpmerking: "" },
  { id: "dienstnaam_eva_1500_2400a_noord", naam: "1500-2400A Noord", persoonId: "persoon_vrouw", beschikbaarVanaf: "R1_wensen", post: "Noord", dienstType: "nacht", start: "15:00", einde: "00:00", locatie: "Noord", reistijdVoorMinuten: DEFAULT_TRAVEL_MINUTES, reistijdNaMinuten: DEFAULT_TRAVEL_MINUTES, reisOpmerking: "Eindtijd 24:00 opgeslagen als 00:00." },
  { id: "dienstnaam_eva_2200_0700a_noord", naam: "2200-0700A Noord", persoonId: "persoon_vrouw", beschikbaarVanaf: "R1_wensen", post: "Noord", dienstType: "nacht", start: "22:00", einde: "07:00", locatie: "Noord", reistijdVoorMinuten: DEFAULT_TRAVEL_MINUTES, reistijdNaMinuten: DEFAULT_TRAVEL_MINUTES, reisOpmerking: "" },
  { id: "dienstnaam_eva_2230_0730a_noord", naam: "2230-0730A Noord", persoonId: "persoon_vrouw", beschikbaarVanaf: "R1_wensen", post: "Noord", dienstType: "nacht", start: "22:30", einde: "07:30", locatie: "Noord", reistijdVoorMinuten: DEFAULT_TRAVEL_MINUTES, reistijdNaMinuten: DEFAULT_TRAVEL_MINUTES, reisOpmerking: "" },
  { id: "dienstnaam_ronald_0700_1600a_oost", naam: "0700-1600A Oost", persoonId: "persoon_jij", beschikbaarVanaf: "R2_afstemming", post: "Oost", dienstType: "dag", start: "07:00", einde: "16:00", locatie: "Oost", beschikbareDagen: ["1", "2", "3", "4", "5", "6", "0"], reistijdVoorMinuten: DEFAULT_TRAVEL_MINUTES, reistijdNaMinuten: DEFAULT_TRAVEL_MINUTES, reisOpmerking: "" },
  { id: "dienstnaam_ronald_0730_1630a_oost", naam: "0730-1630A Oost", persoonId: "persoon_jij", beschikbaarVanaf: "R2_afstemming", post: "Oost", dienstType: "dag", start: "07:30", einde: "16:30", locatie: "Oost", beschikbareDagen: ["1", "2", "3", "4", "5", "6", "0"], reistijdVoorMinuten: DEFAULT_TRAVEL_MINUTES, reistijdNaMinuten: DEFAULT_TRAVEL_MINUTES, reisOpmerking: "" },
  { id: "dienstnaam_ronald_0800_1700a_oost", naam: "0800-1700A Oost", persoonId: "persoon_jij", beschikbaarVanaf: "R2_afstemming", post: "Oost", dienstType: "dag", start: "08:00", einde: "17:00", locatie: "Oost", beschikbareDagen: ["1", "2", "3", "4", "5"], reistijdVoorMinuten: DEFAULT_TRAVEL_MINUTES, reistijdNaMinuten: DEFAULT_TRAVEL_MINUTES, reisOpmerking: "" },
  { id: "dienstnaam_ronald_0830_1730a_oost", naam: "0830-1730A Oost", persoonId: "persoon_jij", beschikbaarVanaf: "R2_afstemming", post: "Oost", dienstType: "dag", start: "08:30", einde: "17:30", locatie: "Oost", beschikbareDagen: ["1", "2", "3", "4", "5"], reistijdVoorMinuten: DEFAULT_TRAVEL_MINUTES, reistijdNaMinuten: DEFAULT_TRAVEL_MINUTES, reisOpmerking: "" },
  { id: "dienstnaam_ronald_0900_1800a_oost", naam: "0900-1800A Oost", persoonId: "persoon_jij", beschikbaarVanaf: "R2_afstemming", post: "Oost", dienstType: "dag", start: "09:00", einde: "18:00", locatie: "Oost", beschikbareDagen: ["6", "0"], reistijdVoorMinuten: DEFAULT_TRAVEL_MINUTES, reistijdNaMinuten: DEFAULT_TRAVEL_MINUTES, reisOpmerking: "" },
  { id: "dienstnaam_ronald_1400_2300a_oost", naam: "1400-2300A Oost", persoonId: "persoon_jij", beschikbaarVanaf: "R2_afstemming", post: "Oost", dienstType: "laat", start: "14:00", einde: "23:00", locatie: "Oost", beschikbareDagen: ["1", "2", "3", "4", "5", "6", "0"], reistijdVoorMinuten: DEFAULT_TRAVEL_MINUTES, reistijdNaMinuten: DEFAULT_TRAVEL_MINUTES, reisOpmerking: "" },
  { id: "dienstnaam_ronald_1430_2330a_oost", naam: "1430-2330A Oost", persoonId: "persoon_jij", beschikbaarVanaf: "R2_afstemming", post: "Oost", dienstType: "laat", start: "14:30", einde: "23:30", locatie: "Oost", beschikbareDagen: ["1", "2", "5", "6", "0"], reistijdVoorMinuten: DEFAULT_TRAVEL_MINUTES, reistijdNaMinuten: DEFAULT_TRAVEL_MINUTES, reisOpmerking: "" },
  { id: "dienstnaam_ronald_1300_2200a_oost", naam: "1300-2200A Oost", persoonId: "persoon_jij", beschikbaarVanaf: "R2_afstemming", post: "Oost", dienstType: "laat", start: "13:00", einde: "22:00", locatie: "Oost", beschikbareDagen: ["2", "3"], reistijdVoorMinuten: DEFAULT_TRAVEL_MINUTES, reistijdNaMinuten: DEFAULT_TRAVEL_MINUTES, reisOpmerking: "" },
  { id: "dienstnaam_ronald_1500_2400a_oost", naam: "1500-2400A Oost", persoonId: "persoon_jij", beschikbaarVanaf: "R2_afstemming", post: "Oost", dienstType: "nacht", start: "15:00", einde: "00:00", locatie: "Oost", beschikbareDagen: ["1", "2", "3", "4", "5", "6", "0"], reistijdVoorMinuten: DEFAULT_TRAVEL_MINUTES, reistijdNaMinuten: DEFAULT_TRAVEL_MINUTES, reisOpmerking: "Eindtijd 24:00 opgeslagen als 00:00." },
  { id: "dienstnaam_ronald_2200_0700a_oost", naam: "2200-0700A Oost", persoonId: "persoon_jij", beschikbaarVanaf: "R2_afstemming", post: "Oost", dienstType: "nacht", start: "22:00", einde: "07:00", locatie: "Oost", beschikbareDagen: ["1", "2", "3", "4", "5", "6", "0"], reistijdVoorMinuten: DEFAULT_TRAVEL_MINUTES, reistijdNaMinuten: DEFAULT_TRAVEL_MINUTES, reisOpmerking: "" },
  { id: "dienstnaam_ronald_2200_0700b_oost", naam: "2200-0700B Oost", persoonId: "persoon_jij", beschikbaarVanaf: "R2_afstemming", post: "Oost", dienstType: "nacht", start: "22:00", einde: "07:00", locatie: "Oost", beschikbareDagen: ["5"], reistijdVoorMinuten: DEFAULT_TRAVEL_MINUTES, reistijdNaMinuten: DEFAULT_TRAVEL_MINUTES, reisOpmerking: "" },
  { id: "dienstnaam_ronald_2230_0730a_oost", naam: "2230-0730A Oost", persoonId: "persoon_jij", beschikbaarVanaf: "R2_afstemming", post: "Oost", dienstType: "nacht", start: "22:30", einde: "07:30", locatie: "Oost", beschikbareDagen: ["1", "2", "3", "4", "5", "6", "0"], reistijdVoorMinuten: DEFAULT_TRAVEL_MINUTES, reistijdNaMinuten: DEFAULT_TRAVEL_MINUTES, reisOpmerking: "" }
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
  "opvang",
  "oppas",
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

const WISH_TEMPLATE_CATEGORIES = {
  samen_vrij: "Samen vrij",
  minder_file: "Minder file",
  herstel: "Herstel/rust",
  schooldag_ontlasten: "Schooldag ontlasten",
  weekend_beschermen: "Weekend beschermen",
  diensttype_voorkeur: "Diensttype voorkeur",
  niet_beschikbaar: "Niet beschikbaar",
  overig: "Overig"
};

const WISH_TEMPLATE_SCOPE = {
  persoon_jij: "Ronald",
  persoon_vrouw: "Eva",
  beiden: "Beiden",
  gezin: "Gezin"
};

const WISH_TEMPLATE_STRENGTH = {
  hard: "Hard",
  sterk: "Sterk",
  normaal: "Normaal",
  zacht: "Zacht"
};

const WISH_TEMPLATE_TIMING = {
  hele_maand: "Hele maand",
  weekdag: "Weekdag",
  weekend: "Weekend",
  schooldag: "Schooldag",
  na_nachtdienst: "Na nachtdienst",
  spits: "Spits/reistijd"
};

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
