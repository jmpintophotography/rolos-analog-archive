import {
  RECOVERY_BACKUP_LIMIT,
  SYNC_SCHEMA_VERSION,
  WEEKLY_BACKUP_LIMIT,
  chooseSyncAction,
  evaluateCloudWrite,
  formatIsoWeekKey,
  historyRetentionPlan,
  isoWeekKey,
  shouldReplaceWeeklyBackup,
  stateFingerprint,
} from "./sync-core.js";
import {
  isDriveBackupDue,
  nextDriveBackupAt,
} from "./drive-backup-core.js";
import { createDriveBackupClient } from "./drive-backup-client.js";
import { createGeocodingClient } from "./geocoding.js";
import {
  applyLanguage,
  localeForLanguage,
  normalizeLanguage,
  startLanguageObserver,
  translatePhrase,
} from "./i18n.js";

const STORAGE_KEY = "rolos-app-state-v1";
const UI_STORAGE_KEY = "rolos-app-ui-v4";
const DEVICE_STORAGE_KEY = "rolos-app-device-v1";
const DRIVE_STATUS_STORAGE_KEY = "rolos-drive-backup-status-v1";
const LANGUAGE_STORAGE_KEY = "rolos-app-language-v1";
const RELEASE_VERSION = "1.10";
const SEED_REVISION = "2026-07-15-v1.0";
const FIREBASE_VERSION = "10.12.5";
const XLSX_CDN_URL = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
const FIREBASE_OPTION_KEYS = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId", "measurementId"];
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_STATUS_DOCUMENT_ID = "drive-status";
const GEOCODING_RETRY_MS = 30 * 24 * 60 * 60 * 1000;
const geocodingClient = createGeocodingClient(window.ROLOS_APP_CONFIG?.geocoding || {});

const LOCATION_COORDS = {
  "Porto": { lat: 41.1579, lon: -8.6291 },
  "Sanfins": { lat: 40.06, lon: -8.75 },
  "Algarve": { lat: 37.02, lon: -7.93 },
  "Aljezur": { lat: 37.317, lon: -8.803 },
  "Braga": { lat: 41.5454, lon: -8.4265 },
  "Fortaleza": { lat: -3.7319, lon: -38.5267 },
  "Madeira": { lat: 32.7607, lon: -16.9595 },
  "Tróia": { lat: 38.493, lon: -8.905 },
  "Troia": { lat: 38.493, lon: -8.905 },
  "Lisboa": { lat: 38.7223, lon: -9.1393 },
  "Creta": { lat: 35.2401, lon: 24.8093 },
  "Gerês": { lat: 41.728, lon: -8.163 },
  "Geręs": { lat: 41.728, lon: -8.163 },
  "Marraquexe": { lat: 31.6295, lon: -7.9811 },
  "Rio de Janeiro": { lat: -22.9068, lon: -43.1729 },
  "Belém": { lat: -1.4558, lon: -48.5039 },
  "Espanha": { lat: 40.4168, lon: -3.7038 },
  "Lourinhã": { lat: 39.2417, lon: -9.3125 },
  "Lourinhă": { lat: 39.2417, lon: -9.3125 },
  "Cerveira": { lat: 41.94, lon: -8.743 },
  "Barcelos": { lat: 41.5388, lon: -8.6151 },
  "Alentejo": { lat: 38.015, lon: -7.863 },
  "Douro": { lat: 41.161, lon: -7.789 },
  "Serra Da Estrela": { lat: 40.321, lon: -7.613 },
  "Monchique": { lat: 37.317, lon: -8.555 },
};

const views = {
  dashboard: {
    title: "Entrada",
    kicker: "Rolos em andamento",
  },
  stats: {
    title: "Estatísticas",
    kicker: "Padrões e tendências",
  },
  rolls: {
    title: "Rolos",
    kicker: "Registo do dia a dia",
  },
  stock: {
    title: "Stock",
    kicker: "Filmes por usar",
  },
  packaging: {
    title: "Embalagens",
    kicker: "Caixas e abas de filme",
  },
  equipment: {
    title: "Equipamento",
    kicker: "Câmaras, lentes e acessórios",
  },
  archive: {
    title: "Backup",
    kicker: "Cópias e sincronização",
  },
};

const defaultSupport = {
  statuses: [
    "Em Uso",
    "Disparado",
    "Em Revelação",
    "Revelado",
    "Digitalizado",
    "Editado",
    "Recolhido",
    "Arquivado",
  ],
  filmBrands: [],
  equipmentKinds: ["Câmara", "Lente", "Flash", "Acessório"],
  equipmentStatuses: ["Funcional", "Vendido", "Avariado", "Emprestado"],
};

const app = {
  state: null,
  ready: false,
  language: loadLanguagePreference(),
  activeView: "dashboard",
  filters: {
    rollsSearch: "",
    rollsStatus: "",
    rollsCamera: "",
    rollsFormat: "",
    rollsType: "",
    rollsSort: "newest",
    statsCamera: "",
    statsFilm: "",
    statsFormat: "",
    statsType: "",
    statsLocation: "",
    statsStatus: "",
    statsYear: "",
    stockSearch: "",
    stockFormat: "",
    stockType: "",
    stockSort: "name",
    packagingSearch: "",
    packagingFormat: "",
    packagingType: "",
    packagingAvailability: "",
    packagingSort: "usage",
    equipmentSearch: "",
    equipmentKind: "",
    equipmentStatus: "",
    equipmentSort: "name",
  },
  viewModes: {
    rolls: "catalog",
    stock: "catalog",
    equipment: "catalog",
  },
  editor: null,
  detailId: null,
  dashboardFilter: "open",
  rollLimit: 50,
  startupWarning: "",
  leafletMap: null,
  cloud: {
    app: null,
    auth: null,
    db: null,
    user: null,
    modules: null,
    status: "Firebase por configurar",
    backupTimer: null,
    backupInProgress: false,
    syncTimer: null,
    syncInProgress: false,
    syncPromise: null,
    authUnsubscribe: null,
    currentUnsubscribe: null,
    resolveInitialAccess: null,
    accessDenied: false,
    history: [],
    historyLoading: false,
    historyLoadedAt: 0,
    historyError: "",
    driveStatus: null,
    driveStatusUnsubscribe: null,
    driveBackupInProgress: false,
    driveBackupError: "",
  },
  geocodingPending: new Set(),
};

const appShell = document.querySelector("#app-shell") || document.querySelector(".app-shell");
const accessGate = document.querySelector("#access-gate");
const accessMessage = document.querySelector("#access-message");
const accessOwner = document.querySelector("#access-owner");
const accessSignin = document.querySelector("#access-signin");
const root = document.querySelector("#app-root");
const title = document.querySelector("#view-title");
const kicker = document.querySelector("#view-kicker");
const brandCount = document.querySelector("#brand-count");
const storageStatus = document.querySelector("#storage-status");
const storageDot = document.querySelector("#storage-dot");
const driveReminder = document.querySelector("#drive-reminder");
const dialog = document.querySelector("#editor-dialog");
const editorForm = document.querySelector("#editor-form");
const editorFields = document.querySelector("#editor-fields");
const dialogTitle = document.querySelector("#dialog-title");
const dialogKicker = document.querySelector("#dialog-kicker");
const detailDialog = document.querySelector("#detail-dialog");
const detailTitle = document.querySelector("#detail-title");
const detailKicker = document.querySelector("#detail-kicker");
const detailContent = document.querySelector("#detail-content");
const detailPrimaryAction = document.querySelector("#detail-primary-action");
const toast = document.querySelector("#toast");
const languageToggle = document.querySelector("#language-toggle");

accessSignin?.addEventListener("click", signInFromAccessGate);
startLanguageObserver(document.body, () => app.language);
applyInterfaceLanguage();
init();

async function init() {
  const accessGranted = await requirePrivateAccess();
  if (!accessGranted) return;
  bindEvents();
  app.state = normalizeState(await loadState());
  app.cloud.driveStatus = loadLocalDriveBackupStatus();
  loadUiPreferences();
  persistState({ skipAutomaticBackup: true, preserveUpdatedAt: true });
  if (app.cloud.user && app.cloud.modules) {
    app.cloud.status = "A confirmar a versão mais recente no Firebase…";
    await synchronizeWithCloud({ reason: "startup", silent: true });
  }
  app.ready = true;
  render();
  startCloudSyncListener();
  startDriveStatusListener();
  if (app.state.meta.autoCloudBackup && app.state.meta.cloudBackupPending) {
    scheduleAutomaticCloudBackup(250);
  }
  if (app.startupWarning) showToast(app.startupWarning);
  registerServiceWorker();
}

async function requirePrivateAccess() {
  const config = window.ROLOS_FIREBASE_CONFIG;
  const ownerEmail = configuredOwnerEmail();

  if (config?.demoMode === true && config?.privateAccess === false) {
    revealApplication();
    return true;
  }

  if (isLocalEnvironment() && (!config?.apiKey || !ownerEmail)) {
    revealApplication();
    return true;
  }

  if (!config?.apiKey || !ownerEmail || config.privateAccess !== true) {
    showAccessGate({
      message: "A publicação ainda não tem a conta proprietária configurada. Consulta o guia privado antes de colocares estes ficheiros online.",
      allowSignIn: false,
      ownerLabel: "Acesso bloqueado por segurança",
    });
    return false;
  }

  showAccessGate({
    message: "A confirmar a tua sessão segura…",
    allowSignIn: false,
    ownerLabel: ownerEmail,
  });

  try {
    await ensureFirebaseReady();
  } catch (error) {
    console.error("Não foi possível preparar o acesso privado.", error);
    showAccessGate({
      message: "Não foi possível ligar ao serviço de acesso. Confirma a configuração e a ligação à internet.",
      allowSignIn: false,
      ownerLabel: "Acesso bloqueado por segurança",
    });
    return false;
  }

  return new Promise((resolve) => {
    app.cloud.resolveInitialAccess = resolve;
    observeCloudAuthentication();
  });
}

function isLocalEnvironment() {
  const currentLocation = window.location || globalThis.location;
  if (!currentLocation) return true;
  if (!currentLocation.protocol && !currentLocation.hostname) return true;
  return currentLocation.protocol === "file:"
    || ["localhost", "127.0.0.1", "::1"].includes(currentLocation.hostname);
}

function isPrivateAccessRequired() {
  if (window.ROLOS_FIREBASE_CONFIG?.demoMode === true
    && window.ROLOS_FIREBASE_CONFIG?.privateAccess === false) return false;
  return !isLocalEnvironment()
    || Boolean(window.ROLOS_FIREBASE_CONFIG?.privateAccess)
    || Boolean(configuredOwnerEmail());
}

function configuredOwnerEmail() {
  return text(window.ROLOS_FIREBASE_CONFIG?.ownerEmail).toLowerCase();
}

function firebaseProjectOptions() {
  const config = window.ROLOS_FIREBASE_CONFIG || {};
  return Object.fromEntries(FIREBASE_OPTION_KEYS
    .filter((key) => text(config[key]))
    .map((key) => [key, config[key]]));
}

function isAuthorizedCloudUser(user) {
  if (!user) return false;
  if (!isPrivateAccessRequired()) return true;
  const ownerEmail = configuredOwnerEmail();
  return Boolean(ownerEmail)
    && Boolean(user.emailVerified)
    && text(user.email).toLowerCase() === ownerEmail;
}

function revealApplication() {
  if (accessGate) accessGate.hidden = true;
  if (appShell) appShell.hidden = false;
}

function showAccessGate({ message, allowSignIn = true, ownerLabel = "" }) {
  if (appShell) appShell.hidden = true;
  if (!accessGate || !accessMessage || !accessOwner || !accessSignin) {
    let fallback = document.querySelector("#access-gate-fallback");
    if (!fallback) {
      fallback = document.createElement("main");
      fallback.id = "access-gate-fallback";
      fallback.className = "access-gate access-gate-fallback";
      fallback.innerHTML = `
        <div class="access-content">
          <p class="kicker">Arquivo privado</p>
          <h1>Rolos</h1>
          <p class="access-message">Atualiza a página para concluir a instalação da versão segura.</p>
        </div>
      `;
      document.body.prepend(fallback);
    }
    return;
  }
  accessGate.hidden = false;
  accessMessage.textContent = message;
  accessOwner.textContent = ownerLabel;
  accessSignin.hidden = !allowSignIn;
  accessSignin.disabled = false;
  const label = accessSignin.querySelector?.("span");
  if (label) label.textContent = app.cloud.accessDenied ? "Tentar outra conta" : "Entrar com Google";
  refreshIcons();
  applyInterfaceLanguage();
}

