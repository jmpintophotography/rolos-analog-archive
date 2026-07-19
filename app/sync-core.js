export const SYNC_SCHEMA_VERSION = 3;
export const WEEKLY_BACKUP_LIMIT = 54;
export const RECOVERY_BACKUP_LIMIT = 10;

export function requiresSyncSchemaUpgrade(record, targetVersion = SYNC_SCHEMA_VERSION) {
  if (!record?.payload) return false;
  return positiveInteger(record.schemaVersion) < targetVersion
    || positiveInteger(record.payload?.meta?.syncSchemaVersion) < targetVersion;
}

export function stateFingerprint(state = {}) {
  const relevantData = {
    rolls: Array.isArray(state.rolls) ? state.rolls : [],
    stock: Array.isArray(state.stock) ? state.stock : [],
    equipment: Array.isArray(state.equipment) ? state.equipment : [],
    filmImages: state.filmImages && typeof state.filmImages === "object" ? state.filmImages : {},
    support: state.support && typeof state.support === "object" ? state.support : {},
    workflow: state.workflow && typeof state.workflow === "object" ? state.workflow : {},
  };
  return dualHash(canonicalStringify(relevantData));
}

export function chooseSyncAction(localState, cloudRecord) {
  if (!cloudRecord?.payload) return "push";

  const localHash = stateFingerprint(localState);
  const cloudHash = cloudRecord.contentHash || stateFingerprint(cloudRecord.payload);
  const remoteRevision = positiveInteger(cloudRecord.revision);
  const localRevision = positiveInteger(localState?.meta?.cloudRevision);
  const pending = Boolean(localState?.meta?.cloudBackupPending);

  if (localHash === cloudHash) {
    return remoteRevision > 0 ? "same" : "migrate";
  }

  if (remoteRevision === 0 && localRevision === 0) {
    return pending ? "recover-pull" : "pull";
  }

  if (remoteRevision > localRevision) {
    return pending ? "recover-pull" : "pull";
  }

  if (remoteRevision === localRevision) {
    if (pending) return "push";
    return "pull";
  }

  return pending ? "push" : "recover-pull";
}

export function evaluateCloudWrite(input = {}) {
  const remoteRevision = positiveInteger(input.remoteRevision);
  const expectedRevision = positiveInteger(input.expectedRevision);
  const remoteHash = String(input.remoteHash || "");
  const localHash = String(input.localHash || "");
  const legacyMatchesExpected = remoteRevision === 0
    && expectedRevision === 0
    && input.legacyExpectedHash === localHash
    && String(input.legacyExpectedUpdatedAt || "") === String(input.remoteUpdatedAt || "");
  const staleRevision = remoteRevision > expectedRevision && remoteHash !== localHash;
  const unknownLegacyChange = Boolean(input.remoteExists)
    && remoteRevision === 0
    && expectedRevision === 0
    && remoteHash !== localHash
    && !legacyMatchesExpected;
  return {
    conflict: staleRevision || unknownLegacyChange,
    nextRevision: Math.max(remoteRevision, expectedRevision) + 1,
  };
}

export function shouldReplaceWeeklyBackup(existingRevision, candidateRevision) {
  return positiveInteger(candidateRevision) >= positiveInteger(existingRevision);
}

