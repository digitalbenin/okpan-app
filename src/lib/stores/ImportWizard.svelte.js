import { getContext, setContext } from 'svelte';

const IMPORT_WIZARD_KEY = 'importWizard';

export function createImportWizardContext(params) {
    let steps = $state([
        { id: 1, t: 'give-datasource-name', fallback: 'Give Data Source Name' },
        { id: 2, t: 'upload-data', fallback: 'Add your data file' },
        { id: 3, t: 'match-data', fallback: 'Match your data' },
        { id: 4, t: 'choose-id', fallback: 'Choose your object identifier' },
        { id: 5, t: 'review-save', fallback: 'Review and Save' }
    ]);
    let currentStep = $state(1);
    let nextEnabled = $state(false);
    let projectId = $state(params?.projectId);
    let datasourceId = $state();
    let mappingId = $state();
    let file = $state();
    let mapping = $state([])
    let data = $state([])
    let useMatchingSuggestions = $state(false);
    let reusedTemplate = $state();
    // let formData = $state({});
    // let isValid = $state(false);
    // let errors = $state([]);

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

        get datasourceId() { return datasourceId; },
        set datasourceId(value) { datasourceId = value; },

        get mappingId() { return mappingId; },
        set mappingId(value) { mappingId = value; },

        get file() { return file; },
        set file(value) { file = value; },

        get mapping() { return mapping; },
        set mapping(value) { mapping = value; },

        get data() { return data; },
        set data(value) { data = value; },

        get useMatchingSuggestions() { return useMatchingSuggestions; },
        set useMatchingSuggestions(value) { useMatchingSuggestions = value; },

        get reusedTemplate() { return reusedTemplate; },
        set reusedTemplate(value) { reusedTemplate = value; },

        // get formData() { return formData; },
        // set formData(value) { formData = value; },

        // get isValid() { return isValid; },
        // set isValid(value) { isValid = value; },

        // get errors() { return errors; },
        // set errors(value) { errors = value; },

        // Helper methods
        addMappingEntry(entry) {
            const existingIndex = mapping.findIndex(e => e.headerField === entry.headerField);
            if (existingIndex !== -1) {
                mapping[existingIndex] = entry;
            } else {
                mapping = [...mapping, entry];
            }
        },
        removeMappingEntry(entry) {
            mapping = mapping.filter(e => e.headerField !== entry.headerField);
        },
        setMappingIdentifier(id) {
            mapping = mapping.map((entry) => {
                if (entry.mappedField !== id) {
                    entry.primary = false;
                } else {
                    entry.primary = true;
                }
                return entry;
            });
        },
        nextStep() {
            currentStep++;
            nextEnabled = false;
        },

        prevStep() {
            if (currentStep > 1) currentStep--;
        },

        // updateFormData(newData) {
        //     formData = { ...formData, ...newData };
        // },

        reset() {
            currentStep = 1;
            // formData = {};
            // isValid = false;
            // errors = [];
        }
    };

    setContext(IMPORT_WIZARD_KEY, context);
    return context;
}

export function getImportWizardContext() {
    return getContext(IMPORT_WIZARD_KEY);
}