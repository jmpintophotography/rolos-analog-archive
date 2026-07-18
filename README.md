# Rolos

Rolos is a private-first web app for cataloguing analogue film rolls, stock, equipment, processing progress and archive locations. It runs in a browser, can be installed as an app on Android and Windows, and does not require a build step.

[Português](docs/README-PT.md) · [Installation guide](docs/INSTALLATION-EN.md) · [Guia de instalação muito detalhado](docs/INSTALLATION-PT.md)

## Why this exists

This began as a personal project because the available tools did not fit the author's analogue photography workflow: tracking a roll from loading to archival, keeping negative codes and folders consistent, and seeing useful statistics without returning to a spreadsheet.

The project was designed and built with help from OpenAI Codex.

## Main features

- Roll workflow from `In use` to `Archived`.
- Progressive new-roll form with quick choices for recent cameras, locations and film stock.
- One-step roll loading from stock and `New similar roll` from an existing record.
- Film stock, expiry dates and packaging images.
- Camera, lens and accessory catalogue.
- Search, filters, statistics and location map.
- Automatic coordinates for new place names when a roll is saved.
- Portuguese and English interface.
- JSON, Excel and CSV import/export.
- Local storage, optional private Firebase synchronisation and weekly history.
- Optional weekly Google Drive copy with a 54-week retention limit.
- Installable Progressive Web App for Android and Windows.

## Try the demo

The repository ships in demo mode with exactly 10 fictional rolls. It contains no personal archive, credentials, private paths or proprietary film-package scans.

The easiest preview is to deploy the `app` directory to any static host. For a local preview:

```bash
cd app
python -m http.server 8080
```

Then open `http://localhost:8080`. Opening `index.html` directly is not supported because browsers block parts of the offline and data-loading flow on `file://` pages.

## Private installation

Follow [INSTALLATION-EN.md](docs/INSTALLATION-EN.md) or the especially detailed [INSTALLATION-PT.md](docs/INSTALLATION-PT.md). Private mode uses Google sign-in plus Firestore rules that restrict the archive to the configured owner account.

When private mode is enabled, the bundled 10-roll demo is automatically ignored and a new empty archive is created.

## Project structure

```text
app/                         Static application
app/data/seed.json           Fictional 10-roll demo database
docs/                        Installation, use and privacy guides
tests/                       Dependency-free safety checks
firestore.rules.example      Private Firestore rule template
netlify.toml                 Netlify publish and security headers
```

## Development

There is no framework or compilation step. Edit the files in `app`, serve that directory over HTTP, and run:

```bash
npm test
```

The tests validate the demo count, privacy boundaries, release version, translations, geocoding client and offline cache manifest.

## Location lookup and privacy

New place names are sent to the configured OpenStreetMap Nominatim endpoint only after the user saves a roll. Results are cached, requests are queued at a maximum of one per second, and a failed lookup never prevents a roll from being saved. Do not enter a home address or other confidential location. See [GEOCODING-PRIVACY.md](docs/GEOCODING-PRIVACY.md).

## Film-package images

The public repository intentionally does not redistribute the author's scanned film-package images. Upload images that you own or are allowed to use through the Packaging view.

## Security

Read [SECURITY.md](SECURITY.md) before making a private deployment. Client-side Firebase configuration identifies a project but does not replace access control; the Firestore rules are mandatory.

## Licence

[MIT](LICENSE). Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).
