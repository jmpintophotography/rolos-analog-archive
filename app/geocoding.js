const DEFAULT_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const DEFAULT_MIN_INTERVAL_MS = 1100;
const DEFAULT_TIMEOUT_MS = 10000;

export function createGeocodingClient(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const endpoint = safeEndpoint(options.endpoint || DEFAULT_ENDPOINT);
  const enabled = options.enabled !== false;
  const minIntervalMs = Math.max(1000, Number(options.minIntervalMs) || DEFAULT_MIN_INTERVAL_MS);
  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS);
  const now = options.now || (() => Date.now());
  const wait = options.wait || ((delay) => new Promise((resolve) => setTimeout(resolve, delay)));
  let queue = Promise.resolve();
  let lastRequestAt = 0;

  async function runSearch(label, language = "pt") {
    if (!enabled || typeof fetchImpl !== "function") return null;
    const query = String(label || "").trim();
    if (!query) return null;

    const delay = Math.max(0, minIntervalMs - (now() - lastRequestAt));
    if (delay) await wait(delay);

    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      limit: "1",
      addressdetails: "0",
      "accept-language": language === "en" ? "en" : "pt-PT,pt,en",
    });
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      lastRequestAt = now();
      const response = await fetchImpl(`${endpoint}?${params.toString()}`, {
        headers: { Accept: "application/json" },
        referrerPolicy: "strict-origin-when-cross-origin",
        signal: controller?.signal,
      });
      if (!response.ok) {
        const error = new Error(`Geocoding service returned ${response.status}.`);
        error.status = response.status;
        throw error;
      }

      const results = await response.json();
      const result = Array.isArray(results) ? results[0] : null;
      const lat = Number(result?.lat);
      const lon = Number(result?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        return null;
      }

      return {
        lat,
        lon,
        displayName: String(result.display_name || query),
        source: "nominatim-openstreetmap",
      };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  return {
    search(label, searchOptions = {}) {
      const task = queue.then(() => runSearch(label, searchOptions.language));
      queue = task.catch(() => null);
      return task;
    },
  };
}

function safeEndpoint(value) {
  try {
    const url = new URL(String(value));
    if (url.protocol !== "https:") throw new Error("Geocoding endpoint must use HTTPS.");
    return url.toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_ENDPOINT;
  }
}
