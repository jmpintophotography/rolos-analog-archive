const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const DAY_MS = 24 * 60 * 60 * 1000;

export function localCalendarDateToIso(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "";
  return calendarPartsToIso(value.getFullYear(), value.getMonth() + 1, value.getDate());
}

export function excelSerialDateToIso(value) {
  const serial = Number(value);
  if (!Number.isFinite(serial) || serial <= 0) return "";
  const wholeDays = Math.floor(serial + Number.EPSILON);
  const date = new Date(EXCEL_EPOCH_UTC + wholeDays * DAY_MS);
  return calendarPartsToIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function calendarValueToIso(value) {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) return localCalendarDateToIso(value);
  if (typeof value === "number") return excelSerialDateToIso(value);

  const text = String(value).trim();
  if (!text || text === "-") return "";

  const isoPrefix = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(text);
  if (isoPrefix) return calendarPartsToIso(Number(isoPrefix[1]), Number(isoPrefix[2]), Number(isoPrefix[3]));

  const portuguese = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(text);
  if (portuguese) return calendarPartsToIso(Number(portuguese[3]), Number(portuguese[2]), Number(portuguese[1]));

  return "";
}

export function rollCalendarFromId(value) {
  const raw = String(value ?? "").trim();
  const id = /^\d{7}$/.test(raw) ? raw.padStart(8, "0") : raw;
  const match = /^(\d{2})(\d{2})(\d{4})$/.exec(id);
  if (!match) return { valid: false, id, reason: "O ID deve ter o formato IIMMAAAA." };

  const sequence = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (sequence < 1) return { valid: false, id, reason: "Os dois primeiros dígitos devem começar em 01." };
  if (month < 1 || month > 12) return { valid: false, id, reason: "O mês do ID deve estar entre 01 e 12." };
  if (year < 1900 || year > 9999) return { valid: false, id, reason: "O ano do ID não é válido." };

  return {
    valid: true,
    id,
    sequence,
    month,
    year,
    date: `${year}-${String(month).padStart(2, "0")}-01`,
  };
}

export function nextRollIdForMonth(dateValue, existingIds = []) {
  const calendarDate = calendarValueToIso(dateValue);
  if (!calendarDate) return "";

  const year = Number(calendarDate.slice(0, 4));
  const month = Number(calendarDate.slice(5, 7));
  const sequences = existingIds
    .map((id) => rollCalendarFromId(id))
    .filter((calendar) => calendar.valid && calendar.year === year && calendar.month === month)
    .map((calendar) => calendar.sequence);
  const nextSequence = Math.max(0, ...sequences) + 1;
  if (nextSequence > 99) return "";

  return `${String(nextSequence).padStart(2, "0")}${String(month).padStart(2, "0")}${year}`;
}

export function reconcileImportedRollDates(rolls, sourceLabel = "ficheiro") {
  if (!Array.isArray(rolls)) throw importValidationError(`O ${sourceLabel} não contém uma lista de rolos válida.`);

  const seen = new Set();
  const reconciled = rolls.map((roll, index) => {
    const calendar = rollCalendarFromId(roll?.id);
    if (!calendar.valid) {
      throw importValidationError(`ID inválido na linha ${index + 1}: “${String(roll?.id ?? "")}”. ${calendar.reason}`);
    }
    if (seen.has(calendar.id)) {
      throw importValidationError(`O ID ${calendar.id} aparece mais do que uma vez. A importação foi cancelada.`);
    }
    seen.add(calendar.id);
    return { ...roll, id: calendar.id, date: calendar.date };
  });

  return reconciled;
}

function calendarPartsToIso(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return "";
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return "";
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return "";
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function importValidationError(message) {
  const error = new Error(message);
  error.code = "rolos/import-validation";
  return error;
}
