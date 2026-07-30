import { rollCalendarFromId } from "./calendar-dates.js";

export const INTEGRITY_CORE_VERSION = 1;

export function applicationIntegrityReport(raw = {}) {
  const rolls = array(raw.rolls);
  const stock = array(raw.stock);
  const equipment = array(raw.equipment);
  const products = array(raw.costCenter?.products);
  const sessions = array(raw.costCenter?.sessions);
  const templates = array(raw.workflow?.templates);
  const errors = [];

  const duplicates = {
    rolls: duplicateIds(rolls),
    stock: duplicateIds(stock),
    equipment: duplicateIds(equipment),
    costProducts: duplicateIds(products),
    costSessions: duplicateIds(sessions),
    templates: duplicateIds(templates),
  };

  Object.entries(duplicates).forEach(([scope, ids]) => {
    ids.forEach((id) => errors.push(issue("duplicate-id", scope, id, "id", `O ID ${id} está duplicado.`)));
  });

  const invalidRollIds = [];
  const rollDateMismatches = [];
  const invalidDates = [];
  const invalidValues = [];
  const missingReferences = [];
  const duplicateReferences = [];
  const missingRequired = [];

  rolls.forEach((roll, index) => {
    const id = text(roll.id) || `linha-${index + 1}`;
    const calendar = rollCalendarFromId(roll.id);
    if (!calendar.valid) {
      invalidRollIds.push(text(roll.id));
      errors.push(issue("invalid-roll-id", "rolls", id, "id", calendar.reason || "O ID do rolo não é válido."));
    } else if (text(roll.date) !== calendar.date) {
      rollDateMismatches.push(calendar.id);
      errors.push(issue("roll-date-mismatch", "rolls", calendar.id, "date", `A data deve ser ${calendar.date}, de acordo com o ID.`));
    }

    ["filmCost", "developmentCost", "scanCost"].forEach((field) => {
      if (!isNonNegativeNumber(roll[field])) {
        invalidValues.push(`${id}:${field}`);
        errors.push(issue("invalid-number", "rolls", id, field, "O valor deve ser zero ou positivo."));
      }
    });
    validateOptionalDates(roll, [
      "shotCompletedAt",
      "developmentCompletedAt",
      "scanCompletedAt",
      "archivedAt",
    ], "rolls", id, invalidDates, errors);
  });

  stock.forEach((item, index) => {
    const id = text(item.id) || `linha-${index + 1}`;
    if (!text(item.id)) {
      missingRequired.push(`stock:${id}:id`);
      errors.push(issue("missing-required", "stock", id, "id", "O artigo de stock não tem ID."));
    }
    if (!isNonNegativeInteger(item.quantity)) {
      invalidValues.push(`${id}:quantity`);
      errors.push(issue("invalid-number", "stock", id, "quantity", "A quantidade de stock deve ser um número inteiro igual ou superior a zero."));
    }
    if (!isNonNegativeNumber(item.unitCost)) {
      invalidValues.push(`${id}:unitCost`);
      errors.push(issue("invalid-number", "stock", id, "unitCost", "O custo unitário deve ser zero ou positivo."));
    }
    validateOptionalDates(item, ["purchasedAt", "expiryDate"], "stock", id, invalidDates, errors);
  });

  equipment.forEach((item, index) => {
    const id = text(item.id) || `linha-${index + 1}`;
    if (!text(item.id)) {
      missingRequired.push(`equipment:${id}:id`);
      errors.push(issue("missing-required", "equipment", id, "id", "O equipamento não tem ID."));
    }
    if (!isNonNegativeNumber(item.purchaseValue)) {
      invalidValues.push(`${id}:purchaseValue`);
      errors.push(issue("invalid-number", "equipment", id, "purchaseValue", "O valor de aquisição deve ser zero ou positivo."));
    }
    validateOptionalDates(item, ["purchaseDate", "lastServiceDate"], "equipment", id, invalidDates, errors);
  });

  const productIds = new Set(products.map((item) => text(item.id)).filter(Boolean));
  const rollIds = new Set(rolls.map((item) => text(item.id)).filter(Boolean));
  const productCapacity = new Map(products.map((item) => [text(item.id), Number(item.capacity)]));
  const completedUsage = new Map();

  products.forEach((item, index) => {
    const id = text(item.id) || `linha-${index + 1}`;
    if (!text(item.id) || !text(item.name)) {
      missingRequired.push(`costProducts:${id}`);
      errors.push(issue("missing-required", "costProducts", id, !text(item.id) ? "id" : "name", "A compra precisa de ID e nome."));
    }
    ["purchaseCost", "capacity"].forEach((field) => {
      if (!isNonNegativeNumber(item[field])) {
        invalidValues.push(`${id}:${field}`);
        errors.push(issue("invalid-number", "costProducts", id, field, "O valor deve ser zero ou positivo."));
      }
    });
    if (Number(item.capacity) <= 0) {
      invalidValues.push(`${id}:capacity`);
      errors.push(issue("invalid-capacity", "costProducts", id, "capacity", "A capacidade da compra deve ser superior a zero."));
    }
    validateOptionalDates(item, ["purchaseDate"], "costProducts", id, invalidDates, errors);
  });

  sessions.forEach((session, index) => {
    const id = text(session.id) || `linha-${index + 1}`;
    if (!text(session.id)) {
      missingRequired.push(`costSessions:${id}:id`);
      errors.push(issue("missing-required", "costSessions", id, "id", "A sessão não tem ID."));
    }
    if (!isCalendarDate(session.date)) {
      invalidDates.push(`${id}:date`);
      errors.push(issue("invalid-date", "costSessions", id, "date", "A sessão precisa de uma data válida."));
    }
    if (!isNonNegativeNumber(session.directCost)) {
      invalidValues.push(`${id}:directCost`);
      errors.push(issue("invalid-number", "costSessions", id, "directCost", "O custo direto deve ser zero ou positivo."));
    }
    const sessionRollIds = array(session.rollIds).map(text).filter(Boolean);
    duplicateValues(sessionRollIds).forEach((rollId) => {
      duplicateReferences.push(`${id}:roll:${rollId}`);
      errors.push(issue("duplicate-reference", "costSessions", id, "rollIds", `O rolo ${rollId} aparece repetido na mesma sessão.`));
    });
    uniqueStrings(sessionRollIds).forEach((rollId) => {
      if (!rollIds.has(rollId)) {
        missingReferences.push(`${id}:roll:${rollId}`);
        errors.push(issue("missing-reference", "costSessions", id, "rollIds", `O rolo ${rollId} já não existe.`));
      }
    });
    const consumptions = array(session.consumptions);
    duplicateValues(consumptions.map((line) => text(line.productId)).filter(Boolean)).forEach((productId) => {
      duplicateReferences.push(`${id}:product:${productId}`);
      errors.push(issue("duplicate-reference", "costSessions", id, "consumptions", `A compra ${productId} aparece repetida na mesma sessão.`));
    });
    consumptions.forEach((line) => {
      const productId = text(line.productId);
      if (!productIds.has(productId)) {
        missingReferences.push(`${id}:product:${productId}`);
        errors.push(issue("missing-reference", "costSessions", id, "consumptions", `A compra ${productId || "sem ID"} já não existe.`));
      }
      if (!isNonNegativeNumber(line.amount)) {
        invalidValues.push(`${id}:consumption:${productId}`);
        errors.push(issue("invalid-number", "costSessions", id, "consumptions", "A quantidade consumida deve ser zero ou positiva."));
      }
      if (session.status === "completed" && productIds.has(productId) && isNonNegativeNumber(line.amount)) {
        completedUsage.set(productId, (completedUsage.get(productId) || 0) + Number(line.amount));
      }
    });
  });

  const productsOverCapacity = [];
  completedUsage.forEach((used, productId) => {
    const capacity = productCapacity.get(productId);
    if (!Number.isFinite(capacity) || capacity <= 0 || used <= capacity + 1e-9) return;
    productsOverCapacity.push(productId);
    invalidValues.push(`${productId}:over-capacity`);
    errors.push(issue("over-capacity", "costProducts", productId, "capacity", `A compra ${productId} tem consumo concluído acima da capacidade registada.`));
  });

  templates.forEach((template, index) => {
    const id = text(template.id) || `linha-${index + 1}`;
    if (!text(template.id) || !text(template.name)) {
      missingRequired.push(`templates:${id}`);
      errors.push(issue("missing-required", "templates", id, !text(template.id) ? "id" : "name", "O modelo precisa de ID e nome."));
    }
  });

  return {
    ok: errors.length === 0,
    errorCount: errors.length,
    errors,
    duplicates,
    duplicateCount: Object.values(duplicates).reduce((total, ids) => total + ids.length, 0),
    invalidRollIds,
    rollDateMismatches,
    invalidDates,
    invalidValues,
    missingReferences,
    duplicateReferences,
    productsOverCapacity,
    missingRequired,
    totals: {
      rolls: rolls.length,
      stockLines: stock.length,
      equipment: equipment.length,
      costProducts: products.length,
      costSessions: sessions.length,
      templates: templates.length,
    },
  };
}