async function ensureFirebaseReady() {
  if (app.cloud.app && app.cloud.auth && app.cloud.db && app.cloud.modules) return;

  const [firebaseApp, firebaseAuth, firebaseFirestore] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`),
  ]);

  app.cloud.modules = {
    initializeApp: firebaseApp.initializeApp,
    getAuth: firebaseAuth.getAuth,
    GoogleAuthProvider: firebaseAuth.GoogleAuthProvider,
    signInWithPopup: firebaseAuth.signInWithPopup,
    signOut: firebaseAuth.signOut,
    onAuthStateChanged: firebaseAuth.onAuthStateChanged,
    getFirestore: firebaseFirestore.getFirestore,
    doc: firebaseFirestore.doc,
    collection: firebaseFirestore.collection,
    getDoc: firebaseFirestore.getDoc,
    getDocs: firebaseFirestore.getDocs,
    setDoc: firebaseFirestore.setDoc,
    deleteDoc: firebaseFirestore.deleteDoc,
    runTransaction: firebaseFirestore.runTransaction,
    onSnapshot: firebaseFirestore.onSnapshot,
    serverTimestamp: firebaseFirestore.serverTimestamp,
  };

  app.cloud.app = app.cloud.modules.initializeApp(firebaseProjectOptions());
  app.cloud.auth = app.cloud.modules.getAuth(app.cloud.app);
  app.cloud.db = app.cloud.modules.getFirestore(app.cloud.app);
}

function observeCloudAuthentication() {
  if (app.cloud.authUnsubscribe || !app.cloud.auth || !app.cloud.modules) return;
  app.cloud.authUnsubscribe = app.cloud.modules.onAuthStateChanged(app.cloud.auth, handleCloudAuthenticationState);
}

async function handleCloudAuthenticationState(user) {
  if (user && !isAuthorizedCloudUser(user)) {
    app.cloud.user = null;
    app.cloud.accessDenied = true;
    app.cloud.status = "Esta conta não está autorizada.";
    showAccessGate({
      message: "Esta conta Google não tem autorização para abrir o arquivo.",
      allowSignIn: true,
      ownerLabel: `Conta autorizada: ${configuredOwnerEmail()}`,
    });
    try {
      await app.cloud.modules.signOut(app.cloud.auth);
    } catch (error) {
      console.warn("Não foi possível terminar a sessão não autorizada.", error);
    }
    return;
  }

  if (!user) {
    app.cloud.user = null;
    app.cloud.status = "Sessão por iniciar.";
    if (isPrivateAccessRequired()) {
      showAccessGate({
        message: app.cloud.accessDenied
          ? "Esta conta Google não tem autorização para abrir o arquivo."
          : "Entra com a conta Google autorizada para abrir o teu arquivo.",
        allowSignIn: true,
        ownerLabel: `Conta autorizada: ${configuredOwnerEmail()}`,
      });
    }
    return;
  }

  app.cloud.accessDenied = false;
  app.cloud.user = user;
  app.cloud.status = `Sessão privada: ${user.email}`;
  revealApplication();

  if (app.cloud.resolveInitialAccess) {
    const resolve = app.cloud.resolveInitialAccess;
    app.cloud.resolveInitialAccess = null;
    resolve(true);
  } else if (app.ready) {
    render();
    startCloudSyncListener();
    startDriveStatusListener();
    scheduleCloudSyncCheck(100);
  }
}

async function signInFromAccessGate() {
  if (!app.cloud.auth || !app.cloud.modules) return;
  app.cloud.accessDenied = false;
  accessSignin.disabled = true;
  accessMessage.textContent = "A abrir o login seguro do Google…";
  try {
    const provider = new app.cloud.modules.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await app.cloud.modules.signInWithPopup(app.cloud.auth, provider);
  } catch (error) {
    const cancelled = ["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(error?.code);
    showAccessGate({
      message: cancelled
        ? "O login foi cancelado. Podes tentar novamente quando estiveres pronto."
        : "Não foi possível iniciar sessão. Confirma a ligação à internet e o domínio autorizado no Firebase.",
      allowSignIn: true,
      ownerLabel: `Conta autorizada: ${configuredOwnerEmail()}`,
    });
  }
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event?.stopPropagation?.();
      app.activeView = button.dataset.view;
      render();
    });
  });

  document.addEventListener("click", handleAction);
  root.addEventListener("input", handleFilterInput);
  root.addEventListener("change", handleFilterInput);
  editorFields.addEventListener("input", refreshComputedFields);
  editorFields.addEventListener("change", refreshComputedFields);
  editorForm.addEventListener("submit", saveEditor);
  window.addEventListener?.("online", () => {
    if (app.ready && app.state?.meta?.autoCloudBackup) scheduleCloudSyncCheck(100);
  });
  window.addEventListener?.("focus", () => {
    if (app.ready && app.state?.meta?.autoCloudBackup) scheduleCloudSyncCheck(150);
  });
  document.addEventListener?.("visibilitychange", () => {
    if (document.visibilityState === "visible" && app.ready && app.state?.meta?.autoCloudBackup) {
      scheduleCloudSyncCheck(150);
    }
  });
}

async function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    let localState;
    try {
      localState = JSON.parse(stored);
    } catch (error) {
      console.error("O arquivo local não pôde ser lido.", error);
      try {
        localStorage.setItem(`${STORAGE_KEY}-recovery-${Date.now()}`, stored);
      } catch (recoveryError) {
        console.error("Não foi possível criar a cópia de recuperação.", recoveryError);
      }
      app.startupWarning = "Foi encontrada uma cópia local danificada. Os dados iniciais foram abertos e a cópia antiga ficou guardada para recuperação.";
      return loadSeed();
    }

    try {
      const seedState = await loadSeed();
      if (seedState?.meta?.seedRevision && localState?.meta?.seedRevision !== seedState.meta.seedRevision) {
        app.startupWarning = "A base foi atualizada com o Excel mais recente. Os dados exclusivos da app foram preservados.";
        return mergeSeedUpgrade(localState, seedState);
      }
    } catch (error) {
      console.warn("Os dados iniciais não puderam ser verificados. A cópia local foi preservada.", error);
      app.startupWarning = "O ficheiro inicial não respondeu. A cópia guardada neste dispositivo foi aberta e será confirmada com o Firebase.";
    }
    return localState;
  }
  return loadSeed();
}

function mergeSeedUpgrade(localState, seedState) {
  const localRolls = new Map((localState.rolls || []).map((roll) => [normalizeRollId(roll.id), roll]));
  const seedRollIds = new Set((seedState.rolls || []).map((roll) => normalizeRollId(roll.id)));
  const preserveRollFields = ["photosUrl", "archiveLocation", "favorite"];
  const rolls = (seedState.rolls || []).map((roll) => {
    const local = localRolls.get(normalizeRollId(roll.id));
    if (!local) return roll;
    const preserved = {};
    preserveRollFields.forEach((field) => {
      if (local[field]) preserved[field] = local[field];
    });
    return { ...roll, ...preserved };
  });

  rolls.push(...(localState.rolls || []).filter((roll) => !seedRollIds.has(normalizeRollId(roll.id)) && roll.createdFrom !== "excel"));

  const seedStockIds = new Set((seedState.stock || []).map((item) => item.id));
  const seedEquipmentIds = new Set((seedState.equipment || []).map((item) => item.id));

  return {
    ...seedState,
    meta: {
      ...seedState.meta,
      ...normalizeCloudBackupMeta(localState.meta),
    },
    rolls,
    stock: [
      ...(seedState.stock || []),
      ...(localState.stock || []).filter((item) => item.createdFrom !== "excel" && !seedStockIds.has(item.id)),
    ],
    equipment: [
      ...(seedState.equipment || []),
      ...(localState.equipment || []).filter((item) => item.createdFrom !== "excel" && !seedEquipmentIds.has(item.id)),
    ],
    filmImages: localState.filmImages || {},
    locationCoordinates: localState.locationCoordinates || {},
  };
}

async function loadSeed() {
  if (window.ROLOS_SEED_DATA) {
    return seedForCurrentMode(structuredClone(window.ROLOS_SEED_DATA));
  }

  const response = await fetch("data/seed.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Não foi possível carregar os dados iniciais.");
  }
  return seedForCurrentMode(await response.json());
}

function seedForCurrentMode(seed) {
  const isPublicDemoSeed = text(seed?.meta?.seedRevision).includes("-demo");
  if (!isPrivateAccessRequired() || !isPublicDemoSeed) return seed;
  return {
    ...seed,
    meta: {
      ...seed.meta,
      seedRevision: `${RELEASE_VERSION}-private-empty`,
    },
    rolls: [],
    stock: [],
    equipment: [],
    filmImages: {},
    locationCoordinates: {},
    support: {
      ...(seed.support || {}),
      filmBrands: [],
    },
  };
}

function normalizeCloudBackupMeta(meta = {}) {
  const initialized = Boolean(meta.cloudBackupInitialized || text(meta.lastCloudBackupAt));
  const migrateExistingBackup = initialized && meta.cloudBackupInitialized == null;
  const isCurrentSyncSchema = numberOrZero(meta.syncSchemaVersion) >= SYNC_SCHEMA_VERSION;
  return {
    autoCloudBackup: isCurrentSyncSchema
      ? meta.autoCloudBackup !== false
      : (migrateExistingBackup || !initialized ? true : Boolean(meta.autoCloudBackup)),
    cloudBackupInitialized: initialized,
    cloudBackupPending: Boolean(meta.cloudBackupPending),
    lastCloudBackupAt: text(meta.lastCloudBackupAt),
    localRevision: Math.max(0, numberOrZero(meta.localRevision)),
    cloudRevision: Math.max(0, numberOrZero(meta.cloudRevision)),
    lastSyncedContentHash: text(meta.lastSyncedContentHash),
    lastSyncCheckAt: text(meta.lastSyncCheckAt),
    lastWeeklyBackupKey: text(meta.lastWeeklyBackupKey),
    lastWeeklyBackupRevision: Math.max(0, numberOrZero(meta.lastWeeklyBackupRevision)),
    lastRetentionCheckKey: text(meta.lastRetentionCheckKey),
    weeklyBackupPending: Boolean(meta.weeklyBackupPending),
    syncSchemaVersion: SYNC_SCHEMA_VERSION,
  };
}

function normalizeState(raw) {
  const state = {
    meta: {
      appName: "Rolos",
      autoCloudBackup: true,
      cloudBackupInitialized: false,
      cloudBackupPending: false,
      lastCloudBackupAt: "",
      localRevision: 0,
      cloudRevision: 0,
      lastSyncedContentHash: "",
      lastSyncCheckAt: "",
      lastWeeklyBackupKey: "",
      lastWeeklyBackupRevision: 0,
      lastRetentionCheckKey: "",
      weeklyBackupPending: false,
      syncSchemaVersion: SYNC_SCHEMA_VERSION,
      importedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(raw.meta || {}),
      ...normalizeCloudBackupMeta(raw.meta),
      version: 5,
    },
    rolls: Array.isArray(raw.rolls) ? raw.rolls : [],
    stock: Array.isArray(raw.stock) ? raw.stock : [],
    equipment: Array.isArray(raw.equipment) ? raw.equipment : [],
    filmImages: raw.filmImages && typeof raw.filmImages === "object" ? raw.filmImages : {},
    locationCoordinates: normalizeLocationCoordinates(raw.locationCoordinates),
    support: {
      ...defaultSupport,
      ...(raw.support || {}),
    },
  };

  state.rolls = state.rolls.map((roll) => ({
    id: text(roll.id) || createId("rolo"),
    status: text(roll.status),
    date: text(roll.date),
    shotLocation: text(roll.shotLocation),
    camera: text(roll.camera),
    lens: text(roll.lens),
    filmBrand: text(roll.filmBrand),
    filmModel: text(roll.filmModel),
    iso: roll.iso ?? "",
    format: text(roll.format),
    type: text(roll.type),
    push: roll.push ?? 0,
    developedAt: text(roll.developedAt),
    scannedAt: text(roll.scannedAt),
    developerMethod: text(roll.developerMethod),
    photosUrl: text(roll.photosUrl),
    notes: text(roll.notes),
    folderName: text(roll.folderName),
    negativeCode: text(roll.negativeCode) || text(roll.id),
    archiveLocation: text(roll.archiveLocation),
    favorite: Boolean(roll.favorite),
    createdFrom: text(roll.createdFrom),
  }));

  state.rolls = state.rolls.map((roll) => {
    const id = normalizeRollId(roll.id);
    const normalized = {
      ...roll,
      id,
      negativeCode: normalizeRollId(roll.negativeCode || id),
    };
    return {
      ...normalized,
      folderName: buildFolderName(normalized),
    };
  });

  state.stock = state.stock.map((item) => ({
    id: text(item.id) || createId("stock"),
    format: text(item.format),
    brand: text(item.brand),
    model: text(item.model),
    iso: item.iso ?? "",
    type: text(item.type),
    quantity: numberOrZero(item.quantity),
    condition: text(item.condition),
    expiryDate: text(item.expiryDate),
    note: text(item.note),
    createdFrom: text(item.createdFrom),
  }));

  state.equipment = state.equipment.map((item) => ({
    id: text(item.id) || createId("equip"),
    kind: normalizeEquipmentKind(item.kind),
    brand: text(item.brand),
    model: text(item.model),
    system: text(item.system),
    purchaseDate: text(item.purchaseDate),
    purchaseValue: numberOrZero(item.purchaseValue),
    status: text(item.status),
    lastServiceDate: text(item.lastServiceDate),
    notes: text(item.notes),
    createdFrom: text(item.createdFrom),
  }));

  state.filmImages = Object.fromEntries(Object.entries(state.filmImages)
    .filter(([, image]) => image && /^data:image\/(?:webp|jpeg|png);base64,/i.test(text(image.dataUrl)))
    .map(([key, image]) => [key, {
      dataUrl: text(image.dataUrl),
      fileName: text(image.fileName),
      updatedAt: text(image.updatedAt),
    }]));

  state.support.statuses = unique([...defaultSupport.statuses, ...state.support.statuses, ...state.rolls.map((roll) => roll.status)])
    .filter((status) => !["estado", "estados"].includes(normalizeSearchValue(status)));
  state.support.filmBrands = unique([...state.support.filmBrands, ...state.rolls.map((roll) => roll.filmBrand), ...state.stock.map((item) => item.brand)]);
  state.support.equipmentKinds = unique([
    ...defaultSupport.equipmentKinds,
    ...state.support.equipmentKinds.map(normalizeEquipmentKind),
    ...state.equipment.map((item) => item.kind),
  ]).filter(Boolean);
  state.support.equipmentStatuses = unique([...defaultSupport.equipmentStatuses, ...state.support.equipmentStatuses, ...state.equipment.map((item) => item.status)]);

  return state;
}

function persistState(options = {}) {
  if (!options.preserveUpdatedAt) {
    app.state.meta.updatedAt = new Date().toISOString();
  }
  if (!options.skipAutomaticBackup) {
    app.state.meta.localRevision = numberOrZero(app.state.meta.localRevision) + 1;
    app.state.meta.cloudBackupPending = true;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(app.state));
  } catch (error) {
    console.error("Não foi possível guardar os dados localmente.", error);
    showToast("Não foi possível guardar neste dispositivo. Exporta um backup antes de continuar.");
  }
  updateChrome();
  if (!options.skipAutomaticBackup) scheduleAutomaticCloudBackup();
}

function loadUiPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(UI_STORAGE_KEY) || "{}");
    app.viewModes = { ...app.viewModes, ...(stored.viewModes || {}) };
    ["rollsSort", "stockSort", "equipmentSort"].forEach((name) => {
      if (stored[name]) app.filters[name] = stored[name];
    });
  } catch (error) {
    console.warn("As preferências visuais não puderam ser recuperadas.", error);
  }
}

function persistUiPreferences() {
  try {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({
      viewModes: app.viewModes,
      rollsSort: app.filters.rollsSort,
      stockSort: app.filters.stockSort,
      equipmentSort: app.filters.equipmentSort,
    }));
  } catch (error) {
    console.warn("As preferências visuais não puderam ser guardadas.", error);
  }
}

function updateChrome() {
  const rollCount = app.state?.rolls?.length || 0;
  brandCount.textContent = formatRollCount(rollCount);
  storageStatus.textContent = app.cloud.user ? "Online e local" : "Guardado neste dispositivo";
  storageDot.classList.toggle("online", Boolean(app.cloud.user));
  updateDriveReminder();
  document.querySelectorAll(".nav-item[data-view]").forEach((button) => {
    const activeView = app.activeView === "packaging" ? "stock" : app.activeView;
    if (button.dataset.view === activeView) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });
}

function updateDriveReminder() {
  if (!driveReminder || !app.ready) return;
  const lastBackupAt = text(app.cloud.driveStatus?.lastBackupAt);
  const due = isDriveBackupDue(lastBackupAt);
  if (!due) {
    driveReminder.hidden = true;
    driveReminder.innerHTML = "";
    return;
  }

  const inProgress = app.cloud.driveBackupInProgress;
  driveReminder.hidden = false;
  driveReminder.innerHTML = `
    <span class="drive-reminder-mark">${uiIcon("cloud-upload")}</span>
    <span class="drive-reminder-copy">
      <strong>Cópia externa semanal pendente</strong>
      <span>${lastBackupAt ? `Já passaram sete dias desde ${escapeHtml(formatDateTime(lastBackupAt))}.` : "Crie a primeira cópia independente no seu Google Drive."}</span>
    </span>
    <button class="button primary" type="button" data-action="drive-backup-now" ${inProgress ? "disabled" : ""}>
      ${uiIcon(inProgress ? "loader-circle" : "hard-drive-upload")}
      <span>${inProgress ? "A guardar…" : "Criar backup"}</span>
    </button>
  `;
}

function render() {
  const view = views[app.activeView];
  title.textContent = view.title;
  kicker.textContent = view.kicker;

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === app.activeView);
  });

  const renderers = {
    dashboard: renderProfessionalDashboard,
    stats: renderStats,
    rolls: renderRollCollection,
    stock: renderStockCollection,
    packaging: renderPackagingCollection,
    equipment: renderEquipmentCollection,
    archive: renderArchive,
  };

  root.innerHTML = renderers[app.activeView]();
  initDynamicWidgets();
  updateChrome();
  refreshIcons();
  applyInterfaceLanguage();
  if (app.activeView === "archive" && app.cloud.user && !app.cloud.historyLoading
    && Date.now() - app.cloud.historyLoadedAt > 60000) {
    window.setTimeout(() => loadCloudHistory(), 0);
  }
}

function initDynamicWidgets() {
  if (app.activeView === "stats") {
    initLocationMap();
    return;
  }

  destroyLocationMap();
}

function refreshIcons() {
  if (!window.lucide?.createIcons) return;
  try {
    window.lucide.createIcons();
  } catch (error) {
    console.warn("Os ícones não puderam ser atualizados.", error);
  }
}

function uiIcon(name) {
  return `<i data-lucide="${escapeAttr(name)}" aria-hidden="true"></i>`;
}

function renderProfessionalDashboard() {
  if (isPrivateAccessRequired() && !app.state.rolls.length && !app.state.stock.length && !app.state.equipment.length) {
    return renderPrivateInitialization();
  }

  const stats = getStats();
  const openRolls = sortRolls(app.state.rolls.filter((roll) => roll.status !== "Arquivado"));
  const currentRolls = openRolls.slice(0, 6);
  const nextRoll = currentRolls[0];
  const stockByType = countStockBy((item) => item.type || "Sem tipo");
  const stockByFormat = countStockBy((item) => item.format || "Sem formato");
  const archiveRate = stats.totalRolls ? Math.round((stats.archivedRolls / stats.totalRolls) * 100) : 0;

  return `
    <section class="dashboard-overview">
      <div class="overview-copy">
        <p class="kicker">Hoje no arquivo</p>
        <h2>${stats.openRolls ? formatPendingRollCount(stats.openRolls) : "Arquivo em dia"}</h2>
        <p>${stats.openRolls ? "Organiza cada rolo, acompanha o processo e mantém o foco na fotografia." : "Não há rolos em andamento neste momento."}</p>
        <div class="home-actions">
          <button class="button primary" type="button" data-action="new-roll">${uiIcon("plus")}<span>Novo rolo</span></button>
          <button class="button inverse" type="button" data-action="show-open-rolls">${uiIcon("list-filter")}<span>Ver todos em andamento</span></button>
        </div>
      </div>
      <div class="overview-metrics" aria-label="Resumo do arquivo">
        <button type="button" data-action="dashboard-filter" data-filter="open">
          <span>Em andamento</span>
          <strong>${formatNumber(stats.openRolls)}</strong>
          <small>precisam de ação</small>
        </button>
        <button type="button" data-action="go-view" data-view="stock">
          <span>Stock disponível</span>
          <strong>${formatNumber(stats.stockTotal)}</strong>
          <small>rolos por usar</small>
        </button>
        <button type="button" data-action="dashboard-filter" data-filter="archived">
          <span>Arquivo fechado</span>
          <strong>${formatNumber(archiveRate)}%</strong>
          <small>${formatRollCount(stats.archivedRolls)}</small>
        </button>
      </div>
    </section>

    <div class="home-focus-grid">
      <section class="panel queue-panel">
        <div class="panel-header">
          <div class="panel-title">
            <p class="section-eyebrow">Fila de trabalho</p>
            <h3>Próximos passos</h3>
            <span class="panel-subtitle">Rolos que ainda não estão arquivados</span>
          </div>
          <button class="text-button" type="button" data-action="show-open-rolls">Ver todos ${uiIcon("arrow-right")}</button>
        </div>
        ${currentRolls.length ? `<div class="roll-card-list">${currentRolls.map((roll) => professionalRollTask(roll)).join("")}</div>` : emptyState("Não há rolos em andamento.")}
      </section>

      <section class="panel stock-snapshot">
        <div class="panel-header">
          <div class="panel-title">
            <p class="section-eyebrow">Disponibilidade</p>
            <h3>Stock</h3>
            <span class="panel-subtitle">O que está pronto para carregar</span>
          </div>
          <button class="icon-button subtle" type="button" data-action="go-view" data-view="stock" aria-label="Abrir stock" title="Abrir stock">${uiIcon("arrow-up-right")}</button>
        </div>
        <div class="stock-total">
          <strong>${formatNumber(stats.stockTotal)}</strong>
          <span>${stats.stockTotal === 1 ? "rolo disponível" : "rolos disponíveis"}</span>
        </div>
        <div class="stock-breakdown">
          ${stockSummaryRow("35 mm", stockByFormat.get("135") || 0, stats.stockTotal)}
          ${stockSummaryRow("120", stockByFormat.get("120") || 0, stats.stockTotal)}
          ${stockSummaryRow("Preto e branco", stockByType.get("B&W") || 0, stats.stockTotal)}
          ${stockSummaryRow("Cor", stockByType.get("Cor") || 0, stats.stockTotal)}
        </div>
        ${nextRoll ? `
          <div class="current-focus">
            <span>Rolo mais recente</span>
            <button type="button" data-action="view-roll" data-id="${escapeAttr(nextRoll.id)}">
              <strong>${escapeHtml(nextRoll.id)} · ${escapeHtml(nextRoll.camera || "Sem câmara")}</strong>
              <small>${escapeHtml(filmName(nextRoll) || "Sem filme")} · ${escapeHtml(nextRoll.status || "Sem estado")}</small>
              ${uiIcon("chevron-right")}
            </button>
          </div>
        ` : ""}
      </section>
    </div>

    <section class="panel workflow-panel">
      <div class="panel-header">
        <div class="panel-title">
          <p class="section-eyebrow">Pipeline</p>
          <h3>Fluxo de trabalho</h3>
          <span class="panel-subtitle">Clica num estado para abrir os respetivos rolos</span>
        </div>
      </div>
      <div class="workflow open-workflow">${openWorkflow(stats)}</div>
    </section>
  `;
}

function renderPrivateInitialization() {
  return `
    <section class="private-initialization">
      <div class="private-initialization-mark">${uiIcon("shield-check")}</div>
      <div>
        <p class="section-eyebrow">Primeira abertura privada</p>
        <h2>O arquivo online está vazio e protegido</h2>
        <p>Importa a cópia inicial incluída no ZIP privado. Depois da importação, a app guarda automaticamente a nova versão no Firebase.</p>
      </div>
      <div class="private-initialization-actions">
        <label class="button primary file-button">
          ${uiIcon("upload")}<span>Importar base inicial</span>
          <input type="file" accept="application/json,.json" data-action="import-json-file">
        </label>
        <button class="button secondary" type="button" data-action="cloud-pull">Verificar backup existente</button>
      </div>
      <ol>
        <li>Escolhe <strong>BACKUP_INICIAL_ROLOS-v1.04-326-ROLOS.json</strong>.</li>
        <li>Confirma que aparecem 326 rolos.</li>
        <li>Vai a <strong>Backup</strong> e aguarda a confirmação da sincronização.</li>
      </ol>
    </section>
  `;
}

function stockSummaryRow(label, value, total) {
  const width = total ? Math.max(3, (value / total) * 100) : 0;
  return `
    <div class="stock-summary-row">
      <span>${escapeHtml(label)}</span>
      <span class="stock-summary-track"><span style="width:${width}%"></span></span>
      <strong>${formatNumber(value)}</strong>
    </div>
  `;
}

function professionalRollTask(roll) {
  const next = getNextStatus(roll.status);
  return `
    <article class="roll-task-card">
      <button class="task-main" type="button" data-action="view-roll" data-id="${escapeAttr(roll.id)}">
        <span class="task-code">${escapeHtml(roll.id)}</span>
        <span class="task-copy">
          <strong>${escapeHtml(roll.camera || "Sem câmara")}</strong>
          <small>${escapeHtml(filmName(roll) || "Sem filme")} · ${escapeHtml(formatDate(roll.date))}</small>
        </span>
        ${uiIcon("chevron-right")}
      </button>
      <div class="task-footer">
        ${statusPill(roll.status)}
        <div class="task-actions">
          ${next ? `<button class="icon-button subtle advance-icon" type="button" data-action="advance-status" data-id="${escapeAttr(roll.id)}" aria-label="Avançar para ${escapeAttr(next)}" title="Avançar para ${escapeAttr(next)}">${uiIcon("arrow-right")}</button>` : `<span class="closed-label">Fechado</span>`}
        </div>
      </div>
    </article>
  `;
}

function renderDashboard() {
  const stats = getStats();
  const openRolls = sortRolls(app.state.rolls.filter((roll) => roll.status !== "Arquivado"));
  const currentRolls = openRolls.slice(0, 8);
  const nextRoll = currentRolls[0];
  const stockByType = countStockBy((item) => item.type || "Sem tipo");

  return `
    <section class="home-hero calm-hero">
      <div class="home-copy">
        <p class="kicker">Hoje no arquivo</p>
        <h2>${stats.openRolls ? `${formatRollCount(stats.openRolls)} em andamento` : "Tudo arquivado"}</h2>
        <p class="home-lead">${stats.openRolls ? "Estes são os rolos que ainda precisam de atenção antes de ficarem fechados no arquivo." : "Não há rolos pendentes neste momento. Bom sinal."}</p>
        <div class="home-actions">
          <button class="button primary" type="button" data-action="new-roll">Novo rolo</button>
          <button class="button secondary" type="button" data-action="show-open-rolls">Ver todos em andamento</button>
          <button class="button secondary" type="button" data-action="go-view" data-view="stats">Ver estatísticas</button>
        </div>
      </div>
      <div class="home-camera">
        <img src="icon.svg" alt="">
      </div>
    </section>

    <div class="home-focus-grid">
      <section class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <h3>Próximos passos</h3>
            <span class="panel-subtitle">Rolos que ainda não estão arquivados</span>
          </div>
          <button class="button secondary" type="button" data-action="show-open-rolls">Ver todos</button>
        </div>
        ${currentRolls.length ? `
          <div class="roll-card-list">
            ${currentRolls.map((roll) => rollTaskCard(roll)).join("")}
          </div>
        ` : emptyState("Não há rolos em andamento.")}
      </section>

      <section class="panel dark-panel">
        <div class="panel-header">
          <div class="panel-title">
            <h3>Resumo rápido</h3>
            <span class="panel-subtitle">Stock e estado geral</span>
          </div>
        </div>
        <div class="quick-summary">
          <div>
            <span>Stock total</span>
            <strong>${formatNumber(stats.stockTotal)}</strong>
            <small>${formatNumber(stats.stock35)} em 35mm · ${formatNumber(stats.stock120)} em 120</small>
          </div>
          <div>
            <span>Cor</span>
            <strong>${formatNumber(stockByType.get("Cor") || 0)}</strong>
            <small>rolos disponíveis</small>
          </div>
          <div>
            <span>Preto e branco</span>
            <strong>${formatNumber(stockByType.get("B&W") || 0)}</strong>
            <small>rolos disponíveis</small>
          </div>
        </div>
        ${nextRoll ? `
          <div class="next-roll">
            <span>Mais recente em andamento</span>
            <strong>${escapeHtml(nextRoll.id)} · ${escapeHtml(nextRoll.camera || "Sem câmara")}</strong>
            <p>${escapeHtml(filmName(nextRoll) || "Sem filme")} · ${escapeHtml(nextRoll.status || "Sem estado")}</p>
            <div class="home-actions">
              <button class="button primary" type="button" data-action="view-roll" data-id="${escapeAttr(nextRoll.id)}">Ver rolo</button>
              ${statusAdvanceButton(nextRoll, false)}
            </div>
          </div>
        ` : ""}
      </section>
    </div>

    <section class="panel">
      <div class="panel-header">
        <div class="panel-title">
          <h3>Fluxo de trabalho</h3>
          <span class="panel-subtitle">Onde estão os rolos que ainda não foram fechados</span>
        </div>
      </div>
      <div class="workflow open-workflow">${openWorkflow(stats)}</div>
    </section>
  `;
}

function renderStats() {
  const statsRolls = getStatsRolls();
  const stats = getStats(statsRolls);
  return `
    ${statsFilterToolbar(statsRolls.length)}

    <section class="stats-hero">
      <div>
        <p class="kicker">Leitura do arquivo</p>
        <h2>Padrões de uso, filmes e câmaras.</h2>
      </div>
      <div class="stats-hero-grid">
        ${metric("Rolos na análise", stats.totalRolls, `${formatNumber(app.state.rolls.length)} no arquivo completo`)}
        ${metric("Arquivados", stats.archivedRolls, `${formatNumber(stats.openRolls)} em andamento`)}
        ${metric("Stock total", stats.stockTotal, `${formatNumber(stats.stock35)} em 35mm · ${formatNumber(stats.stock120)} em 120`)}
      </div>
    </section>

    ${patternInsights(stats)}

    <section class="panel">
      <div class="panel-header">
        <div class="panel-title">
          <h3>Rolos por mês</h3>
          <span class="panel-subtitle">Evolução dos últimos meses registados</span>
        </div>
      </div>
      ${lineChart(stats.byMonth, { maxItems: 18 })}
    </section>

    <section class="panel">
      <div class="panel-header">
        <div class="panel-title">
          <h3>Mapa de locais</h3>
          <span class="panel-subtitle">Rolos com vários locais contam em cada ponto indicado</span>
        </div>
      </div>
      ${locationMap(stats.byLocation)}
    </section>

    <div class="dashboard-grid visual-grid">
      <section class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <h3>Tipo de filme</h3>
            <span class="panel-subtitle">Cor e preto e branco</span>
          </div>
        </div>
        ${donutChart(stats.byType, { filterType: "type" })}
      </section>

      <section class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <h3>Formato</h3>
            <span class="panel-subtitle">135 e 120</span>
          </div>
        </div>
        ${donutChart(stats.byFormat, { filterType: "format", alt: true })}
      </section>
    </div>

    <div class="dashboard-grid">
      <section class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <h3>Câmaras mais usadas</h3>
            <span class="panel-subtitle">Top 10 por número de rolos</span>
          </div>
        </div>
        ${barChart(stats.byCamera, { maxItems: 10, alt: true, filterType: "camera" })}
      </section>

      <section class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <h3>Filmes mais usados</h3>
            <span class="panel-subtitle">Marcas e ISO recorrentes</span>
          </div>
        </div>
        ${barChart(stats.byFilmBrand, { maxItems: 10, filterType: "brand" })}
      </section>
    </div>

    <div class="dashboard-grid">
      <section class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <h3>ISO</h3>
            <span class="panel-subtitle">Sensibilidades mais usadas</span>
          </div>
        </div>
        ${barChart(stats.byIso, { maxItems: 10 })}
      </section>

      <section class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <h3>Revelação</h3>
            <span class="panel-subtitle">Locais ou métodos mais frequentes</span>
          </div>
        </div>
        ${barChart(stats.byDeveloper, { maxItems: 10, alt: true })}
      </section>
    </div>
  `;
}

function statsFilterToolbar(resultCount) {
  const cameras = unique(app.state.rolls.map((roll) => roll.camera)).sort(localeSort);
  const films = unique(app.state.rolls.map(filmName)).sort(localeSort);
  const formats = unique(app.state.rolls.map((roll) => roll.format)).sort(localeSort);
  const types = unique(app.state.rolls.map((roll) => roll.type)).sort(localeSort);
  const locations = unique(app.state.rolls.flatMap((roll) => splitLocations(roll.shotLocation))).sort(localeSort);
  const statuses = unique(app.state.rolls.map((roll) => roll.status)).sort(localeSort);
  const years = unique(app.state.rolls.map((roll) => String(roll.date || "").slice(0, 4)).filter((year) => /^\d{4}$/.test(year))).sort((a, b) => b.localeCompare(a));
  const activeCount = ["statsCamera", "statsFilm", "statsFormat", "statsType", "statsLocation", "statsStatus", "statsYear"]
    .filter((name) => app.filters[name]).length;

  return `
    <section class="stats-filter-panel">
      <div class="stats-filter-heading">
        <div>
          <p class="section-eyebrow">Análise personalizada</p>
          <h2>${formatRollCount(resultCount)}</h2>
          <span>${activeCount ? `${formatNumber(activeCount)} ${activeCount === 1 ? "filtro ativo" : "filtros ativos"}` : "Arquivo completo"}</span>
        </div>
        <button class="button secondary" type="button" data-action="clear-stats-filters" ${activeCount ? "" : "disabled"}>${uiIcon("filter-x")}<span>Limpar filtros</span></button>
      </div>
      <div class="stats-filter-grid">
        ${filterSelect("statsCamera", "Câmara", ["", ...cameras])}
        ${filterSelect("statsFilm", "Filme", ["", ...films])}
        ${filterSelect("statsFormat", "Formato", ["", ...formats])}
        ${filterSelect("statsType", "Tipo", ["", ...types])}
        ${filterSelect("statsLocation", "Local", ["", ...locations])}
        ${filterSelect("statsStatus", "Estado", ["", ...statuses])}
        ${filterSelect("statsYear", "Ano", ["", ...years])}
      </div>
    </section>
  `;
}

function renderRollCollection() {
  const rolls = sortRollCollection(getFilteredRolls(), app.filters.rollsSort);
  const visibleRolls = rolls.slice(0, app.rollLimit);
  const mode = app.viewModes.rolls;

  return `
    <section class="toolbar">
      ${filterInput("rollsSearch", "Pesquisar", "ID, câmara, filme, local, pasta")}
      ${filterSelect("rollsStatus", "Estado", ["", ...unique(app.state.rolls.map((roll) => roll.status))])}
      ${filterSelect("rollsCamera", "Câmara", ["", ...unique(app.state.rolls.map((roll) => roll.camera)).sort(localeSort)])}
      ${filterSelect("rollsFormat", "Formato", ["", ...unique(app.state.rolls.map((roll) => roll.format)).sort(localeSort)])}
      ${filterSelect("rollsType", "Tipo", ["", ...unique(app.state.rolls.map((roll) => roll.type)).sort(localeSort)])}
      <div class="toolbar-actions">
        <button class="button ${app.filters.rollsStatus === "__open" ? "primary" : "secondary"}" type="button" data-action="show-open-rolls">${uiIcon("activity")}<span>Em andamento</span></button>
        <button class="button secondary" type="button" data-action="clear-roll-filters">${uiIcon("filter-x")}<span>Limpar</span></button>
        <button class="button primary" type="button" data-action="new-roll">${uiIcon("plus")}<span>Novo rolo</span></button>
      </div>
    </section>

    ${collectionHeading({
      collection: "rolls",
      title: formatRollCount(rolls.length),
      subtitle: app.filters.rollsStatus === "__open" ? "Rolos ainda por concluir" : "Arquivo cronológico de negativos e fotografias",
      sortName: "rollsSort",
      sortOptions: [
        ["newest", "Mais recentes"],
        ["oldest", "Mais antigos"],
        ["status", "Estado"],
        ["camera", "Câmara"],
        ["film", "Filme"],
      ],
    })}

    ${visibleRolls.length
      ? (mode === "catalog" ? rollCatalogView(visibleRolls, app.filters.rollsSort) : rollListView(visibleRolls))
      : emptyState("Nenhum rolo encontrado.")}

    ${collectionPagination(rolls.length, visibleRolls.length)}
  `;
}

function renderStockCollection() {
  const stock = sortStockCollection(getFilteredStock(), app.filters.stockSort);
  const mode = app.viewModes.stock;
  const quantity = sum(stock.map((item) => item.quantity));

  return `
    ${filmSectionTabs("stock")}

    <section class="toolbar compact">
      ${filterInput("stockSearch", "Pesquisar", "Marca, modelo, nota")}
      ${filterSelect("stockFormat", "Formato", ["", ...unique(app.state.stock.map((item) => item.format)).sort(localeSort)])}
      ${filterSelect("stockType", "Tipo", ["", ...unique(app.state.stock.map((item) => item.type)).sort(localeSort)])}
      <div class="toolbar-actions">
        <button class="button primary" type="button" data-action="new-stock">${uiIcon("plus")}<span>Novo stock</span></button>
      </div>
    </section>

    ${collectionHeading({
      collection: "stock",
      title: formatInStockCount(quantity),
      subtitle: formatFilmReferenceCount(stock.length),
      sortName: "stockSort",
      sortOptions: [
        ["name", "Marca e modelo"],
        ["quantity", "Maior quantidade"],
        ["expiry", "Validade"],
        ["iso", "ISO"],
      ],
    })}

    ${stock.length
      ? (mode === "catalog" ? stockCatalogView(stock) : stockListView(stock))
      : emptyState("Nenhum stock encontrado.")}
  `;
}

function filmSectionTabs(active) {
  return `
    <div class="section-tabs" role="tablist" aria-label="Filmes">
      <button type="button" role="tab" data-action="go-view" data-view="stock" aria-selected="${active === "stock"}" class="${active === "stock" ? "active" : ""}">
        ${uiIcon("package")}<span>Stock</span>
      </button>
      <button type="button" role="tab" data-action="go-view" data-view="packaging" aria-selected="${active === "packaging"}" class="${active === "packaging" ? "active" : ""}">
        ${uiIcon("image")}<span>Embalagens</span>
      </button>
    </div>
  `;
}

function renderPackagingCollection() {
  const allFilms = getFilmLibrary();
  const films = getFilteredFilmLibrary(allFilms);
  const imageMatches = films.map((film) => findFilmImage(film));
  const customImages = imageMatches.filter((match) => match?.source === "custom").length;
  const includedImages = imageMatches.filter((match) => match?.source === "included").length;
  const automaticCovers = films.length - customImages - includedImages;

  return `
    ${filmSectionTabs("packaging")}

    <section class="toolbar packaging-toolbar">
      ${filterInput("packagingSearch", "Pesquisar", "Marca, modelo ou ISO")}
      ${filterSelect("packagingFormat", "Formato", ["", ...unique(allFilms.map((film) => film.format)).sort(localeSort)])}
      ${filterSelect("packagingType", "Tipo", ["", ...unique(allFilms.map((film) => film.type)).sort(localeSort)])}
      ${filterSelectOptions("packagingAvailability", "Mostrar", [
        ["", "Todos"],
        ["stock", "Com stock"],
        ["used", "Já utilizados"],
        ["photo", "Com fotografia"],
        ["missing", "Sem fotografia"],
      ])}
      <div class="toolbar-actions">
        <button class="button secondary" type="button" data-action="clear-packaging-filters">${uiIcon("filter-x")}<span>Limpar</span></button>
      </div>
    </section>

    <section class="collection-heading packaging-heading">
      <div>
        <p class="section-eyebrow">Biblioteca visual</p>
        <h2>${formatFilmCount(films.length)}</h2>
        <p>${formatPackagingSummary(customImages, includedImages, automaticCovers)}</p>
      </div>
      <label class="collection-sort">
        <span>Ordenar</span>
        <select data-filter="packagingSort">
          <option value="usage" ${app.filters.packagingSort === "usage" ? "selected" : ""}>Mais utilizados</option>
          <option value="stock" ${app.filters.packagingSort === "stock" ? "selected" : ""}>Maior stock</option>
          <option value="recent" ${app.filters.packagingSort === "recent" ? "selected" : ""}>Uso mais recente</option>
          <option value="name" ${app.filters.packagingSort === "name" ? "selected" : ""}>Marca e modelo</option>
        </select>
      </label>
    </section>

    ${films.length
      ? `<div class="film-package-grid">${films.map(filmPackageCard).join("")}</div>`
      : emptyState("Nenhum filme corresponde aos filtros escolhidos.")}
  `;
}

function getFilmLibrary() {
  const films = new Map();
  const ensure = (source) => {
    const normalized = {
      brand: text(source.brand || source.filmBrand),
      model: text(source.model || source.filmModel),
      iso: text(source.iso),
      format: text(source.format),
      type: text(source.type),
    };
    const key = filmReferenceKey(normalized);
    if (!films.has(key)) {
      films.set(key, { ...normalized, key, rollCount: 0, stockQuantity: 0, lastUsed: "" });
    }
    return films.get(key);
  };

  app.state.rolls.forEach((roll) => {
    const film = ensure(roll);
    film.rollCount += 1;
    if (String(roll.date || "") > film.lastUsed) film.lastUsed = String(roll.date || "");
  });

  app.state.stock.forEach((item) => {
    const film = ensure(item);
    film.stockQuantity += numberOrZero(item.quantity);
    if (!film.type) film.type = text(item.type);
  });

  return [...films.values()];
}

function getFilteredFilmLibrary(films) {
  const search = normalizeSearchValue(app.filters.packagingSearch);
  const filtered = films.filter((film) => {
    const hasPhoto = Boolean(findFilmImage(film));
    const availability = app.filters.packagingAvailability;
    const matchesAvailability = !availability
      || (availability === "stock" && film.stockQuantity > 0)
      || (availability === "used" && film.rollCount > 0)
      || (availability === "photo" && hasPhoto)
      || (availability === "missing" && !hasPhoto);
    const haystack = normalizeSearchValue([film.brand, film.model, film.iso, film.format, film.type].join(" "));
    return (!search || haystack.includes(search))
      && (!app.filters.packagingFormat || film.format === app.filters.packagingFormat)
      && (!app.filters.packagingType || film.type === app.filters.packagingType)
      && matchesAvailability;
  });

  if (app.filters.packagingSort === "stock") {
    return filtered.sort((a, b) => b.stockQuantity - a.stockQuantity || localeSort(filmDisplayName(a), filmDisplayName(b)));
  }
  if (app.filters.packagingSort === "recent") {
    return filtered.sort((a, b) => String(b.lastUsed).localeCompare(String(a.lastUsed)) || localeSort(filmDisplayName(a), filmDisplayName(b)));
  }
  if (app.filters.packagingSort === "name") {
    return filtered.sort((a, b) => localeSort(filmDisplayName(a), filmDisplayName(b)) || localeSort(a.format, b.format));
  }
  return filtered.sort((a, b) => b.rollCount - a.rollCount || localeSort(filmDisplayName(a), filmDisplayName(b)));
}

function filmPackageCard(film) {
  const imageMatch = findFilmImage(film);
  const filmImage = imageMatch?.image;
  const imageSrc = filmImageSource(filmImage);
  const isCustomImage = imageMatch?.source === "custom";
  const palette = filmPalette(film.brand);
  const image = imageSrc
    ? `<img src="${escapeAttr(imageSrc)}" alt="Embalagem de ${escapeAttr(filmDisplayName(film))}">`
    : `
      <div class="film-package-art" style="--film-accent:${palette.accent};--film-deep:${palette.deep};--film-paper:${palette.paper}" role="img" aria-label="Capa automática de ${escapeAttr(filmDisplayName(film))}">
        <span class="film-package-brand">${escapeHtml(film.brand || "Filme")}</span>
        <strong>${escapeHtml(film.model || "Sem modelo")}</strong>
        <span class="film-package-iso">ISO ${escapeHtml(film.iso || "—")}</span>
        <small>${escapeHtml(film.format || "—")} · ${escapeHtml(film.type || "Sem tipo")}</small>
      </div>`;

  return `
    <article class="film-package-card">
      <div class="film-package-media">
        ${image}
        <span class="film-image-source ${isCustomImage ? "custom" : imageSrc ? "included" : ""}">${isCustomImage ? "Fotografia tua" : imageSrc ? "Imagem incluída" : "Capa automática"}</span>
      </div>
      <div class="film-package-content">
        <header>
          <div>
            <span class="catalog-overline">${escapeHtml(film.brand || "Sem marca")}</span>
            <h3>${escapeHtml(film.model || "Sem modelo")}</h3>
          </div>
          <span class="film-iso-badge">ISO ${escapeHtml(film.iso || "—")}</span>
        </header>
        <div class="film-package-stats">
          <span><small>Utilizados</small><strong>${formatNumber(film.rollCount)}</strong></span>
          <span><small>Em stock</small><strong>${formatNumber(film.stockQuantity)}</strong></span>
          <span><small>Formato</small><strong>${escapeHtml(film.format || "—")}</strong></span>
        </div>
        <footer>
          <label class="button secondary compact-button film-upload-button">
            ${uiIcon("camera")}<span>${imageSrc ? "Substituir foto" : "Carregar foto"}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" data-action="upload-film-image" data-film-key="${escapeAttr(film.key)}">
          </label>
          ${isCustomImage ? `<button class="icon-button subtle" type="button" data-action="remove-film-image" data-film-key="${escapeAttr(imageMatch.key)}" aria-label="Remover fotografia pessoal" title="Remover fotografia pessoal">${uiIcon("trash-2")}</button>` : ""}
        </footer>
      </div>
    </article>
  `;
}

function filmReferenceKey(film) {
  return [film.brand || film.filmBrand, film.model || film.filmModel, film.iso, film.format]
    .map((value) => normalizeSearchValue(value) || "-")
    .join("::");
}

function findFilmImage(film) {
  const images = app.state?.filmImages || {};
  const exactKey = filmReferenceKey(film);
  if (images[exactKey]) return { key: exactKey, image: images[exactKey], source: "custom" };

  const comparableKey = comparableFilmReferenceKey(film);
  for (const [key, image] of Object.entries(images)) {
    const [brand = "", model = "", iso = "", format = ""] = key.split("::");
    if (comparableFilmReferenceKey({ brand, model, iso, format }) === comparableKey) {
      return { key, image, source: "custom" };
    }
  }

  const included = findBuiltInFilmImage(film);
  return included
    ? {
        key: `included:${included.id}`,
        image: {
          src: included.src,
          fileName: included.fileName,
        },
        source: "included",
      }
    : null;
}

function findBuiltInFilmImage(film) {
  const catalog = Array.isArray(globalThis.ROLOS_BUILT_IN_FILM_IMAGES)
    ? globalThis.ROLOS_BUILT_IN_FILM_IMAGES
    : [];
  return catalog.find((entry) => {
    const brandMatches = filmCatalogValueMatches(
      film.brand || film.filmBrand,
      entry.brands || [entry.brand]
    );
    const modelMatches = filmCatalogValueMatches(
      film.model || film.filmModel,
      entry.models || [entry.model]
    );
    const isoMatches = filmCatalogValueMatches(film.iso, [entry.iso]);
    const formats = Array.isArray(entry.formats) ? entry.formats : [];
    const formatMatches = !formats.length
      || formats.includes("*")
      || filmCatalogValueMatches(normalizeFilmFormat(film.format), formats.map(normalizeFilmFormat));
    return brandMatches && modelMatches && isoMatches && formatMatches && text(entry.src);
  }) || null;
}

function filmCatalogValueMatches(value, options) {
  const comparable = normalizeSearchValue(value).replace(/[^a-z0-9]+/g, "");
  return Boolean(comparable) && options
    .filter((option) => option !== undefined && option !== null)
    .some((option) => normalizeSearchValue(option).replace(/[^a-z0-9]+/g, "") === comparable);
}

function comparableFilmReferenceKey(film) {
  return [
    film.brand || film.filmBrand,
    film.model || film.filmModel,
    film.iso,
    normalizeFilmFormat(film.format),
  ]
    .map((value) => normalizeSearchValue(value) || "-")
    .join("::");
}

function normalizeFilmFormat(value) {
  const compact = normalizeSearchValue(value).replace(/[^a-z0-9]+/g, "");
  if (["35", "35mm", "135"].includes(compact)) return "135";
  if (["120", "120mm", "medioformato", "mediumformat"].includes(compact)) return "120";
  return compact;
}

function filmThumbnailImage(image) {
  const src = filmImageSource(image);
  if (!src) return "";
  return `<img class="film-thumbnail-image" src="${escapeAttr(src)}" alt="" aria-hidden="true" loading="lazy" decoding="async">`;
}

function filmImageSource(image) {
  return text(image?.dataUrl || image?.src);
}

function filmDisplayName(film) {
  return [film.brand, film.model, film.iso && !String(film.model || "").includes(String(film.iso)) ? film.iso : ""]
    .filter(Boolean)
    .join(" ");
}

function filmPalette(brand) {
  const palettes = {
    kodak: { accent: "#f2c500", deep: "#c41624", paper: "#fff7cf" },
    ilford: { accent: "#d9e1df", deep: "#19191b", paper: "#ffffff" },
    fujifilm: { accent: "#38a169", deep: "#12613a", paper: "#f4fff7" },
    fomapan: { accent: "#2f6f98", deep: "#142f47", paper: "#edf6fb" },
    rollei: { accent: "#d7b331", deep: "#1b1b1c", paper: "#faf8ef" },
    kentemere: { accent: "#d6d8d7", deep: "#202124", paper: "#ffffff" },
    kentmere: { accent: "#d6d8d7", deep: "#202124", paper: "#ffffff" },
    adox: { accent: "#e25252", deep: "#151515", paper: "#fff5f5" },
    lomo: { accent: "#28a7a1", deep: "#1a2540", paper: "#f3ffff" },
    leica: { accent: "#d61627", deep: "#171719", paper: "#ffffff" },
    harman: { accent: "#d96b3b", deep: "#272121", paper: "#fff7f1" },
  };
  const key = normalizeSearchValue(brand);
  if (palettes[key]) return palettes[key];
  const fallbacks = [
    { accent: "#d97706", deep: "#3b2614", paper: "#fff8eb" },
    { accent: "#287a78", deep: "#183b3a", paper: "#effbfa" },
    { accent: "#8a8f98", deep: "#25282d", paper: "#f7f8f9" },
    { accent: "#ba4a4f", deep: "#3b2023", paper: "#fff4f4" },
  ];
  return fallbacks[hashString(key) % fallbacks.length];
}

function renderEquipmentCollection() {
  const equipment = sortEquipmentCollection(getFilteredEquipment(), app.filters.equipmentSort);
  const mode = app.viewModes.equipment;
  const totalValue = sum(equipment.map((item) => item.purchaseValue));

  return `
    <section class="toolbar compact">
      ${filterInput("equipmentSearch", "Pesquisar", "Marca, modelo, sistema, notas")}
      ${filterSelect("equipmentKind", "Tipo", ["", ...unique(app.state.equipment.map((item) => item.kind)).sort(localeSort)])}
      ${filterSelect("equipmentStatus", "Estado", ["", ...unique(app.state.equipment.map((item) => item.status)).sort(localeSort)])}
      <div class="toolbar-actions">
        <button class="button primary" type="button" data-action="new-equipment">${uiIcon("plus")}<span>Novo item</span></button>
      </div>
    </section>

    ${collectionHeading({
      collection: "equipment",
      title: formatItemCount(equipment.length),
      subtitle: `Valor registado: ${formatCurrency(totalValue)}`,
      sortName: "equipmentSort",
      sortOptions: [
        ["name", "Marca e modelo"],
        ["kind", "Tipo"],
        ["value", "Maior valor"],
        ["service", "Última revisão"],
      ],
    })}

    ${equipment.length
      ? (mode === "catalog" ? equipmentCatalogView(equipment) : equipmentListView(equipment))
      : emptyState("Nenhum equipamento encontrado.")}
  `;
}

function collectionHeading({ collection, title: heading, subtitle, sortName, sortOptions }) {
  return `
    <section class="collection-heading">
      <div>
        <p class="section-eyebrow">${app.viewModes[collection] === "catalog" ? "Vista de catálogo" : "Vista compacta"}</p>
        <h2>${escapeHtml(heading)}</h2>
        <p>${escapeHtml(subtitle)}</p>
      </div>
      <div class="collection-controls">
        <label class="collection-sort">
          <span>Ordenar</span>
          <select data-filter="${escapeAttr(sortName)}">
            ${sortOptions.map(([value, label]) => `<option value="${escapeAttr(value)}" ${app.filters[sortName] === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}
          </select>
        </label>
        ${viewModeSwitch(collection)}
      </div>
    </section>
  `;
}

function viewModeSwitch(collection) {
  const mode = app.viewModes[collection];
  return `
    <div class="view-switch" role="group" aria-label="Modo de visualização">
      <button class="${mode === "catalog" ? "active" : ""}" type="button" data-action="set-view-mode" data-collection="${escapeAttr(collection)}" data-mode="catalog" aria-pressed="${mode === "catalog"}">
        ${uiIcon("layout-grid")}<span>Catálogo</span>
      </button>
      <button class="${mode === "list" ? "active" : ""}" type="button" data-action="set-view-mode" data-collection="${escapeAttr(collection)}" data-mode="list" aria-pressed="${mode === "list"}">
        ${uiIcon("list")}<span>Lista</span>
      </button>
    </div>
  `;
}

function rollCatalogView(rolls, sortMode) {
  const groups = groupCollection(rolls, (roll) => String(roll.date || "").slice(0, 7) || "Sem data");
  const keys = [...groups.keys()].sort((a, b) => {
    if (a === "Sem data") return 1;
    if (b === "Sem data") return -1;
    return sortMode === "oldest" ? a.localeCompare(b) : b.localeCompare(a);
  });

  return `<div class="catalog-groups">${keys.map((key) => {
    const items = groups.get(key);
    return `
      <section class="catalog-group">
        <div class="catalog-group-heading">
          <h3>${key === "Sem data" ? key : escapeHtml(formatMonthLabel(key))}</h3>
          <span>${formatRollCount(items.length)}</span>
        </div>
        <div class="roll-catalog-grid">${items.map(rollCatalogCard).join("")}</div>
      </section>
    `;
  }).join("")}</div>`;
}

function rollCatalogCard(roll) {
  const next = getNextStatus(roll.status);
  const locations = splitLocations(roll.shotLocation);
  const locationLabel = locations.length > 2
    ? `${locations.slice(0, 2).join(" · ")} +${locations.length - 2}`
    : locations.join(" · ") || "Sem local";
  const photosUrl = safeExternalUrl(roll.photosUrl);
  const progress = statusProgress(roll.status);
  const typeClass = normalizeSearchValue(roll.type) === "cor" ? "is-color" : "is-bw";
  const customImage = findFilmImage(roll)?.image;

  return `
    <article class="roll-catalog-card ${typeClass}">
      <header class="catalog-card-header">
        <div>
          <strong>${escapeHtml(roll.id)}</strong>
          <span>${escapeHtml(formatDate(roll.date) || "Sem data")}</span>
        </div>
        <div class="catalog-card-flags">
          ${roll.favorite ? `<span class="favorite-flag" title="Favorito">${uiIcon("star")}</span>` : ""}
          ${statusPill(roll.status)}
        </div>
      </header>

      <button class="roll-catalog-main" type="button" data-action="view-roll" data-id="${escapeAttr(roll.id)}">
        <span class="film-object ${customImage ? "has-film-image" : ""}" aria-hidden="true">
          ${filmThumbnailImage(customImage)}
          ${uiIcon("film")}
          <small>${escapeHtml(roll.format || "—")}</small>
        </span>
        <span class="catalog-primary">
          <span class="catalog-overline">${escapeHtml(roll.type || "Filme")}${roll.iso ? ` · ISO ${escapeHtml(roll.iso)}` : ""}</span>
          <strong>${escapeHtml(filmName(roll) || "Filme sem identificação")}</strong>
          <small>${escapeHtml(roll.camera || "Sem câmara")}${roll.lens ? ` · ${escapeHtml(roll.lens)}` : ""}</small>
        </span>
        ${uiIcon("chevron-right")}
      </button>

      <div class="catalog-facts">
        <span title="${escapeAttr(roll.shotLocation || "Sem local")}">${uiIcon("map-pin")}<span>${escapeHtml(locationLabel)}</span></span>
        <span>${uiIcon("folder-archive")}<span>${escapeHtml(roll.negativeCode || roll.id)}</span></span>
      </div>

      <div class="roll-progress" aria-label="Progresso: ${escapeAttr(roll.status || "Sem estado")}">
        <span><span style="width:${progress}%"></span></span>
        <small>${formatArchiveProgress(progress)}</small>
      </div>

      <footer class="catalog-card-actions">
        <button class="button secondary compact-button" type="button" data-action="view-roll" data-id="${escapeAttr(roll.id)}">${uiIcon("eye")}<span>Detalhes</span></button>
        <div>
          ${photosUrl ? `<a class="icon-button subtle" href="${escapeAttr(photosUrl)}" target="_blank" rel="noopener" aria-label="Abrir fotografias" title="Abrir fotografias">${uiIcon("images")}</a>` : ""}
          ${next ? `<button class="icon-button subtle" type="button" data-action="advance-status" data-id="${escapeAttr(roll.id)}" aria-label="Avançar para ${escapeAttr(next)}" title="Avançar para ${escapeAttr(next)}">${uiIcon("arrow-right")}</button>` : `<span class="closed-label">Fechado</span>`}
        </div>
      </footer>
    </article>
  `;
}

function stockCatalogView(stock) {
  const groups = groupCollection(stock, (item) => item.format || "Sem formato");
  const orderedGroups = [...groups.entries()].sort(([formatA], [formatB]) => localeSort(formatA, formatB));
  return `<div class="catalog-groups">${orderedGroups.map(([format, items]) => `
    <section class="catalog-group">
      <div class="catalog-group-heading">
        <h3>${escapeHtml(format === "135" ? "35 mm" : format === "120" ? "Médio formato · 120" : format)}</h3>
        <span>${formatRollCount(sum(items.map((item) => item.quantity)))}</span>
      </div>
      <div class="stock-catalog-grid">${items.map(stockCatalogCard).join("")}</div>
    </section>
  `).join("")}</div>`;
}

function stockCatalogCard(item) {
  const typeClass = normalizeSearchValue(item.type) === "cor" ? "is-color" : "is-bw";
  const customImage = findFilmImage(item)?.image;
  return `
    <article class="stock-catalog-card ${typeClass}">
      <div class="stock-object ${customImage ? "has-film-image" : ""}" aria-hidden="true">
        ${filmThumbnailImage(customImage)}
        ${uiIcon("disc-3")}
        <span>${escapeHtml(item.format || "—")}</span>
      </div>
      <div class="stock-card-content">
        <header>
          <div>
            <span class="catalog-overline">${escapeHtml(item.brand || "Sem marca")}</span>
            <h3>${escapeHtml(item.model || "Filme sem modelo")}</h3>
          </div>
          ${stockPill(item.condition)}
        </header>
        <div class="stock-specs">
          <span><small>ISO</small><strong>${escapeHtml(item.iso || "—")}</strong></span>
          <span><small>Tipo</small><strong>${escapeHtml(item.type || "—")}</strong></span>
          <span><small>Quantidade</small><strong>${formatNumber(item.quantity)}</strong></span>
        </div>
        <div class="stock-card-note">
          ${uiIcon("calendar-clock")}
          <span>${item.expiryDate ? `Validade ${escapeHtml(formatDate(item.expiryDate))}` : "Sem validade registada"}</span>
        </div>
        ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ""}
        <footer>
          <button class="button secondary compact-button" type="button" data-action="edit-stock" data-id="${escapeAttr(item.id)}">${uiIcon("pencil")}<span>Editar stock</span></button>
        </footer>
      </div>
    </article>
  `;
}

function equipmentCatalogView(equipment) {
  const groups = groupCollection(equipment, (item) => item.kind || "Outros");
  const orderedGroups = [...groups.entries()].sort(([kindA], [kindB]) => localeSort(kindA, kindB));
  return `<div class="catalog-groups">${orderedGroups.map(([kind, items]) => `
    <section class="catalog-group">
      <div class="catalog-group-heading">
        <h3>${escapeHtml(kind)}</h3>
        <span>${formatItemCount(items.length)}</span>
      </div>
      <div class="equipment-catalog-grid">${items.map(equipmentCatalogCard).join("")}</div>
    </section>
  `).join("")}</div>`;
}

function equipmentCatalogCard(item) {
  return `
    <article class="equipment-catalog-card">
      <header>
        <span class="equipment-object" aria-hidden="true">${uiIcon(equipmentIcon(item.kind))}</span>
        ${stockPill(item.status)}
      </header>
      <div class="equipment-card-main">
        <span class="catalog-overline">${escapeHtml(item.brand || item.kind || "Equipamento")}</span>
        <h3>${escapeHtml(item.model || "Sem modelo")}</h3>
        <p>${escapeHtml(item.system || "Sistema não registado")}</p>
      </div>
      <dl class="equipment-details">
        <div><dt>Aquisição</dt><dd>${escapeHtml(formatDate(item.purchaseDate) || "—")}</dd></div>
        <div><dt>Valor</dt><dd>${item.purchaseValue ? escapeHtml(formatCurrency(item.purchaseValue)) : "—"}</dd></div>
        <div><dt>Última revisão</dt><dd>${escapeHtml(formatDate(item.lastServiceDate) || "—")}</dd></div>
      </dl>
      ${item.notes ? `<p class="equipment-note">${escapeHtml(item.notes)}</p>` : ""}
      <footer>
        <button class="button secondary compact-button" type="button" data-action="edit-equipment" data-id="${escapeAttr(item.id)}">${uiIcon("pencil")}<span>Editar equipamento</span></button>
      </footer>
    </article>
  `;
}

function rollListView(rolls) {
  const rows = rolls.map((roll) => `
    <tr>
      <td>${escapeHtml(roll.id)}</td><td>${statusPill(roll.status)}</td><td>${formatDate(roll.date)}</td>
      <td>${escapeHtml(roll.camera)}</td><td>${escapeHtml(filmName(roll))}</td><td>${escapeHtml(roll.iso)}</td>
      <td>${escapeHtml(roll.format)}</td><td>${escapeHtml(roll.shotLocation)}</td><td>${photosLink(roll)}</td>
      <td class="table-actions"><button class="button secondary compact-button" type="button" data-action="view-roll" data-id="${escapeAttr(roll.id)}">${uiIcon("eye")}<span>Ver</span></button>${statusAdvanceButton(roll, true)}</td>
    </tr>
  `).join("");
  return `<section class="panel collection-list-panel"><div class="list-table"><table class="rolls-table"><thead><tr><th>ID</th><th>Estado</th><th>Data</th><th>Câmara</th><th>Filme</th><th>ISO</th><th>Formato</th><th>Local</th><th>Fotos</th><th class="table-actions">Ação</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function stockListView(stock) {
  const rows = stock.map((item) => `<tr><td>${escapeHtml(item.format)}</td><td>${escapeHtml(item.brand)}</td><td>${escapeHtml(item.model)}</td><td>${escapeHtml(item.iso)}</td><td>${escapeHtml(item.type)}</td><td>${formatNumber(item.quantity)}</td><td>${stockPill(item.condition)}</td><td>${formatDate(item.expiryDate)}</td><td>${escapeHtml(item.note)}</td><td class="table-action"><button class="button secondary compact-button" type="button" data-action="edit-stock" data-id="${escapeAttr(item.id)}">${uiIcon("pencil")}<span>Editar</span></button></td></tr>`).join("");
  return `<section class="panel collection-list-panel"><div class="list-table"><table class="stock-table"><thead><tr><th>Formato</th><th>Marca</th><th>Modelo</th><th>ISO</th><th>Tipo</th><th>Qtd</th><th>Estado</th><th>Validade</th><th>Nota</th><th class="table-action">Ação</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function equipmentListView(equipment) {
  const rows = equipment.map((item) => `<tr><td>${escapeHtml(item.kind)}</td><td>${escapeHtml(item.brand)}</td><td>${escapeHtml(item.model)}</td><td>${escapeHtml(item.system)}</td><td>${formatDate(item.purchaseDate)}</td><td>${formatCurrency(item.purchaseValue)}</td><td>${stockPill(item.status)}</td><td>${formatDate(item.lastServiceDate)}</td><td class="table-action"><button class="button secondary compact-button" type="button" data-action="edit-equipment" data-id="${escapeAttr(item.id)}">${uiIcon("pencil")}<span>Editar</span></button></td></tr>`).join("");
  return `<section class="panel collection-list-panel"><div class="list-table"><table class="equipment-table"><thead><tr><th>Tipo</th><th>Marca</th><th>Modelo</th><th>Sistema</th><th>Compra</th><th>Valor</th><th>Estado</th><th>Revisão</th><th class="table-action">Ação</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function collectionPagination(total, visible) {
  if (total <= visible) return "";
  return `<div class="pagination-footer collection-pagination"><span>${formatShownCount(visible, total)}</span><button class="button secondary" type="button" data-action="show-more-rolls">${uiIcon("chevrons-down")}<span>Mostrar mais</span></button></div>`;
}

function groupCollection(items, picker) {
  const groups = new Map();
  items.forEach((item) => {
    const key = picker(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return groups;
}

function sortRollCollection(rolls, mode) {
  const items = [...rolls];
  if (mode === "oldest") return items.sort((a, b) => String(a.date).localeCompare(String(b.date)) || localeSort(a.id, b.id));
  if (mode === "status") return items.sort((a, b) => defaultSupport.statuses.indexOf(a.status) - defaultSupport.statuses.indexOf(b.status) || String(b.date).localeCompare(String(a.date)));
  if (mode === "camera") return items.sort((a, b) => localeSort(a.camera, b.camera) || String(b.date).localeCompare(String(a.date)));
  if (mode === "film") return items.sort((a, b) => localeSort(filmName(a), filmName(b)) || String(b.date).localeCompare(String(a.date)));
  return sortRolls(items);
}

function sortStockCollection(stock, mode) {
  const items = [...stock];
  if (mode === "quantity") return items.sort((a, b) => numberOrZero(b.quantity) - numberOrZero(a.quantity) || localeSort(a.brand, b.brand));
  if (mode === "expiry") return items.sort((a, b) => String(a.expiryDate || "9999").localeCompare(String(b.expiryDate || "9999")) || localeSort(a.brand, b.brand));
  if (mode === "iso") return items.sort((a, b) => numberOrZero(a.iso) - numberOrZero(b.iso) || localeSort(a.brand, b.brand));
  return items.sort((a, b) => localeSort(a.brand, b.brand) || localeSort(a.model, b.model));
}

function sortEquipmentCollection(equipment, mode) {
  const items = [...equipment];
  if (mode === "kind") return items.sort((a, b) => localeSort(a.kind, b.kind) || localeSort(a.brand, b.brand) || localeSort(a.model, b.model));
  if (mode === "value") return items.sort((a, b) => numberOrZero(b.purchaseValue) - numberOrZero(a.purchaseValue) || localeSort(a.model, b.model));
  if (mode === "service") return items.sort((a, b) => String(b.lastServiceDate || "").localeCompare(String(a.lastServiceDate || "")) || localeSort(a.model, b.model));
  return items.sort((a, b) => localeSort(a.brand, b.brand) || localeSort(a.model, b.model));
}

function statusProgress(status) {
  const index = defaultSupport.statuses.indexOf(status);
  if (index < 0) return 0;
  return ((index + 1) / defaultSupport.statuses.length) * 100;
}

function equipmentIcon(kind) {
  const key = normalizeSearchValue(kind);
  if (key === "camera") return "camera";
  if (key === "lente") return "aperture";
  if (key === "flash") return "zap";
  return "package";
}

function renderRolls() {
  const rolls = getFilteredRolls();
  const visibleRolls = rolls.slice(0, app.rollLimit);
  const rows = visibleRolls.map((roll) => `
    <tr>
      <td>${escapeHtml(roll.id)}</td>
      <td>${statusPill(roll.status)}</td>
      <td>${formatDate(roll.date)}</td>
      <td>${escapeHtml(roll.camera)}</td>
      <td>${escapeHtml(filmName(roll))}</td>
      <td>${escapeHtml(roll.iso)}</td>
      <td>${escapeHtml(roll.format)}</td>
      <td>${escapeHtml(roll.shotLocation)}</td>
      <td>${photosLink(roll)}</td>
      <td class="table-actions">
        <button class="button secondary compact-button" type="button" data-action="view-roll" data-id="${escapeAttr(roll.id)}">${uiIcon("eye")}<span>Ver</span></button>
        ${statusAdvanceButton(roll, true)}
      </td>
    </tr>
  `).join("");

  return `
    <section class="toolbar">
      ${filterInput("rollsSearch", "Pesquisar", "ID, câmara, filme, local, pasta")}
      ${filterSelect("rollsStatus", "Estado", ["", ...unique(app.state.rolls.map((roll) => roll.status))])}
      ${filterSelect("rollsCamera", "Câmara", ["", ...unique(app.state.rolls.map((roll) => roll.camera)).sort(localeSort)])}
      ${filterSelect("rollsFormat", "Formato", ["", ...unique(app.state.rolls.map((roll) => roll.format)).sort(localeSort)])}
      ${filterSelect("rollsType", "Tipo", ["", ...unique(app.state.rolls.map((roll) => roll.type)).sort(localeSort)])}
      <div class="toolbar-actions">
        <button class="button ${app.filters.rollsStatus === "__open" ? "primary" : "secondary"}" type="button" data-action="show-open-rolls">Em andamento</button>
        <button class="button secondary" type="button" data-action="clear-roll-filters">Limpar</button>
        <button class="button primary" type="button" data-action="new-roll">Novo rolo</button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div class="panel-title">
          <h3>${formatRollCount(rolls.length)}</h3>
          <span class="panel-subtitle">${app.filters.rollsStatus === "__open" ? "A mostrar rolos ainda não arquivados" : "Dados guardados automaticamente no dispositivo"}</span>
        </div>
      </div>
      ${rows ? `
        <div class="list-table">
          <table class="rolls-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Estado</th>
                <th>Data</th>
                <th>Câmara</th>
                <th>Filme</th>
                <th>ISO</th>
                <th>Formato</th>
                <th>Local</th>
                <th>Fotos</th>
                <th class="table-actions">Ação</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${rolls.length > visibleRolls.length ? `
          <div class="pagination-footer">
            <span>${formatShownCount(visibleRolls.length, rolls.length)}</span>
            <button class="button secondary" type="button" data-action="show-more-rolls">${uiIcon("chevrons-down")}<span>Mostrar mais</span></button>
          </div>
        ` : ""}
      ` : emptyState("Nenhum rolo encontrado.")}
    </section>
  `;
}

function renderStock() {
  const stock = getFilteredStock();
  const rows = stock.map((item) => `
    <tr>
      <td>${escapeHtml(item.format)}</td>
      <td>${escapeHtml(item.brand)}</td>
      <td>${escapeHtml(item.model)}</td>
      <td>${escapeHtml(item.iso)}</td>
      <td>${escapeHtml(item.type)}</td>
      <td>${formatNumber(item.quantity)}</td>
      <td>${stockPill(item.condition)}</td>
      <td>${formatDate(item.expiryDate)}</td>
      <td>${escapeHtml(item.note)}</td>
      <td class="table-action"><button class="button secondary compact-button" type="button" data-action="edit-stock" data-id="${escapeAttr(item.id)}">${uiIcon("pencil")}<span>Editar</span></button></td>
    </tr>
  `).join("");

  return `
    <section class="toolbar compact">
      ${filterInput("stockSearch", "Pesquisar", "Marca, modelo, nota")}
      ${filterSelect("stockFormat", "Formato", ["", ...unique(app.state.stock.map((item) => item.format)).sort(localeSort)])}
      ${filterSelect("stockType", "Tipo", ["", ...unique(app.state.stock.map((item) => item.type)).sort(localeSort)])}
      <div class="toolbar-actions">
        <button class="button primary" type="button" data-action="new-stock">Novo stock</button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div class="panel-title">
          <h3>${formatInStockCount(sum(stock.map((item) => item.quantity)))}</h3>
          <span class="panel-subtitle">${formatNumber(stock.length)} linhas</span>
        </div>
      </div>
      ${rows ? `
        <div class="list-table">
          <table class="stock-table">
            <thead>
              <tr>
                <th>Formato</th>
                <th>Marca</th>
                <th>Modelo</th>
                <th>ISO</th>
                <th>Tipo</th>
                <th>Qtd</th>
                <th>Estado</th>
                <th>Validade</th>
                <th>Nota</th>
                <th class="table-action">Ação</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      ` : emptyState("Nenhum stock encontrado.")}
    </section>
  `;
}

function renderEquipment() {
  const equipment = getFilteredEquipment();
  const rows = equipment.map((item) => `
    <tr>
      <td>${escapeHtml(item.kind)}</td>
      <td>${escapeHtml(item.brand)}</td>
      <td>${escapeHtml(item.model)}</td>
      <td>${escapeHtml(item.system)}</td>
      <td>${formatDate(item.purchaseDate)}</td>
      <td>${formatCurrency(item.purchaseValue)}</td>
      <td>${stockPill(item.status)}</td>
      <td>${formatDate(item.lastServiceDate)}</td>
      <td class="table-action"><button class="button secondary compact-button" type="button" data-action="edit-equipment" data-id="${escapeAttr(item.id)}">${uiIcon("pencil")}<span>Editar</span></button></td>
    </tr>
  `).join("");

  return `
    <section class="toolbar compact">
      ${filterInput("equipmentSearch", "Pesquisar", "Marca, modelo, sistema, notas")}
      ${filterSelect("equipmentKind", "Tipo", ["", ...unique(app.state.equipment.map((item) => item.kind)).sort(localeSort)])}
      ${filterSelect("equipmentStatus", "Estado", ["", ...unique(app.state.equipment.map((item) => item.status)).sort(localeSort)])}
      <div class="toolbar-actions">
        <button class="button primary" type="button" data-action="new-equipment">Novo item</button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div class="panel-title">
          <h3>${formatItemCount(equipment.length)}</h3>
          <span class="panel-subtitle">Valor registado: ${formatCurrency(sum(equipment.map((item) => item.purchaseValue)))}</span>
        </div>
      </div>
      ${rows ? `
        <div class="list-table">
          <table class="equipment-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Marca</th>
                <th>Modelo</th>
                <th>Sistema</th>
                <th>Compra</th>
                <th>Valor</th>
                <th>Estado</th>
                <th>Revisão</th>
                <th class="table-action">Ação</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      ` : emptyState("Nenhum equipamento encontrado.")}
    </section>
  `;
}

function renderArchive() {
  const stats = getStats();
  const automaticBackup = Boolean(app.state.meta.autoCloudBackup);
  const lastCloudBackup = formatDateTime(app.state.meta.lastCloudBackupAt);
  const automaticBackupDetail = automaticBackup
    ? (lastCloudBackup ? `Última sincronização: ${escapeHtml(lastCloudBackup)}` : "Verifica e guarda cada alteração automaticamente")
    : "Pausada neste dispositivo";
  return `
    <div class="backup-grid">
      <section class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <h3>Cópia local</h3>
            <span class="panel-subtitle">Última gravação: ${formatDateTime(app.state.meta.updatedAt)}</span>
          </div>
        </div>
        <div class="backup-actions">
          <button class="button primary" type="button" data-action="export-json">Exportar JSON</button>
          <button class="button secondary" type="button" data-action="export-excel">${uiIcon("sheet")}<span>Exportar Excel</span></button>
          <button class="button secondary" type="button" data-action="export-rolls-csv">Exportar rolos CSV</button>
          <button class="button secondary" type="button" data-action="export-stock-csv">Exportar stock CSV</button>
          <button class="button secondary" type="button" data-action="export-equipment-csv">Exportar equipamento CSV</button>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <h3>Importar backup</h3>
            <span class="panel-subtitle">Substitui os dados atuais pelo ficheiro escolhido</span>
          </div>
        </div>
        <input class="file-input" type="file" accept="application/json,.json" data-action="import-json-file">
      </section>

      <section class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <h3>Importar Excel</h3>
            <span class="panel-subtitle">Lê as folhas Registos Rolos, Stock e Equipamento</span>
          </div>
        </div>
        <div class="import-box">
          <input class="file-input" type="file" accept=".xlsx,.xls" data-action="import-excel-file">
          <p class="helper-text">Antes de importar, exporta um JSON. A importação do Excel substitui os dados atuais.</p>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <h3>Resumo</h3>
          </div>
        </div>
        <div class="archive-summary">
          ${archiveSummaryRow("Rolos", stats.totalRolls)}
          ${archiveSummaryRow("Stock", stats.stockTotal)}
          ${archiveSummaryRow("Equipamento", stats.equipmentCount)}
          ${archiveSummaryRow("Valor do equipamento", formatCurrency(stats.equipmentValue))}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <h3>Firebase</h3>
            <span class="panel-subtitle">A mesma versão no telefone e no computador</span>
          </div>
        </div>
        <div class="sync-box">
          <button class="auto-backup-toggle ${automaticBackup ? "active" : ""}" type="button" data-action="toggle-auto-backup" aria-pressed="${automaticBackup}">
            <span class="auto-backup-icon">${uiIcon(automaticBackup ? "cloud-check" : "cloud")}</span>
            <span>
              <strong>Sincronização automática</strong>
              <small>${automaticBackupDetail}</small>
            </span>
            <span class="switch-control" aria-hidden="true"><span></span></span>
          </button>
          <div class="sync-status" id="cloud-status">${escapeHtml(app.cloud.status)}</div>
          <div class="backup-actions">
            <button class="button secondary" type="button" data-action="cloud-connect">Ligar</button>
            <button class="button secondary" type="button" data-action="cloud-signin">Entrar</button>
            <button class="button primary" type="button" data-action="cloud-push">Sincronizar agora</button>
            <button class="button secondary" type="button" data-action="cloud-pull">Verificar versão online</button>
            <button class="button secondary" type="button" data-action="cloud-signout">Sair</button>
          </div>
        </div>
      </section>

      ${renderDriveBackupPanel()}

      ${renderCloudHistoryPanel()}

      <section class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <h3>Repor dados iniciais</h3>
            <span class="panel-subtitle">Volta à importação original do Excel</span>
          </div>
        </div>
        <button class="button danger ghost" type="button" data-action="reset-seed">Repor importação</button>
      </section>
    </div>
  `;
}

function archiveSummaryRow(label, value) {
  return `
    <div class="archive-summary-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderDriveBackupPanel() {
  const status = app.cloud.driveStatus || {};
  const lastBackupAt = text(status.lastBackupAt);
  const due = isDriveBackupDue(lastBackupAt);
  const error = text(app.cloud.driveBackupError);
  const inProgress = app.cloud.driveBackupInProgress;
  const nextBackup = nextDriveBackupAt(lastBackupAt);
  const stateClass = error ? "error" : due ? "due" : "";
  const title = error
    ? "A cópia não foi concluída"
    : inProgress
      ? "A guardar a cópia semanal…"
      : due
        ? "Cópia semanal por criar"
        : "Cópia externa em dia";
  const detail = error
    || (lastBackupAt
      ? `Última cópia: ${formatDateTime(lastBackupAt)}${nextBackup ? ` · Próxima a partir de ${formatDate(nextBackup.slice(0, 10))}` : ""}`
      : "Ainda não foi criada nenhuma cópia no Google Drive.");
  const folderLink = safeExternalUrl(status.folderUrl)
    ? `<a href="${escapeAttr(status.folderUrl)}" target="_blank" rel="noopener">Abrir pasta no Drive</a>`
    : "";
  return `
    <section class="panel drive-backup-panel">
      <div class="panel-header">
        <div class="panel-title">
          <h3>Google Drive</h3>
          <span class="panel-subtitle">Cópia externa semanal, confirmada por si antes do envio</span>
        </div>
      </div>
      <div class="drive-backup-layout">
        <div class="drive-backup-state ${stateClass}">
          <span>${uiIcon(error ? "triangle-alert" : due ? "cloud-upload" : "cloud-check")}</span>
          <span class="drive-backup-copy">
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(detail)}</span>
            <small>A aplicação só pode gerir as cópias que ela própria criar. ${folderLink}</small>
          </span>
        </div>
        <button class="button ${due || error ? "primary" : "secondary"}" type="button" data-action="drive-backup-now" ${inProgress ? "disabled" : ""}>
          ${uiIcon(inProgress ? "loader-circle" : "hard-drive-upload")}
          <span>${inProgress ? "A guardar…" : "Criar backup no Drive"}</span>
        </button>
      </div>
    </section>
  `;
}

function renderCloudHistoryPanel() {
  const weeklyCount = app.cloud.history.filter((item) => item.kind === "weekly").length;
  const recoveryCount = app.cloud.history.filter((item) => item.kind === "recovery").length;
  let content = "";

  if (!app.cloud.user) {
    content = '<div class="empty-state compact">Entra com a conta autorizada para consultar o historial.</div>';
  } else if (app.cloud.historyLoading) {
    content = '<div class="empty-state compact">A carregar o historial seguro…</div>';
  } else if (app.cloud.historyError) {
    content = `<div class="empty-state compact">${escapeHtml(app.cloud.historyError)}</div>`;
  } else if (!app.cloud.history.length) {
    content = '<div class="empty-state compact">A primeira cópia semanal será criada na próxima sincronização.</div>';
  } else {
    content = `
      <div class="backup-history-list">
        ${app.cloud.history.map((item) => `
          <article class="backup-history-item ${item.kind === "recovery" ? "recovery" : ""}">
            <div class="backup-history-mark">${uiIcon(item.kind === "weekly" ? "calendar-check" : "shield-check")}</div>
            <div class="backup-history-copy">
              <strong>${escapeHtml(item.kind === "weekly" ? formatIsoWeekKey(item.weekKey) : "Cópia de recuperação")}</strong>
              <span>${escapeHtml(formatDateTime(item.updatedAtLocal))} · ${formatRollCount(item.rollCount)}</span>
            </div>
            <button class="button secondary compact-button" type="button" data-action="restore-cloud-version" data-id="${escapeAttr(item.id)}">Repor</button>
          </article>
        `).join("")}
      </div>
    `;
  }

  return `
    <section class="panel backup-history-panel">
      <div class="panel-header">
        <div class="panel-title">
          <h3>Historial automático</h3>
          <span class="panel-subtitle">${formatHistoryCount(weeklyCount, WEEKLY_BACKUP_LIMIT, recoveryCount)}</span>
        </div>
        <button class="icon-button" type="button" data-action="refresh-cloud-history" title="Atualizar historial" aria-label="Atualizar historial">${uiIcon("refresh-cw")}</button>
      </div>
      ${content}
    </section>
  `;
}

function metric(label, value, note) {
  return `
    <div class="metric-card">
      <span class="metric-label">${escapeHtml(label)}</span>
      <strong class="metric-value">${escapeHtml(value)}</strong>
      <span class="metric-note">${escapeHtml(note)}</span>
    </div>
  `;
}

function patternInsights(stats) {
  const topCamera = topEntry(stats.byCamera);
  const topFilm = topEntry(stats.byFilmBrand);
  const topMonth = topEntry(stats.byMonth);
  const topLocation = topEntry(stats.byLocation);
  const cards = [
    topMonth ? patternCard("M\u00eas mais forte", formatChartLabel(topMonth[0]), formatRollCount(topMonth[1]), dashboardFilterFor("month", topMonth[0])) : "",
    topLocation ? patternCard("Local mais repetido", topLocation[0], formatRollCount(topLocation[1]), `location:${topLocation[0]}`) : "",
    topCamera ? patternCard("C\u00e2mara dominante", topCamera[0], formatRollCount(topCamera[1]), dashboardFilterFor("camera", topCamera[0])) : "",
    topFilm ? patternCard("Filme recorrente", topFilm[0], formatRollCount(topFilm[1]), dashboardFilterFor("brand", topFilm[0])) : "",
  ].filter(Boolean);

  return `
    <section class="panel pattern-panel">
      <div class="panel-header">
        <div class="panel-title">
          <h3>Padr\u00f5es detectados</h3>
          <span class="panel-subtitle">Leitura r\u00e1pida dos h\u00e1bitos mais fortes do arquivo</span>
        </div>
      </div>
      <div class="pattern-grid">${cards.join("")}</div>
    </section>
  `;
}

function patternCard(label, value, note, filter) {
  return `
    <button class="pattern-card" type="button" data-action="dashboard-filter" data-filter="${escapeAttr(filter)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <em>${escapeHtml(note)}</em>
    </button>
  `;
}

function rollTaskCard(roll) {
  const next = getNextStatus(roll.status);
  return `
    <article class="roll-task-card">
      <div>
        <span class="task-code">${escapeHtml(roll.id)}</span>
        <h4>${escapeHtml(roll.camera || "Sem câmara")}</h4>
        <p>${escapeHtml(filmName(roll) || "Sem filme")} · ${escapeHtml(formatDate(roll.date))}</p>
      </div>
      <div class="task-footer">
        ${statusPill(roll.status)}
        <div class="task-actions">
          <button class="button secondary compact-button" type="button" data-action="view-roll" data-id="${escapeAttr(roll.id)}">Ver</button>
          ${next ? statusAdvanceButton(roll, true) : ""}
        </div>
      </div>
    </article>
  `;
}

function openWorkflow(stats) {
  return defaultSupport.statuses
    .filter((status) => status !== "Arquivado")
    .map((status) => {
      const count = stats.byStatus.get(status) || 0;
      return `
        <button class="workflow-item" type="button" data-action="dashboard-filter" data-filter="${escapeAttr(`status:${status}`)}">
          <strong>${escapeHtml(status)}</strong>
          <span>${formatRollCount(count)}</span>
        </button>
      `;
    }).join("");
}

function countStockBy(picker) {
  const map = new Map();
  app.state.stock.forEach((item) => {
    const key = picker(item);
    map.set(key, (map.get(key) || 0) + numberOrZero(item.quantity));
  });
  return map;
}

function insightCard(label, value, note, filter) {
  return `
    <button class="insight-card ${app.dashboardFilter === filter ? "active" : ""}" type="button" data-action="dashboard-filter" data-filter="${escapeAttr(filter)}">
      <span class="metric-label">${escapeHtml(label)}</span>
      <strong class="metric-value">${escapeHtml(value)}</strong>
      <span class="metric-note">${escapeHtml(note)}</span>
    </button>
  `;
}

function lineChart(map, options = {}) {
  const entries = [...map.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .slice(-(options.maxItems || 18));

  if (!entries.length) {
    return emptyState("Sem dados para mostrar.");
  }

  const width = 760;
  const height = 250;
  const paddingX = 34;
  const paddingY = 28;
  const max = Math.max(...entries.map(([, value]) => value), 1);
  const step = entries.length > 1 ? (width - paddingX * 2) / (entries.length - 1) : 0;
  const points = entries.map(([, value], index) => {
    const x = paddingX + index * step;
    const y = height - paddingY - (value / max) * (height - paddingY * 2);
    return { x, y, value };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${paddingX},${height - paddingY} ${polyline} ${width - paddingX},${height - paddingY}`;

  return `
    <div class="line-chart">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Rolos por mês">
        <polyline class="line-grid" points="${paddingX},${height - paddingY} ${width - paddingX},${height - paddingY}"></polyline>
        <polygon class="line-area" points="${area}"></polygon>
        <polyline class="line-stroke" points="${polyline}"></polyline>
        ${points.map((point, index) => `<circle class="line-point" cx="${point.x}" cy="${point.y}" r="5"><title>${escapeHtml(`${formatChartLabel(entries[index][0])}: ${formatRollCount(point.value)}`)}</title></circle>`).join("")}
      </svg>
      <div class="line-labels">
        ${entries.map(([label, value]) => `
          <button type="button" title="${escapeAttr(`${formatChartLabel(label)}: ${formatRollCount(value)}`)}" data-action="dashboard-filter" data-filter="${escapeAttr(dashboardFilterFor("month", label))}">
            <span>${escapeHtml(formatChartLabel(label))}</span>
            <strong>${formatNumber(value)}</strong>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function locationMap(map) {
  const entries = locationEntries(map);
  if (!entries.length) {
    return emptyState("Sem locais para mostrar.");
  }

  const points = locationPoints(entries);
  const missing = entries.filter(([label]) => !locationCoordsFor(label));
  const top = entries[0];

  return `
    <div class="location-layout">
      <div class="map-shell v2-map-shell">
        <div class="location-v2-summary">
          <div>
            <span>Locais no mapa</span>
            <strong>${formatNumber(points.length)}</strong>
          </div>
          <div>
            <span>Local mais usado</span>
            <strong>${escapeHtml(top[0])}</strong>
          </div>
          <div>
            <span>Por posicionar</span>
            <strong>${formatNumber(missing.length)}</strong>
          </div>
        </div>
        <div id="stats-location-map" class="leaflet-map" role="img" aria-label="Mapa interativo de locais fotografados">
          <div class="map-fallback">Mapa a carregar...</div>
        </div>
        <p class="map-note">
          <span>Os círculos maiores indicam mais rolos nesse local. Clica num ponto para ver detalhes e filtrar os rolos.</span>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">Posicionamento por OpenStreetMap.</a>
        </p>
      </div>
      <div class="location-list">
        ${entries.slice(0, 12).map(([label, value]) => `
          <button type="button" title="${escapeAttr(`${label}: ${formatRollCount(value)}`)}" data-action="dashboard-filter" data-filter="${escapeAttr(`location:${label}`)}">
            <span>${escapeHtml(label)}</span>
            <strong>${formatNumber(value)}</strong>
          </button>
        `).join("")}
        ${missing.length ? `
          <div class="location-missing">
            <span>Sem ponto no mapa</span>
            <p>${escapeHtml(missing.slice(0, 5).map(([label]) => label).join(", "))}${missing.length > 5 ? "..." : ""}</p>
          </div>
        ` : ""}
      </div>
    </div>
  `;
}

function locationEntries(map) {
  return [...map.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1] || localeSort(a[0], b[0]));
}

function locationPoints(entries) {
  return entries
    .map(([label, value]) => ({ label, value, coords: locationCoordsFor(label) }))
    .filter((item) => item.coords);
}

function openStreetMapUrl(label) {
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(label)}`;
}

function locationCoordsFor(label) {
  const saved = app.state?.locationCoordinates?.[locationCoordinateKey(label)];
  if (saved?.status === "resolved" && validCoordinates(saved.lat, saved.lon)) {
    return { lat: Number(saved.lat), lon: Number(saved.lon) };
  }
  if (LOCATION_COORDS[label]) return LOCATION_COORDS[label];
  const key = slugValue(label);
  const match = Object.entries(LOCATION_COORDS).find(([name]) => slugValue(name) === key);
  return match ? match[1] : null;
}

function normalizeLocationCoordinates(raw = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const entries = Object.entries(raw).flatMap(([rawKey, value]) => {
    if (!value || typeof value !== "object") return [];
    const label = text(value.label || rawKey);
    const key = locationCoordinateKey(label || rawKey);
    if (!key) return [];
    const lat = Number(value.lat);
    const lon = Number(value.lon);
    const status = value.status === "resolved" && validCoordinates(lat, lon) ? "resolved" : "not-found";
    return [[key, {
      label,
      status,
      lat: status === "resolved" ? lat : null,
      lon: status === "resolved" ? lon : null,
      displayName: text(value.displayName),
      source: text(value.source),
      attemptedAt: text(value.attemptedAt),
      resolvedAt: text(value.resolvedAt),
    }]];
  });
  return Object.fromEntries(entries);
}

function locationCoordinateKey(label) {
  return slugValue(normalizeLocationName(label));
}

function validCoordinates(lat, lon) {
  return Number.isFinite(Number(lat))
    && Number.isFinite(Number(lon))
    && Math.abs(Number(lat)) <= 90
    && Math.abs(Number(lon)) <= 180;
}

function shouldGeocodeLocation(label) {
  if (!label || locationCoordsFor(label) || app.geocodingPending.has(locationCoordinateKey(label))) return false;
  const cached = app.state.locationCoordinates?.[locationCoordinateKey(label)];
  if (!cached?.attemptedAt) return true;
  const attemptedAt = Date.parse(cached.attemptedAt);
  return !Number.isFinite(attemptedAt) || Date.now() - attemptedAt >= GEOCODING_RETRY_MS;
}

async function geocodeRollLocations(roll) {
  if (!roll || window.ROLOS_APP_CONFIG?.geocoding?.enabled === false) return;
  const labels = splitLocations(roll.shotLocation).filter(shouldGeocodeLocation);
  if (!labels.length) return;

  let resolved = 0;
  let notFound = 0;
  let changed = false;
  for (const label of labels) {
    const key = locationCoordinateKey(label);
    app.geocodingPending.add(key);
    try {
      const result = await geocodingClient.search(label, {
        language: document.documentElement.lang.startsWith("en") ? "en" : "pt",
      });
      const attemptedAt = new Date().toISOString();
      if (result) {
        app.state.locationCoordinates[key] = {
          label,
          status: "resolved",
          lat: result.lat,
          lon: result.lon,
          displayName: result.displayName,
          source: result.source,
          attemptedAt,
          resolvedAt: attemptedAt,
        };
        resolved += 1;
      } else {
        app.state.locationCoordinates[key] = {
          label,
          status: "not-found",
          lat: null,
          lon: null,
          displayName: "",
          source: "nominatim-openstreetmap",
          attemptedAt,
          resolvedAt: "",
        };
        notFound += 1;
      }
      changed = true;
    } catch (error) {
      console.warn(`Não foi possível posicionar ${label}.`, error);
    } finally {
      app.geocodingPending.delete(key);
    }
  }

  if (!changed) return;
  app.state = normalizeState(app.state);
  persistState();
  render();
  if (resolved === 1 && !notFound) showToast(`${labels[0]} foi adicionado ao mapa.`);
  else if (resolved > 0) showToast(`${resolved} locais foram adicionados ao mapa.`);
  else if (notFound > 0) showToast("O local ficou guardado, mas não foi possível posicioná-lo no mapa.");
}

function initLocationMap() {
  const mapEl = typeof document.getElementById === "function"
    ? document.getElementById("stats-location-map")
    : null;
  if (!mapEl) return;

  destroyLocationMap();

  const entries = locationEntries(getStats(getStatsRolls()).byLocation);
  const points = locationPoints(entries);
  if (!points.length) {
    mapEl.innerHTML = '<div class="map-fallback">Ainda não há locais com coordenadas para mostrar no mapa.</div>';
    return;
  }

  if (!window.L) {
    mapEl.innerHTML = '<div class="map-fallback">Mapa real disponível quando houver ligação à internet. A lista de locais continua a funcionar.</div>';
    return;
  }

  try {
    const max = Math.max(...points.map((point) => point.value), 1);
    const map = window.L.map(mapEl, {
      scrollWheelZoom: false,
      worldCopyJump: true,
    });

    window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const markers = points.map((point) => {
      const marker = window.L.circleMarker([point.coords.lat, point.coords.lon], {
        radius: locationMarkerRadius(point.value, max),
        color: "#ffffff",
        weight: 2,
        fillColor: "#c1121f",
        fillOpacity: Math.min(0.88, 0.42 + point.value / max * 0.46),
      }).addTo(map);

      marker.bindTooltip(`${point.label}: ${formatRollCount(point.value)}`);
      marker.bindPopup(locationPopup(point));
      return marker;
    });

    const group = window.L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.28), { maxZoom: 7 });
    app.leafletMap = map;
    window.setTimeout(() => map.invalidateSize(), 0);
  } catch (error) {
    console.error(error);
    mapEl.innerHTML = '<div class="map-fallback">Não foi possível carregar o mapa agora. A lista de locais continua disponível.</div>';
  }
}

function destroyLocationMap() {
  if (!app.leafletMap) return;
  app.leafletMap.remove();
  app.leafletMap = null;
}

function locationMarkerRadius(value, max) {
  return Math.min(28, 8 + Math.sqrt(value / max) * 20);
}

function locationPopup(point) {
  return `
    <div class="map-popup">
      <strong>${escapeHtml(point.label)}</strong>
      <span>${formatRollCount(point.value)}</span>
      <button class="button primary compact-button" type="button" data-action="dashboard-filter" data-filter="${escapeAttr(`location:${point.label}`)}">Ver rolos</button>
      <a href="${escapeAttr(openStreetMapUrl(point.label))}" target="_blank" rel="noopener">Abrir no OpenStreetMap</a>
    </div>
  `;
}

function donutChart(map, options = {}) {
  const entries = [...map.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1] || localeSort(a[0], b[0]));

  if (!entries.length) {
    return emptyState("Sem dados para mostrar.");
  }

  const colors = options.alt
    ? ["#1f1f1f", "#c1121f", "#8f8f89", "#b28b4b"]
    : ["#c1121f", "#1f1f1f", "#8f8f89", "#b28b4b"];
  const total = sum(entries.map(([, value]) => value));
  let cursor = 0;
  const segments = entries.map(([, value], index) => {
    const start = cursor;
    const end = cursor + (value / total) * 100;
    cursor = end;
    return `${colors[index % colors.length]} ${start}% ${end}%`;
  }).join(", ");

  return `
    <div class="donut-card">
      <div class="donut-ring" style="background: conic-gradient(${segments});">
        <span>${formatNumber(total)}</span>
      </div>
      <div class="donut-legend">
        ${entries.map(([label, value], index) => `
          <button class="legend-item" type="button" title="${escapeAttr(`${formatChartLabel(label)}: ${formatRollCount(value)}`)}" data-action="dashboard-filter" data-filter="${escapeAttr(dashboardFilterFor(options.filterType, label))}">
            <span style="background:${colors[index % colors.length]}"></span>
            <strong>${escapeHtml(formatChartLabel(label))}</strong>
            <em>${formatNumber(value)}</em>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function barChart(map, options = {}) {
  let entries = [...map.entries()].filter(([, value]) => value > 0);
  if (options.sort === "recent") {
    entries = entries.sort((a, b) => String(b[0]).localeCompare(String(a[0]))).slice(0, options.maxItems || 10).reverse();
  } else {
    entries = entries.sort((a, b) => b[1] - a[1] || localeSort(a[0], b[0])).slice(0, options.maxItems || 10);
  }

  if (!entries.length) {
    return emptyState("Sem dados para mostrar.");
  }

  const max = Math.max(...entries.map(([, value]) => value), 1);
  return `
    <div class="chart-list">
      ${entries.map(([label, value]) => {
        const filter = dashboardFilterFor(options.filterType, label);
        const tag = options.filterType ? "button" : "div";
        const action = options.filterType ? `type="button" data-action="dashboard-filter" data-filter="${escapeAttr(filter)}"` : "";
        return `
        <${tag} class="chart-row ${options.filterType ? "chart-button" : ""}" ${action}>
          <span class="chart-label" title="${escapeAttr(`${formatChartLabel(label)}: ${formatRollCount(value)}`)}">${escapeHtml(formatChartLabel(label))}</span>
          <span class="chart-track">
            <span class="chart-fill ${options.alt ? "alt" : ""}" style="width:${Math.max((value / max) * 100, 2)}%"></span>
          </span>
          <span class="chart-value">${formatNumber(value)}</span>
        </${tag}>
      `}).join("")}
    </div>
  `;
}

function filterInput(name, label, placeholder) {
  return `
    <div class="field">
      <label for="${name}">${escapeHtml(label)}</label>
      <input id="${name}" type="search" value="${escapeAttr(app.filters[name])}" placeholder="${escapeAttr(placeholder)}" data-filter="${name}">
    </div>
  `;
}

function filterSelect(name, label, values) {
  return `
    <div class="field">
      <label for="${name}">${escapeHtml(label)}</label>
      <select id="${name}" data-filter="${name}">
        ${values.map((value) => `
          <option value="${escapeAttr(value)}" ${String(app.filters[name]) === String(value) ? "selected" : ""}>
            ${value ? escapeHtml(value) : "Todos"}
          </option>
        `).join("")}
      </select>
    </div>
  `;
}

function filterSelectOptions(name, label, options) {
  return `
    <div class="field">
      <label for="${name}">${escapeHtml(label)}</label>
      <select id="${name}" data-filter="${name}">
        ${options.map(([value, optionLabel]) => `
          <option value="${escapeAttr(value)}" ${String(app.filters[name]) === String(value) ? "selected" : ""}>${escapeHtml(optionLabel)}</option>
        `).join("")}
      </select>
    </div>
  `;
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function handleFilterInput(event) {
  const field = event.target.closest("[data-filter]");
  if (!field) return;
  const isSearch = field.matches('input[type="search"]');
  if (isSearch && event.type === "change") return;
  if (!isSearch && event.type === "input") return;

  const caret = isSearch ? field.selectionStart : null;
  const filterName = field.dataset.filter;
  app.filters[field.dataset.filter] = field.value;
  if (field.dataset.filter.startsWith("rolls")) app.rollLimit = 50;
  if (field.dataset.filter.endsWith("Sort")) persistUiPreferences();
  render();

  if (isSearch) {
    const replacement = root.querySelector(`[data-filter="${filterName}"]`);
    replacement?.focus({ preventScroll: true });
    if (caret !== null && replacement?.setSelectionRange) {
      replacement.setSelectionRange(caret, caret);
    }
  }
}

async function handleAction(event) {
  const button = event.target.closest("[data-action], [data-view]");
  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id;

  if (!action && button.dataset.view) {
    app.activeView = button.dataset.view;
    render();
    return;
  }

  if (action === "toggle-language") toggleLanguage();
  if (action === "new-roll") openEditor("roll");
  if (action === "set-view-mode") {
    const collection = button.dataset.collection;
    const mode = button.dataset.mode;
    if (["rolls", "stock", "equipment"].includes(collection) && ["catalog", "list"].includes(mode)) {
      app.viewModes[collection] = mode;
      persistUiPreferences();
      render();
    }
  }
  if (action === "go-view") {
    app.activeView = button.dataset.view || "dashboard";
    render();
  }
  if (action === "view-roll") openDetails(id);
  if (action === "edit-roll") openEditor("roll", id);
  if (action === "advance-status") advanceRollStatus(id);
  if (action === "show-open-rolls") {
    app.filters.rollsStatus = "__open";
    app.rollLimit = 50;
    app.activeView = "rolls";
    render();
  }
  if (action === "show-more-rolls") {
    app.rollLimit += 50;
    render();
  }
  if (action === "clear-roll-filters") {
    app.filters.rollsSearch = "";
    app.filters.rollsStatus = "";
    app.filters.rollsCamera = "";
    app.filters.rollsFormat = "";
    app.filters.rollsType = "";
    app.rollLimit = 50;
    render();
  }
  if (action === "clear-stats-filters") {
    ["statsCamera", "statsFilm", "statsFormat", "statsType", "statsLocation", "statsStatus", "statsYear"]
      .forEach((name) => { app.filters[name] = ""; });
    render();
  }
  if (action === "clear-packaging-filters") {
    app.filters.packagingSearch = "";
    app.filters.packagingFormat = "";
    app.filters.packagingType = "";
    app.filters.packagingAvailability = "";
    render();
  }
  if (action === "dashboard-filter") {
    applyRollFilterShortcut(button.dataset.filter || "all");
    render();
  }
  if (action === "new-stock") openEditor("stock");
  if (action === "edit-stock") openEditor("stock", id);
  if (action === "new-equipment") openEditor("equipment");
  if (action === "edit-equipment") openEditor("equipment", id);
  if (action === "close-dialog") closeEditor();
  if (action === "close-detail") closeDetails();
  if (action === "detail-edit") editDetailRoll();
  if (action === "detail-advance-status") advanceDetailStatus();
  if (action === "delete-item") deleteEditorItem();
  if (action === "export-json") exportJson();
  if (action === "export-rolls-csv") exportCsv("rolos", app.state.rolls, rollCsvColumns());
  if (action === "export-stock-csv") exportCsv("stock", app.state.stock, stockCsvColumns());
  if (action === "export-equipment-csv") exportCsv("equipamento", app.state.equipment, equipmentCsvColumns());
  if (action === "export-excel") await exportExcelWorkbook();
  if (action === "reset-seed") await resetSeed();
  if (action === "cloud-connect") await connectCloud();
  if (action === "cloud-signin") await signInCloud();
  if (action === "cloud-signout") await signOutCloud();
  if (action === "cloud-push") await pushCloudBackup();
  if (action === "cloud-pull") await pullCloudBackup();
  if (action === "drive-backup-now") await createDriveBackup();
  if (action === "toggle-auto-backup") toggleAutomaticCloudBackup();
  if (action === "refresh-cloud-history") await loadCloudHistory({ force: true });
  if (action === "restore-cloud-version") await restoreCloudVersion(id);
  if (action === "remove-film-image") removeFilmImage(button.dataset.filmKey);
}

root.addEventListener("change", async (event) => {
  const input = event.target.closest('[data-action="import-json-file"]');
  if (!input || !input.files?.length) return;
  await importJson(input.files[0]);
  input.value = "";
});

root.addEventListener("change", async (event) => {
  const input = event.target.closest('[data-action="import-excel-file"]');
  if (!input || !input.files?.length) return;
  await importExcel(input.files[0]);
  input.value = "";
});

root.addEventListener("change", async (event) => {
  const input = event.target.closest('[data-action="upload-film-image"]');
  if (!input || !input.files?.length) return;
  await saveFilmImage(input.dataset.filmKey, input.files[0]);
  input.value = "";
});

async function saveFilmImage(key, file) {
  if (!key || !file) return;
  try {
    const dataUrl = await createFilmThumbnail(file);
    const nextImage = {
      dataUrl,
      fileName: file.name,
      updatedAt: new Date().toISOString(),
    };
    const nextImages = { ...app.state.filmImages, [key]: nextImage };
    const projectedSize = JSON.stringify({ ...app.state, filmImages: nextImages }).length;
    if (projectedSize > 4_200_000) {
      showToast("O espaço local está quase cheio. Exporta um JSON antes de adicionares mais fotografias.");
      return;
    }
    app.state.filmImages = nextImages;
    persistState();
    render();
    showToast("Fotografia da embalagem guardada.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível preparar esta fotografia.");
  }
}

function removeFilmImage(key) {
  if (!key || !app.state.filmImages[key]) return;
  if (!confirm(uiText("Remover esta fotografia pessoal? A imagem incluída volta a aparecer quando estiver disponível."))) return;
  const nextImages = { ...app.state.filmImages };
  delete nextImages[key];
  app.state.filmImages = nextImages;
  persistState();
  render();
  showToast("Fotografia removida.");
}

async function createFilmThumbnail(file) {
  if (!/^image\/(?:jpeg|png|webp)$/i.test(file.type)) {
    throw new Error("Escolhe uma fotografia JPG, PNG ou WebP.");
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("A fotografia é demasiado grande. Escolhe uma imagem até 15 MB.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Não foi possível ler esta fotografia."));
      element.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 320;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Este dispositivo não conseguiu preparar a fotografia.");

    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const targetRatio = canvas.width / canvas.height;
    let sx = 0;
    let sy = 0;
    let sw = image.naturalWidth;
    let sh = image.naturalHeight;
    if (sourceRatio > targetRatio) {
      sw = image.naturalHeight * targetRatio;
      sx = (image.naturalWidth - sw) / 2;
    } else {
      sh = image.naturalWidth / targetRatio;
      sy = (image.naturalHeight - sh) / 2;
    }
    context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    let quality = 0.78;
    let dataUrl = canvas.toDataURL("image/webp", quality);
    if (!dataUrl.startsWith("data:image/webp")) dataUrl = canvas.toDataURL("image/jpeg", quality);
    while (dataUrl.length > 150_000 && quality > 0.42) {
      quality -= 0.08;
      dataUrl = canvas.toDataURL(dataUrl.startsWith("data:image/webp") ? "image/webp" : "image/jpeg", quality);
    }
    if (dataUrl.length > 190_000) throw new Error("Não foi possível comprimir esta fotografia o suficiente.");
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function openEditor(type, id = null) {
  const item = id ? findItem(type, id) : defaultItem(type);
  if (!item) {
    showToast("Não encontrei esse registo.");
    return;
  }

  app.editor = { type, id, item: structuredClone(item) };
  dialogTitle.textContent = id ? editorTitle(type, item) : newEditorTitle(type);
  dialogKicker.textContent = editorKicker(type);
  editorFields.innerHTML = renderEditorFields(type, app.editor.item);
  refreshComputedFields();
  document.querySelector('[data-action="delete-item"]').style.display = id ? "inline-flex" : "none";
  dialog.showModal();
  refreshIcons();
}

function closeEditor() {
  dialog.close();
  app.editor = null;
}

function openDetails(id) {
  const roll = findItem("roll", id);
  if (!roll) {
    showToast("Não encontrei esse rolo.");
    return;
  }

  app.detailId = id;
  renderDetails(roll);
  detailDialog.showModal();
}

function renderDetails(roll) {
  const next = getNextStatus(roll.status);
  detailTitle.textContent = `Rolo ${roll.id}`;
  detailKicker.textContent = `${roll.status || "Sem estado"} · ${formatDate(roll.date)}`;
  detailPrimaryAction.textContent = next ? `Avançar para ${next}` : "Arquivado";
  detailPrimaryAction.disabled = !next;

  detailContent.innerHTML = `
    <section class="detail-hero-panel">
      <div>
        <p class="kicker">${escapeHtml(buildFilmLabel(roll, { includePush: true }))}</p>
        <h3>${escapeHtml(roll.camera || "Sem câmara")}</h3>
        <span class="detail-subtitle">${escapeHtml(roll.shotLocation || "Sem local")} · ${escapeHtml(roll.folderName)}</span>
      </div>
      <div class="detail-status-block">
        ${statusPill(roll.status)}
        ${next ? `<button class="button primary" type="button" data-action="advance-status" data-id="${escapeAttr(roll.id)}">Avançar</button>` : `<span class="closed-label">Fechado</span>`}
      </div>
    </section>

    ${statusTimeline(roll.status)}

    <div class="detail-grid">
      ${detailField("Código", roll.negativeCode || roll.id)}
      ${detailField("Data", formatDate(roll.date))}
      ${detailField("Câmara", roll.camera)}
      ${detailField("Lente", roll.lens)}
      ${detailField("Filme", buildFilmLabel(roll, { includePush: true }))}
      ${detailField("ISO", roll.iso)}
      ${detailField("Formato", roll.format)}
      ${detailField("Tipo", roll.type)}
      ${detailField("Local disparado", roll.shotLocation, "wide")}
      ${detailField("Revelado em", roll.developedAt)}
      ${detailField("Digitalizado em", roll.scannedAt)}
      ${detailField("Revelador/método", roll.developerMethod)}
      ${detailField("Nome da pasta", roll.folderName, "full")}
      ${detailField("Arquivo físico", roll.archiveLocation, "wide")}
      ${detailField("Google Photos", photosDetailLink(roll), "wide", true)}
      ${detailField("Notas", roll.notes, "full")}
    </div>
  `;
  refreshIcons();
}

function closeDetails() {
  detailDialog.close();
  app.detailId = null;
}

function editDetailRoll() {
  const id = app.detailId;
  if (!id) return;
  closeDetails();
  openEditor("roll", id);
}

function advanceDetailStatus() {
  if (app.detailId) {
    advanceRollStatus(app.detailId);
  }
}

function saveEditor(event) {
  event.preventDefault();
  if (!app.editor) return;
  const editorType = app.editor.type;

  const fields = fieldsFor(app.editor.type);
  const values = {};
  fields.forEach((field) => {
    if (field.type === "computed") return;
    const input = editorForm.elements[field.name];
    if (!input) return;
    if (field.type === "checkbox") {
      values[field.name] = input.checked;
    } else if (field.type === "number") {
      values[field.name] = input.value === "" ? 0 : Number(input.value);
    } else {
      values[field.name] = input.value.trim();
    }
  });

  if (app.editor.type === "roll") {
    const photosInput = editorForm.elements.photosUrl;
    photosInput?.setCustomValidity("");
    if (values.photosUrl && !safeExternalUrl(values.photosUrl)) {
      photosInput?.setCustomValidity("Usa um link que comece por https:// ou http://");
      photosInput?.reportValidity();
      return;
    }
    if (values.photosUrl) values.photosUrl = safeExternalUrl(values.photosUrl);
  }

  if (app.editor.type === "roll" && !values.id) {
    values.id = nextRollId(values.date);
  }

  if (app.editor.type === "roll") {
    values.id = normalizeRollId(values.id);
    values.negativeCode = normalizeRollId(values.negativeCode || values.id);
    values.folderName = buildFolderName(values);
  }

  const collection = collectionFor(app.editor.type);
  if (app.editor.id) {
    const index = app.state[collection].findIndex((item) => item.id === app.editor.id);
    app.state[collection][index] = { ...app.state[collection][index], ...values };
  } else {
    app.state[collection].push({ ...values, id: values.id || createId(app.editor.type) });
  }

  app.state = normalizeState(app.state);
  persistState();
  closeEditor();
  render();
  showToast("Guardado.");
  if (editorType === "roll") {
    const savedRoll = app.state.rolls.find((roll) => roll.id === values.id);
    if (savedRoll) void geocodeRollLocations(savedRoll);
  }
}

function deleteEditorItem() {
  if (!app.editor?.id) return;
  const confirmed = confirm(uiText("Eliminar este registo?"));
  if (!confirmed) return;

  const collection = collectionFor(app.editor.type);
  app.state[collection] = app.state[collection].filter((item) => item.id !== app.editor.id);
  persistState();
  closeEditor();
  render();
  showToast("Registo eliminado.");
}

function renderEditorFields(type, item) {
  const fields = fieldsFor(type);
  const groups = editorFieldGroups(type);
  const renderedNames = new Set();
  const sections = groups.map((group) => {
    const sectionFields = fields.filter((field) => group.fields.includes(field.name));
    sectionFields.forEach((field) => renderedNames.add(field.name));
    if (!sectionFields.length) return "";
    return `
      <fieldset class="form-section">
        <legend>${escapeHtml(group.label)}</legend>
        <div class="form-section-grid">${sectionFields.map((field) => renderField(field, item)).join("")}</div>
      </fieldset>
    `;
  });
  const remaining = fields.filter((field) => !renderedNames.has(field.name));
  if (remaining.length) {
    sections.push(`<fieldset class="form-section"><legend>Outros dados</legend><div class="form-section-grid">${remaining.map((field) => renderField(field, item)).join("")}</div></fieldset>`);
  }
  return sections.join("");
}

function editorFieldGroups(type) {
  if (type === "roll") {
    return [
      { label: "Identificação", fields: ["id", "status", "date", "negativeCode"] },
      { label: "Captura", fields: ["camera", "lens", "filmBrand", "filmModel", "iso", "format", "type", "push", "shotLocation"] },
      { label: "Processamento", fields: ["developedAt", "scannedAt", "developerMethod"] },
      { label: "Arquivo", fields: ["folderName", "photosUrl", "archiveLocation", "favorite", "notes"] },
    ];
  }
  if (type === "stock") {
    return [
      { label: "Filme", fields: ["brand", "model", "format", "iso", "type"] },
      { label: "Inventário", fields: ["quantity", "condition", "expiryDate", "note"] },
    ];
  }
  return [
    { label: "Identificação", fields: ["kind", "brand", "model", "system", "status"] },
    { label: "Compra e manutenção", fields: ["purchaseDate", "purchaseValue", "lastServiceDate", "notes"] },
  ];
}

function renderField(field, item) {
  const value = item[field.name] ?? "";
  const label = `<label for="field-${field.name}">${escapeHtml(field.label)}</label>`;

  if (field.type === "textarea") {
    return `
      <div class="field full">
        ${label}
        <textarea id="field-${field.name}" name="${escapeAttr(field.name)}">${escapeHtml(value)}</textarea>
      </div>
    `;
  }

  if (field.type === "select") {
    const options = unique(["", ...(field.options || [])]);
    return `
      <div class="field ${field.wide ? "wide" : ""}">
        ${label}
        <select id="field-${field.name}" name="${escapeAttr(field.name)}">
          ${options.map((option) => `
            <option value="${escapeAttr(option)}" ${String(value) === String(option) ? "selected" : ""}>
              ${option ? escapeHtml(option) : "Escolher"}
            </option>
          `).join("")}
        </select>
      </div>
    `;
  }

  if (field.type === "combo") {
    const listId = `list-${field.name}`;
    const options = unique(field.options || []);
    return `
      <div class="field ${field.wide ? "wide" : ""}">
        ${label}
        <input id="field-${field.name}" name="${escapeAttr(field.name)}" list="${escapeAttr(listId)}" type="text" value="${escapeAttr(value)}">
        <datalist id="${escapeAttr(listId)}">
          ${options.map((option) => `<option value="${escapeAttr(option)}"></option>`).join("")}
        </datalist>
      </div>
    `;
  }

  if (field.type === "checkbox") {
    return `
      <label class="checkbox-field">
        <input type="checkbox" name="${escapeAttr(field.name)}" ${value ? "checked" : ""}>
        ${escapeHtml(field.label)}
      </label>
    `;
  }

  if (field.type === "computed") {
    return `
      <div class="field ${field.wide ? "wide" : ""}">
        ${label}
        <output class="computed-output" data-computed="${escapeAttr(field.name)}">${escapeHtml(value)}</output>
      </div>
    `;
  }

  return `
    <div class="field ${field.wide ? "wide" : ""}">
      ${label}
      <input id="field-${field.name}" name="${escapeAttr(field.name)}" type="${escapeAttr(field.type || "text")}" value="${escapeAttr(value)}" ${field.step ? `step="${escapeAttr(field.step)}"` : ""}>
    </div>
  `;
}

function fieldsFor(type) {
  const statusOptions = unique([...app.state.support.statuses, ...app.state.rolls.map((roll) => roll.status)]);
  const cameraOptions = unique(app.state.rolls.map((roll) => roll.camera)).sort(localeSort);
  const lensOptions = unique(app.state.rolls.map((roll) => roll.lens)).sort(localeSort);
  const brandOptions = unique([...app.state.support.filmBrands, ...app.state.rolls.map((roll) => roll.filmBrand), ...app.state.stock.map((item) => item.brand)]).sort(localeSort);
  const modelOptions = unique([...app.state.rolls.map((roll) => roll.filmModel), ...app.state.stock.map((item) => item.model)]).sort(localeSort);
  const labOptions = unique([...app.state.rolls.map((roll) => roll.developedAt), ...app.state.rolls.map((roll) => roll.scannedAt)]).sort(localeSort);

  if (type === "roll") {
    return [
      { name: "id", label: "ID rolo", type: "text" },
      { name: "status", label: "Estado", type: "select", options: statusOptions },
      { name: "date", label: "Data", type: "date" },
      { name: "negativeCode", label: "Código negativo", type: "text" },
      { name: "camera", label: "Câmara", type: "combo", options: cameraOptions },
      { name: "lens", label: "Lente", type: "combo", options: lensOptions },
      { name: "filmBrand", label: "Marca do rolo", type: "combo", options: brandOptions },
      { name: "filmModel", label: "Modelo", type: "combo", options: modelOptions },
      { name: "iso", label: "ISO", type: "number" },
      { name: "format", label: "Formato", type: "select", options: ["135", "120"] },
      { name: "type", label: "Tipo", type: "select", options: ["B&W", "Cor"] },
      { name: "push", label: "Push", type: "number" },
      { name: "shotLocation", label: "Local disparado", type: "text", wide: true },
      { name: "developedAt", label: "Local revelado", type: "combo", options: labOptions },
      { name: "scannedAt", label: "Local digitalizado", type: "combo", options: labOptions },
      { name: "developerMethod", label: "Revelador/método", type: "text", wide: true },
      { name: "folderName", label: "Nome da pasta", type: "computed", wide: true },
      { name: "photosUrl", label: "Link Google Photos", type: "url", wide: true },
      { name: "archiveLocation", label: "Local de arquivo", type: "text", wide: true },
      { name: "favorite", label: "Favorito", type: "checkbox" },
      { name: "notes", label: "Notas", type: "textarea" },
    ];
  }

  if (type === "stock") {
    return [
      { name: "brand", label: "Marca", type: "combo", options: brandOptions },
      { name: "model", label: "Modelo", type: "combo", options: modelOptions },
      { name: "format", label: "Formato", type: "select", options: ["135", "120"] },
      { name: "iso", label: "ISO", type: "number" },
      { name: "type", label: "Tipo", type: "select", options: ["B&W", "Cor"] },
      { name: "quantity", label: "Quantidade", type: "number" },
      { name: "condition", label: "Estado", type: "select", options: ["Novo", "Expirado"] },
      { name: "expiryDate", label: "Validade", type: "date" },
      { name: "note", label: "Nota", type: "textarea" },
    ];
  }

  return [
    { name: "kind", label: "Tipo", type: "select", options: app.state.support.equipmentKinds },
    { name: "brand", label: "Marca", type: "text" },
    { name: "model", label: "Modelo", type: "text" },
    { name: "system", label: "Sistema", type: "text" },
    { name: "purchaseDate", label: "Data aquisição", type: "date" },
    { name: "purchaseValue", label: "Valor aquisição", type: "number", step: "0.01" },
    { name: "status", label: "Estado", type: "select", options: app.state.support.equipmentStatuses },
    { name: "lastServiceDate", label: "Última revisão", type: "date" },
    { name: "notes", label: "Notas", type: "textarea" },
  ];
}

function defaultItem(type) {
  if (type === "roll") {
    const today = new Date().toISOString().slice(0, 10);
    return {
      id: nextRollId(today),
      status: "Em Uso",
      date: today,
      negativeCode: "",
      shotLocation: "",
      camera: "",
      lens: "",
      filmBrand: "",
      filmModel: "",
      iso: "",
      format: "135",
      type: "B&W",
      push: 0,
      developedAt: "",
      scannedAt: "",
      developerMethod: "",
      photosUrl: "",
      notes: "",
      folderName: "",
      archiveLocation: "",
      favorite: false,
    };
  }

  if (type === "stock") {
    return {
      id: createId("stock"),
      format: "135",
      brand: "",
      model: "",
      iso: "",
      type: "B&W",
      quantity: 1,
      condition: "Novo",
      expiryDate: "",
      note: "",
    };
  }

  return {
    id: createId("equip"),
    kind: "Câmara",
    brand: "",
    model: "",
    system: "",
    purchaseDate: "",
    purchaseValue: 0,
    status: "Funcional",
    lastServiceDate: "",
    notes: "",
  };
}

function findItem(type, id) {
  return app.state[collectionFor(type)].find((item) => item.id === id);
}

function collectionFor(type) {
  return {
    roll: "rolls",
    stock: "stock",
    equipment: "equipment",
  }[type];
}

function editorTitle(type, item) {
  if (type === "roll") return `Rolo ${item.id}`;
  if (type === "stock") return `${item.brand || "Stock"} ${item.model || ""}`.trim();
  return `${item.brand || "Equipamento"} ${item.model || ""}`.trim();
}

function newEditorTitle(type) {
  if (type === "roll") return "Novo rolo";
  if (type === "stock") return "Novo stock";
  return "Novo equipamento";
}

function editorKicker(type) {
  if (type === "roll") return "Registo de rolo";
  if (type === "stock") return "Stock de filme";
  return "Equipamento";
}

function getFilteredRolls() {
  const search = normalizeSearchValue(app.filters.rollsSearch);
  return sortRolls(app.state.rolls.filter((roll) => {
    const haystack = normalizeSearchValue([
      roll.id,
      roll.status,
      roll.date,
      roll.shotLocation,
      roll.camera,
      roll.lens,
      roll.filmBrand,
      roll.filmModel,
      roll.iso,
      roll.format,
      roll.type,
      roll.developedAt,
      roll.scannedAt,
      roll.developerMethod,
      roll.photosUrl,
      roll.notes,
      roll.folderName,
      roll.negativeCode,
      roll.archiveLocation,
    ].join(" "));

    return (!search || haystack.includes(search))
      && (!app.filters.rollsStatus || (app.filters.rollsStatus === "__open" ? roll.status !== "Arquivado" : roll.status === app.filters.rollsStatus))
      && (!app.filters.rollsCamera || roll.camera === app.filters.rollsCamera)
      && (!app.filters.rollsFormat || roll.format === app.filters.rollsFormat)
      && (!app.filters.rollsType || roll.type === app.filters.rollsType);
  }));
}

function getDashboardRolls() {
  return sortRolls(app.state.rolls.filter((roll) => matchesDashboardFilter(roll, app.dashboardFilter)));
}

function matchesDashboardFilter(roll, filter) {
  const currentYear = String(new Date().getFullYear());
  if (!filter || filter === "all") return true;
  if (filter === "open") return roll.status !== "Arquivado";
  if (filter === "thisYear") return String(roll.date || "").startsWith(currentYear);
  if (filter === "withPhotos") return Boolean(roll.photosUrl);
  if (filter === "archived") return roll.status === "Arquivado";

  const [kind, ...rest] = String(filter).split(":");
  const value = rest.join(":");
  if (kind === "status") return roll.status === value;
  if (kind === "camera") return roll.camera === value;
  if (kind === "brand") return roll.filmBrand === value;
  if (kind === "type") return roll.type === value;
  if (kind === "format") return roll.format === value;
  if (kind === "month") return String(roll.date || "").startsWith(value);
  if (kind === "location") return splitLocations(roll.shotLocation).includes(value);
  return true;
}

function applyRollFilterShortcut(filter) {
  app.filters.rollsSearch = "";
  app.filters.rollsStatus = "";
  app.filters.rollsCamera = "";
  app.filters.rollsFormat = "";
  app.filters.rollsType = "";

  if (!filter || filter === "all") {
    app.activeView = "rolls";
    return;
  }

  if (filter === "open") {
    app.filters.rollsStatus = "__open";
  } else if (filter === "thisYear") {
    app.filters.rollsSearch = String(new Date().getFullYear());
  } else if (filter === "withPhotos") {
    app.filters.rollsSearch = "photos.google";
  } else if (filter === "archived") {
    app.filters.rollsStatus = "Arquivado";
  } else {
    const [kind, ...rest] = String(filter).split(":");
    const value = rest.join(":");
    if (kind === "status") app.filters.rollsStatus = value;
    if (kind === "camera") app.filters.rollsCamera = value;
    if (kind === "type") app.filters.rollsType = value;
    if (kind === "format") app.filters.rollsFormat = value;
    if (["brand", "month", "location"].includes(kind)) app.filters.rollsSearch = value;
  }

  app.activeView = "rolls";
}

function dashboardFilterFor(type, label) {
  if (!type) return "all";
  const value = type === "format" ? String(label).replace(/\s*mm$/i, "") : String(label);
  return `${type}:${value}`;
}

function getDashboardFilterMeta() {
  const count = getDashboardRolls().length;
  const suffix = formatRollCount(count);
  const filter = app.dashboardFilter || "all";

  if (filter === "all") return { title: "Todos os rolos", subtitle: suffix };
  if (filter === "open") return { title: "Rolos em andamento", subtitle: `${suffix} ainda não arquivados` };
  if (filter === "thisYear") return { title: `Rolos de ${new Date().getFullYear()}`, subtitle: suffix };
  if (filter === "withPhotos") return { title: "Rolos com Google Photos", subtitle: suffix };
  if (filter === "archived") return { title: "Rolos arquivados", subtitle: suffix };

  const [kind, ...rest] = filter.split(":");
  const value = rest.join(":");
  const labels = {
    status: `Estado: ${value}`,
    camera: `Câmara: ${value}`,
    brand: `Marca: ${value}`,
    type: `Tipo: ${value}`,
    format: `Formato: ${value}`,
    month: `Mês: ${formatChartLabel(value)}`,
    location: `Local: ${value}`,
  };

  return {
    title: labels[kind] || "Registos em foco",
    subtitle: suffix,
  };
}

function getFilteredStock() {
  const search = normalizeSearchValue(app.filters.stockSearch);
  return app.state.stock.filter((item) => {
    const haystack = normalizeSearchValue([
      item.format,
      item.brand,
      item.model,
      item.iso,
      item.type,
      item.condition,
      item.expiryDate,
      item.note,
    ].join(" "));

    return (!search || haystack.includes(search))
      && (!app.filters.stockFormat || item.format === app.filters.stockFormat)
      && (!app.filters.stockType || item.type === app.filters.stockType);
  }).sort((a, b) => localeSort(a.format, b.format) || localeSort(a.brand, b.brand) || localeSort(a.model, b.model));
}

function getFilteredEquipment() {
  const search = normalizeSearchValue(app.filters.equipmentSearch);
  return app.state.equipment.filter((item) => {
    const haystack = normalizeSearchValue([
      item.kind,
      item.brand,
      item.model,
      item.system,
      item.status,
      item.notes,
    ].join(" "));

    return (!search || haystack.includes(search))
      && (!app.filters.equipmentKind || item.kind === app.filters.equipmentKind)
      && (!app.filters.equipmentStatus || item.status === app.filters.equipmentStatus);
  }).sort((a, b) => localeSort(a.kind, b.kind) || localeSort(a.brand, b.brand) || localeSort(a.model, b.model));
}

function getStatsRolls() {
  return app.state.rolls.filter((roll) => {
    return (!app.filters.statsCamera || roll.camera === app.filters.statsCamera)
      && (!app.filters.statsFilm || filmName(roll) === app.filters.statsFilm)
      && (!app.filters.statsFormat || roll.format === app.filters.statsFormat)
      && (!app.filters.statsType || roll.type === app.filters.statsType)
      && (!app.filters.statsLocation || splitLocations(roll.shotLocation).includes(app.filters.statsLocation))
      && (!app.filters.statsStatus || roll.status === app.filters.statsStatus)
      && (!app.filters.statsYear || String(roll.date || "").startsWith(app.filters.statsYear));
  });
}

function getStats(rolls = app.state.rolls) {
  const currentYear = new Date().getFullYear();
  const years = rolls
    .map((roll) => Number(String(roll.date || "").slice(0, 4)))
    .filter((year) => Number.isFinite(year) && year > 1900);
  const byStatus = countBy(rolls, (roll) => roll.status || "Sem estado");
  const byCamera = countBy(rolls, (roll) => roll.camera || "Sem câmara");
  const byFilmBrand = countBy(rolls, (roll) => roll.filmBrand || "Sem marca");
  const byType = countBy(rolls, (roll) => roll.type || "Sem tipo");
  const byFormat = countBy(rolls, (roll) => roll.format ? `${roll.format} mm` : "Sem formato");
  const byMonth = countBy(rolls, (roll) => roll.date ? roll.date.slice(0, 7) : "Sem data");
  const byIso = countBy(rolls, (roll) => roll.iso ? String(roll.iso) : "Sem ISO");
  const byDeveloper = countBy(rolls, (roll) => roll.developerMethod || roll.developedAt || "Sem registo");
  const byLocation = countLocations(rolls);

  return {
    totalRolls: rolls.length,
    openRolls: rolls.filter((roll) => roll.status !== "Arquivado").length,
    archivedRolls: rolls.filter((roll) => roll.status === "Arquivado").length,
    withPhotos: rolls.filter((roll) => roll.photosUrl).length,
    thisYear: rolls.filter((roll) => Number(String(roll.date).slice(0, 4)) === currentYear).length,
    firstYear: years.length ? Math.min(...years) : "",
    stockTotal: sum(app.state.stock.map((item) => item.quantity)),
    stock35: sum(app.state.stock.filter((item) => item.format === "135").map((item) => item.quantity)),
    stock120: sum(app.state.stock.filter((item) => item.format === "120").map((item) => item.quantity)),
    equipmentCount: app.state.equipment.length,
    equipmentValue: sum(app.state.equipment.map((item) => item.purchaseValue)),
    byStatus,
    byCamera,
    byFilmBrand,
    byType,
    byFormat,
    byMonth,
    byIso,
    byDeveloper,
    byLocation,
  };
}

function sortRolls(rolls) {
  return [...rolls].sort((a, b) => {
    const byDate = String(b.date || "").localeCompare(String(a.date || ""));
    if (byDate) return byDate;
    return String(b.id || "").localeCompare(String(a.id || ""), currentLocale(), { numeric: true });
  });
}

function countBy(items, picker) {
  const map = new Map();
  items.forEach((item) => {
    const key = picker(item);
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
}

function topEntry(map) {
  return [...map.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1] || localeSort(a[0], b[0]))[0] || null;
}

function countLocations(rolls) {
  const map = new Map();
  rolls.forEach((roll) => {
    splitLocations(roll.shotLocation).forEach((location) => {
      map.set(location, (map.get(location) || 0) + 1);
    });
  });
  return map;
}

function splitLocations(value) {
  return text(value)
    .split(/\/|,|;|\s+\+\s+|\s+e\s+/i)
    .map(normalizeLocationName)
    .filter(Boolean);
}

function normalizeLocationName(value) {
  const cleaned = text(value).replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned === "-") return "";

  const aliases = {
    varios: "",
    varias: "",
    troia: "Tróia",
    geres: "Gerês",
    belem: "Belém",
    lourinha: "Lourinhã",
    "rio-de-janeiro": "Rio de Janeiro",
    "serra-da-estrela": "Serra da Estrela",
  };
  const key = slugValue(cleaned);
  if (Object.prototype.hasOwnProperty.call(aliases, key)) return aliases[key];

  return cleaned.split(" ")
    .map((part) => part ? `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}` : "")
    .join(" ");
}

function filmName(roll) {
  return buildFilmLabel(roll, { includePush: false });
}

function buildFolderName(roll) {
  const camera = text(roll.camera) || "Sem câmara";
  const film = buildFilmLabel(roll, { includePush: true }) || "Sem rolo";
  const code = normalizeRollId(roll.negativeCode || roll.id) || "Sem código";
  return `${camera} - ${film} - ${code}`;
}

function buildFilmLabel(roll, options = {}) {
  const brand = text(roll.filmBrand);
  const model = text(roll.filmModel);
  const iso = text(roll.iso);
  const push = Number(roll.push || 0);
  const modelHasIso = iso && model.toLowerCase().includes(iso.toLowerCase());
  const parts = [brand, model];

  if (iso && !modelHasIso) {
    parts.push(iso);
  }

  if (options.includePush && push > 0) {
    parts.push(`+${push}`);
  }

  if (options.includePush && push < 0) {
    parts.push(String(push));
  }

  return parts.filter(Boolean).join(" ");
}

function photosLink(roll) {
  const url = safeExternalUrl(roll.photosUrl);
  if (!url) return "";
  return `<a class="table-link" href="${escapeAttr(url)}" target="_blank" rel="noopener">Abrir</a>`;
}

function photosDetailLink(roll) {
  const url = safeExternalUrl(roll.photosUrl);
  if (!url) return "";
  return `<a class="table-link" href="${escapeAttr(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`;
}

function safeExternalUrl(value) {
  const raw = text(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function detailField(label, value, size = "", raw = false) {
  const content = raw ? value : escapeHtml(value || "");
  return `
    <div class="detail-field ${size}">
      <span>${escapeHtml(label)}</span>
      <strong>${content || "—"}</strong>
    </div>
  `;
}

function statusTimeline(currentStatus) {
  const currentIndex = defaultSupport.statuses.indexOf(currentStatus);
  return `
    <div class="status-timeline" aria-label="Fluxo do rolo">
      ${defaultSupport.statuses.map((status, index) => {
        const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "";
        return `
          <div class="timeline-step ${state}">
            <span></span>
            <strong>${escapeHtml(status)}</strong>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function getNextStatus(status) {
  const index = defaultSupport.statuses.indexOf(status);
  if (index < 0) return defaultSupport.statuses[0];
  return defaultSupport.statuses[index + 1] || "";
}

function statusAdvanceButton(roll, compact = false) {
  const next = getNextStatus(roll.status);
  if (!next) {
    return `<span class="closed-label">Fechado</span>`;
  }
  const label = compact ? "Avançar" : `Avançar para ${next}`;
  return `<button class="button primary ${compact ? "compact-button" : ""}" type="button" data-action="advance-status" data-id="${escapeAttr(roll.id)}">${uiIcon("arrow-right")}<span>${escapeHtml(label)}</span></button>`;
}

function advanceRollStatus(id) {
  const index = app.state.rolls.findIndex((roll) => roll.id === id);
  if (index < 0) {
    showToast("Não encontrei esse rolo.");
    return;
  }

  const current = app.state.rolls[index];
  const next = getNextStatus(current.status);
  if (!next) {
    showToast("Este rolo já está arquivado.");
    return;
  }

  app.state.rolls[index] = {
    ...current,
    status: next,
  };
  app.state = normalizeState(app.state);
  persistState();
  render();

  if (app.detailId === id && detailDialog.open) {
    const updated = findItem("roll", id);
    renderDetails(updated);
  }

  showToast(`Estado alterado para ${next}.`);
}

function refreshComputedFields() {
  if (!app.editor || app.editor.type !== "roll") return;
  const output = editorFields.querySelector('[data-computed="folderName"]');
  if (!output) return;
  output.textContent = buildFolderName(readEditorDraft());
}

function readEditorDraft() {
  const draft = { ...(app.editor?.item || {}) };
  if (!app.editor) return draft;

  fieldsFor(app.editor.type).forEach((field) => {
    if (field.type === "computed") return;
    const input = editorForm.elements[field.name];
    if (!input) return;
    if (field.type === "checkbox") {
      draft[field.name] = input.checked;
    } else if (field.type === "number") {
      draft[field.name] = input.value === "" ? "" : Number(input.value);
    } else {
      draft[field.name] = input.value.trim();
    }
  });

  return draft;
}

function statusPill(status) {
  const value = text(status) || "Sem estado";
  let className = "pill";
  if (value === "Arquivado") className += " archived";
  if (["Disparado", "Em Revelação", "Revelado"].includes(value)) className += " warn";
  if (value === "Avariado") className += " danger";
  return `<span class="${className}">${escapeHtml(value)}</span>`;
}

function stockPill(status) {
  const value = text(status) || "Sem estado";
  let className = "pill";
  if (value === "Expirado" || value === "Avariado") className += " danger";
  if (value === "Emprestado") className += " warn";
  return `<span class="${className}">${escapeHtml(value)}</span>`;
}

function exportJson() {
  persistState();
  download(
    `rolos-backup-${todayStamp()}.json`,
    "application/json",
    JSON.stringify(app.state, null, 2)
  );
  showToast("Backup exportado.");
}

function exportCsv(name, rows, columns) {
  const header = columns.map((column) => csvCell(column.label)).join(";");
  const body = rows.map((row) => columns.map((column) => csvCell(row[column.key])).join(";")).join("\n");
  download(`rolos-${name}-${todayStamp()}.csv`, "text/csv;charset=utf-8", `\uFEFF${header}\n${body}`);
  showToast("CSV exportado.");
}

async function exportExcelWorkbook() {
  try {
    await loadXlsxLibrary();
    const workbook = window.XLSX.utils.book_new();
    const rollRows = app.state.rolls.map((roll) => ({
      "ID Rolo": roll.id,
      Estado: roll.status,
      Data: roll.date,
      "Local Disparado": roll.shotLocation,
      Camera: roll.camera,
      Lente: roll.lens,
      MarcaRolo: roll.filmBrand,
      Modelo: roll.filmModel,
      ISO: roll.iso,
      Formato: roll.format,
      Tipo: roll.type,
      Push: roll.push,
      "Local Revelado": roll.developedAt,
      "Local Digitalizado": roll.scannedAt,
      "Revelador/Metodo": roll.developerMethod,
      "Google Photos": roll.photosUrl,
      Notas: roll.notes,
      "Local Arquivo": roll.archiveLocation,
    }));
    const stockRows = (format) => app.state.stock
      .filter((item) => item.format === format)
      .map((item) => ({
        Marca: item.brand,
        Modelo: item.model,
        ISO: item.iso,
        Tipo: item.type,
        Quantidade: item.quantity,
        Estado: item.condition,
        Validade: item.expiryDate,
        Nota: item.note,
      }));
    const equipmentRows = app.state.equipment.map((item) => ({
      Tipo: item.kind,
      Marca: item.brand,
      Modelo: item.model,
      Sistema: item.system,
      "Data Aquisição": item.purchaseDate,
      "Valor Aquisição": item.purchaseValue,
      Estado: item.status,
      "Data Revisão Realizada": item.lastServiceDate,
      Notas: item.notes,
    }));

    appendWorkbookSheet(workbook, "Registos Rolos", rollRows);
    appendWorkbookSheet(workbook, "Stock 35mm", stockRows("135"));
    appendWorkbookSheet(workbook, "Stock 120mm", stockRows("120"));
    appendWorkbookSheet(workbook, "Equipamento", equipmentRows);
    window.XLSX.writeFile(workbook, `rolos-export-${todayStamp()}.xlsx`, { compression: true });
    showToast("Excel exportado. Pode voltar a ser importado pela app.");
  } catch (error) {
    console.error(error);
    showToast("Não foi possível criar o Excel. Confirma a ligação à internet e tenta novamente.");
  }
}

function appendWorkbookSheet(workbook, name, rows) {
  const sheet = window.XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
  const headers = rows.length ? Object.keys(rows[0]) : [];
  sheet["!cols"] = headers.map((header) => ({
    wch: Math.min(42, Math.max(header.length + 2, ...rows.map((row) => String(row[header] ?? "").length + 2))),
  }));
  window.XLSX.utils.book_append_sheet(workbook, sheet, name);
}

async function importJson(file) {
  try {
    const textValue = await file.text();
    const imported = normalizeState(JSON.parse(textValue));
    const bundledSeed = await loadSeed();
    imported.meta.seedRevision = bundledSeed.meta?.seedRevision || imported.meta.seedRevision || app.state.meta.seedRevision || SEED_REVISION;
    imported.meta.releaseVersion = imported.meta.releaseVersion || app.state.meta.releaseVersion || RELEASE_VERSION;
    app.state = imported;
    persistState();
    render();
    showToast("Backup importado.");
  } catch (error) {
    showToast("O ficheiro não parece ser um backup válido.");
  }
}

async function importExcel(file) {
  const confirmed = confirm(uiText("Importar este Excel vai substituir os dados atuais. Exportaste um JSON de backup?"));
  if (!confirmed) return;

  try {
    await loadXlsxLibrary();
    const buffer = await file.arrayBuffer();
    const workbook = window.XLSX.read(buffer, { type: "array", cellDates: true });
    const imported = normalizeState(buildStateFromExcelWorkbook(workbook, file.name));
    const bundledSeed = await loadSeed();
    imported.meta.seedRevision = bundledSeed.meta?.seedRevision || imported.meta.seedRevision || app.state.meta.seedRevision || SEED_REVISION;
    imported.meta.releaseVersion = imported.meta.releaseVersion || app.state.meta.releaseVersion || RELEASE_VERSION;
    app.state = normalizeState(mergeSeedUpgrade(app.state, imported));
    persistState();
    render();
    showToast("Excel importado.");
  } catch (error) {
    console.error(error);
    showToast("Não consegui importar este Excel. Confirma se tem as folhas esperadas.");
  }
}

function loadXlsxLibrary() {
  if (window.XLSX) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = XLSX_CDN_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("XLSX parser unavailable"));
    document.head.append(script);
  });
}

function buildStateFromExcelWorkbook(workbook, sourceFile) {
  const rollsRows = readExcelTable(workbook, "Registos Rolos", ["ID Rolo", "Estado", "Data"]);
  const stock35Rows = readExcelTable(workbook, "Stock 35mm", ["Marca", "Modelo", "Quantidade"], false);
  const stock120Rows = readExcelTable(workbook, "Stock 120mm", ["Marca", "Modelo", "Quantidade"], false);
  const equipmentRows = readExcelTable(workbook, "Equipamento", ["Tipo", "Marca", "Modelo"], false);

  const rolls = rollsRows.map((row) => {
    const id = normalizeRollId(row["ID Rolo"]);
    const roll = {
      id,
      status: cleanExcelValue(row.Estado),
      date: excelDateToIso(row.Data),
      shotLocation: cleanExcelValue(row["Local Disparado"]),
      camera: cleanExcelValue(row.Camera),
      lens: cleanExcelValue(row.Lente),
      filmBrand: cleanExcelValue(row.MarcaRolo),
      filmModel: cleanExcelValue(row.Modelo),
      iso: cleanExcelValue(row.ISO),
      format: cleanExcelValue(row.Formato),
      type: cleanExcelValue(row.Tipo),
      push: numberOrZero(row.Push),
      developedAt: cleanExcelValue(row["Local Revelado"]),
      scannedAt: cleanExcelValue(row["Local Digitalizado"]),
      developerMethod: cleanExcelValue(row["Revelador/Metodo"] || row["Revelador/Método"]),
      photosUrl: cleanExcelValue(row["Google Photos"] || row.photosUrl),
      notes: cleanExcelValue(row.Notas),
      negativeCode: id,
      archiveLocation: cleanExcelValue(row["Local Arquivo"]),
      favorite: false,
      createdFrom: "excel",
    };
    return {
      ...roll,
      folderName: buildFolderName(roll),
    };
  });

  const stock = [
    ...stock35Rows.map((row, index) => excelStockRow(row, "135", index)),
    ...stock120Rows.map((row, index) => excelStockRow(row, "120", index)),
  ];

  const equipment = equipmentRows.map((row, index) => ({
    id: `eq-${index + 1}-${slugValue(`${row.Marca || ""} ${row.Modelo || ""}`)}`,
    kind: cleanExcelValue(row.Tipo),
    brand: cleanExcelValue(row.Marca),
    model: cleanExcelValue(row.Modelo),
    system: cleanExcelValue(row.Sistema),
    purchaseDate: excelDateToIso(row["Data Aquisiçao"] || row["Data Aquisição"]),
    purchaseValue: numberOrZero(row["Valor Aquisiçao"] || row["Valor Aquisição"]),
    status: cleanExcelValue(row.Estado),
    lastServiceDate: excelDateToIso(row["Data Revisao Realizada"] || row["Data Revisão Realizada"]),
    notes: cleanExcelValue(row.Notas),
    createdFrom: "excel",
  }));

  return {
    meta: {
      appName: "Rolos",
      sourceFile,
      importedAt: new Date().toISOString(),
      seedRevision: SEED_REVISION,
      releaseVersion: RELEASE_VERSION,
      version: 4,
    },
    rolls,
    stock,
    equipment,
    support: defaultSupport,
  };
}

function excelStockRow(row, format, index) {
  const note = cleanExcelValue(row.Nota);
  const expiryDate = excelDateToIso(row.Validade) || (isIsoDate(note) ? note : "");
  return {
    id: `${format}-${index + 1}-${slugValue(`${row.Marca || ""} ${row.Modelo || ""}`)}`,
    format,
    brand: cleanExcelValue(row.Marca),
    model: cleanExcelValue(row.Modelo),
    iso: cleanExcelValue(row.ISO),
    type: cleanExcelValue(row.Tipo),
    quantity: numberOrZero(row.Quantidade),
    condition: cleanExcelValue(row.Estado),
    expiryDate,
    note: isIsoDate(note) ? "" : note,
    createdFrom: "excel",
  };
}

function readExcelTable(workbook, sheetName, requiredHeaders, required = true) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    if (required) throw new Error(`Missing sheet: ${sheetName}`);
    return [];
  }

  const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const headerIndex = rows.findIndex((row) => requiredHeaders.every((header) => row.map(cleanExcelValue).includes(header)));
  if (headerIndex < 0) {
    if (required) throw new Error(`Missing headers: ${sheetName}`);
    return [];
  }

  const headers = rows[headerIndex].map(cleanExcelValue);
  return rows.slice(headerIndex + 1)
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]])))
    .filter((row) => Object.values(row).some((value) => cleanExcelValue(value)));
}

function cleanExcelValue(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isInteger(value)) return String(value);
  return String(value).trim();
}

