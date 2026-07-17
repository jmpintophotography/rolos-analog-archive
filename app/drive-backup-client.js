import { DRIVE_BACKUP_LIMIT, driveRetentionPlan } from "./drive-backup-core.js";

const DRIVE_API_URL = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3";
const DRIVE_FOLDER_MARKER = "rolos-backup-folder-v1";
const DRIVE_FILE_MARKER = "rolos-weekly-backup-v1";
const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 5 * 1024 * 1024;

export function createDriveBackupClient(accessToken, options = {}) {
  if (!accessToken) throw new Error("Google Drive access token is required.");
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("Fetch is unavailable.");
  const resumableThresholdBytes = Math.max(
    1,
    Number(options.resumableThresholdBytes) || RESUMABLE_UPLOAD_THRESHOLD_BYTES
  );

  const request = (url, requestOptions = {}) => driveApiRequest(fetchImpl, url, requestOptions, accessToken);

  async function listFiles(query, listOptions = {}) {
    const params = new URLSearchParams({
      q: query,
      spaces: "drive",
      pageSize: "100",
      fields: "files(id,name,webViewLink,createdTime,modifiedTime,parents,appProperties)",
    });
    if (listOptions.orderBy) params.set("orderBy", listOptions.orderBy);
    const response = await request(`${DRIVE_API_URL}/files?${params.toString()}`);
    return Array.isArray(response?.files) ? response.files : [];
  }

  async function ensureBackupFolder() {
    const query = `appProperties has { key='rolosMarker' and value='${DRIVE_FOLDER_MARKER}' } and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const existing = await listFiles(query);
    if (existing.length) return existing[0];

    return request(`${DRIVE_API_URL}/files?fields=id,name,webViewLink,createdTime`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({
        name: "Rolos - Backups",
        mimeType: "application/vnd.google-apps.folder",
        appProperties: { rolosMarker: DRIVE_FOLDER_MARKER },
      }),
    });
  }

  async function uploadWeeklyBackup(folderId, weekKey, content) {
    const escapedFolderId = driveQueryLiteral(folderId);
    const escapedWeekKey = driveQueryLiteral(weekKey);
    const query = `'${escapedFolderId}' in parents and appProperties has { key='rolosBackupWeek' and value='${escapedWeekKey}' } and trashed=false`;
    const existing = await listFiles(query);
    let file = existing[0];

    if (!file) {
      file = await request(`${DRIVE_API_URL}/files?fields=id,name,webViewLink,createdTime,modifiedTime`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({
          name: `rolos-backup-${weekKey}.json`,
          mimeType: "application/json",
          parents: [folderId],
          description: "Cópia semanal criada pela aplicação privada Rolos.",
          appProperties: {
            rolosBackupKind: DRIVE_FILE_MARKER,
            rolosBackupWeek: weekKey,
          },
        }),
      });
    }

    try {
      if (utf8ByteLength(content) > resumableThresholdBytes) {
        return await uploadResumableFile(fetchImpl, accessToken, file.id, content);
      }
      return await request(`${DRIVE_UPLOAD_URL}/files/${encodeURIComponent(file.id)}?uploadType=media&fields=id,name,webViewLink,createdTime,modifiedTime`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: content,
      });
    } catch (error) {
      if (!existing.length && file?.id) {
        try {
          await request(`${DRIVE_API_URL}/files/${encodeURIComponent(file.id)}`, { method: "DELETE" });
        } catch (cleanupError) {
          console.warn("O ficheiro incompleto não pôde ser removido.", cleanupError);
        }
      }
      throw error;
    }
  }

  async function pruneBackupHistory(limit = DRIVE_BACKUP_LIMIT) {
    const query = `appProperties has { key='rolosBackupKind' and value='${DRIVE_FILE_MARKER}' } and trashed=false`;
    const files = await listFiles(query, { orderBy: "createdTime desc" });
    const plan = driveRetentionPlan(files, limit);
    await Promise.all(plan.remove.map((file) => request(
      `${DRIVE_API_URL}/files/${encodeURIComponent(file.id)}?fields=id,trashed`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({ trashed: true }),
      }
    )));
    return plan;
  }

  return {
    ensureBackupFolder,
    uploadWeeklyBackup,
    pruneBackupHistory,
  };
}

async function uploadResumableFile(fetchImpl, accessToken, fileId, content) {
  const initUrl = `${DRIVE_UPLOAD_URL}/files/${encodeURIComponent(fileId)}?uploadType=resumable&fields=id,name,webViewLink,createdTime,modifiedTime`;
  const initResponse = await driveAuthorizedFetch(fetchImpl, initUrl, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "application/json; charset=UTF-8",
    },
    body: "{}",
  }, accessToken);
  if (!initResponse.ok) await readDriveResponse(initResponse);

  const sessionUrl = initResponse.headers?.get?.("Location");
  if (!sessionUrl) throw new Error("O Google Drive não iniciou o envio seguro do backup.");

  return driveApiRequest(fetchImpl, sessionUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: content,
  }, accessToken);
}

async function driveApiRequest(fetchImpl, url, options, accessToken) {
  const response = await driveAuthorizedFetch(fetchImpl, url, options, accessToken);
  return readDriveResponse(response);
}

async function driveAuthorizedFetch(fetchImpl, url, options, accessToken) {
  return fetchImpl(url, {
    ...options,
    headers: {
      ...(options?.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

async function readDriveResponse(response) {
  const raw = await response.text();
  let body = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
  }
  if (!response.ok) {
    const error = new Error(body?.error?.message || `Google Drive respondeu com o código ${response.status}.`);
    error.status = response.status;
    error.reason = body?.error?.errors?.[0]?.reason || "";
    throw error;
  }
  return body;
}

function utf8ByteLength(value) {
  return new TextEncoder().encode(String(value ?? "")).byteLength;
}

function driveQueryLiteral(value) {
  return String(value || "").replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}
