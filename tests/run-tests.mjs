import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createGeocodingClient } from "../app/geocoding.js";
import { normalizeLanguage, translatePhrase } from "../app/i18n.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFile(join(root, path), "utf8");
const seed = JSON.parse(await read("app/data/seed.json"));
const appSource = await read("app/app.js");
const indexSource = await read("app/index.html");
const swSource = await read("app/sw.js");
const firebaseConfig = await read("app/firebase-config.js");

assert.equal(seed.rolls.length, 10, "The public database must contain exactly 10 demo rolls.");
assert.ok(seed.rolls.every((roll) => roll.createdFrom === "demo"));
assert.ok(seed.rolls.every((roll) => !roll.photosUrl));
assert.equal(seed.meta.releaseVersion, "1.10");
assert.match(firebaseConfig, /demoMode:\s*true/);
assert.match(firebaseConfig, /privateAccess:\s*false/);
assert.match(appSource, /const RELEASE_VERSION = "1\.10"/);
assert.match(appSource, /Organiza cada rolo, acompanha o processo e mantém o foco na fotografia\./);
assert.doesNotMatch(appSource, /Registos e Stock v3\.xlsx/);
assert.match(indexSource, /data-action="toggle-language"/);
assert.match(indexSource, />v1\.10</);
assert.match(swSource, /\.\/geocoding\.js/);
assert.match(swSource, /\.\/i18n\.js/);
assert.doesNotMatch(swSource, /film-packages/);

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

console.log("Rolos v1.10 public checks passed: demo data, privacy, translations, geocoding and offline shell.");

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
