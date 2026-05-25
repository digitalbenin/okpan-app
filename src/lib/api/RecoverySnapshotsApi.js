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