export const V25_WORKSPACE_VERSION = 1;

export function normalizeV25Workspace(raw = {}) {
  const templates = Array.isArray(raw.templates) ? raw.templates : [];
  const archiveActivity = Array.isArray(raw.archiveActivity) ? raw.archiveActivity : [];
  return {
    version: V25_WORKSPACE_VERSION,
    templates: templates
      .map(normalizeTemplate)
      .filter((item) => item.id && item.name)
      .slice(0, 30),
    archiveActivity: archiveActivity
      .map((item) => ({
        id: text(item.id),
        at: text(item.at),
        action: text(item.action),
        rollIds: uniqueStrings(item.rollIds),
        detail: text(item.detail),
      }))
      .filter((item) => item.id && item.at)
      .slice(-200),
    lastIntegrityCheckAt: text(raw.lastIntegrityCheckAt),
  };
}

export function captureTemplateFromRoll(name, roll = {}, now = new Date()) {
  const safeName = text(name);
  if (!safeName) throw new Error("O modelo precisa de um nome.");
  const stamp = dateValue(now).toISOString().replace(/\D/g, "").slice(0, 17);
  return normalizeTemplate({
    id: `template-${slug(safeName) || "rolo"}-${stamp}`,
    name: safeName,
    createdAt: dateValue(now).toISOString(),
    capture: captureFields(roll),
  });
}

export function captureFields(roll = {}) {
  return {
    camera: text(roll.camera),
    lens: text(roll.lens),
    filmBrand: text(roll.filmBrand),
    filmModel: text(roll.filmModel),
    iso: numericOrText(roll.iso),
    format: text(roll.format),
    type: text(roll.type),
    push: numberOrZero(roll.push),
    shotLocation: text(roll.shotLocation),
    developedAt: text(roll.developedAt),
    scannedAt: text(roll.scannedAt),
    developerMethod: text(roll.developerMethod),
    project: text(roll.project),
  };
}

export function archiveIntegrityReport(state = {}) {
  const rolls = Array.isArray(state.rolls) ? state.rolls : [];
  const stock = Array.isArray(state.stock) ? state.stock : [];
  const equipment = Array.isArray(state.equipment) ? state.equipment : [];
  const counts = new Map();
  rolls.forEach((roll) => counts.set(text(roll.id), (counts.get(text(roll.id)) || 0) + 1));
  const duplicateIds = [...counts.entries()].filter(([id, count]) => id && count > 1).map(([id]) => id);
  const invalidIds = [];
  const dateMismatches = [];
  const missingArchive = [];
  const missingPhysical = [];
  rolls.forEach((roll) => {
    const parsed = rollCalendarFromId(roll.id);
    if (!parsed.valid) invalidIds.push(text(roll.id));
    else if (text(roll.date) !== parsed.date) dateMismatches.push(text(roll.id));
    if (text(roll.status) === "Arquivado" && !text(roll.archiveLocation)) missingArchive.push(text(roll.id));
    if (text(roll.status) === "Arquivado" && (!roll.negativePresent || !roll.scanFilesPresent)) missingPhysical.push(text(roll.id));
  });
  const negativeStock = stock.filter((item) => numberOrZero(item.quantity) < 0).map((item) => text(item.id));
  const totalStock = stock.reduce((total, item) => total + Math.max(0, numberOrZero(item.quantity)), 0);
  return {
    ok: !duplicateIds.length && !invalidIds.length && !dateMismatches.length && !negativeStock.length,
    rolls: rolls.length,
    stockLines: stock.length,
    stockQuantity: totalStock,
    equipment: equipment.length,
    duplicateIds,
    invalidIds,
    dateMismatches,
    negativeStock,
    missingArchive,
    missingPhysical,
  };
}