export function assertApplicationIntegrity(raw, sourceLabel = "arquivo") {
  const report = applicationIntegrityReport(raw);
  if (report.ok) return report;
  const preview = report.errors.slice(0, 3).map((item) => item.message).join(" ");
  const remaining = Math.max(0, report.errorCount - 3);
  const error = new Error(`O ${sourceLabel} tem ${report.errorCount} ${report.errorCount === 1 ? "problema" : "problemas"}: ${preview}${remaining ? ` Mais ${remaining} por rever.` : ""}`);
  error.code = "rolos/integrity-validation";
  error.report = report;
  throw error;
}

export function remapRollIdReferences(raw, previousId, nextId) {
  const before = text(previousId);
  const after = text(nextId);
  if (!before || !after || before === after) return structuredClone(raw);
  const state = structuredClone(raw);
  state.costCenter = state.costCenter || {};
  state.costCenter.sessions = array(state.costCenter.sessions).map((session) => ({
    ...session,
    rollIds: uniqueStrings(array(session.rollIds).map((id) => text(id) === before ? after : id)),
  }));
  state.workflow = state.workflow || {};
  state.workflow.archiveActivity = array(state.workflow.archiveActivity).map((entry) => ({
    ...entry,
    rollIds: uniqueStrings(array(entry.rollIds).map((id) => text(id) === before ? after : id)),
  }));
  return state;
}

