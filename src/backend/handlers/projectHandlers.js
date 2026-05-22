/**
 * IPC handlers for project P2P lifecycle operations.
 * @namespace backend.handlers.projectHandlers
 * @memberof backend.handlers
 */
import {
  startP2PForProject,
  stopP2PForProject,
  getP2PProvider,
  getProjectPeersCount,
  setPendingProjectPassword
} from '../services/p2pService.js';
import { stopProjectTorrents } from '../services/assetTorrentManagerService.js';
import { db } from '../../db/init.js';
import { project } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import {
  pendingProjectJoins,
  reconnectP2PJobs,
  clearDelayedReconcileStart,
  scheduleDelayedReconcileStart,
  isProjectShared
} from '../services/projectRuntimeService.js';

/**
 * Set a project's password in the DB and mark it as pending for P2P negotiation.
 * @memberof backend.handlers.projectHandlers
 * @param {Electron.IpcMainInvokeEvent} _event
 * @param {Object} payload - Payload containing `projectId` and `password`.
 * @returns {Promise.<{success: boolean, error: (string|undefined)}>}
 */
export async function handleSetProjectPassword(_event, { projectId, password }) {
  try {
    await db.update(project).set({ password }).where(eq(project.id, projectId)).execute();
    setPendingProjectPassword(projectId, password || null);
    return { success: true };
  } catch (err) {
    console.error('[P2P] Failed to set password:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Prepare a project to be joined via P2P: stop existing sessions so the next
 * runtime bootstrap picks up the new password and peer list.
 * @memberof backend.handlers.projectHandlers
 * @param {Electron.IpcMainInvokeEvent} _event
 * @param {Object} payload - Payload containing `projectId` and optional `password`.
 * @returns {Promise.<{success: boolean, projectId: (string|undefined), error: (string|undefined)}>}
 */
export async function handleJoinP2P(_event, { projectId, password }) {
  try {
    pendingProjectJoins.add(projectId);
    setPendingProjectPassword(projectId, password || null);
    clearDelayedReconcileStart(projectId);
    await stopProjectTorrents(projectId);
    await stopP2PForProject(projectId);
    return { success: true, projectId };
  } catch (err) {
    console.error('[P2P] Failed to join P2P project:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Suspend P2P and asset sync for a project without removing it from the DB.
 * @memberof backend.handlers.projectHandlers
 * @param {Electron.IpcMainInvokeEvent} _event
 * @param {string} projectId
 * @returns {Promise.<{success: boolean, error: (string|undefined)}>}
 */
export async function handleSuspendP2P(_event, projectId) {
  try {
    if (!projectId) {
      return { success: false, error: 'No projectId provided' };
    }

    clearDelayedReconcileStart(projectId);
    await stopProjectTorrents(projectId);

    if (getP2PProvider(projectId)) {
      await stopP2PForProject(projectId);
    }

    return { success: true };
  } catch (err) {
    console.error('[P2P] Failed to suspend P2P project:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Reconnect P2P for a project. Deduplicates concurrent calls via a job map so
 * rapid re-triggers don't start multiple concurrent reconnect flows.
 * @memberof backend.handlers.projectHandlers
 * @param {Electron.IpcMainInvokeEvent} event
 * @param {string|Object} payload - Project ID or payload containing `projectId` and optional `password`.
 * @param {Object} notifiers - Notification callbacks injected from the main process.
 *   BrowserWindow-dependent callbacks injected from the main process.
 * @returns {Promise.<{success: boolean, projectId: (string|undefined), skipped: (boolean|undefined), reason: (string|undefined), error: (string|undefined)}>}
 */
export async function handleReconnectP2P(event, payload, { notifyProjectDataChanged, notifyProjectPresence }) {
  const projectId = typeof payload === 'string' ? payload : payload?.projectId;
  const passwordOverride = typeof payload === 'string' ? undefined : payload?.password;

  if (reconnectP2PJobs.has(projectId)) {
    console.log('[P2P] reconnect request deduped', { projectId });
    return reconnectP2PJobs.get(projectId);
  }

  const reconnectJob = (async () => {
    try {
      if (!projectId) {
        return { success: false, error: 'No projectId provided' };
      }

      const sharedProject = await isProjectShared(projectId);

      console.log('[P2P] reconnect requested', {
        projectId,
        sharedProject,
        hadProvider: !!getP2PProvider(projectId),
        hasPasswordOverride: passwordOverride !== undefined,
      });

      clearDelayedReconcileStart(projectId);

      if (passwordOverride !== undefined) {
        setPendingProjectPassword(projectId, passwordOverride || null);
      }

      const wasRunning = !!getP2PProvider(projectId);
      await stopProjectTorrents(projectId);
      if (wasRunning) {
        await stopP2PForProject(projectId);
      }

      if (!sharedProject) {
        return { success: true, skipped: true, reason: 'project-is-private' };
      }

      await startP2PForProject(projectId, {
        onDataChange: () => notifyProjectDataChanged(event, projectId, 'p2p'),
        skipHydration: true,
      });

      notifyProjectPresence(event, projectId);
      scheduleDelayedReconcileStart(projectId);

      console.log('[P2P] reconnect completed', {
        projectId,
        hadProvider: wasRunning,
        hasProvider: !!getP2PProvider(projectId),
        peers: getProjectPeersCount(projectId)
      });

      return { success: true };
    } catch (err) {
      console.error('[P2P] Failed to reconnect P2P project:', err);
      return { success: false, error: err.message };
    } finally {
      reconnectP2PJobs.delete(projectId);
    }
  })();

  reconnectP2PJobs.set(projectId, reconnectJob);
  return reconnectJob;
}
