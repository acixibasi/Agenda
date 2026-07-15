"use strict";

const APP_VERSION = "0.1.33-lokaal";
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
  { id: "dienstnaam_vroeg", naam: "Vroeg", persoonId: "persoon_jij", beschikbaarVanaf: "R1_wensen", post: "", dienstType: "vroeg", start: "07:00", einde: "15:00", locatie: "" },
  { id: "dienstnaam_dag", naam: "Dag", persoonId: "persoon_jij", beschikbaarVanaf: "R1_wensen", post: "", dienstType: "dag", start: "08:00", einde: "16:00", locatie: "" },
  { id: "dienstnaam_laat", naam: "Laat", persoonId: "persoon_jij", beschikbaarVanaf: "R1_wensen", post: "", dienstType: "laat", start: "14:00", einde: "22:00", locatie: "" },
  { id: "dienstnaam_nacht", naam: "Nacht", persoonId: "persoon_jij", beschikbaarVanaf: "R2_afstemming", post: "", dienstType: "nacht", start: "22:00", einde: "07:00", locatie: "" }
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
