import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applicationIntegrityReport,
  assertApplicationIntegrity,
  recordChangedSinceOpen,
  remapRollIdReferences,
} from "../app/integrity-core.js";
import { nextRollIdForMonth } from "../app/calendar-dates.js";

const seed = JSON.parse(await readFile(new URL("../app/data/seed.json", import.meta.url), "utf8"));
const clean = applicationIntegrityReport(seed);
assert.equal(clean.ok, true);
assert.equal(clean.errorCount, 0);
assert.equal(clean.totals.rolls, 10);

const duplicateRoll = structuredClone(seed);
duplicateRoll.rolls.push(structuredClone(duplicateRoll.rolls[0]));
assert.deepEqual(applicationIntegrityReport(duplicateRoll).duplicates.rolls, [seed.rolls[0].id]);
assert.throws(() => assertApplicationIntegrity(duplicateRoll, "teste"), (error) => error.code === "rolos/integrity-validation");

const invalidDate = structuredClone(seed);
invalidDate.rolls[0].date = "2026-12-01";
assert.equal(applicationIntegrityReport(invalidDate).rollDateMismatches.length, 1);

const invalidValues = structuredClone(seed);
invalidValues.rolls[0].filmCost = -1;
invalidValues.stock[0].quantity = -2;
invalidValues.equipment[0].purchaseValue = -3;
const invalidValuesReport = applicationIntegrityReport(invalidValues);
assert.equal(invalidValuesReport.invalidValues.length, 3);
assert.equal(invalidValuesReport.ok, false);

const linked = structuredClone(seed);
linked.costCenter = {
  version: 1,
  products: [{
    id: "produto-1",
    name: "Rodinal",
    category: "Revelador",
    purchaseDate: "2026-07-01",
    purchaseCost: 15,
    capacity: 500,
  }],
  sessions: [{
    id: "sessao-1",
    date: "2026-07-20",
    status: "completed",
    rollIds: [seed.rolls[0].id],
    consumptions: [{ productId: "produto-1", amount: 10 }],
    directCost: 0,
  }],
};
linked.workflow = {
  ...(linked.workflow || {}),
  archiveActivity: [{
    id: "log-1",
    at: "2026-07-20T12:00:00.000Z",
    action: "archive",
    rollIds: [seed.rolls[0].id],
  }],
};
assert.equal(applicationIntegrityReport(linked).ok, true);

const changedId = "99012026";
const remapped = remapRollIdReferences(linked, seed.rolls[0].id, changedId);
remapped.rolls[0].id = changedId;
remapped.rolls[0].date = "2026-01-01";
assert.deepEqual(remapped.costCenter.sessions[0].rollIds, [changedId]);
assert.deepEqual(remapped.workflow.archiveActivity[0].rollIds, [changedId]);
assert.equal(applicationIntegrityReport(remapped).ok, true);

const brokenReference = structuredClone(linked);
brokenReference.costCenter.sessions[0].rollIds = ["99999999"];
brokenReference.costCenter.sessions[0].consumptions[0].productId = "produto-inexistente";
assert.equal(applicationIntegrityReport(brokenReference).missingReferences.length, 2);

const duplicateReferences = structuredClone(linked);
duplicateReferences.costCenter.sessions[0].rollIds.push(seed.rolls[0].id);
duplicateReferences.costCenter.sessions[0].consumptions.push({ productId: "produto-1", amount: 1 });
assert.equal(applicationIntegrityReport(duplicateReferences).duplicateReferences.length, 2);

const overCapacity = structuredClone(linked);
overCapacity.costCenter.sessions[0].consumptions[0].amount = 501;
const overCapacityReport = applicationIntegrityReport(overCapacity);
assert.deepEqual(overCapacityReport.productsOverCapacity, ["produto-1"]);
assert.equal(overCapacityReport.ok, false);

const duplicateCollections = structuredClone(linked);
duplicateCollections.stock.push(structuredClone(duplicateCollections.stock[0]));
duplicateCollections.equipment.push(structuredClone(duplicateCollections.equipment[0]));
duplicateCollections.costCenter.products.push(structuredClone(duplicateCollections.costCenter.products[0]));
duplicateCollections.costCenter.sessions.push(structuredClone(duplicateCollections.costCenter.sessions[0]));
duplicateCollections.workflow.templates = [{
  id: "modelo-1",
  name: "Modelo",
}, {
  id: "modelo-1",
  name: "Modelo repetido",
}];
const duplicateReport = applicationIntegrityReport(duplicateCollections);
assert.equal(duplicateReport.duplicateCount, 5);

assert.equal(recordChangedSinceOpen({ id: "a", value: 1 }, { value: 1, id: "a" }), false);
assert.equal(recordChangedSinceOpen({ id: "a", value: 2 }, { value: 1, id: "a" }), true);
assert.equal(recordChangedSinceOpen(null, { id: "a" }), true);

const historicIds = seed.rolls.map((roll) => roll.id);
const nextHistoricId = nextRollIdForMonth("2010-03-01", historicIds);
assert.match(nextHistoricId, /^\d{2}032010$/);
assert.equal(nextHistoricId.slice(2), "032010");

console.log(JSON.stringify({
  ok: true,
  checks: 26,
  rolls: clean.totals.rolls,
  nextHistoricId,
  duplicateScopes: Object.keys(duplicateReport.duplicates).length,
}, null, 2));