function excelDateToIso(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && value > 20000) {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return date.toISOString().slice(0, 10);
  }
  const textValue = cleanExcelValue(value);
  if (!textValue || textValue === "-") return "";
  if (isIsoDate(textValue)) return textValue;
  const parsed = new Date(textValue);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

async function resetSeed() {
  const confirmed = confirm(uiText("Repor os dados iniciais importados do Excel?"));
  if (!confirmed) return;

  app.state = normalizeState(mergeSeedUpgrade(app.state, await loadSeed()));
  persistState();
  render();
  showToast("Importação inicial reposta.");
}

function rollCsvColumns() {
  return [
    ["id", "ID Rolo"],
    ["status", "Estado"],
    ["date", "Data"],
    ["shotLocation", "Local Disparado"],
    ["camera", "Câmara"],
    ["lens", "Lente"],
    ["filmBrand", "MarcaRolo"],
    ["filmModel", "Modelo"],
    ["iso", "ISO"],
    ["format", "Formato"],
    ["type", "Tipo"],
    ["push", "Push"],
    ["developedAt", "Local Revelado"],
    ["scannedAt", "Local Digitalizado"],
    ["developerMethod", "Revelador/Método"],
    ["photosUrl", "Google Photos"],
    ["notes", "Notas"],
    ["folderName", "Nome Pasta"],
    ["negativeCode", "Código Negativo"],
    ["archiveLocation", "Local Arquivo"],
  ].map(([key, label]) => ({ key, label }));
}

