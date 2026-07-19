import assert from "node:assert/strict";
import {
  SYNC_SCHEMA_VERSION,
  RECOVERY_BACKUP_LIMIT,
  WEEKLY_BACKUP_LIMIT,
  chooseSyncAction,
  cloudArchiveResetPlan,
  cloudHistoryDeletionPlan,
  cloudRecordApproximateBytes,
  cloudStorageSummary,
  evaluateCloudWrite,
  historyRetentionPlan,
  isoWeekKey,
  requiresSyncSchemaUpgrade,
  shouldReplaceWeeklyBackup,
  stateFingerprint,
} from "../app/sync-core.js";

assert.equal(SYNC_SCHEMA_VERSION, 3, "v2.5 must block older writers that would drop additive fields");
assert.equal(requiresSyncSchemaUpgrade({ schemaVersion: 2, payload: { meta: { syncSchemaVersion: 2 } } }), true);
assert.equal(requiresSyncSchemaUpgrade({ schemaVersion: 3, payload: { meta: { syncSchemaVersion: 3 } } }), false);

function state(overrides = {}) {
  return {
    meta: {
      cloudRevision: 0,
      cloudBackupPending: false,
      ...overrides.meta,
    },
    rolls: overrides.rolls || [{ id: "01012026", notes: "original" }],
    stock: overrides.stock || [],
    equipment: overrides.equipment || [],
    filmImages: overrides.filmImages || {},
    support: overrides.support || { statuses: ["Em Uso", "Arquivado"] },
  };
}

const original = state();
const sameWithReorderedKeys = {
  support: original.support,
  filmImages: {},
  equipment: [],
  stock: [],
  rolls: [{ notes: "original", id: "01012026" }],
  meta: { cloudBackupPending: true, cloudRevision: 99 },
};
assert.equal(stateFingerprint(original), stateFingerprint(sameWithReorderedKeys), "metadata and object key order must not affect the content hash");

const cloudV3 = { revision: 3, payload: original, contentHash: stateFingerprint(original) };
assert.equal(chooseSyncAction(state({ meta: { cloudRevision: 3 } }), cloudV3), "same");
assert.equal(chooseSyncAction(state({ meta: { cloudRevision: 3, cloudBackupPending: true }, rolls: [{ id: "01012026", notes: "local" }] }), cloudV3), "push");
assert.equal(chooseSyncAction(state({ meta: { cloudRevision: 2 }, rolls: [{ id: "01012026", notes: "old" }] }), cloudV3), "pull");
assert.equal(chooseSyncAction(state({ meta: { cloudRevision: 2, cloudBackupPending: true }, rolls: [{ id: "01012026", notes: "offline" }] }), cloudV3), "recover-pull");
assert.equal(chooseSyncAction(original, { payload: original }), "migrate");
assert.equal(chooseSyncAction(state({ meta: { cloudBackupPending: true }, rolls: [{ id: "01012026", notes: "legacy local" }] }), { payload: original }), "recover-pull");
assert.equal(chooseSyncAction(original, null), "push");

assert.deepEqual(evaluateCloudWrite({
  remoteExists: true,
  remoteRevision: 4,
  expectedRevision: 3,
  remoteHash: "remote-change",
  localHash: "local-change",
}), { conflict: true, nextRevision: 5 });
assert.deepEqual(evaluateCloudWrite({
  remoteExists: true,
  remoteRevision: 4,
  expectedRevision: 3,
  remoteHash: "same-change",
  localHash: "same-change",
}), { conflict: false, nextRevision: 5 });
assert.equal(evaluateCloudWrite({
  remoteExists: true,
  remoteHash: "legacy-without-images",
  localHash: "hydrated-legacy",
  legacyExpectedHash: "hydrated-legacy",
  legacyExpectedUpdatedAt: "2026-07-17T12:00:00.000Z",
  remoteUpdatedAt: "2026-07-17T12:00:00.000Z",
}).conflict, false);
assert.equal(evaluateCloudWrite({
  remoteExists: true,
  remoteHash: "legacy-changed",
  localHash: "hydrated-legacy",
  legacyExpectedHash: "hydrated-legacy",
  legacyExpectedUpdatedAt: "2026-07-17T12:00:00.000Z",
  remoteUpdatedAt: "2026-07-17T12:01:00.000Z",
}).conflict, true);
assert.equal(shouldReplaceWeeklyBackup(12, 11), false);
assert.equal(shouldReplaceWeeklyBackup(12, 12), true);

