export const DRIVE_BACKUP_INTERVAL_DAYS = 7;
export const DRIVE_BACKUP_LIMIT = 54;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isDriveBackupDue(lastBackupAt, now = new Date()) {
  const lastTimestamp = Date.parse(String(lastBackupAt || ""));
  const currentTimestamp = dateTimestamp(now);
  if (!Number.isFinite(lastTimestamp)) return true;
  return currentTimestamp - lastTimestamp >= DRIVE_BACKUP_INTERVAL_DAYS * DAY_MS;
}

export function nextDriveBackupAt(lastBackupAt) {
  const lastTimestamp = Date.parse(String(lastBackupAt || ""));
  if (!Number.isFinite(lastTimestamp)) return "";
  return new Date(lastTimestamp + DRIVE_BACKUP_INTERVAL_DAYS * DAY_MS).toISOString();
}

export function driveRetentionPlan(files = [], limit = DRIVE_BACKUP_LIMIT) {
  const sorted = [...files].sort((a, b) => fileTimestamp(b) - fileTimestamp(a)
    || String(b.id || "").localeCompare(String(a.id || "")));
  return {
    keep: sorted.slice(0, Math.max(0, limit)),
    remove: sorted.slice(Math.max(0, limit)),
  };
}

function fileTimestamp(file) {
  const value = Date.parse(file?.createdTime || file?.modifiedTime || "");
  return Number.isFinite(value) ? value : 0;
}

function dateTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}
