# Rolos

Rolos is a private-first web app for cataloguing analogue film rolls, stock, equipment, processing progress and archive locations. It runs in a browser, can be installed as an app on Android and Windows, and does not require a build step.

[Português](docs/README-PT.md) · [Manual completo](docs/MANUAL-PT.md) · [Installation guide](docs/INSTALLATION-EN.md) · [Guia de instalação muito detalhado](docs/INSTALLATION-PT.md)

## Why this exists

This began as a personal project because the available tools did not fit the author's analogue photography workflow: tracking a roll from loading to archival, keeping negative codes and folders consistent, and seeing useful statistics without returning to a spreadsheet.

The project was designed and built with help from OpenAI Codex.

## Main features

- Universal local search across rolls, stock and equipment, with keyboard shortcuts and quick actions.
- Read-only smart review for unfinished rolls, missing physical archive locations, incomplete identification and expiring stock.
- Roll favourites available from the dashboard, review, catalogue, list and detail view.
- Twelve-second undo for important archive changes, including saves, deletions, status changes and stock consumption.
- Roll workflow from `In use` to `Archived`.
- Simplified progressive new-roll form: essential fields first, optional details grouped and available when needed.
- Historical roll entry with safe month-based ID generation.
- Quick capture with repeat-last setup, personal templates and save-and-add-another.
- Touch-friendly wrapping quick-choice grid with no horizontal dragging on mobile.
- One-step roll loading from stock and `New similar roll` from an existing record.
- Film stock, expiry dates and packaging images.
- Compact mobile stock-list cards with no horizontal dragging.
- Optional project, cost and processing-time tracking with stock-value and runway insights.
- Detailed cost centre for chemicals, film and consumables, with quantity- or roll-based capacity.
- Home-development and external-lab sessions with automatic per-roll cost allocation and financial comparison.
- Physical archive batch tools, offline QR labels and QR/manual roll lookup.
- Camera, lens and accessory catalogue.
- Sold or written-off equipment hidden by default without deleting its history.
- Optional film backgrounds and camera/lens photographs in roll details.
- Optional equipment photographs in the visual catalogue.
- Search, filters, statistics and location map.
- Automatic coordinates for new place names when a roll is saved.
- Portuguese and English interface.
- JSON, Excel and CSV import/export.
- Timezone-safe calendar dates, with roll IDs as the definitive month/year reference on import.
- Protected fresh-start workflow when an imported backup must replace an older Firebase archive.
- Local storage, optional private Firebase synchronisation and weekly history.
- Firebase history management with protected deletion controls and an estimated document-usage summary.
- Non-destructive backup checks, restore previews, named/protected backups and known-device status.
- Full data-integrity validation before import, export, restore or synchronisation.
- Duplicate, broken-reference, invalid-value and concurrent-edit protection.
- Optional manual Google Drive copies, with a weekly reminder and no automatic deletion.
- Independent timestamped Google Drive files for every manual backup, including multiple copies in one week.
- Installable Progressive Web App for Android and Windows.
- Dedicated **Manual** item in the desktop and mobile navigation.
- Complete Portuguese beginner manual inside the site, available offline and in [Markdown](docs/MANUAL-PT.md).

## Try the demo

The repository ships in demo mode with exactly 10 fictional rolls. It contains no personal archive, credentials or private paths. The visual catalogues include researched film and equipment reference images; their source pages and usage classifications are documented separately.

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

The tests validate the demo count, privacy boundaries, release version, calendar dates in Lisbon and UTC, historical roll-ID increments, data integrity, edit conflicts, cost references, search, review, favourites, undo, translations, geocoding and the offline cache manifest.

## Location lookup and privacy

New place names are sent to the configured OpenStreetMap Nominatim endpoint only after the user saves a roll. Results are cached, requests are queued at a maximum of one per second, and a failed lookup never prevents a roll from being saved. Do not enter a home address or other confidential location. See [GEOCODING-PRIVACY.md](docs/GEOCODING-PRIVACY.md).

## Product images and sources

The repository includes the v2.6 film-package and equipment reference images. See [the image source notes](docs/IMAGE-SOURCES-PT.md), the [machine-readable source manifest](docs/image-sources.json) and the [normalization report](docs/image-normalization-report.json) for the page of origin, usage classification, confidence and SHA-256 of every newly researched asset.

Product imagery is not covered by the MIT licence for the application code. Manufacturer, retailer, editorial and review images remain subject to their respective owners' terms. Replace any image whose redistribution terms do not suit your deployment.

## Security

Read [SECURITY.md](SECURITY.md) before making a private deployment. Client-side Firebase configuration identifies a project but does not replace access control; the Firestore rules are mandatory.

## Licence

[MIT](LICENSE). Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).
