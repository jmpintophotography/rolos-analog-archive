# Basic use

## Roll workflow

Select `New roll`, fill in the core details and save. Use `Details` to read the complete record and `Advance status` to move it through the workflow. `Archived` is the final state and removes the roll from the work queue without deleting it.

## Locations

When a previously unknown place such as `Paris` is saved, the app attempts to find its coordinates and caches the result. An offline or unsuccessful lookup never blocks the save; the place remains in the `Unpositioned` list and can be retried by editing and saving later.

Use clear place names. For an ambiguous name, include the country and verify the point on the map. User-entered places and notes are never translated.

## Stock, packaging and equipment

Stock records film quantity, format, ISO, type and expiry. Packaging images are user-supplied. Equipment covers cameras, lenses, flashes and accessories, including optional status and value.

## Statistics and language

Filters work together across the charts. The `EN`/`PT` button changes the interface and stores the choice on the current device.

## Data safety

- Every change is stored locally.
- With Firebase configured, the latest revision synchronises across devices.
- Firebase weekly history is automatic.
- JSON export provides an independent manual copy.
- Google Drive backup displays a weekly reminder and requires a click to authorise the upload.

Export a JSON before any large import. JSON and Excel imports replace the current archive after confirmation.

## Updates

The Android or Windows app normally does not need to be reinstalled. After a deployment, close it fully and reopen it. The release number appears in the sidebar and mobile header.
