/**
 * IPC handlers for snapshot and asset sync actions.
 * @namespace backend.handlers.snapshotHandlers
 * @memberof backend.handlers
 */
import { getP2PProvider, startP2PForProject, stopP2PForProject } from '../services/p2pService.js';
import { stopProjectTorrents, getProjectSyncStatus, scheduleAssetReconcile } from '../services/assetTorrentManagerService.js';
import {
  createProjectSnapshot,
  hydrateProjectFromLatestSnapshot
} from '../services/snapshotService.js';
import {
  listRecoverySnapshots,
  createRecoverySnapshot,
  restoreRecoverySnapshot,
  deleteRecoverySnapshot
} from '../services/recoverySnapshotService.js';
import { clearDelayedReconcileStart, scheduleDelayedReconcileStart, isProjectShared } from '../services/projectRuntimeService.js';

/**
 * Create a P2P sync snapshot for the project.
 * @memberof backend.handlers.snapshotHandlers
 * @param {Electron.IpcMainInvokeEvent} _event
 * @param {string} projectId
 * @returns {Promise.<{success: boolean, result: (Object|undefined), error: (string|undefined)}>}
 */
export async function handleCreateSnapshot(_event, projectId) {
  try {
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('snapshot-create requires a valid projectId');
    }

    const result = await createProjectSnapshot(projectId);
    return { success: true, result };
  } catch (error) {
    console.error('Error in snapshot:create:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Stop P2P before hydrating to avoid write conflicts, then restore it afterwards.
 * @memberof backend.handlers.snapshotHandlers
 * @param {Electron.IpcMainInvokeEvent} _event
 * @param {string} projectId
 * @returns {Promise.<{success: boolean, result: (Object|undefined), error: (string|undefined)}>}
 */
export async function handleHydrateSnapshot(_event, projectId) {
  try {
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('snapshot-hydrate requires a valid projectId');
    }

    const wasRunning = !!getP2PProvider(projectId);
    if (wasRunning) {
      await stopP2PForProject(projectId);
    }

    const result = await hydrateProjectFromLatestSnapshot(projectId);

    const sharedProject = await isProjectShared(projectId);
    if (wasRunning && sharedProject) {
      await startP2PForProject(projectId, { skipHydration: true });
    }

    return { success: true, result };
  } catch (error) {
    console.error('Error in snapshot-hydrate:', error);
    return { success: false, error: error.message };
  }
}

/**
 * List the most recent recovery snapshots for a project.
 * @memberof backend.handlers.snapshotHandlers
 * @param {Electron.IpcMainInvokeEvent} _event
 * @param {string} projectId
 * @returns {Promise.<{success: boolean, snapshots: (Array.<Object>|undefined), error: (string|undefined)}>}
 */
export async function handleListRecoverySnapshots(_event, projectId) {
  try {
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('recovery-snapshots-list requires a valid projectId');
    }

    const snapshots = await listRecoverySnapshots(projectId, { limit: 10 });
    return { success: true, snapshots };
  } catch (error) {
    console.error('Error in recovery-snapshots-list:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Manually create a recovery snapshot for a project.
 * @memberof backend.handlers.snapshotHandlers
 * @param {Electron.IpcMainInvokeEvent} _event
 * @param {string|Object} payload - Project ID or payload containing `projectId` and optional `reason`.
 * @returns {Promise.<{success: boolean, snapshot: (Object|undefined), error: (string|undefined)}>}
 */
export async function handleCreateRecoverySnapshot(_event, payload) {
  try {
    const projectId = typeof payload === 'string' ? payload : payload?.projectId;
    const reason = typeof payload === 'string' ? null : payload?.reason ?? null;

    if (!projectId || typeof projectId !== 'string') {
      throw new Error('recovery-snapshots-create requires a valid projectId');
    }

    const snapshot = await createRecoverySnapshot(projectId, {
      trigger: 'manual',
      reason,
      isAutomatic: false,
    });

    return { success: true, snapshot };
  } catch (error) {
    console.error('Error in recovery-snapshots-create:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Stop P2P and torrents before restoring, restart afterwards, then broadcast data change.
 * @memberof backend.handlers.snapshotHandlers
 * @param {Electron.IpcMainInvokeEvent} event
 * @param {Object} payload - Payload containing `projectId` and `snapshotId`.
 * @param {Object} notifiers - Notification callbacks injected from the main process.
 *   BrowserWindow-dependent callback injected from the main process.
 * @returns {Promise.<{success: boolean, result: (Object|undefined), error: (string|undefined)}>}
 */
export async function handleRestoreRecoverySnapshot(event, payload, { notifyProjectDataChanged }) {
  try {
    const { projectId, snapshotId } = payload;

    if (!projectId || typeof projectId !== 'string') {
      throw new Error('recovery-snapshots-restore requires a valid projectId');
    }
    if (!snapshotId || typeof snapshotId !== 'string') {
      throw new Error('recovery-snapshots-restore requires a valid snapshotId');
    }

    clearDelayedReconcileStart(projectId);
    const hadProvider = !!getP2PProvider(projectId);

    await stopProjectTorrents(projectId);
    if (hadProvider) {
      await stopP2PForProject(projectId);
    }

    const result = await restoreRecoverySnapshot(projectId, snapshotId);

    const sharedProject = await isProjectShared(projectId);
    if (hadProvider && sharedProject) {
      await startP2PForProject(projectId, { skipHydration: true });
    }

    scheduleDelayedReconcileStart(projectId);
    notifyProjectDataChanged(event, projectId, 'recovery-snapshot-restore');

    return { success: true, result };
  } catch (error) {
    console.error('Error in recovery-snapshots-restore:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a recovery snapshot by ID.
 * @memberof backend.handlers.snapshotHandlers
 * @param {Electron.IpcMainInvokeEvent} _event
 * @param {Object} payload - Payload containing `projectId` and `snapshotId`.
 * @returns {Promise.<{success: boolean, result: (Object|undefined), error: (string|undefined)}>}
 */
export async function handleDeleteRecoverySnapshot(_event, payload) {
  try {
    const { projectId, snapshotId } = payload;

    if (!projectId || typeof projectId !== 'string') {
      throw new Error('recovery-snapshots-delete requires a valid projectId');
    }
    if (!snapshotId || typeof snapshotId !== 'string') {
      throw new Error('recovery-snapshots-delete requires a valid snapshotId');
    }

    const result = await deleteRecoverySnapshot(projectId, snapshotId);
    return { success: true, result };
  } catch (error) {
    console.error('Error in recovery-snapshots-delete:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Return the current asset sync status for a project.
 * @memberof backend.handlers.snapshotHandlers
 * @param {Electron.IpcMainInvokeEvent} _event
 * @param {string} projectId
 * @returns {Promise.<{success: boolean, status: (Object|undefined), error: (string|undefined)}>}
 */
export async function handleGetAssetSyncStatus(_event, projectId) {
  try {
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('asset-sync-status requires a valid projectId');
    }

    const status = await getProjectSyncStatus(projectId);
    return { success: true, status };
  } catch (error) {
    console.error('Error in asset-sync-status:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Schedule an asset reconcile job for a project.
 * @memberof backend.handlers.snapshotHandlers
 * @param {Electron.IpcMainInvokeEvent} _event
 * @param {string|Object} payload - Project ID or payload containing `projectId` and optional `assetId`.
 * @returns {Promise.<{success: boolean, error: (string|undefined)}>}
 */
export async function handleTriggerAssetReconcile(_event, payload) {
  try {
    const projectId = typeof payload === 'string' ? payload : payload?.projectId;
    const assetId = typeof payload === 'string' ? null : payload?.assetId ?? null;

    if (!projectId || typeof projectId !== 'string') {
      throw new Error('asset-sync-reconcile requires a valid projectId');
    }

    scheduleAssetReconcile(projectId, assetId);
    return { success: true };
  } catch (error) {
    console.error('Error in asset-sync-reconcile:', error);
    return { success: false, error: error.message };
  }
}