export function isoWeekKey(value = new Date()) {
  const source = value instanceof Date ? value : new Date(value);
  const localDate = new Date(Date.UTC(source.getFullYear(), source.getMonth(), source.getDate()));
  const day = localDate.getUTCDay() || 7;
  localDate.setUTCDate(localDate.getUTCDate() + 4 - day);
  const isoYear = localDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil((((localDate - yearStart) / 86400000) + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

export function formatIsoWeekKey(key) {
  const match = /^(\d{4})-W(\d{2})$/.exec(String(key || ""));
  if (!match) return String(key || "Copia semanal");
  return `Semana ${Number(match[2])} de ${match[1]}`;
}

export function historyRetentionPlan(records, weeklyLimit = WEEKLY_BACKUP_LIMIT, recoveryLimit = RECOVERY_BACKUP_LIMIT) {
  const newestFirst = (a, b) => recordTimestamp(b) - recordTimestamp(a) || String(b.id).localeCompare(String(a.id));
  const weekly = records.filter((record) => record.kind === "weekly").sort(newestFirst);
  const recovery = records.filter((record) => record.kind === "recovery").sort(newestFirst);
  const pinned = [...weekly, ...recovery].filter((record) => Boolean(record.pinned));
  const regularWeekly = weekly.filter((record) => !record.pinned);
  const regularRecovery = recovery.filter((record) => !record.pinned);
  return {
    keep: [...pinned, ...regularWeekly.slice(0, weeklyLimit), ...regularRecovery.slice(0, recoveryLimit)],
    remove: [...regularWeekly.slice(weeklyLimit), ...regularRecovery.slice(recoveryLimit)],
  };
}

export function cloudArchiveResetPlan(records, replacementImageIds = []) {
  const keepImageIds = new Set(replacementImageIds.map(String));
  const removable = records.filter((record) => {
    if (!record?.id || record.id === "current" || record.kind === "drive-status") return false;
    if (record.kind === "film-image-v2" && keepImageIds.has(String(record.id))) return false;
    return ["weekly", "recovery", "film-image-v2", "film-image"].includes(String(record.kind || ""))
      || String(record.id).startsWith("film-image-");
  });
  return {
    removeIds: removable.map((record) => String(record.id)),
    removedHistory: removable.filter((record) => ["weekly", "recovery"].includes(record.kind)).length,
    removedImages: removable.filter((record) => String(record.id).startsWith("film-image-")).length,
  };
}

export function cloudRecordApproximateBytes(record) {
  try {
    const serialized = JSON.stringify(record ?? {});
    if (typeof TextEncoder === "function") return new TextEncoder().encode(serialized).byteLength;
    return serialized.length * 2;
  } catch {
    return 0;
  }
}

export function cloudStorageSummary(records = []) {
  const normalized = Array.isArray(records) ? records : [];
  const history = normalized.filter((record) => ["weekly", "recovery"].includes(record?.kind));
  const images = normalized.filter((record) => ["film-image", "film-image-v2"].includes(record?.kind)
    || String(record?.id || "").startsWith("film-image-"));
  const current = normalized.filter((record) => record?.id === "current" || record?.kind === "current");
  return {
    documentCount: normalized.length,
    historyCount: history.length,
    imageCount: images.length,
    currentCount: current.length,
    approximateBytes: normalized.reduce((total, record) => total + cloudRecordApproximateBytes(record), 0),
    historyBytes: history.reduce((total, record) => total + cloudRecordApproximateBytes(record), 0),
    imageBytes: images.reduce((total, record) => total + cloudRecordApproximateBytes(record), 0),
  };
}

export function cloudHistoryDeletionPlan(records = [], requestedIds = null) {
  const requested = requestedIds === null ? null : new Set(requestedIds.map(String));
  const removable = (Array.isArray(records) ? records : []).filter((record) => {
    if (!record?.id || record.pinned || !["weekly", "recovery"].includes(record.kind)) return false;
    return requested === null || requested.has(String(record.id));
  });
  return {
    removeIds: removable.map((record) => String(record.id)),
    weeklyCount: removable.filter((record) => record.kind === "weekly").length,
    recoveryCount: removable.filter((record) => record.kind === "recovery").length,
    approximateBytes: removable.reduce((total, record) => total + cloudRecordApproximateBytes(record), 0),
  };
}

function recordTimestamp(record) {
  const value = Date.parse(record.updatedAtLocal || record.createdAtLocal || "");
  return Number.isFinite(value) ? value : 0;
}

function canonicalStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function dualHash(value) {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first ^= code;
    first = Math.imul(first, 0x01000193);
    second ^= code + index;
    second = Math.imul(second, 0x5bd1e995);
    second ^= second >>> 13;
  }
  return `${(first >>> 0).toString(36).padStart(7, "0")}${(second >>> 0).toString(36).padStart(7, "0")}`;
}

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}