function stockCsvColumns() {
  return [
    ["format", "Formato"],
    ["brand", "Marca"],
    ["model", "Modelo"],
    ["iso", "ISO"],
    ["type", "Tipo"],
    ["quantity", "Quantidade"],
    ["condition", "Estado"],
    ["expiryDate", "Validade"],
    ["note", "Nota"],
  ].map(([key, label]) => ({ key, label }));
}

function equipmentCsvColumns() {
  return [
    ["kind", "Tipo"],
    ["brand", "Marca"],
    ["model", "Modelo"],
    ["system", "Sistema"],
    ["purchaseDate", "Data Aquisição"],
    ["purchaseValue", "Valor Aquisição"],
    ["status", "Estado"],
    ["lastServiceDate", "Data Revisao Realizada"],
    ["notes", "Notas"],
  ].map(([key, label]) => ({ key, label }));
}

async function connectCloud() {
  try {
    if (!window.ROLOS_FIREBASE_CONFIG?.apiKey) {
      app.cloud.status = "Firebase ainda não configurado. A app continua a funcionar localmente.";
      render();
      return;
    }

    await ensureFirebaseReady();
    observeCloudAuthentication();

    app.cloud.status = app.cloud.user ? `Sessão iniciada: ${app.cloud.user.email}` : "Firebase ligado. Sessão por iniciar.";
    render();
  } catch (error) {
    app.cloud.status = "Não foi possível ligar ao Firebase.";
    render();
  }
}

