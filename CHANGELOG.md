# Changelog

## 2.5.0 - 2026-07-18

- Added quick capture with reusable personal templates, repeat-last setup and save-and-add-another.
- Added optional projects, costs and processing milestone dates, with new operational statistics and stock forecasts.
- Added a physical archive workspace with batch updates, offline QR labels and camera/manual lookup.
- Added non-destructive backup validation and restore previews.
- Added names and retention protection for important Firebase backups plus known-device status.
- Added sync schema 3 to prevent older clients from overwriting the additive v2.5 fields.
- Preserved the timezone-safe import rules and every v2.1.1 workflow.

## 2.1.1 - 2026-07-18

- Fixed the mobile top bar so the page title keeps its own full-width row.
- Moved search, language, export and new-roll actions to a balanced 44 px touch grid below the title.
- Added a regression check matching the approximately 405 px viewport from the reported Android screenshot.
- Preserved the v2.1 database, sync, backups, imports, exports and application workflows unchanged.

## 2.1.0 - 2026-07-18

- Reworked quick choices in the new-roll form into a touch-friendly wrapping grid with no horizontal dragging.
- Added per-backup and delete-all controls for Firebase weekly/recovery history while protecting the current version.
- Added an estimated Firebase document-usage summary with backup and image counts.
- Changed manual Google Drive backups so every click creates a new timestamped file, including several backups in the same week.
- Removed automatic pruning from the manual Google Drive backup action.
- Preserved the timezone-safe date import, protected Firebase fresh start and all v2.05 data checks.

## 2.0.5 (v2.05) - 2026-07-18

- Fixed Excel calendar-date imports so local midnight is never shifted through UTC.
- Made the `IIMMAAAA` roll ID authoritative for the entry month and year during imports.
- Rejected invalid or duplicate roll IDs with a clear error instead of silently changing records.
- Added a protected fresh-start flow for replacing stale Firebase current/history data after importing a backup.
- Made new roll IDs continue after the highest sequence already used in the selected month.
- Replaced the language icon with a globe.

## 2.0.0 - 2026-07-18

- Added universal local search for rolls, stock and equipment, with keyboard shortcuts and quick actions.
- Added a read-only smart review centre for unfinished work, missing archive locations, incomplete identification and expiring stock.
- Added roll favourites throughout the dashboard, review, catalogue, list and detail views.
- Added a twelve-second undo action for saves, deletions, status changes, favourites, stock consumption and packaging-image changes.
- Preserved the existing data schema, Firebase rules, imports, exports and all v1.11 workflows.

## 1.11.0 - 2026-07-18

- Added a shorter, progressive new-roll form while keeping every existing field available.
- Added quick choices for recent cameras, recent locations and film currently in stock.
- Added one-step roll creation from stock, with an optional automatic stock decrement.
- Added `New similar roll` from an existing roll.
- Updated private recovery data to the latest 18 July backup and expanded migration and release checks.

## 1.10.0 - 2026-07-17

- Added automatic coordinates for newly saved location names, with caching, throttling and graceful offline behavior.
- Added complete Portuguese and English interface switching.
- Refined the dashboard message and removed the legacy spreadsheet filename from Backup summary.
- Added a privacy-safe 10-roll public demo.
- Added public installation, security, privacy and use documentation.
- Added automated release, privacy, translation, geocoding and offline-shell checks.

## 1.04.0

- Added the fixed full-height sidebar and visible release number.
- Added optional weekly Google Drive backups and reminders.

## 1.03.0

- Added automatic Firebase synchronisation and a rolling 54-week Firebase history.
