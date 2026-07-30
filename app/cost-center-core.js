export const COST_CENTER_VERSION = 1;

export const COST_CATEGORIES = [
  "Filme",
  "Revelador",
  "Banho de paragem",
  "Fixador",
  "Agente de lavagem",
  "Agente molhante",
  "Água",
  "Luvas",
  "Proteção e arquivo",
  "Digitalização",
  "Impressão",
  "Laboratório",
  "Outro",
];

export const COST_UNITS = [
  "ml",
  "l",
  "g",
  "kg",
  "unidade",
  "par",
  "caixa",
  "garrafa",
  "rolo",
];

export function normalizeCostCenter(raw = {}) {
  const products = (Array.isArray(raw.products) ? raw.products : [])
    .map(normalizeCostProduct)
    .filter((item) => item.id && item.name);
  const sessions = (Array.isArray(raw.sessions) ? raw.sessions : [])
    .map(normalizeCostSession)
    .filter((item) => item.id);
  return {
    version: COST_CENTER_VERSION,
    products,
    sessions,
  };
}

export function normalizeCostProduct(raw = {}) {
  const mode = raw.costingMode === "rolls" ? "rolls" : "quantity";
  return {
    id: text(raw.id),
    name: text(raw.name),
    category: text(raw.category) || "Outro",
    brand: text(raw.brand),
    purchaseDate: calendarIso(raw.purchaseDate),
    purchaseCost: nonNegative(raw.purchaseCost),
    costingMode: mode,
    capacity: nonNegative(raw.capacity),
    unit: mode === "rolls" ? "rolo" : (text(raw.unit) || "unidade"),
    status: raw.status === "finished" ? "finished" : "active",
    notes: text(raw.notes),
    createdAt: text(raw.createdAt),
    updatedAt: text(raw.updatedAt),
    finishedAt: text(raw.finishedAt),
  };
}

export function normalizeCostSession(raw = {}) {
  const status = raw.status === "completed" ? "completed" : "draft";
  return {
    id: text(raw.id),
    date: calendarIso(raw.date),
    title: text(raw.title),
    method: ["home", "lab", "other"].includes(raw.method) ? raw.method : "home",
    provider: text(raw.provider),
    status,
    rollIds: uniqueStrings(raw.rollIds),
    consumptions: (Array.isArray(raw.consumptions) ? raw.consumptions : [])
      .map((item) => ({
        productId: text(item.productId),
        amount: nonNegative(item.amount),
      }))
      .filter((item) => item.productId && item.amount > 0),
    directCost: nonNegative(raw.directCost),
    notes: text(raw.notes),
    createdAt: text(raw.createdAt),
    updatedAt: text(raw.updatedAt),
    completedAt: status === "completed" ? text(raw.completedAt) : "",
  };
}

export function productUsage(product = {}, sessions = []) {
  const normalized = normalizeCostProduct(product);
  const used = completedSessions(sessions).reduce((total, session) => total + session.consumptions
    .filter((item) => item.productId === normalized.id)
    .reduce((subtotal, item) => subtotal + nonNegative(item.amount), 0), 0);
  const capacity = normalized.capacity;
  const unitCost = capacity > 0 ? normalized.purchaseCost / capacity : 0;
  const consumedCost = roundMoney(used * unitCost);
  const remaining = capacity > 0 ? Math.max(0, capacity - used) : 0;
  const remainingValue = roundMoney(remaining * unitCost);
  return {
    used: roundQuantity(used),
    capacity: roundQuantity(capacity),
    remaining: roundQuantity(remaining),
    unit: normalized.unit,
    unitCost: roundMoney(unitCost),
    consumedCost,
    remainingValue,
    percent: capacity > 0 ? Math.min(100, Math.round((used / capacity) * 100)) : 0,
    overused: capacity > 0 && used > capacity,
  };
}

export function sessionCost(session = {}, products = []) {
  const normalized = normalizeCostSession(session);
  if (normalized.status !== "completed") return 0;
  const productsById = new Map((Array.isArray(products) ? products : [])
    .map((item) => normalizeCostProduct(item))
    .map((item) => [item.id, item]));
  const consumables = normalized.consumptions.reduce((total, item) => {
    const product = productsById.get(item.productId);
    if (!product || product.capacity <= 0) return total;
    return total + item.amount * (product.purchaseCost / product.capacity);
  }, 0);
  return roundMoney(consumables + normalized.directCost);
}

export function allocatedCostForRoll(costCenter = {}, rollId = "") {
  const center = normalizeCostCenter(costCenter);
  const target = text(rollId);
  if (!target) return 0;
  return roundMoney(center.sessions.reduce((total, session) => {
    if (session.status !== "completed" || !session.rollIds.includes(target) || !session.rollIds.length) return total;
    return total + sessionCost(session, center.products) / session.rollIds.length;
  }, 0));
}

export function rollTotalCost(roll = {}, costCenter = {}) {
  const legacy = nonNegative(roll.filmCost) + nonNegative(roll.developmentCost) + nonNegative(roll.scanCost);
  return roundMoney(legacy + allocatedCostForRoll(costCenter, roll.id));
}