async function signInCloud() {
  await connectCloud();
  if (!app.cloud.auth || !app.cloud.modules) return;
  const provider = new app.cloud.modules.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await app.cloud.modules.signInWithPopup(app.cloud.auth, provider);
}

async function signOutCloud() {
  if (!app.cloud.auth || !app.cloud.modules) return;
  window.clearTimeout(app.cloud.backupTimer);
  window.clearTimeout(app.cloud.syncTimer);
  app.cloud.currentUnsubscribe?.();
  app.cloud.currentUnsubscribe = null;
  app.cloud.driveStatusUnsubscribe?.();
  app.cloud.driveStatusUnsubscribe = null;
  await app.cloud.modules.signOut(app.cloud.auth);
  app.cloud.user = null;
  app.cloud.status = "Sessão terminada.";
  render();
}

function loadLocalDriveBackupStatus() {
  try {
    return normalizeDriveBackupStatus(JSON.parse(localStorage.getItem(DRIVE_STATUS_STORAGE_KEY) || "{}"));
  } catch (error) {
    console.warn("O estado local do Google Drive não pôde ser lido.", error);
    return normalizeDriveBackupStatus();
  }
}

function saveLocalDriveBackupStatus(status) {
  const normalized = normalizeDriveBackupStatus(status);
  app.cloud.driveStatus = normalized;
  try {
    localStorage.setItem(DRIVE_STATUS_STORAGE_KEY, JSON.stringify(normalized));
  } catch (error) {
    console.warn("O estado local do Google Drive não pôde ser guardado.", error);
  }
  return normalized;
}