export function backupRestoreDiff(current = {}, candidate = {}) {
  const currentRolls = Array.isArray(current.rolls) ? current.rolls : [];
  const candidateRolls = Array.isArray(candidate.rolls) ? candidate.rolls : [];
  const currentIds = new Set(currentRolls.map((roll) => text(roll.id)).filter(Boolean));
  const candidateIds = new Set(candidateRolls.map((roll) => text(roll.id)).filter(Boolean));
  const added = [...candidateIds].filter((id) => !currentIds.has(id));
  const removed = [...currentIds].filter((id) => !candidateIds.has(id));
  const changed = candidateRolls.filter((roll) => {
    if (!currentIds.has(text(roll.id))) return false;
    const existing = currentRolls.find((item) => text(item.id) === text(roll.id));
    return stableStringify(existing) !== stableStringify(roll);
  }).map((roll) => text(roll.id));
  return {
    currentRolls: currentRolls.length,
    candidateRolls: candidateRolls.length,
    added,
    removed,
    changed,
    stockDelta: stockQuantity(candidate.stock) - stockQuantity(current.stock),
    equipmentDelta: arrayLength(candidate.equipment) - arrayLength(current.equipment),
    candidateIntegrity: archiveIntegrityReport(candidate),
  };
}

export function applyBatchArchiveUpdate(rolls = [], selectedIds = [], changes = {}, now = new Date()) {
  const selected = new Set(selectedIds.map(text));
  const sourceDate = dateValue(now);
  const timestamp = sourceDate.toISOString();
  const archiveDate = localCalendarIso(sourceDate);
  let updated = 0;
  const result = rolls.map((roll) => {
    if (!selected.has(text(roll.id))) return roll;
    updated += 1;
    const next = { ...roll };
    if (changes.archiveLocation != null) next.archiveLocation = text(changes.archiveLocation);
    if (changes.negativePresent != null) next.negativePresent = Boolean(changes.negativePresent);
    if (changes.contactSheetPresent != null) next.contactSheetPresent = Boolean(changes.contactSheetPresent);
    if (changes.scanFilesPresent != null) next.scanFilesPresent = Boolean(changes.scanFilesPresent);
    if (changes.status) next.status = text(changes.status);
    next.archiveUpdatedAt = timestamp;
    if (next.status === "Arquivado" && !next.archivedAt) next.archivedAt = archiveDate;
    return next;
  });
  return { rolls: result, updated };
}

export function rollCost(roll = {}) {
  return roundMoney(numberOrZero(roll.filmCost) + numberOrZero(roll.developmentCost) + numberOrZero(roll.scanCost));
}

export function financialSummary(rolls = [], stock = []) {
  const tracked = rolls.filter((roll) => rollCost(roll) > 0);
  const total = roundMoney(tracked.reduce((sum, roll) => sum + rollCost(roll), 0));
  const byYear = new Map();
  tracked.forEach((roll) => {
    const year = /^\d{4}/.test(text(roll.date)) ? text(roll.date).slice(0, 4) : "Sem ano";
    byYear.set(year, roundMoney((byYear.get(year) || 0) + rollCost(roll)));
  });
  const stockValue = roundMoney((Array.isArray(stock) ? stock : [])
    .reduce((sum, item) => sum + Math.max(0, numberOrZero(item.quantity)) * Math.max(0, numberOrZero(item.unitCost)), 0));
  return {
    trackedRolls: tracked.length,
    total,
    average: tracked.length ? roundMoney(total / tracked.length) : 0,
    stockValue,
    byYear,
  };
}

export function processingDurationSummary(rolls = []) {
  const shotToDevelop = durations(rolls, "shotCompletedAt", "developmentCompletedAt");
  const developToScan = durations(rolls, "developmentCompletedAt", "scanCompletedAt");
  const scanToArchive = durations(rolls, "scanCompletedAt", "archivedAt");
  return {
    shotToDevelop: durationResult(shotToDevelop),
    developToScan: durationResult(developToScan),
    scanToArchive: durationResult(scanToArchive),
  };
}

export function stockForecast(stock = [], rolls = [], now = new Date()) {
  const today = dateValue(now);
  const yearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  const recentRolls = (Array.isArray(rolls) ? rolls : []).filter((roll) => {
    const date = calendarDate(roll.date);
    return date && date >= yearAgo && date <= today;
  });
  const monthlyUse = recentRolls.length / 12;
  const totalStock = stockQuantity(stock);
  const expiring = [];
  const expired = [];
  (Array.isArray(stock) ? stock : []).forEach((item) => {
    if (!text(item.expiryDate) || numberOrZero(item.quantity) <= 0) return;
    const expiry = calendarDate(item.expiryDate);
    if (!expiry) return;
    const days = Math.ceil((expiry - today) / 86400000);
    const entry = { id: text(item.id), label: `${text(item.brand)} ${text(item.model)}`.trim(), quantity: numberOrZero(item.quantity), days };
    if (days < 0) expired.push(entry);
    else if (days <= 180) expiring.push(entry);
  });
  return {
    totalStock,
    monthlyUse,
    monthsRemaining: monthlyUse > 0 ? Math.round((totalStock / monthlyUse) * 10) / 10 : null,
    expiring: expiring.sort((a, b) => a.days - b.days),
    expired: expired.sort((a, b) => a.days - b.days),
  };
}