export function recordChangedSinceOpen(current, original) {
  if (!current || !original) return true;
  return canonicalStringify(current) !== canonicalStringify(original);
}

function validateOptionalDates(item, fields, scope, id, invalidDates, errors) {
  fields.forEach((field) => {
    if (!text(item[field])) return;
    if (isCalendarDate(item[field])) return;
    invalidDates.push(`${id}:${field}`);
    errors.push(issue("invalid-date", scope, id, field, "A data não é válida."));
  });
}

function issue(code, scope, id, field, message) {
  return { code, scope, id: text(id), field, message };
}

function duplicateIds(items) {
  const counts = new Map();
  items.forEach((item) => {
    const id = text(item?.id);
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
  });
  return [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
}

function duplicateValues(values) {
  const counts = new Map();
  values.forEach((value) => {
    const normalized = text(value);
    if (normalized) counts.set(normalized, (counts.get(normalized) || 0) + 1);
  });
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
}

function isCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(value));
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  return year >= 1900
    && year <= 9999
    && check.getUTCFullYear() === year
    && check.getUTCMonth() === month - 1
    && check.getUTCDate() === day;
}

function isNonNegativeNumber(value) {
  if (value === "" || value === null || value === undefined) return true;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
}

function isNonNegativeInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0;
}

function uniqueStrings(values) {
  return [...new Set(array(values).map(text).filter(Boolean))];
}

function canonicalStringify(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return String(value ?? "").trim();
}
