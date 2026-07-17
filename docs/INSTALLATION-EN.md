# Private installation

This guide creates a private, single-owner installation using Firebase, GitHub and Netlify. The Portuguese guide, [INSTALLATION-PT.md](INSTALLATION-PT.md), includes more detailed click-by-click instructions.

## 1. Create the Firebase project

1. Create a project in the [Firebase Console](https://console.firebase.google.com/).
2. Under `Security` > `Authentication` > `Sign-in method`, enable Google.
3. Under `Databases & Storage` > `Firestore`, add the default Standard database in Production mode.
4. In Project settings, register a Web app and keep its Firebase configuration visible.

## 2. Use a private copy of this repository

Do not commit personal configuration to a public fork. Create a private repository, then edit `app/firebase-config.js` with the values supplied by Firebase:

```js
window.ROLOS_FIREBASE_CONFIG = {
  apiKey: "YOUR_VALUE",
  authDomain: "YOUR_VALUE",
  projectId: "YOUR_VALUE",
  storageBucket: "YOUR_VALUE",
  messagingSenderId: "YOUR_VALUE",
  appId: "YOUR_VALUE",
  ownerEmail: "YOUR_GOOGLE_EMAIL",
  privateAccess: true,
  demoMode: false,
};
```

Private mode automatically ignores the bundled demo rolls and starts with an empty archive.

## 3. Publish the security rules

1. Open `firestore.rules.example`.
2. Replace `YOUR_GOOGLE_EMAIL@example.com` with the exact owner email.
3. Paste the result into Firestore > Rules and select `Publish`.

Never deploy an `allow read, write: if true` rule.

## 4. Deploy to Netlify

1. In Netlify, choose `Add new project` > `Import an existing project`.
2. Connect the private GitHub repository.
3. Netlify reads `netlify.toml`; the publish directory must be `app` and no build command is required.
4. Publish and copy the resulting `*.netlify.app` hostname.
5. In Firebase Authentication settings, add that hostname under `Authorized domains` without `https://`.

Open the site, sign in with the configured owner account and create a test roll. A second account must be denied.

## 5. Install the app

- Windows: open the site in Edge or Chrome and use `Install app` in the browser menu or address bar.
- Android: open the site in Chrome and choose `Install app` or `Add to Home screen`.

Updates are delivered by the website. Reinstallation is not normally required; close and reopen the installed app after a deployment.

## 6. Optional Google Drive copy

1. In Google Cloud Console, select the Firebase project and enable the Google Drive API.
2. In Google Auth Platform > Data Access, add only `https://www.googleapis.com/auth/drive.file`.
3. If the OAuth app is in testing, add the owner under Audience > Test users.
4. In Rolos > Backup, select `Create Drive backup` and grant the limited permission.

Firebase synchronisation and weekly Firebase history are automatic. The Drive copy needs a user click when the weekly reminder appears because a browser cannot silently grant or renew Google consent while the app is closed.

Official references: [Firebase Web setup](https://firebase.google.com/docs/web/setup), [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin), [Firestore rules](https://firebase.google.com/docs/firestore/security/get-started), [Netlify repository deployment](https://docs.netlify.com/start/quickstarts/deploy-from-repository/) and [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).
