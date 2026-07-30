import assert from "node:assert/strict";
import {
  allocatedCostForRoll,
  costCenterIntegrityReport,
  costCenterSummary,
  normalizeCostCenter,
  productUsage,
  rollTotalCost,
  sessionCost,
} from "../app/cost-center-core.js";

const rolls = [
  { id: "01072026", filmCost: 8, developmentCost: 0, scanCost: 0 },
  { id: "02072026", filmCost: 7, developmentCost: 0, scanCost: 0 },
  { id: "03072026", filmCost: 9, developmentCost: 0, scanCost: 0 },
  { id: "04072026", filmCost: 8, developmentCost: 4, scanCost: 0 },
  { id: "05072026", filmCost: 8, developmentCost: 4, scanCost: 0 },
];

const center = normalizeCostCenter({
  products: [
    {
      id: "rodinal",
      name: "Rodinal 500 ml",
      category: "Revelador",
      purchaseCost: 15,
      costingMode: "quantity",
      capacity: 500,
      unit: "ml",
      status: "active",
    },
    {
      id: "fixador",
      name: "Fixador",
      category: "Fixador",
      purchaseCost: 10,
      costingMode: "rolls",
      capacity: 20,
      status: "active",
    },
    {
      id: "agua",
      name: "Água desmineralizada",
      category: "Água",
      purchaseCost: 6,
      costingMode: "quantity",
      capacity: 12,
      unit: "garrafa",
      status: "active",
    },
  ],
  sessions: [
    {
      id: "casa-1",
      date: "2026-07-20",
      title: "Revelação em casa",
      method: "home",
      status: "completed",
      rollIds: ["01072026", "02072026", "03072026"],
      consumptions: [
        { productId: "rodinal", amount: 10 },
        { productId: "fixador", amount: 3 },
        { productId: "agua", amount: 1 },
      ],
      directCost: 0,
    },
    {
      id: "lab-1",
      date: "2026-07-21",
      title: "Laboratório",
      method: "lab",
      status: "completed",
      rollIds: ["04072026", "05072026"],
      consumptions: [],
      directCost: 24,
    },
    {
      id: "rascunho",
      date: "2026-07-22",
      method: "home",
      status: "draft",
      rollIds: ["01072026"],
      consumptions: [{ productId: "rodinal", amount: 100 }],
      directCost: 50,
    },
  ],
});

assert.deepEqual(normalizeCostCenter(), { version: 1, products: [], sessions: [] });
assert.equal(center.products[1].unit, "rolo", "O modo por rolos deve ter a unidade correta.");
assert.equal(sessionCost(center.sessions[0], center.products), 2.3, "Custo da sessão em casa incorreto.");
assert.equal(sessionCost(center.sessions[1], center.products), 24, "Custo do laboratório incorreto.");
assert.equal(sessionCost(center.sessions[2], center.products), 0, "Rascunhos não podem afetar contas.");

const rodinalUsage = productUsage(center.products[0], center.sessions);
assert.equal(rodinalUsage.used, 10);
assert.equal(rodinalUsage.remaining, 490);
assert.equal(rodinalUsage.consumedCost, 0.3);
assert.equal(rodinalUsage.remainingValue, 14.7);

const fixerUsage = productUsage(center.products[1], center.sessions);
assert.equal(fixerUsage.used, 3);
assert.equal(fixerUsage.remaining, 17);
assert.equal(fixerUsage.consumedCost, 1.5);

assert.equal(allocatedCostForRoll(center, "01072026"), 0.77);
assert.equal(allocatedCostForRoll(center, "04072026"), 12);
assert.equal(allocatedCostForRoll(center, "99999999"), 0);
assert.equal(rollTotalCost(rolls[0], center), 8.77);
assert.equal(rollTotalCost(rolls[3], center), 24);

const summary = costCenterSummary(center, rolls);
assert.equal(summary.purchaseSpend, 31);
assert.equal(summary.consumedValue, 26.3);
assert.equal(summary.directSpend, 24);
assert.equal(summary.remainingValue, 28.7);
assert.equal(summary.sessions, 2);
assert.equal(summary.drafts, 1);
assert.equal(summary.allocatedRolls, 5);
assert.equal(summary.methods.home.rolls, 3);
assert.equal(summary.methods.home.average, 0.77);
assert.equal(summary.methods.lab.average, 12);
assert.equal(summary.homeLabDifference, 11.23);
assert.equal(summary.byCategory.get("Revelador"), 0.3);
assert.equal(summary.byCategory.get("Fixador"), 1.5);
assert.equal(summary.byCategory.get("Água"), 0.5);
assert.equal(summary.byCategory.get("Serviços e extras"), 24);

const integrity = costCenterIntegrityReport(center, rolls);
assert.equal(integrity.ok, true);
assert.deepEqual(integrity.missingProducts, []);
assert.deepEqual(integrity.missingRolls, []);

const broken = costCenterIntegrityReport({
  products: [...center.products, { ...center.products[0] }],
  sessions: [{
    id: "bad",
    status: "completed",
    rollIds: ["99999999"],
    consumptions: [{ productId: "missing", amount: 1 }],
  }],
}, rolls);
assert.equal(broken.ok, false);
assert.deepEqual(broken.duplicateProductIds, ["rodinal"]);
assert.deepEqual(broken.missingProducts, ["bad:missing"]);
assert.deepEqual(broken.missingRolls, ["bad:99999999"]);

const revised = structuredClone(center);
revised.sessions = revised.sessions.filter((item) => item.id !== "casa-1");
assert.equal(productUsage(revised.products[0], revised.sessions).used, 0, "Eliminar/reabrir deve recalcular o saldo sem mutações acumuladas.");
assert.equal(allocatedCostForRoll(revised, "01072026"), 0);

console.log("PASS: compras por quantidade e por rolos.");
console.log("PASS: sessões em casa, laboratório, rascunhos e custos diretos.");
console.log("PASS: imputação, saldos, autonomia, médias e comparação financeira.");
console.log("PASS: integridade, referências inválidas e recálculo seguro.");