function normalizeDriveBackupStatus(status = {}) {
  return {
    lastBackupAt: text(status.lastBackupAt),
    weekKey: text(status.weekKey),
    fileId: text(status.fileId),
    fileName: text(status.fileName),
    fileUrl: text(status.fileUrl),
    folderId: text(status.folderId),
    folderUrl: text(status.folderUrl),
    rollCount: Math.max(0, numberOrZero(status.rollCount)),
    revision: Math.max(0, numberOrZero(status.revision)),
    releaseVersion: text(status.releaseVersion),
  };
}

function startDriveStatusListener() {
  app.cloud.driveStatusUnsubscribe?.();
  app.cloud.driveStatusUnsubscribe = null;
  if (!app.cloud.user || !app.cloud.modules?.onSnapshot) return;

  app.cloud.driveStatusUnsubscribe = app.cloud.modules.onSnapshot(
    cloudDocumentRef(DRIVE_STATUS_DOCUMENT_ID),
    (snapshot) => {
      if (snapshot.exists()) {
        const remote = normalizeDriveBackupStatus(snapshot.data());
        const localTimestamp = Date.parse(app.cloud.driveStatus?.lastBackupAt || "");
        const remoteTimestamp = Date.parse(remote.lastBackupAt || "");
        if (!Number.isFinite(localTimestamp) || remoteTimestamp >= localTimestamp) {
          saveLocalDriveBackupStatus(remote);
        }
      }
      if (app.ready) render();
    },
    (error) => console.warn("O estado da cópia no Drive não pôde ser atualizado.", error)
  );
}

