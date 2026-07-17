# Security

## Supported version

Security fixes are applied to the latest published release. The current release is 1.10.

## Private deployment checklist

- Keep the personal fork or deployment repository private.
- Set `privateAccess: true` and `demoMode: false`.
- Set the exact owner email in both `firebase-config.js` and the Firestore rules.
- Publish `firestore.rules.example` only after replacing its placeholder.
- Authorise only the final site domain in Firebase Authentication.
- Test an unauthorised account in a private browser window.
- Use only the limited `drive.file` scope for optional Drive backups.
- Export a JSON before imports and major upgrades.

The Firebase Web configuration is not a server secret, but it does not secure the database. Firestore Security Rules are the actual access boundary and must never be replaced with an allow-all rule.

## Reporting a vulnerability

Do not open a public issue containing credentials, personal archive data or an exploitable proof of concept. Contact the repository owner privately through the security contact method configured on the GitHub profile, and include the affected version, impact and reproduction steps.
