import { diff } from '@opentf/obj-diff';

function serializeData(data) {
    if (data == null) return null;
    try {
        return JSON.parse(JSON.stringify(data));
    } catch {
        return data;
    }
}

export function createDirtyTracker(options = {}) {
    let pristineData = $state(null);
    let currentData = $state(null);

    const serialized = serializeData(options.initialData);
    pristineData = serialized;
    currentData = serialized;

    return {
        get pristineData() { return pristineData; },
        get currentData() { return currentData; },
        get isDirty() {
            if (pristineData === null || currentData === null) return false;
            return diff(pristineData, currentData).length > 0;
        },
        update(newData) { currentData = serializeData(newData); },
        markPristine() { pristineData = serializeData(currentData); },
        reset() { currentData = serializeData(pristineData); },
        setPristine(newPristineData) {
            const s = serializeData(newPristineData);
            pristineData = s;
            currentData = s;
        }
    };
}
