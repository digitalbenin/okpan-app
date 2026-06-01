/**
 * Dirty Tracker - Tracks form data changes using deep equality
 * Detects when user modifies any data and provides dirty state
 */

import { diff } from '@opentf/obj-diff';

/**
 * Serializes data for comparison (normalizes structure)
 */
function serializeData(data) {
    if (data == null) return null;

    try {
        return JSON.parse(JSON.stringify(data));
    } catch {
        return data;
    }
}

class DirtyTracker {
    pristineData = $state(null);
    currentData = $state(null);

    get isDirty() {
        if (this.pristineData === null || this.currentData === null) return false;
        return diff(this.pristineData, this.currentData).length > 0;
    }

    constructor(initialData = null) {
        const serialized = serializeData(initialData);
        this.pristineData = serialized;
        this.currentData = serialized;
    }

    /**
     * Update current data and check for changes
     */
    update(newData) {
        this.currentData = serializeData(newData);
    }

    /**
     * Mark current state as pristine (after successful save)
     */
    markPristine() {
        this.pristineData = serializeData(this.currentData);
    }

    /**
     * Reset to pristine state (revert changes)
     */
    reset() {
        this.currentData = serializeData(this.pristineData);
    }

    /**
     * Update pristine baseline without marking dirty
     */
    setPristine(newPristineData) {
        const serialized = serializeData(newPristineData);
        this.pristineData = serialized;
        this.currentData = serialized;
    }
}

/**
 * Creates a dirty tracker for form data
 * @param {Object} options - Configuration options
 * @param {*} options.initialData - Initial/pristine state of the data
 * @returns {DirtyTracker} Dirty tracker instance
 */
export function createDirtyTracker(options = {}) {
    return new DirtyTracker(options.initialData);
}
