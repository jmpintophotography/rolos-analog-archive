import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  V25_WORKSPACE_VERSION,
  applyBatchArchiveUpdate,
  archiveIntegrityReport,
  backupRestoreDiff,
  captureFields,
  captureTemplateFromRoll,
  financialSummary,
  normalizeV25Workspace,
  processingDurationSummary,
  qrSvgForRollId,
  rollCost,
  stockForecast,
} from "../app/v25-core.js";

const sourceSeed = JSON.parse(await readFile(new URL("../app/data/seed.json", import.meta.url), "utf8"));

const emptyWorkspace = normalizeV25Workspace();
assert.equal(emptyWorkspace.version, V25_WORKSPACE_VERSION);
assert.deepEqual(emptyWorkspace.templates, []);
assert.deepEqual(emptyWorkspace.archiveActivity, []);

const sourceRoll = {
  id: "01072026",
  camera: "Leica M6",
  lens: "Summicron 35",
  filmBrand: "Kodak",
  filmModel: "Gold 200",
  iso: 200,
  format: "35mm",
  type: "Cor",
  push: 1,
  project: "Lisboa",
  notes: "não copiar",
  archiveLocation: "A-01",
};
const template = captureTemplateFromRoll("Passeio", sourceRoll, new Date("2026-07-18T12:00:00.000Z"));
assert.equal(template.name, "Passeio");
assert.equal(template.capture.camera, "Leica M6");
assert.equal(template.capture.project, "Lisboa");
assert.equal("notes" in template.capture, false);
assert.equal("archiveLocation" in template.capture, false);
assert.deepEqual(captureFields(sourceRoll), template.capture);

const normalized = normalizeV25Workspace({
  templates: [template, { id: "", name: "ignorar" }],
  archiveActivity: [{ id: "evt-1", at: "2026-07-18T12:00:00.000Z", action: "Lote", rollIds: ["01072026", "01072026"] }],
});
assert.equal(normalized.templates.length, 1);
assert.deepEqual(normalized.archiveActivity[0].rollIds, ["01072026"]);

const seedAudit = archiveIntegrityReport(sourceSeed);
assert.equal(seedAudit.rolls, 10);
assert.deepEqual(seedAudit.duplicateIds, []);
assert.deepEqual(seedAudit.invalidIds, []);
assert.deepEqual(seedAudit.dateMismatches, []);
assert.deepEqual(seedAudit.negativeStock, []);
assert.equal(seedAudit.ok, true);

const badAudit = archiveIntegrityReport({
  rolls: [
    { id: "01072026", date: "2026-06-01" },
    { id: "01072026", date: "2026-07-01" },
    { id: "00072026", date: "2026-07-01" },
    { id: "01132026", date: "2026-13-01" },
  ],
  stock: [{ id: "stock-1", quantity: -1 }],
});
assert.deepEqual(badAudit.duplicateIds, ["01072026"]);
assert.deepEqual(badAudit.dateMismatches, ["01072026"]);
assert.deepEqual(badAudit.invalidIds, ["00072026", "01132026"]);
assert.deepEqual(badAudit.negativeStock, ["stock-1"]);
assert.equal(badAudit.ok, false);

const current = {
  rolls: [{ id: "01072026", date: "2026-07-01", notes: "antes" }, { id: "02072026", date: "2026-07-01" }],
  stock: [{ id: "s", quantity: 2 }],
  equipment: [{}],
};
const candidate = {
  rolls: [{ id: "01072026", date: "2026-07-01", notes: "depois" }, { id: "03072026", date: "2026-07-01" }],
  stock: [{ id: "s", quantity: 5 }],
  equipment: [{}, {}],
};
const diff = backupRestoreDiff(current, candidate);
assert.deepEqual(diff.added, ["03072026"]);
assert.deepEqual(diff.removed, ["02072026"]);
assert.deepEqual(diff.changed, ["01072026"]);
assert.equal(diff.stockDelta, 3);
assert.equal(diff.equipmentDelta, 1);

const batch = applyBatchArchiveUpdate(
  [{ id: "01072026", status: "Digitalizado" }, { id: "02072026", status: "Digitalizado" }],
  ["01072026"],
  { archiveLocation: "Caixa 7", negativePresent: true, scanFilesPresent: true, status: "Arquivado" },
  new Date("2026-07-18T14:30:00.000Z"),
);
assert.equal(batch.updated, 1);
assert.equal(batch.rolls[0].archiveLocation, "Caixa 7");
assert.equal(batch.rolls[0].archivedAt, "2026-07-18");
assert.equal(batch.rolls[1].archiveLocation, undefined);

assert.equal(rollCost({ filmCost: 7.5, developmentCost: 4.25, scanCost: 2 }), 13.75);
const finance = financialSummary([
  { id: "01012026", date: "2026-01-01", filmCost: 10, developmentCost: 5 },
  { id: "02012026", date: "2026-01-01", filmCost: 5 },
  { id: "03012026", date: "2026-01-01" },
], [{ quantity: 3, unitCost: 8.5 }]);
assert.equal(finance.trackedRolls, 2);
assert.equal(finance.total, 20);
assert.equal(finance.average, 10);
assert.equal(finance.stockValue, 25.5);
assert.equal(finance.byYear.get("2026"), 20);

const durations = processingDurationSummary([
  {
    shotCompletedAt: "2026-07-01T10:00:00.000Z",
    developmentCompletedAt: "2026-07-04T10:00:00.000Z",
    scanCompletedAt: "2026-07-06T10:00:00.000Z",
    archivedAt: "2026-07-07T10:00:00.000Z",
  },
  {
    shotCompletedAt: "2026-07-01T10:00:00.000Z",
    developmentCompletedAt: "2026-07-06T10:00:00.000Z",
  },
]);
assert.deepEqual(durations.shotToDevelop, { tracked: 2, averageDays: 4 });
assert.deepEqual(durations.developToScan, { tracked: 1, averageDays: 2 });
assert.deepEqual(durations.scanToArchive, { tracked: 1, averageDays: 1 });

const forecast = stockForecast([
  { id: "fresh", brand: "Kodak", model: "Gold", quantity: 12, expiryDate: "2026-10-01" },
  { id: "expired", brand: "Ilford", model: "HP5", quantity: 2, expiryDate: "2026-01-01" },
], Array.from({ length: 12 }, (_, index) => ({ id: `0${index}`, date: `2026-${String((index % 7) + 1).padStart(2, "0")}-01` })), new Date("2026-07-18T12:00:00.000Z"));
assert.equal(forecast.totalStock, 14);
assert.equal(forecast.monthlyUse, 1);
assert.equal(forecast.monthsRemaining, 14);
assert.equal(forecast.expiring.length, 1);
assert.equal(forecast.expired.length, 1);

const qr = qrSvgForRollId("01072026", { scale: 4 });
assert.match(qr, /^<svg/);
assert.match(qr, /viewBox="0 0 29 29"/);
assert.match(qr, /QR 01072026/);
assert.doesNotMatch(qr, /<rect x="24" y="12" width="1" height="1"\/>/);
assert.match(qr, /<rect x="22" y="12" width="1" height="1"\/>/);
assert.throws(() => qrSvgForRollId("inválido"), /8 dígitos/i);

console.log(JSON.stringify({
  ok: true,
  checks: 54,
  seedRolls: seedAudit.rolls,
  seedMismatches: seedAudit.dateMismatches.length,
  workspaceVersion: V25_WORKSPACE_VERSION,
}, null, 2));