export function qrSvgForRollId(id, options = {}) {
  const value = text(id);
  if (!/^\d{8}$/.test(value)) throw new Error("O QR requer um ID de rolo com 8 dígitos.");
  const matrix = qrVersionOneNumeric(value);
  const scale = Math.max(2, Number(options.scale) || 6);
  const quiet = 4;
  const size = matrix.length + quiet * 2;
  const cells = [];
  matrix.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) cells.push(`<rect x="${x + quiet}" y="${y + quiet}" width="1" height="1"/>`);
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size * scale}" height="${size * scale}" role="img" aria-label="QR ${value}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><g fill="#000">${cells.join("")}</g></svg>`;
}

function normalizeTemplate(raw = {}) {
  return {
    id: text(raw.id),
    name: text(raw.name),
    createdAt: text(raw.createdAt),
    capture: captureFields(raw.capture || {}),
  };
}

function rollCalendarFromId(value) {
  const id = text(value);
  const match = /^(\d{2})(\d{2})(\d{4})$/.exec(id);
  if (!match) return { valid: false, date: "" };
  const sequence = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (sequence < 1 || month < 1 || month > 12 || year < 1900 || year > 2200) return { valid: false, date: "" };
  return { valid: true, date: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01` };
}

function qrVersionOneNumeric(value) {
  const data = [];
  pushBits(data, 0b0001, 4);
  pushBits(data, value.length, 10);
  for (let index = 0; index < value.length; index += 3) {
    const chunk = value.slice(index, index + 3);
    pushBits(data, Number(chunk), chunk.length === 3 ? 10 : chunk.length === 2 ? 7 : 4);
  }
  pushBits(data, 0, Math.min(4, 152 - data.length));
  while (data.length % 8) data.push(0);
  const codewords = bitsToBytes(data);
  for (let pad = 0; codewords.length < 19; pad += 1) codewords.push(pad % 2 ? 0x11 : 0xec);
  const allCodewords = [...codewords, ...reedSolomonRemainder(codewords, 7)];
  const bits = [];
  allCodewords.forEach((byte) => pushBits(bits, byte, 8));

  const size = 21;
  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));
  drawFinder(modules, reserved, 0, 0);
  drawFinder(modules, reserved, size - 7, 0);
  drawFinder(modules, reserved, 0, size - 7);
  for (let index = 8; index < size - 8; index += 1) {
    setFunction(modules, reserved, index, 6, index % 2 === 0);
    setFunction(modules, reserved, 6, index, index % 2 === 0);
  }
  reserveFormat(reserved, size);
  setFunction(modules, reserved, 8, size - 8, true);

  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let offset = 0; offset < size; offset += 1) {
      const y = upward ? size - 1 - offset : offset;
      for (let column = 0; column < 2; column += 1) {
        const x = right - column;
        if (reserved[y][x]) continue;
        const raw = bitIndex < bits.length ? Boolean(bits[bitIndex]) : false;
        modules[y][x] = raw !== ((x + y) % 2 === 0);
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
  drawFormat(modules, reserved, size, 0);
  return modules;
}

function drawFinder(modules, reserved, left, top) {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const x = left + dx;
      const y = top + dy;
      if (x < 0 || y < 0 || y >= modules.length || x >= modules.length) continue;
      const inside = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      const dark = inside && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
      setFunction(modules, reserved, x, y, dark);
    }
  }
}

function reserveFormat(reserved, size) {
  const positions = [];
  for (let index = 0; index <= 5; index += 1) positions.push([8, index]);
  positions.push([8, 7], [8, 8], [7, 8]);
  for (let index = 9; index <= 14; index += 1) positions.push([14 - index, 8]);
  for (let index = 0; index <= 7; index += 1) positions.push([size - 1 - index, 8]);
  for (let index = 8; index <= 14; index += 1) positions.push([8, size - 15 + index]);
  positions.forEach(([x, y]) => { reserved[y][x] = true; });
}