async function createDriveBackup() {
  if (app.cloud.driveBackupInProgress) return;
  app.cloud.driveBackupInProgress = true;
  app.cloud.driveBackupError = "";
  render();

  try {
    await ensureFirebaseReady();
    if (!app.cloud.user || !isAuthorizedCloudUser(app.cloud.user)) {
      throw Object.assign(new Error("Sessão privada em falta."), { code: "rolos/drive-auth-required" });
    }

    await synchronizeWithCloud({ reason: "drive-backup", silent: true, allowWhenPaused: true });
    const accessToken = await authorizeGoogleDrive();
    const driveClient = createDriveBackupClient(accessToken);
    const timestamp = new Date().toISOString();
    const weekKey = isoWeekKey(timestamp);
    const folder = await driveClient.ensureBackupFolder();
    const stateSnapshot = structuredClone(app.state);
    stateSnapshot.meta = {
      ...stateSnapshot.meta,
      releaseVersion: RELEASE_VERSION,
      driveBackupCreatedAt: timestamp,
      driveBackupWeekKey: weekKey,
    };
    const content = JSON.stringify(stateSnapshot, null, 2);
    const file = await driveClient.uploadWeeklyBackup(folder.id, weekKey, content);

    try {
      await driveClient.pruneBackupHistory();
    } catch (retentionError) {
      console.warn("A cópia foi criada, mas a retenção do Drive não foi revista.", retentionError);
    }

    const status = saveLocalDriveBackupStatus({
      lastBackupAt: timestamp,
      weekKey,
      fileId: file.id,
      fileName: file.name || `rolos-backup-${weekKey}.json`,
      fileUrl: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
      folderId: folder.id,
      folderUrl: `https://drive.google.com/drive/folders/${folder.id}`,
      rollCount: app.state.rolls.length,
      revision: numberOrZero(app.state.meta.cloudRevision),
      releaseVersion: RELEASE_VERSION,
    });

    try {
      await app.cloud.modules.setDoc(cloudDocumentRef(DRIVE_STATUS_DOCUMENT_ID), {
        kind: "drive-status",
        schemaVersion: SYNC_SCHEMA_VERSION,
        ...status,
        updatedAt: app.cloud.modules.serverTimestamp(),
        updatedAtLocal: timestamp,
      });
    } catch (statusError) {
      console.warn("A cópia foi criada, mas o aviso não ficou sincronizado entre dispositivos.", statusError);
    }

    showToast("Backup semanal guardado no Google Drive.");
  } catch (error) {
    console.error("A cópia para o Google Drive falhou.", error);
    app.cloud.driveBackupError = driveBackupErrorMessage(error);
    showToast(app.cloud.driveBackupError);
  } finally {
    app.cloud.driveBackupInProgress = false;
    render();
  }
}

async function authorizeGoogleDrive() {
  const provider = new app.cloud.modules.GoogleAuthProvider();
  provider.addScope(DRIVE_SCOPE);
  provider.setCustomParameters({ login_hint: configuredOwnerEmail() });
  const result = await app.cloud.modules.signInWithPopup(app.cloud.auth, provider);
  if (!isAuthorizedCloudUser(result.user)) {
    throw Object.assign(new Error("Conta não autorizada."), { code: "rolos/drive-wrong-account" });
  }
  const credential = app.cloud.modules.GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw Object.assign(new Error("O Google não devolveu uma autorização para o Drive."), { code: "rolos/drive-token-missing" });
  }
  return credential.accessToken;
}

