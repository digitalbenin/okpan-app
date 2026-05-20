import { db } from '../../db/init.js';
import { project } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { isSharedProject as checkIsSharedProject } from '../../lib/utils/projectSharing.js';
import { startP2PForProject, stopP2PForProject, getP2PProvider } from './p2pService.js';
import { startReconcileLoop, stopProjectTorrents } from './assetTorrentManagerService.js';
import { startChangeLogTailer } from './changeLogTailerService.js';
import { hydrateProjectFromDatabase } from './snapshotService.js';
import { prepareSessionOpenRecoverySnapshot } from './recoverySnapshotService.js';

// ─── Runtime State ────────────────────────────────────────────────────────────
// These maps/sets track in-flight async jobs and per-project lifecycle state so
// that concurrent IPC calls are safely deduplicated or cancelled.

export const openedProjectsThisSession = new Set();
export const sessionOpenSnapshotJobs = new Map();
export const pendingProjectJoins = new Set();
export const reconnectP2PJobs = new Map();

const delayedReconcileStarts = new Map();
let changeLogTailerStarted = false;

// ─── Delayed asset-reconcile scheduling ───────────────────────────────────────

export function clearDelayedReconcileStart(projectId) {
  const timer = delayedReconcileStarts.get(projectId);
  if (timer) {
    clearTimeout(timer);
    delayedReconcileStarts.delete(projectId);
  }
}

/**
 * Start the asset-reconcile loop for a project after a short debounce delay.
 * Debouncing avoids redundant reconcile starts when P2P connects quickly after
 * a stop/start cycle (e.g. password change, reconnect).
 */
export function scheduleDelayedReconcileStart(projectId) {
  if (!projectId) return;

  clearDelayedReconcileStart(projectId);

  const timer = setTimeout(() => {
    delayedReconcileStarts.delete(projectId);
    try {
      startReconcileLoop(projectId);
    } catch (err) {
      console.error('Failed to start asset reconcile loop for project', projectId, err);
    }
  }, 5000);

  delayedReconcileStarts.set(projectId, timer);
}

// ─── Project sharing check ────────────────────────────────────────────────────

export async function isProjectShared(projectId) {
  if (!projectId) return false;

  const rows = await db
    .select({ is_shared: project.is_shared })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1)
    .execute();

  return checkIsSharedProject(rows[0]);
}

// ─── Session-open recovery snapshot ──────────────────────────────────────────

/**
 * Capture a "session-open" recovery snapshot the first time a project is
 * opened in a session. Deduplicates concurrent calls with a job map.
 */
export async function ensureSessionOpenRecoverySnapshot(projectId) {
  if (!projectId || openedProjectsThisSession.has(projectId)) return null;
  if (sessionOpenSnapshotJobs.has(projectId)) return sessionOpenSnapshotJobs.get(projectId);

  const job = (async () => {
    try {
      const prepared = await prepareSessionOpenRecoverySnapshot(projectId, {
        trigger: 'session-open',
        reason: 'Automatic recovery snapshot captured before the first sync after opening this project in a new app session.',
        isAutomatic: true,
      });
      openedProjectsThisSession.add(projectId);
      prepared?.packagingJob?.catch(() => {});
      return prepared;
    } catch (error) {
      console.warn('[RecoverySnapshot] Failed to prepare session-open snapshot', { projectId, error: error?.message });
      return null;
    } finally {
      sessionOpenSnapshotJobs.delete(projectId);
    }
  })();

  sessionOpenSnapshotJobs.set(projectId, job);
  return job;
}

// ─── Project runtime bootstrap ────────────────────────────────────────────────

/**
 * Start all runtime services for a project (P2P, change log, asset sync).
 * Called when a project is set as the active one in the renderer.
 *
 * @param {Electron.IpcMainInvokeEvent} event
 * @param {string} projectId
 * @param {Object} options - Runtime options with optional `hydrateSnapshot` and `captureSessionSnapshot` flags.
 * @param {Object} notifiers - BrowserWindow-dependent notification callbacks (`notifyProjectDataChanged`, `notifyProjectPresence`).
 *   BrowserWindow-dependent notification callbacks injected from the main process.
 */
export async function bootstrapProjectRuntime(event, projectId, options = {}, { notifyProjectDataChanged, notifyProjectPresence }) {
  const { hydrateSnapshot = false, captureSessionSnapshot = false } = options;

  if (!projectId) return { success: false, error: 'No projectId provided' };

  const sharedProject = await isProjectShared(projectId);
  const isPendingRemoteJoin = pendingProjectJoins.has(projectId);

  if (hydrateSnapshot && !getP2PProvider(projectId)) {
    try {
      await hydrateProjectFromDatabase(projectId);
    } catch (err) {
      console.error('Hydration failed for project', projectId, err);
    }
  }

  if (!changeLogTailerStarted) {
    startChangeLogTailer();
    changeLogTailerStarted = true;
  }

  if (captureSessionSnapshot) {
    await ensureSessionOpenRecoverySnapshot(projectId);
  }

  if (!sharedProject && !isPendingRemoteJoin) {
    clearDelayedReconcileStart(projectId);

    if (getP2PProvider(projectId)) {
      try {
        await stopProjectTorrents(projectId);
        await stopP2PForProject(projectId);
      } catch (err) {
        console.warn('Failed to stop P2P for private project', projectId, err);
      }
    }

    return { success: true, shared: false };
  }

  try {
    await startP2PForProject(projectId, {
      onDataChange: () => notifyProjectDataChanged(event, projectId, 'p2p'),
      skipHydration: true,
    });
    if (sharedProject) {
      pendingProjectJoins.delete(projectId);
    }
    notifyProjectPresence(event, projectId);
  } catch (err) {
    console.error('Failed to start P2P provider for project', projectId, err);
  }

  scheduleDelayedReconcileStart(projectId);

  return { success: true };
}