export function costCenterSummary(costCenter = {}, rolls = []) {
  const center = normalizeCostCenter(costCenter);
  const complete = completedSessions(center.sessions);
  const purchaseSpend = roundMoney(center.products.reduce((total, item) => total + item.purchaseCost, 0));
  const consumedValue = roundMoney(complete.reduce((total, session) => total + sessionCost(session, center.products), 0));
  const directSpend = roundMoney(complete.reduce((total, session) => total + session.directCost, 0));
  const remainingValue = roundMoney(center.products.reduce((total, item) =>
    total + productUsage(item, complete).remainingValue, 0));
  const allocatedRollIds = new Set(complete.flatMap((session) => session.rollIds));
  const allocatedValue = roundMoney(complete.reduce((total, session) =>
    total + (session.rollIds.length ? sessionCost(session, center.products) : 0), 0));
  const byCategory = new Map();
  center.products.forEach((product) => {
    const value = productUsage(product, complete).consumedCost;
    if (!value) return;
    byCategory.set(product.category, roundMoney((byCategory.get(product.category) || 0) + value));
  });
  if (directSpend) byCategory.set("Serviços e extras", directSpend);

  const byMonth = new Map();
  complete.forEach((session) => {
    const month = /^\d{4}-\d{2}/.test(session.date) ? session.date.slice(0, 7) : "Sem data";
    byMonth.set(month, roundMoney((byMonth.get(month) || 0) + sessionCost(session, center.products)));
  });

  const methodStats = Object.fromEntries(["home", "lab", "other"].map((method) => {
    const matching = complete.filter((session) => session.method === method && session.rollIds.length);
    const rollCount = matching.reduce((total, session) => total + session.rollIds.length, 0);
    const total = roundMoney(matching.reduce((sum, session) => sum + sessionCost(session, center.products), 0));
    return [method, {
      sessions: matching.length,
      rolls: rollCount,
      total,
      average: rollCount ? roundMoney(total / rollCount) : 0,
    }];
  }));

  const knownRollIds = new Set((Array.isArray(rolls) ? rolls : []).map((roll) => text(roll.id)));
  return {
    products: center.products.length,
    activeProducts: center.products.filter((item) => item.status === "active").length,
    sessions: complete.length,
    drafts: center.sessions.filter((item) => item.status === "draft").length,
    purchaseSpend,
    consumedValue,
    allocatedValue,
    directSpend,
    remainingValue,
    allocatedRolls: [...allocatedRollIds].filter((id) => !knownRollIds.size || knownRollIds.has(id)).length,
    averagePerRoll: allocatedRollIds.size ? roundMoney(allocatedValue / allocatedRollIds.size) : 0,
    byCategory,
    byMonth,
    methods: methodStats,
    homeLabDifference: methodStats.home.average && methodStats.lab.average
      ? roundMoney(methodStats.lab.average - methodStats.home.average)
      : null,
  };
}

export function costCenterIntegrityReport(costCenter = {}, rolls = []) {
  const center = normalizeCostCenter(costCenter);
  const duplicateProductIds = duplicateIds(center.products);
  const duplicateSessionIds = duplicateIds(center.sessions);
  const productIds = new Set(center.products.map((item) => item.id));
  const rollIds = new Set((Array.isArray(rolls) ? rolls : []).map((item) => text(item.id)));
  const missingProducts = [];
  const missingRolls = [];
  center.sessions.forEach((session) => {
    session.consumptions.forEach((item) => {
      if (!productIds.has(item.productId)) missingProducts.push(`${session.id}:${item.productId}`);
    });
    session.rollIds.forEach((id) => {
      if (!rollIds.has(id)) missingRolls.push(`${session.id}:${id}`);
    });
  });
  const productsOverCapacity = center.products
    .filter((item) => productUsage(item, center.sessions).overused)
    .map((item) => item.id);
  const invalidProducts = center.products
    .filter((item) => !item.name || item.purchaseCost < 0 || item.capacity < 0)
    .map((item) => item.id);
  return {
    ok: !duplicateProductIds.length
      && !duplicateSessionIds.length
      && !missingProducts.length
      && !missingRolls.length
      && !invalidProducts.length,
    duplicateProductIds,
    duplicateSessionIds,
    missingProducts,
    missingRolls,
    productsOverCapacity,
    invalidProducts,
  };
}

function completedSessions(sessions) {
  return (Array.isArray(sessions) ? sessions : [])
    .map(normalizeCostSession)
    .filter((item) => item.status === "completed");
}

function duplicateIds(items) {
  const counts = new Map();
  items.forEach((item) => counts.set(item.id, (counts.get(item.id) || 0) + 1));
  return [...counts.entries()].filter(([id, count]) => id && count > 1).map(([id]) => id);
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))];
}

function calendarIso(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text(value));
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function nonNegative(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function roundQuantity(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

function text(value) {
  return String(value ?? "").trim();
}