function driveBackupErrorMessage(error) {
  if (["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(error?.code)) {
    return "O backup foi cancelado. Nenhum ficheiro foi enviado.";
  }
  if (["rolos/drive-auth-required", "rolos/drive-wrong-account"].includes(error?.code)) {
    return "Entre com a conta Google autorizada antes de criar o backup.";
  }
  if (error?.status === 401 || error?.code === "rolos/drive-token-missing") {
    return "A autorização do Google Drive expirou. Tente novamente.";
  }
  if (error?.status === 403) {
    return "O Google Drive ainda não está configurado para a aplicação. Siga o guia da versão 1.04 e tente novamente.";
  }
  return "Não foi possível criar o backup no Google Drive. A cópia Firebase continua segura.";
}

async function pushCloudBackup(options = {}) {
  if (app.cloud.backupInProgress) return false;
  if (!options.skipConnect) await connectCloud();
  if (!app.cloud.user || !isAuthorizedCloudUser(app.cloud.user)) {
    if (!options.silent) {
      app.cloud.status = "Entra com a conta autorizada para sincronizar.";
      render();
    }
    return false;
  }

  app.cloud.backupInProgress = true;
  let shouldRetry = false;
  const stateSnapshot = structuredClone(app.state);
  const syncedLocalRevision = numberOrZero(stateSnapshot.meta.localRevision);
  try {
    const timestamp = new Date().toISOString();
    const contentHash = stateFingerprint(stateSnapshot);
    const expectedRevision = numberOrZero(stateSnapshot.meta.cloudRevision);
    const prepared = prepareCloudPayload(stateSnapshot, timestamp, contentHash);
    await persistCloudImages(prepared.imageRecords);

    const nextRevision = await app.cloud.modules.runTransaction(app.cloud.db, async (transaction) => {
      const ref = cloudBackupRef();
      const remoteSnapshot = await transaction.get(ref);
      const remoteRecord = remoteSnapshot.exists() ? remoteSnapshot.data() : null;
      const remoteRevision = numberOrZero(remoteRecord?.revision);
      const remoteHash = text(remoteRecord?.contentHash)
        || (remoteRecord?.payload ? stateFingerprint(remoteRecord.payload) : "");
      const writeDecision = evaluateCloudWrite({
        remoteExists: Boolean(remoteRecord),
        remoteRevision,
        expectedRevision,
        remoteHash,
        localHash: contentHash,
        legacyExpectedHash: options.expectedRemoteHash,
        legacyExpectedUpdatedAt: options.expectedRemoteUpdatedAtLocal,
        remoteUpdatedAt: remoteRecord?.updatedAtLocal,
      });

      if (writeDecision.conflict) {
        const conflict = new Error("A versão online mudou noutro dispositivo.");
        conflict.code = "rolos/sync-conflict";
        throw conflict;
      }

      const revision = writeDecision.nextRevision;
      const payload = structuredClone(prepared.payload);
      payload.meta.cloudRevision = revision;
      payload.meta.lastSyncedContentHash = contentHash;
      transaction.set(ref, {
        kind: "current",
        schemaVersion: SYNC_SCHEMA_VERSION,
        revision,
        contentHash,
        sourceDeviceId: getDeviceId(),
        payload,
        updatedAt: app.cloud.modules.serverTimestamp(),
        updatedAtLocal: timestamp,
      });
      return revision;
    });

    shouldRetry = numberOrZero(app.state.meta.localRevision) !== syncedLocalRevision;
    app.state.meta.autoCloudBackup = true;
    app.state.meta.cloudBackupInitialized = true;
    app.state.meta.cloudBackupPending = shouldRetry;
    app.state.meta.lastCloudBackupAt = timestamp;
    app.state.meta.lastSyncCheckAt = timestamp;
    app.state.meta.cloudRevision = nextRevision;
    app.state.meta.lastSyncedContentHash = contentHash;
    persistState({ skipAutomaticBackup: true, preserveUpdatedAt: true });
    await ensureWeeklyCloudBackup(stateSnapshot, {
      revision: nextRevision,
      contentHash,
      timestamp,
      force: true,
    });
    app.cloud.status = options.silent
      ? `Sincronizado. Versão ${nextRevision} guardada.`
      : `Sincronização concluída. Versão ${nextRevision} guardada no Firebase.`;
    render();
    return true;
  } catch (error) {
    if (error?.code === "rolos/sync-conflict") {
      console.warn("Foi evitada a substituição de uma versão mais recente.", error);
      await saveRecoveryCloudBackup(stateSnapshot, "conflito entre dispositivos");
      const latest = await readCloudBackup("current");
      if (latest) await applyCloudRecord(latest);
      app.cloud.status = "Foi encontrada uma versão mais recente. A alteração local ficou guardada no historial de recuperação.";
      if (!options.silent) showToast("A versão mais recente foi mantida. A outra cópia ficou no historial.");
    } else {
      console.error(error);
      app.cloud.status = "Sem ligação ao Firebase. A alteração continua guardada neste dispositivo e será repetida automaticamente.";
      app.state.meta.cloudBackupPending = true;
      persistState({ skipAutomaticBackup: true, preserveUpdatedAt: true });
      if (!options.silent) showToast("A sincronização falhou, mas a cópia local está guardada.");
    }
    render();
    return false;
  } finally {
    app.cloud.backupInProgress = false;
    if (shouldRetry) scheduleAutomaticCloudBackup(500);
  }
}

async function pullCloudBackup() {
  await connectCloud();
  if (!app.cloud.user || !isAuthorizedCloudUser(app.cloud.user)) {
    app.cloud.status = "Entra com a conta autorizada para verificar a versão online.";
    render();
    return;
  }
  await synchronizeWithCloud({ reason: "manual", forcePull: true, allowWhenPaused: true });
}

function scheduleAutomaticCloudBackup(delay = 1200) {
  window.clearTimeout(app.cloud.backupTimer);
  if (!app.state?.meta?.autoCloudBackup
    || !app.state.meta.cloudBackupPending
    || !app.cloud.user
    || !app.cloud.modules) return;
  app.cloud.backupTimer = window.setTimeout(() => {
    pushCloudBackup({ silent: true, skipConnect: true });
  }, delay);
}

function scheduleCloudSyncCheck(delay = 350) {
  window.clearTimeout(app.cloud.syncTimer);
  if (!app.state?.meta?.autoCloudBackup || !app.cloud.user || !app.cloud.modules) return;
  app.cloud.syncTimer = window.setTimeout(() => {
    synchronizeWithCloud({ reason: "automatic", silent: true });
  }, delay);
}

function startCloudSyncListener() {
  app.cloud.currentUnsubscribe?.();
  app.cloud.currentUnsubscribe = null;
  if (!app.cloud.user || !app.cloud.modules?.onSnapshot || !app.state?.meta?.autoCloudBackup) return;

  app.cloud.currentUnsubscribe = app.cloud.modules.onSnapshot(cloudBackupRef(), (snapshot) => {
    if (!snapshot.exists() || !app.ready || app.cloud.backupInProgress || app.cloud.syncInProgress) return;
    const record = snapshot.data();
    const remoteRevision = numberOrZero(record.revision);
    const remoteHash = text(record.contentHash);
    const isNewer = remoteRevision > numberOrZero(app.state.meta.cloudRevision);
    const isDifferent = remoteHash && remoteHash !== app.state.meta.lastSyncedContentHash;
    if (isNewer || isDifferent) scheduleCloudSyncCheck(200);
  }, (error) => {
    console.warn("A escuta automática do Firebase foi interrompida.", error);
  });
}

async function synchronizeWithCloud(options = {}) {
  if (!app.cloud.user || !app.cloud.modules
    || (!app.state?.meta?.autoCloudBackup && !options.allowWhenPaused)) return false;
  if (app.cloud.syncInProgress) return app.cloud.syncPromise;

  app.cloud.syncInProgress = true;
  app.cloud.syncPromise = (async () => {
    try {
      if (!options.silent) {
        app.cloud.status = "A verificar a versão mais recente…";
        if (app.ready) render();
      }

      const cloudRecord = await readCloudBackup("current");
      if (!cloudRecord) {
        if (!hasUserArchiveData(app.state)) {
          app.cloud.status = "O arquivo online ainda está vazio. Importa a base inicial para começar.";
          return false;
        }
        return pushCloudBackup({ silent: options.silent, skipConnect: true });
      }

      const localHash = stateFingerprint(app.state);
      const cloudHash = cloudRecord.contentHash || stateFingerprint(cloudRecord.payload);
      let action = chooseSyncAction(app.state, { ...cloudRecord, contentHash: cloudHash });
      if (options.forcePull && localHash !== cloudHash) action = "recover-pull";

      if (action === "migrate" || action === "push") {
        return pushCloudBackup({
          silent: options.silent,
          skipConnect: true,
          expectedRemoteHash: action === "migrate" ? cloudHash : "",
          expectedRemoteUpdatedAtLocal: action === "migrate" ? text(cloudRecord.updatedAtLocal) : "",
        });
      }

      if (action === "recover-pull") {
        await saveRecoveryCloudBackup(app.state, options.forcePull ? "antes de receber a versão online" : "conflito entre dispositivos");
      }

      if (action === "pull" || action === "recover-pull") {
        await applyCloudRecord(cloudRecord);
        if (numberOrZero(cloudRecord.revision) === 0) {
          return pushCloudBackup({
            silent: options.silent,
            skipConnect: true,
            expectedRemoteHash: stateFingerprint(app.state),
            expectedRemoteUpdatedAtLocal: text(cloudRecord.updatedAtLocal),
          });
        }
      } else {
        const timestamp = new Date().toISOString();
        app.state.meta.cloudRevision = numberOrZero(cloudRecord.revision);
        app.state.meta.lastSyncedContentHash = cloudHash;
        app.state.meta.lastCloudBackupAt = text(cloudRecord.updatedAtLocal) || app.state.meta.lastCloudBackupAt;
        app.state.meta.lastSyncCheckAt = timestamp;
        app.state.meta.cloudBackupInitialized = true;
        app.state.meta.cloudBackupPending = false;
        persistState({ skipAutomaticBackup: true, preserveUpdatedAt: true });
      }

      await ensureWeeklyCloudBackup(app.state, {
        revision: numberOrZero(cloudRecord.revision),
        contentHash: cloudHash,
        timestamp: new Date().toISOString(),
      });
      app.cloud.status = `Sincronizado. Versão ${numberOrZero(cloudRecord.revision) || 1} disponível em todos os dispositivos.`;
      if (app.ready) render();
      return true;
    } catch (error) {
      console.error("A sincronização automática falhou.", error);
      app.cloud.status = "Sem ligação ao Firebase. A cópia local continua segura e a app tentará novamente.";
      if (app.ready) render();
      return false;
    } finally {
      app.cloud.syncInProgress = false;
      app.cloud.syncPromise = null;
    }
  })();

  return app.cloud.syncPromise;
}

async function applyCloudRecord(cloudRecord) {
  const localMeta = app.state?.meta || {};
  const payload = normalizeState(structuredClone(cloudRecord.payload));
  payload.meta.seedRevision = localMeta.seedRevision || payload.meta.seedRevision;
  payload.meta.releaseVersion = RELEASE_VERSION;
  payload.meta.autoCloudBackup = localMeta.autoCloudBackup !== false;
  payload.meta.cloudBackupInitialized = true;
  payload.meta.cloudBackupPending = false;
  payload.meta.cloudRevision = numberOrZero(cloudRecord.revision);
  payload.meta.lastSyncedContentHash = cloudRecord.contentHash || stateFingerprint(payload);
  payload.meta.lastCloudBackupAt = text(cloudRecord.updatedAtLocal) || payload.meta.lastCloudBackupAt;
  payload.meta.lastSyncCheckAt = new Date().toISOString();
  payload.meta.lastWeeklyBackupKey = text(localMeta.lastWeeklyBackupKey);
  payload.meta.lastWeeklyBackupRevision = numberOrZero(localMeta.lastWeeklyBackupRevision);
  payload.meta.lastRetentionCheckKey = text(localMeta.lastRetentionCheckKey);
  app.state = payload;
  persistState({ skipAutomaticBackup: true, preserveUpdatedAt: true });
  if (app.ready) render();
}

async function readCloudBackup(id) {
  const snapshot = await app.cloud.modules.getDoc(cloudDocumentRef(id));
  if (!snapshot.exists()) return null;
  return hydrateCloudRecord({ id: snapshot.id || id, ...snapshot.data() });
}

async function hydrateCloudRecord(record) {
  const payload = structuredClone(record.payload || {});
  const imageDocs = Array.isArray(payload?.meta?.filmImageDocs) ? payload.meta.filmImageDocs : [];
  const legacyKeys = Array.isArray(payload?.meta?.filmImageIndex) ? payload.meta.filmImageIndex : [];
  let images = [];

  if (imageDocs.length) {
    const snapshots = await Promise.all(imageDocs.map((item) => app.cloud.modules.getDoc(cloudDocumentRef(item.docId))));
    images = snapshots.filter((item) => item.exists()).map((item) => item.data());
  } else if (legacyKeys.length) {
    const snapshots = await Promise.all(legacyKeys.map((key) => app.cloud.modules.getDoc(cloudFilmImageRef(key))));
    images = snapshots.filter((item) => item.exists()).map((item) => item.data());
  }

  payload.filmImages = Object.fromEntries(images
    .filter((item) => item.key && item.image)
    .map((item) => [item.key, item.image]));
  if (payload.meta) {
    delete payload.meta.filmImageDocs;
    delete payload.meta.filmImageIndex;
  }
  return { ...record, payload };
}

function prepareCloudPayload(stateSnapshot, timestamp, contentHash = stateFingerprint(stateSnapshot)) {
  const payload = structuredClone(stateSnapshot);
  const imageRecords = Object.entries(payload.filmImages || {}).map(([key, image]) => ({
    key,
    image,
    docId: cloudImageDocumentId(key, image),
  }));
  delete payload.filmImages;
  payload.meta = {
    ...payload.meta,
    releaseVersion: RELEASE_VERSION,
    syncSchemaVersion: SYNC_SCHEMA_VERSION,
    autoCloudBackup: true,
    cloudBackupInitialized: true,
    cloudBackupPending: false,
    lastCloudBackupAt: timestamp,
    lastSyncedContentHash: contentHash,
    filmImageDocs: imageRecords.map(({ key, docId }) => ({ key, docId })),
  };
  delete payload.meta.filmImageIndex;
  return { payload, imageRecords };
}

async function persistCloudImages(imageRecords) {
  await Promise.all(imageRecords.map((record) => app.cloud.modules.setDoc(cloudDocumentRef(record.docId), {
    kind: "film-image-v2",
    schemaVersion: SYNC_SCHEMA_VERSION,
    key: record.key,
    image: record.image,
    updatedAt: app.cloud.modules.serverTimestamp(),
  })));
}

async function ensureWeeklyCloudBackup(stateSnapshot, options = {}) {
  if (!app.cloud.user || !app.cloud.modules || !app.state.meta.autoCloudBackup) return false;
  const weekKey = isoWeekKey();
  const revision = numberOrZero(options.revision ?? stateSnapshot.meta?.cloudRevision);
  if (!options.force
    && !app.state.meta.weeklyBackupPending
    && app.state.meta.lastWeeklyBackupKey === weekKey
    && numberOrZero(app.state.meta.lastWeeklyBackupRevision) === revision) return true;

  try {
    const timestamp = options.timestamp || new Date().toISOString();
    const contentHash = options.contentHash || stateFingerprint(stateSnapshot);
    const prepared = prepareCloudPayload(stateSnapshot, timestamp, contentHash);
    prepared.payload.meta.cloudRevision = revision;
    await persistCloudImages(prepared.imageRecords);
    await app.cloud.modules.runTransaction(app.cloud.db, async (transaction) => {
      const ref = cloudDocumentRef(`weekly-${weekKey}`);
      const existing = await transaction.get(ref);
      if (existing.exists() && !shouldReplaceWeeklyBackup(existing.data()?.revision, revision)) return;
      transaction.set(ref, {
        kind: "weekly",
        schemaVersion: SYNC_SCHEMA_VERSION,
        weekKey,
        revision,
        contentHash,
        sourceDeviceId: getDeviceId(),
        payload: prepared.payload,
        updatedAt: app.cloud.modules.serverTimestamp(),
        updatedAtLocal: timestamp,
      });
    });
    app.state.meta.lastWeeklyBackupKey = weekKey;
    app.state.meta.lastWeeklyBackupRevision = revision;
    app.state.meta.weeklyBackupPending = false;

    if (app.state.meta.lastRetentionCheckKey !== weekKey) {
      await pruneCloudHistory();
      app.state.meta.lastRetentionCheckKey = weekKey;
    }
    persistState({ skipAutomaticBackup: true, preserveUpdatedAt: true });
    return true;
  } catch (error) {
    console.error("Não foi possível atualizar a cópia semanal.", error);
    app.state.meta.weeklyBackupPending = true;
    persistState({ skipAutomaticBackup: true, preserveUpdatedAt: true });
    return false;
  }
}

async function saveRecoveryCloudBackup(stateSnapshot, reason) {
  if (!app.cloud.user || !app.cloud.modules || !hasUserArchiveData(stateSnapshot)) return "";
  try {
    const timestamp = new Date().toISOString();
    const contentHash = stateFingerprint(stateSnapshot);
    const prepared = prepareCloudPayload(stateSnapshot, timestamp, contentHash);
    const id = `recovery-${timestamp.replace(/\D/g, "").slice(0, 17)}-${getDeviceId().slice(0, 18)}`;
    await persistCloudImages(prepared.imageRecords);
    await app.cloud.modules.setDoc(cloudDocumentRef(id), {
      kind: "recovery",
      schemaVersion: SYNC_SCHEMA_VERSION,
      reason: text(reason),
      revision: numberOrZero(stateSnapshot.meta?.cloudRevision),
      contentHash,
      sourceDeviceId: getDeviceId(),
      payload: prepared.payload,
      updatedAt: app.cloud.modules.serverTimestamp(),
      updatedAtLocal: timestamp,
    });
    app.cloud.historyLoadedAt = 0;
    await pruneCloudHistory();
    return id;
  } catch (error) {
    console.error("Não foi possível criar a cópia de recuperação online.", error);
    saveLocalRecoveryCopy(stateSnapshot);
    return "";
  }
}

function saveLocalRecoveryCopy(stateSnapshot) {
  try {
    localStorage.setItem(`${STORAGE_KEY}-recovery-${Date.now()}`, JSON.stringify(stateSnapshot));
  } catch (error) {
    console.error("Não foi possível criar a cópia local de recuperação.", error);
  }
}

async function pruneCloudHistory() {
  const snapshot = await app.cloud.modules.getDocs(cloudBackupsCollectionRef());
  const records = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const plan = historyRetentionPlan(records, WEEKLY_BACKUP_LIMIT, RECOVERY_BACKUP_LIMIT);
  const removeIds = new Set(plan.remove.map((item) => item.id));
  await Promise.all([...removeIds].map((id) => app.cloud.modules.deleteDoc(cloudDocumentRef(id))));

  const referencedImages = new Set(records
    .filter((item) => !removeIds.has(item.id) && ["current", "weekly", "recovery"].includes(item.kind))
    .flatMap((item) => Array.isArray(item.payload?.meta?.filmImageDocs) ? item.payload.meta.filmImageDocs : [])
    .map((item) => item.docId)
    .filter(Boolean));
  const orphanImageIds = records
    .filter((item) => item.kind === "film-image-v2" && !referencedImages.has(item.id))
    .map((item) => item.id);
  await Promise.all(orphanImageIds.map((id) => app.cloud.modules.deleteDoc(cloudDocumentRef(id))));
  app.cloud.historyLoadedAt = 0;
}

async function loadCloudHistory(options = {}) {
  if (!app.cloud.user || !app.cloud.modules || app.cloud.historyLoading) return;
  if (!options.force && Date.now() - app.cloud.historyLoadedAt < 60000) return;
  app.cloud.historyLoading = true;
  app.cloud.historyError = "";
  if (app.ready && app.activeView === "archive") render();
  try {
    const snapshot = await app.cloud.modules.getDocs(cloudBackupsCollectionRef());
    app.cloud.history = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => ["weekly", "recovery"].includes(item.kind))
      .map((item) => ({
        id: item.id,
        kind: item.kind,
        weekKey: text(item.weekKey),
        reason: text(item.reason),
        revision: numberOrZero(item.revision),
        updatedAtLocal: text(item.updatedAtLocal),
        rollCount: Array.isArray(item.payload?.rolls) ? item.payload.rolls.length : 0,
      }))
      .sort((a, b) => Date.parse(b.updatedAtLocal || 0) - Date.parse(a.updatedAtLocal || 0));
    app.cloud.historyLoadedAt = Date.now();
  } catch (error) {
    console.error("Não foi possível carregar o historial.", error);
    app.cloud.historyError = "Não foi possível consultar o historial neste momento.";
  } finally {
    app.cloud.historyLoading = false;
    if (app.ready && app.activeView === "archive") render();
  }
}

async function restoreCloudVersion(id) {
  if (!id || !app.cloud.user || !app.cloud.modules) return;
  const confirmed = confirm(uiText("Repor esta versão? A versão atual ficará guardada como cópia de recuperação."));
  if (!confirmed) return;

  try {
    app.cloud.status = "A preparar a recuperação…";
    render();
    const [selected, current] = await Promise.all([
      readCloudBackup(id),
      readCloudBackup("current"),
    ]);
    if (!selected?.payload) throw new Error("A cópia selecionada já não existe.");
    await saveRecoveryCloudBackup(app.state, "antes de repor uma versão anterior");

    const restored = normalizeState(selected.payload);
    restored.meta.autoCloudBackup = true;
    restored.meta.cloudBackupInitialized = true;
    restored.meta.cloudRevision = numberOrZero(current?.revision);
    restored.meta.localRevision = numberOrZero(app.state.meta.localRevision) + 1;
    restored.meta.cloudBackupPending = true;
    restored.meta.updatedAt = new Date().toISOString();
    app.state = restored;
    persistState({ skipAutomaticBackup: true, preserveUpdatedAt: true });
    const restoredOnline = await pushCloudBackup({ skipConnect: true });
    await loadCloudHistory({ force: true });
    if (restoredOnline) showToast("Versão reposta e sincronizada.");
  } catch (error) {
    console.error(error);
    app.cloud.status = "Não foi possível repor essa versão.";
    render();
    showToast("A recuperação não foi concluída.");
  }
}

function toggleAutomaticCloudBackup() {
  const enabled = !app.state.meta.autoCloudBackup;
  app.state.meta.autoCloudBackup = enabled;
  if (enabled) app.state.meta.cloudBackupPending = true;
  persistState({ skipAutomaticBackup: true });

  if (!enabled) {
    window.clearTimeout(app.cloud.backupTimer);
    window.clearTimeout(app.cloud.syncTimer);
    app.cloud.currentUnsubscribe?.();
    app.cloud.currentUnsubscribe = null;
    if (app.cloud.user) app.cloud.status = "Sincronização automática pausada neste dispositivo.";
  } else if (app.cloud.user) {
    app.cloud.status = "Sincronização automática ativa. A verificar a versão mais recente.";
    startCloudSyncListener();
    scheduleCloudSyncCheck(100);
  } else {
    app.cloud.status = "Sincronização preparada. Entra com a conta Google autorizada para começar.";
  }
  render();
}

function cloudBackupRef() {
  return cloudDocumentRef("current");
}

function cloudBackupsCollectionRef() {
  return app.cloud.modules.collection(app.cloud.db, "users", app.cloud.user.uid, "backups");
}

function cloudDocumentRef(id) {
  return app.cloud.modules.doc(app.cloud.db, "users", app.cloud.user.uid, "backups", id);
}

function cloudFilmImageRef(key) {
  const readableKey = slugValue(key).slice(0, 56) || "film";
  return cloudDocumentRef(`film-image-${readableKey}-${hashString(key).toString(36)}`);
}

function cloudImageDocumentId(key, image) {
  const readableKey = slugValue(key).slice(0, 42) || "film";
  const contentHash = stateFingerprint({ filmImages: { [key]: image } });
  return `film-image-v2-${readableKey}-${contentHash}`;
}

function getDeviceId() {
  if (app.cloud.deviceId) return app.cloud.deviceId;
  try {
    const stored = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (stored) {
      app.cloud.deviceId = stored;
      return stored;
    }
    const generated = globalThis.crypto?.randomUUID?.()
      || `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_STORAGE_KEY, generated);
    app.cloud.deviceId = generated;
    return generated;
  } catch (error) {
    app.cloud.deviceId = `session-${Date.now().toString(36)}`;
    return app.cloud.deviceId;
  }
}

function hasUserArchiveData(state) {
  return Boolean(state?.rolls?.length || state?.stock?.length || state?.equipment?.length || Object.keys(state?.filmImages || {}).length);
}

function download(filename, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const stringValue = String(value ?? "");
  const safeValue = /^[=+\-@]/.test(stringValue) ? `'${stringValue}` : stringValue;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

function nextRollId(dateValue) {
  const date = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const sameMonth = app.state?.rolls?.filter((roll) => String(roll.date || "").startsWith(`${year}-${month}`)).length || 0;
  const sequence = String(sameMonth + 1).padStart(2, "0");
  return `${sequence}${month}${year}`;
}

function normalizeRollId(value) {
  const raw = text(value);
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 7) return digits.padStart(8, "0");
  return raw;
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(text(value));
}

function slugValue(value) {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sum(values) {
  return values.reduce((total, value) => total + numberOrZero(value), 0);
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function text(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeEquipmentKind(value) {
  const original = text(value);
  const key = normalizeSearchValue(original);
  if (["equipamento", "equipamentos"].includes(key)) return "";
  if (key === "camera") return "Câmara";
  if (key === "acessorio") return "Acessório";
  return original;
}

function normalizeSearchValue(value) {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function unique(values) {
  const seen = new Set();
  return values
    .map(text)
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function localeSort(a, b) {
  return String(a || "").localeCompare(String(b || ""), currentLocale(), { sensitivity: "base", numeric: true });
}

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function formatNumber(value) {
  return new Intl.NumberFormat(currentLocale()).format(numberOrZero(value));
}

function formatRollCount(value) {
  const count = numberOrZero(value);
  if (app.language === "en") return `${formatNumber(count)} ${count === 1 ? "roll" : "rolls"}`;
  return `${formatNumber(count)} ${count === 1 ? "rolo" : "rolos"}`;
}

function formatPendingRollCount(value) {
  return app.language === "en"
    ? `${formatRollCount(value)} to finish`
    : `${formatRollCount(value)} por concluir`;
}

function formatInStockCount(value) {
  return app.language === "en"
    ? `${formatRollCount(value)} in stock`
    : `${formatRollCount(value)} em stock`;
}

function formatFilmCount(value) {
  const count = numberOrZero(value);
  if (app.language === "en") return `${formatNumber(count)} ${count === 1 ? "film" : "films"}`;
  return `${formatNumber(count)} ${count === 1 ? "filme" : "filmes"}`;
}

function formatFilmReferenceCount(value) {
  const count = numberOrZero(value);
  if (app.language === "en") return `${formatNumber(count)} film ${count === 1 ? "reference" : "references"}`;
  return `${formatNumber(count)} ${count === 1 ? "referência" : "referências"} de filme`;
}

function formatItemCount(value) {
  const count = numberOrZero(value);
  if (app.language === "en") return `${formatNumber(count)} ${count === 1 ? "item" : "items"}`;
  return `${formatNumber(count)} ${count === 1 ? "item" : "itens"}`;
}

function formatPackagingSummary(customImages, includedImages, automaticCovers) {
  if (app.language === "en") {
    return `${formatNumber(customImages)} ${customImages === 1 ? "personal photograph" : "personal photographs"}; `
      + `${formatNumber(includedImages)} ${includedImages === 1 ? "included image" : "included images"}; `
      + `${formatNumber(automaticCovers)} ${automaticCovers === 1 ? "automatic cover" : "automatic covers"}.`;
  }
  return `${formatNumber(customImages)} ${customImages === 1 ? "fotografia tua" : "fotografias tuas"}; `
    + `${formatNumber(includedImages)} ${includedImages === 1 ? "imagem incluída" : "imagens incluídas"}; `
    + `${formatNumber(automaticCovers)} ${automaticCovers === 1 ? "capa automática" : "capas automáticas"}.`;
}

function formatArchiveProgress(value) {
  const percent = formatNumber(Math.round(numberOrZero(value)));
  return app.language === "en" ? `${percent}% to archive` : `${percent}% até ao arquivo`;
}

function formatShownCount(visible, total) {
  return app.language === "en"
    ? `Showing ${formatNumber(visible)} of ${formatNumber(total)}`
    : `A mostrar ${formatNumber(visible)} de ${formatNumber(total)}`;
}

function formatHistoryCount(weeklyCount, limit, recoveryCount) {
  if (app.language === "en") {
    return `${weeklyCount} of ${limit} saved weeks${recoveryCount ? ` · ${recoveryCount} recovery ${recoveryCount === 1 ? "copy" : "copies"}` : ""}`;
  }
  return `${weeklyCount} de ${limit} semanas guardadas${recoveryCount ? ` · ${recoveryCount} ${recoveryCount === 1 ? "cópia" : "cópias"} de proteção` : ""}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat(currentLocale(), {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(numberOrZero(value));
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat(currentLocale(), { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function formatChartLabel(value) {
  const label = text(value);
  if (/^\d{4}-\d{2}$/.test(label)) return formatMonthLabel(label);
  if (/^\d{4}$/.test(label)) return label;
  return label;
}

function formatMonthLabel(value) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat(currentLocale(), { month: "long", year: "numeric" }).format(date);
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(currentLocale(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function showToast(message) {
  toast.textContent = uiText(message);
  toast.classList.add("visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    toast.classList.remove("visible");
  }, 2400);
}

function loadLanguagePreference() {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored) return normalizeLanguage(stored);
  } catch (error) {
    console.warn("A preferência de idioma não pôde ser recuperada.", error);
  }
  return normalizeLanguage(navigator.language || "pt");
}

function currentLocale() {
  return localeForLanguage(app.language);
}

function uiText(value) {
  return translatePhrase(value, app.language);
}

function toggleLanguage() {
  app.language = app.language === "en" ? "pt" : "en";
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, app.language);
  } catch (error) {
    console.warn("A preferência de idioma não pôde ser guardada.", error);
  }
  if (app.ready) render();
  else applyInterfaceLanguage();
}

function applyInterfaceLanguage() {
  const isEnglish = app.language === "en";
  if (document.documentElement) document.documentElement.lang = isEnglish ? "en" : "pt-PT";
  document.title = isEnglish ? "Rolos — Analogue archive" : "Rolos — Arquivo analógico";
  const description = document.querySelector('meta[name="description"]');
  description?.setAttribute("content", isEnglish
    ? "Personal archive for analogue photography, rolls, stock and equipment."
    : "Arquivo pessoal de fotografia analógica, rolos, stock e equipamento.");
  applyLanguage(document.body, app.language);
  if (languageToggle) {
    const targetLanguage = isEnglish ? "Português" : "English";
    languageToggle.setAttribute("aria-label", `Mudar para ${targetLanguage}`);
    languageToggle.setAttribute("title", `Mudar para ${targetLanguage}`);
    const label = languageToggle.querySelector("span");
    if (label) label.textContent = isEnglish ? "PT" : "EN";
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