assert.equal(isoWeekKey(new Date("2026-01-01T12:00:00Z")), "2026-W01");
assert.equal(isoWeekKey(new Date("2027-01-01T12:00:00Z")), "2026-W53");

const records = [
  ...Array.from({ length: 60 }, (_, index) => ({
    id: `weekly-${index}`,
    kind: "weekly",
    updatedAtLocal: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
  })),
  ...Array.from({ length: 14 }, (_, index) => ({
    id: `recovery-${index}`,
    kind: "recovery",
    updatedAtLocal: new Date(Date.UTC(2026, 3, index + 1)).toISOString(),
  })),
];
const retention = historyRetentionPlan(records);
assert.equal(retention.keep.filter((item) => item.kind === "weekly").length, WEEKLY_BACKUP_LIMIT);
assert.equal(retention.keep.filter((item) => item.kind === "recovery").length, RECOVERY_BACKUP_LIMIT);
assert.equal(retention.remove.length, 10);
assert.ok(retention.keep.some((item) => item.id === "weekly-59"));
assert.ok(!retention.keep.some((item) => item.id === "weekly-0"));

const pinnedRetention = historyRetentionPlan([
  ...records,
  { id: "weekly-protegido-antigo", kind: "weekly", pinned: true, updatedAtLocal: "2020-01-01T00:00:00.000Z" },
]);
assert.ok(pinnedRetention.keep.some((item) => item.id === "weekly-protegido-antigo"));
assert.ok(!pinnedRetention.remove.some((item) => item.id === "weekly-protegido-antigo"));

const reset = cloudArchiveResetPlan([
  { id: "current", kind: "current" },
  { id: "drive-status", kind: "drive-status" },
  { id: "weekly-2026-W28", kind: "weekly" },
  { id: "recovery-old", kind: "recovery" },
  { id: "film-image-old", kind: "film-image-v2" },
  { id: "film-image-keep", kind: "film-image-v2" },
], ["film-image-keep"]);
assert.deepEqual(reset.removeIds.sort(), ["film-image-old", "recovery-old", "weekly-2026-W28"]);
assert.equal(reset.removedHistory, 2);
assert.equal(reset.removedImages, 1);

const storageRecords = [
  { id: "current", kind: "current", payload: { rolls: [{ id: "01072026" }] } },
  { id: "weekly-2026-W29", kind: "weekly", payload: { rolls: [{ id: "01072026" }] } },
  { id: "recovery-before-restore", kind: "recovery", payload: { rolls: [{ id: "01062026" }] } },
  { id: "film-image-demo", kind: "film-image-v2", image: { dataUrl: "data:image/png;base64,AAAA" } },
  { id: "drive-status", kind: "drive-status" },
];
const storage = cloudStorageSummary(storageRecords);
assert.equal(storage.documentCount, 5);
assert.equal(storage.historyCount, 2);
assert.equal(storage.imageCount, 1);
assert.equal(storage.currentCount, 1);
assert.ok(storage.approximateBytes >= cloudRecordApproximateBytes(storageRecords[0]));

const allHistory = cloudHistoryDeletionPlan(storageRecords);
assert.deepEqual(allHistory.removeIds, ["weekly-2026-W29", "recovery-before-restore"]);
assert.equal(allHistory.weeklyCount, 1);
assert.equal(allHistory.recoveryCount, 1);
const selectedHistory = cloudHistoryDeletionPlan(storageRecords, ["current", "weekly-2026-W29", "film-image-demo"]);
assert.deepEqual(selectedHistory.removeIds, ["weekly-2026-W29"]);

const protectedHistory = cloudHistoryDeletionPlan([
  ...storageRecords,
  { id: "weekly-pinned", kind: "weekly", pinned: true },
]);
assert.ok(!protectedHistory.removeIds.includes("weekly-pinned"));

console.log(JSON.stringify({
  ok: true,
  checks: 40,
  weeklyLimit: WEEKLY_BACKUP_LIMIT,
  recoveryLimit: RECOVERY_BACKUP_LIMIT,
}, null, 2));
