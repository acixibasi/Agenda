"use strict";

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
