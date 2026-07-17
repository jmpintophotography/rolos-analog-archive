# Privacy

Rolos has no project analytics, advertising SDK or application server controlled by the author.

In demo mode, archive data is stored in the browser. In private mode, data is stored in the Firebase project selected by the installer and is governed by that project's Authentication and Firestore rules. Optional Drive backups are stored in the installer's Google Drive.

The application contacts these external services when the corresponding feature is used:

- Firebase and Google sign-in for private synchronisation.
- Google Drive API for an explicitly authorised backup.
- OpenStreetMap map tiles while viewing the map.
- The configured geocoding endpoint after saving a new location.
- Public CDNs for Leaflet, Lucide and Firebase browser modules.

Location lookup behavior is documented in [docs/GEOCODING-PRIVACY.md](docs/GEOCODING-PRIVACY.md).

Anyone deploying Rolos is responsible for reviewing the providers' terms, publishing an appropriate privacy notice for their users, and securing their Firebase rules. The included private setup is intended for a single owner.
