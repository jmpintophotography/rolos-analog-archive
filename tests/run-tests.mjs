import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createGeocodingClient } from "../app/geocoding.js";
import { normalizeLanguage, translatePhrase } from "../app/i18n.js";
import { nextRollIdForMonth, rollCalendarFromId } from "../app/calendar-dates.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFile(join(root, path), "utf8");
const seed = JSON.parse(await read("app/data/seed.json"));
const appSource = await read("app/app.js");
const indexSource = await read("app/index.html");
const stylesSource = await read("app/styles.css");
const swSource = await read("app/sw.js");
const firebaseConfig = await read("app/firebase-config.js");
const filmImageCatalog = await read("app/data/film-images.js");
const equipmentImageCatalog = await read("app/data/equipment-images.js");

assert.equal(seed.rolls.length, 10, "The public database must contain exactly 10 demo rolls.");
assert.ok(seed.rolls.every((roll) => roll.createdFrom === "demo"));
assert.ok(seed.rolls.every((roll) => !roll.photosUrl));
assert.equal(seed.meta.releaseVersion, "2.1");
assert.match(firebaseConfig, /demoMode:\s*true/);
assert.match(firebaseConfig, /privateAccess:\s*false/);
assert.match(appSource, /const RELEASE_VERSION = "2\.8\.1"/);
assert.match(appSource, /Organiza cada rolo, acompanha o processo e mantém o foco na fotografia\./);
assert.doesNotMatch(appSource, /Registos e Stock v3\.xlsx/);
assert.match(indexSource, /data-action="toggle-language"/);
assert.match(indexSource, />v2\.8\.1</);
assert.match(indexSource, /data-lucide="globe-2"/);
assert.match(indexSource, /class="nav-item" href="\.\/manual\.html"/);
assert.match(indexSource, /data-lucide="book-open"/);
assert.match(stylesSource, /grid-template-columns: 44px 64px 44px minmax\(0, 1fr\)/);
assert.match(stylesSource, /white-space: nowrap/);
assert.match(appSource, /data-action="new-roll-from-stock"/);
assert.match(appSource, /data-action="duplicate-roll"/);
assert.match(appSource, /Usar preenchimento rápido/);
assert.match(appSource, /consumeStock/);
assert.match(appSource, /openCommandPalette/);
assert.match(appSource, /getArchiveReview/);
assert.match(appSource, /toggleFavorite/);
assert.match(appSource, /undoLastChange/);
assert.match(swSource, /\.\/geocoding\.js/);
assert.match(swSource, /\.\/i18n\.js/);
assert.match(swSource, /assets\/film-packages/);
assert.match(swSource, /assets\/equipment/);
assert.match(swSource, /\.\/data\/equipment-images\.js/);
assert.equal((filmImageCatalog.match(/\bsrc:/g) || []).length, 70);
assert.equal((equipmentImageCatalog.match(/\bsrc:/g) || []).length, 28);
assert.match(equipmentImageCatalog, /camera-leica-m6/);
assert.match(equipmentImageCatalog, /accessory-godox-im30pro/);
assert.match(appSource, /detail-hero-film/);
assert.match(appSource, /findEquipmentImageForRoll/);
assert.match(appSource, /stock-mobile-summary/);
assert.match(stylesSource, /\.stock-table \.stock-mobile-summary/);
assert.match(swSource, /\.\/calendar-dates\.js/);
assert.ok(seed.rolls.every((roll) => rollCalendarFromId(roll.id).date === roll.date));
assert.equal(nextRollIdForMonth("2026-07-01", ["01072026", "03072026"]), "04072026");
assert.match(appSource, /deleteCloudHistoryVersion/);
assert.match(appSource, /deleteAllCloudHistory/);
assert.match(appSource, /uploadManualBackup/);
assert.doesNotMatch(appSource, /driveClient\.pruneBackupHistory/);
assert.match(appSource, /renderQuickCapturePanel/);
assert.match(appSource, /renderArchiveIntegrityPanel/);
assert.match(appSource, /renderPhysicalArchivePanel/);
assert.match(appSource, /backupRestoreDiff/);
assert.match(swSource, /\.\/v25-core\.js/);
assert.match(swSource, /\.\/cost-center-core\.js/);
assert.match(swSource, /\.\/integrity-core\.js/);
assert.match(swSource, /\.\/manual\.html/);
assert.match(appSource, /renderCostCenter/);
assert.match(appSource, /normalizeCostCenter/);
assert.match(appSource, /normalizeValidatedState/);
assert.match(appSource, /recordChangedSinceOpen/);
assert.match(appSource, /remapRollIdReferences/);
assert.match(appSource, /Detalhes opcionais/);
assert.match(appSource, /isNew \? "month" : "computed"/);
assert.match(appSource, /toggle-retired-equipment/);
assert.match(indexSource, /data-view="costs"/);

assert.equal(normalizeLanguage("en-US"), "en");
assert.equal(normalizeLanguage("pt-PT"), "pt");
assert.equal(translatePhrase("Novo rolo", "en"), "New roll");
assert.equal(translatePhrase("New roll", "pt"), "Novo rolo");

const calls = [];
const geocoder = createGeocodingClient({
  minIntervalMs: 1000,
  sleep: async () => {},
  now: (() => { let value = 0; return () => (value += 1100); })(),
  fetchImpl: async (url) => {
    calls.push(String(url));
    return {
      ok: true,
      json: async () => [{ lat: "48.8566", lon: "2.3522", display_name: "Paris, France" }],
    };
  },
});
const paris = await geocoder.search("Paris", { language: "en" });
assert.deepEqual(paris, {
  lat: 48.8566,
  lon: 2.3522,
  displayName: "Paris, France",
  source: "nominatim-openstreetmap",
});
assert.equal(calls.length, 1);
assert.match(calls[0], /q=Paris/);

const shellMatches = [...swSource.matchAll(/^\s*"(\.\/[^"?]+)"/gm)].map((match) => match[1]);
for (const asset of shellMatches) {
  if (asset === "./") continue;
  const path = join(root, "app", asset.slice(2));
  assert.ok((await stat(path)).isFile(), `Service worker asset does not exist: ${asset}`);
}

const privatePatterns = [
  new RegExp(["rolos", "privado"].join("-"), "iu"),
  new RegExp(["rolos-", "jm", "pinto"].join(""), "iu"),
  new RegExp(["jm", "pinto\\.photography"].join(""), "iu"),
  /AIza[0-9A-Za-z_-]{20,}/u,
  new RegExp(`C:\\\\Users\\\\${["se", "que"].join("")}`, "iu"),
  /D:\\(?:Fotos|Photos)/iu,
  /Dropbox[\\/](?:Photos|Fotos)/iu,
];
const textExtensions = new Set([".css", ".html", ".js", ".json", ".md", ".mjs", ".toml", ".txt", ".webmanifest", ".yml"]);
for (const path of await walk(root)) {
  if (!textExtensions.has(path.slice(path.lastIndexOf(".")))) continue;
  const content = await readFile(path, "utf8");
  for (const pattern of privatePatterns) {
    assert.doesNotMatch(content, pattern, `Private value found in ${relative(root, path)}`);
  }
}

console.log("Rolos v2.8.1 public checks passed: demo privacy, offline manual navigation, full integrity checks, historical ID increment, simplified roll entry, cost centre, hidden sold equipment, visual detail, equipment catalogue, quick capture, physical archive, backup confidence, operational metrics, calendar dates, search, translations, geocoding and offline shell.");

async function walk(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await walk(path));
    else paths.push(path);
  }
  return paths;
}
