/**
 * Dirty Tracker - Tracks form data changes using deep equality
 * Detects when user modifies any data and provides dirty state
 */

import { diff } from '@opentf/obj-diff';

/**
 * Creates a dirty tracker for form data
 * @param {Object} options - Configuration options
 * @param {*} options.initialData - Initial/pristine state of the data
 * @returns {Object} Dirty tracker instance
 */
export function createDirtyTracker(options = {}) {
    let pristineData = $state(serializeData(options.initialData || null));
    let currentData = $state(serializeData(options.initialData || null));
    
    const isDirty = $derived.by(() => {
        if (pristineData === null || currentData === null) return false;
        
        const differences = diff(pristineData, currentData);
        return differences.length > 0;
    });

    return {
        get isDirty() {
            return isDirty;
        },

        get pristineData() {
            return pristineData;
        },

        get currentData() {
            return currentData;
        },

        /**
         * Update current data and check for changes
         */
        update(newData) {
            currentData = serializeData(newData);
        },

        /**
         * Mark current state as pristine (after successful save)
         */
        markPristine() {
            pristineData = serializeData(currentData);
        },

        /**
         * Reset to pristine state (revert changes)
         */
        reset() {
            currentData = serializeData(pristineData);
        },

        /**
         * Update pristine baseline without marking dirty
         */
        setPristine(newPristineData) {
            pristineData = serializeData(newPristineData);
            currentData = serializeData(newPristineData);
        }
    };
}

/**
 * Serializes data for comparison (normalizes structure)
 */
function serializeData(data) {
    if (data == null) return null;
    
    try {
        // JSON round-trip to normalize data structure
        return JSON.parse(JSON.stringify(data));
    } catch {
        return data;
    }
}
