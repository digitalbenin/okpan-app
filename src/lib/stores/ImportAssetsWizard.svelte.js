import { getContext, setContext } from 'svelte';
import { getObjectIdentifier } from '$lib/utils/objects.js';
import { deleteAssetsBulk } from '$lib/stores/AssetsUtils.js';

const IMPORT_WIZARD_KEY = 'importAssetsWizard';

export function createImportAssetsWizardContext(params) {
    let steps = $state([
        { id: 1, t: 'select-institution', fallback: 'Select Institution' },
        { id: 2, t: 'upload-assets', fallback: 'Add your asset files' },
        { id: 3, t: 'match-assets', fallback: 'Match your assets' },
        { id: 4, t: 'review-save', fallback: 'Review and Save' }
    ]);
    let currentStep = $state(1);
    let nextEnabled = $state(false);
    let projectId = $state(params?.projectId);
    let institutionId = $state(null);
    let assets = $state([]);
    let mapping = $state([])
    let importCompleted = $state(false);
    let isCleaningUp = $state(false);
    // let useMatchingSuggestions = $state(false);
    // let formData = $state({});
    // let isValid = $state(false);
    // let errors = $state([]);

    const cleanupImportedAssets = async () => {
        if (isCleaningUp) {
            return { successes: [], errors: [] };
        }

        const importedAssetIds = (assets || []).map((asset) => asset?.id).filter(Boolean);

        if (!importedAssetIds.length) {
            mapping = [];
            nextEnabled = false;
            return { successes: [], errors: [] };
        }

        isCleaningUp = true;
        try {
            const result = await deleteAssetsBulk(importedAssetIds);
            return result;
        } catch (error) {
            console.error('Failed to delete imported assets:', error);
            return {
                successes: [],
                errors: [{ error: error?.message || 'Failed to delete imported assets' }]
            };
        } finally {
            assets = [];
            mapping = [];
            nextEnabled = false;
            isCleaningUp = false;
        }
    };

    const context = {
        // Getters and setters for reactive state
        get currentStep() { return currentStep; },
        set currentStep(value) { currentStep = value; },

        get steps() { return steps; },
        set steps(value) { steps = value; },

        get nextEnabled() { return nextEnabled; },
        set nextEnabled(value) { nextEnabled = value; },

        get projectId() { return projectId; },
        set projectId(value) { projectId = value; },

        get assets() { return assets; },
        set assets(value) { assets = value; },

        get institutionId() { return institutionId; },
        set institutionId(value) { institutionId = value; },

        // get datasourceId() { return datasourceId; },
        // set datasourceId(value) { datasourceId = value; },

        // get mappingId() { return mappingId; },
        // set mappingId(value) { mappingId = value; },

        // get file() { return file; },
        // set file(value) { file = value; },

        get mapping() { return mapping; },
        set mapping(value) { mapping = value; },

        get importCompleted() { return importCompleted; },
        set importCompleted(value) { importCompleted = value; },

        get isCleaningUp() { return isCleaningUp; },
        set isCleaningUp(value) { isCleaningUp = value; },

        // get data() { return data; },
        // set data(value) { data = value; },

        // get useMatchingSuggestions() { return useMatchingSuggestions; },
        // set useMatchingSuggestions(value) { useMatchingSuggestions = value; },

        // get useMatchingTemplate() { return useMatchingTemplate; },
        // set useMatchingTemplate(value) { useMatchingTemplate = value; },

        // get reusedTemplate() { return reusedTemplate; },
        // set reusedTemplate(value) {
        //     if (value?.mapping) {
        //         mapping = value.mapping;
        //     }
        //     reusedTemplate = value;
        // },

        // get formData() { return formData; },
        // set formData(value) { formData = value; },

        // get isValid() { return isValid; },
        // set isValid(value) { isValid = value; },

        // get errors() { return errors; },
        // set errors(value) { errors = value; },

        // Helper methods
        addMappingEntry(object, assetId) {
            const existingIndex = mapping.findIndex(e => e.asset_id === assetId);
            mapping[existingIndex].object_ids.push(object.id);
            mapping[existingIndex].objects_primary_ids.push(getObjectIdentifier(object));

        },
        removeMappingEntry(object, assetId) {
            const existingIndex = mapping.findIndex(e => e.asset_id === assetId);
            mapping[existingIndex].object_ids = mapping[existingIndex].object_ids.filter(id => id !== object.id);
            mapping[existingIndex].objects_primary_ids = mapping[existingIndex].objects_primary_ids.filter(id => id !== getObjectIdentifier(object));
        },
        // setMappingIdentifier(id) {
        //     mapping = mapping.map((entry) => {
        //         if (entry.mappedField !== id) {
        //             entry.primary = false;
        //         } else {
        //             entry.primary = true;
        //         }
        //         return entry;
        //     });
        // },
        nextStep() {
            currentStep++;
            nextEnabled = false;
        },

        prevStep() {
            if (currentStep > 1) currentStep--;
        },

        cleanupImportedAssets,

        async goBackOneStep() {
            if (isCleaningUp || currentStep <= 1) return;

            const targetStep = currentStep - 1;

            if (!importCompleted && targetStep < 2 && (assets || []).length) {
                await cleanupImportedAssets();
            }

            currentStep = targetStep;
        },

        clearFlowState() {
            currentStep = 1;
            nextEnabled = false;
            institutionId = null;
            assets = [];
            mapping = [];
            importCompleted = false;
        },

        // updateFormData(newData) {
        //     formData = { ...formData, ...newData };
        // },

        reset() {
            currentStep = 1;
            importCompleted = false;
            nextEnabled = false;
            institutionId = null;
            assets = [];
            mapping = [];
            // formData = {};
            // isValid = false;
            // errors = [];
        }
    };

    setContext(IMPORT_WIZARD_KEY, context);
    return context;
}

export function getImportAssetsWizardContext() {
    return getContext(IMPORT_WIZARD_KEY);
}