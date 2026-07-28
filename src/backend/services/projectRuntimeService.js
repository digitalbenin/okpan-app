/**
 * Project runtime orchestration service that starts and stops P2P, change-log
 * tailing, and reconcile workflows for the active project.
 *
 * @namespace backend.services.projectRuntimeService
 * @memberof backend.services
 */
import { db } from '../../db/init.js';
import { project } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { startP2PForProject, stopP2PForProject, getP2PProvider } from './p2pService.js';
import { startReconcileLoop, stopProjectTorrents, resumeAssetSeeding } from './assetTorrentManagerService.js';
import { startChangeLogTailer } from './changeLogTailerService.js';
import { hydrateProjectFromDatabase } from './snapshotService.js';
import { prepareSessionOpenRecoverySnapshot } from './recoverySnapshotService.js';

// ─── Runtime State ────────────────────────────────────────────────────────────
// These maps/sets track in-flight async jobs and per-project lifecycle state so
// that concurrent IPC calls are safely deduplicated or cancelled.

/**
 * Projects already opened during the current app session.
 * @memberof backend.services.projectRuntimeService
 * @constant {Set<string>}
 */
export const openedProjectsThisSession = new Set();
/**
 * In-flight recovery snapshot jobs keyed by project id.
 * @memberof backend.services.projectRuntimeService
 * @constant {Map<string, Promise>}
 */
export const sessionOpenSnapshotJobs = new Map();
/**
 * Projects waiting to finish a remote join before local teardown runs.
 * @memberof backend.services.projectRuntimeService
 * @constant {Set<string>}
 */
export const pendingProjectJoins = new Set();
/**
 * In-flight reconnect jobs keyed by project id.
 * @memberof backend.services.projectRuntimeService
 * @constant {Map<string, Promise>}
 */
export const reconnectP2PJobs = new Map();

const delayedReconcileStarts = new Map();
let changeLogTailerStarted = false;

// ─── Delayed asset-reconcile scheduling ───────────────────────────────────────

/**
 * Cancel a delayed reconcile start for a project.
 * @memberof backend.services.projectRuntimeService
 * @param {string} projectId - Project identifier.
 * @returns {void}
 */
export function clearDelayedReconcileStart(projectId) {
  const timer = delayedReconcileStarts.get(projectId);
  if (timer) {
    clearTimeout(timer);
    delayedReconcileStarts.delete(projectId);
  }
}

/**
 * Schedule a delayed reconcile loop start for a project.
 * @memberof backend.services.projectRuntimeService
 * @param {string} projectId - Project identifier.
 * @returns {void}
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

/**
 * Check whether a project is shared.
 * @memberof backend.services.projectRuntimeService
 * @param {string} projectId - Project identifier.
 * @returns {Promise<boolean>}
 */
export async function isProjectShared(projectId) {
  if (!projectId) return false;

  const rows = await db
    .select({ is_shared: project.is_shared })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1)
    .execute();

  const row = rows[0];
  return row != null && (row.is_shared === 1 || row.is_shared === true);
}

// ─── Session-open recovery snapshot ──────────────────────────────────────────

/**
 * Capture the session-open recovery snapshot once per project per session.
 * @memberof backend.services.projectRuntimeService
 * @param {string} projectId - Project identifier.
 * @returns {Promise<Object|null>}
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
 * Start all runtime services for a project.
 * @memberof backend.services.projectRuntimeService
 * @param {Electron.IpcMainInvokeEvent} event - IPC event.
 * @param {string} projectId - Project identifier.
 * @param {Object} [options={}] - Runtime options.
 * @param {Object} notifiers - Renderer notification callbacks.
 * @returns {Promise<Object>}
 */
export async function bootstrapProjectRuntime(event, projectId, options = {}, { notifyProjectDataChanged, notifyProjectPresence }) {
  const { hydrateSnapshot = false, captureSessionSnapshot = false } = options;

  if (!projectId) return { success: false, error: 'No projectId provided' };

  const sharedProject = await isProjectShared(projectId);
  const isPendingRemoteJoin = pendingProjectJoins.has(projectId);

  console.log('[P2P] bootstrapProjectRuntime', {
    projectId,
    sharedProject,
    isPendingRemoteJoin,
    hasProvider: !!getP2PProvider(projectId),
  });

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

  // Skip snapshot for remote joins: the project doesn't exist locally yet,
  // so there is nothing to snapshot. It will be snapshotted on the next open.
  if (captureSessionSnapshot && !isPendingRemoteJoin) {
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

    // Torrent metadata must still be creatable for private projects so that
    // assets can be shared if the project is later promoted to shared.
    resumeAssetSeeding(projectId);

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
