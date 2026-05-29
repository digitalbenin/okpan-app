/**
 * @namespace frontend.api.RecoverySnapshotsApi
 */

/**
 * Lists all recovery snapshots for a project.
 * @memberOf frontend.api.RecoverySnapshotsApi
 * @method
 * @param {string} projectId - The project ID.
 * @returns {Promise.<{success: boolean, snapshots: Array.<Object>, error: (string|undefined)}>}
 */
export const getRecoverySnapshots = async (projectId) => {
    if (!projectId) {
        return { success: false, snapshots: [], error: "Project ID is required" };
    }

    const result = await window.api.listRecoverySnapshots(projectId);
    if (!result?.success) {
        return {
            success: false,
            snapshots: [],
            error: result?.error || "Failed to load recovery snapshots."
        };
    }

    return {
        success: true,
        snapshots: result.snapshots || []
    };
};

/**
 * Creates a new recovery snapshot for a project.
 * @memberOf frontend.api.RecoverySnapshotsApi
 * @method
 * @param {string} projectId - The project ID.
 * @param {string|null} [reason=null] - Human-readable reason for the snapshot.
 * @returns {Promise.<{success: boolean, snapshot: (Object|undefined), error: (string|undefined)}>}
 */
export const createProjectRecoverySnapshot = async (projectId, reason) => {
    if (!projectId) {
        return { success: false, error: "Project ID is required" };
    }

    const result = await window.api.createRecoverySnapshot(projectId, reason);
    if (!result?.success) {
        return {
            success: false,
            error: result?.error || "Failed to create recovery snapshot."
        };
    }

    return result;
};

/**
 * Restores the project database from a recovery snapshot.
 * @memberOf frontend.api.RecoverySnapshotsApi
 * @method
 * @param {string} projectId - The project ID.
 * @param {string} snapshotId - The snapshot ID to restore.
 * @returns {Promise.<{success: boolean, result: (Object|undefined), error: (string|undefined)}>}
 */
export const restoreProjectRecoverySnapshot = async (projectId, snapshotId) => {
    if (!projectId) {
        return { success: false, error: "Project ID is required" };
    }

    if (!snapshotId) {
        return { success: false, error: "Snapshot ID is required" };
    }

    const result = await window.api.restoreRecoverySnapshot(projectId, snapshotId);
    if (!result?.success) {
        return {
            success: false,
            error: result?.error || "Failed to restore recovery snapshot."
        };
    }

    return result;
};

/**
 * Permanently deletes a recovery snapshot.
 * @memberOf frontend.api.RecoverySnapshotsApi
 * @method
 * @param {string} projectId - The project ID.
 * @param {string} snapshotId - The snapshot ID to delete.
 * @returns {Promise.<{success: boolean, result: (Object|undefined), error: (string|undefined)}>}
 */
export const deleteProjectRecoverySnapshot = async (projectId, snapshotId) => {
    if (!projectId) {
        return { success: false, error: "Project ID is required" };
    }

    if (!snapshotId) {
        return { success: false, error: "Snapshot ID is required" };
    }

    const result = await window.api.deleteRecoverySnapshot(projectId, snapshotId);
    if (!result?.success) {
        return {
            success: false,
            error: result?.error || "Failed to delete recovery snapshot."
        };
    }

    return result;
};