function drawFormat(modules, reserved, size, mask) {
  const data = (0b01 << 3) | mask;
  let remainder = data << 10;
  for (let bit = 14; bit >= 10; bit -= 1) {
    if ((remainder >>> bit) & 1) remainder ^= 0x537 << (bit - 10);
  }
  const value = ((data << 10) | remainder) ^ 0x5412;
  const bit = (index) => Boolean((value >>> index) & 1);
  for (let index = 0; index <= 5; index += 1) setFunction(modules, reserved, 8, index, bit(index));
  setFunction(modules, reserved, 8, 7, bit(6));
  setFunction(modules, reserved, 8, 8, bit(7));
  setFunction(modules, reserved, 7, 8, bit(8));
  for (let index = 9; index <= 14; index += 1) setFunction(modules, reserved, 14 - index, 8, bit(index));
  for (let index = 0; index <= 7; index += 1) setFunction(modules, reserved, size - 1 - index, 8, bit(index));
  for (let index = 8; index <= 14; index += 1) setFunction(modules, reserved, 8, size - 15 + index, bit(index));
  setFunction(modules, reserved, 8, size - 8, true);
}

function setFunction(modules, reserved, x, y, dark) {
  modules[y][x] = Boolean(dark);
  reserved[y][x] = true;
}

function reedSolomonRemainder(data, degree) {
  const generator = reedSolomonGenerator(degree);
  const result = Array(degree).fill(0);
  data.forEach((byte) => {
    const factor = byte ^ result.shift();
    result.push(0);
    for (let index = 0; index < degree; index += 1) result[index] ^= gfMultiply(generator[index], factor);
  });
  return result;
}

function reedSolomonGenerator(degree) {
  const result = Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let step = 0; step < degree; step += 1) {
    for (let index = 0; index < degree; index += 1) {
      result[index] = gfMultiply(result[index], root);
      if (index + 1 < degree) result[index] ^= result[index + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function gfMultiply(left, right) {
  let x = left;
  let y = right;
  let product = 0;
  while (y) {
    if (y & 1) product ^= x;
    y >>>= 1;
    x = (x << 1) ^ ((x >>> 7) * 0x11d);
  }
  return product;
}

function pushBits(target, value, length) {
  for (let bit = length - 1; bit >= 0; bit -= 1) target.push((value >>> bit) & 1);
}

function bitsToBytes(bits) {
  const result = [];
  for (let index = 0; index < bits.length; index += 8) {
    let value = 0;
    for (let offset = 0; offset < 8; offset += 1) value = (value << 1) | (bits[index + offset] || 0);
    result.push(value);
  }
  return result;
}

function durations(items, fromField, toField) {
  return items.map((item) => {
    const from = dateValueOrNull(item[fromField]);
    const to = dateValueOrNull(item[toField]);
    if (!from || !to || to < from) return null;
    return Math.round((to - from) / 86400000);
  }).filter((value) => value != null);
}

function durationResult(values) {
  return {
    tracked: values.length,
    averageDays: values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null,
  };
}

function stockQuantity(stock) {
  return (Array.isArray(stock) ? stock : []).reduce((sum, item) => sum + Math.max(0, numberOrZero(item.quantity)), 0);
}

function arrayLength(value) {
  return Array.isArray(value) ? value.length : 0;
}

function calendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(value));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  if (Number.isNaN(date.getTime())
    || date.getFullYear() !== Number(match[1])
    || date.getMonth() !== Number(match[2]) - 1
    || date.getDate() !== Number(match[3])) return null;
  return date;
}

function localCalendarIso(date) {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateValue(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date(0);
  return date;
}

function dateValueOrNull(value) {
  if (!text(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function roundMoney(value) {
  return Math.round((numberOrZero(value) + Number.EPSILON) * 100) / 100;
}

function numericOrText(value) {
  if (value == null || value === "") return "";
  const number = Number(value);
  return Number.isFinite(number) ? number : text(value);
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function text(value) {
  return String(value ?? "").trim();
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))];
}

function slug(value) {
  return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
