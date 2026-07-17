# Location lookup and privacy

Rolos can place new location names on its map. The default lookup provider is the public OpenStreetMap Nominatim service.

## What is sent

Only the location label entered in the roll form is sent, for example `Paris`. Roll codes, film details, notes, account details and the rest of the archive are not included in that request.

Do not enter a home address, a private studio address or any other confidential information as a location label. A third-party geocoding provider necessarily receives the text needed to perform the lookup.

## When a request occurs

- Only after a roll is saved.
- Only for a location without a valid cached result.
- Never while typing and never as autocomplete.
- At no more than one request per second.
- An unsuccessful or offline request never prevents the roll from being saved.

Successful results are stored in `locationCoordinates` and reused by all rolls with the same normalized label. A not-found result may be tried again after 30 days.

## Ambiguous and multiple places

Check the map after entering an unfamiliar or ambiguous place. The first result may not be the place you intended.

The current archive format treats commas as separators between different places. Use `Paris`, or `Paris França` when extra context is essential; do not use `Paris, França` as a single label.

## Changing or disabling the provider

Edit `app/app-config.js`:

```js
window.ROLOS_APP_CONFIG = {
  geocoding: {
    enabled: true,
    endpoint: "https://nominatim.openstreetmap.org/search",
    minIntervalMs: 1100,
    timeoutMs: 10000,
  },
};
```

Set `enabled` to `false` to disable automatic lookup. A self-hosted or compatible alternative endpoint can be configured without changing the application code. Check the chosen provider's terms before changing the endpoint.

## OpenStreetMap requirements

The app displays OpenStreetMap attribution near the map, caches results, avoids autocomplete and queues requests. Operators of public or busy installations should not rely on the community Nominatim endpoint and should use a suitable provider or self-hosted service.

References: [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) and [Nominatim Search API](https://nominatim.org/release-docs/latest/api/Search/).
