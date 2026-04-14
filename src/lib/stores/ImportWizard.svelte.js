import { getContext, setContext } from 'svelte';

const IMPORT_WIZARD_KEY = 'importWizard';

function normalizeMappingEntry(entry, defaults = {}) {
    return {
        ...defaults,
        ...(entry || {}),
        included: entry?.included ?? defaults.included ?? true,
        mappingSource: entry?.mappingSource ?? defaults.mappingSource ?? null,
        primary: entry?.primary ? 1 : 0,
    };
}

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
    let saving = $state(false);
    let projectId = $state(params?.projectId);
    let datasourceId = $state();
    let mappingId = $state();
    let file = $state();
    let mapping = $state([])
    let data = $state([])
    let detectedPreset = $state(null);
    let availablePresets = $state([]);
    let parserWarnings = $state([]);
    let prefilledMapping = $state([]);
    let useMatchingSuggestions = $state(false);
    let reusedTemplate = $state();
    let useMatchingTemplate = $state(false);
    let importCompleted = $state(false);
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

        get saving() { return saving; },
        set saving(value) { saving = value; },

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

        get activeMapping() {
            return mapping.filter((entry) => entry?.included !== false);
        },

        get data() { return data; },
        set data(value) { data = value; },

        get detectedPreset() { return detectedPreset; },
        set detectedPreset(value) { detectedPreset = value; },

        get availablePresets() { return availablePresets; },
        set availablePresets(value) { availablePresets = value; },

        get parserWarnings() { return parserWarnings; },
        set parserWarnings(value) { parserWarnings = value; },

        get prefilledMapping() { return prefilledMapping; },
        set prefilledMapping(value) { prefilledMapping = value; },

        get useMatchingSuggestions() { return useMatchingSuggestions; },
        set useMatchingSuggestions(value) { useMatchingSuggestions = value; },

        get useMatchingTemplate() { return useMatchingTemplate; },
        set useMatchingTemplate(value) { useMatchingTemplate = value; },

        get importCompleted() { return importCompleted; },
        set importCompleted(value) { importCompleted = value; },

        get reusedTemplate() { return reusedTemplate; },
        set reusedTemplate(value) {
            if (value?.mapping) {
                mapping = value.mapping.map((entry) => normalizeMappingEntry(entry, {
                    included: true,
                    mappingSource: 'template',
                }));
            }
            reusedTemplate = value;
        },

        // get formData() { return formData; },
        // set formData(value) { formData = value; },

        // get isValid() { return isValid; },
        // set isValid(value) { isValid = value; },

        // get errors() { return errors; },
        // set errors(value) { errors = value; },

        // Helper methods
        addMappingEntry(entry) {
            const existingIndex = mapping.findIndex(e => e.headerField === entry.headerField);
            const normalizedEntry = normalizeMappingEntry(entry, {
                included: true,
                mappingSource: 'manual',
            });
            if (existingIndex !== -1) {
                mapping[existingIndex] = {
                    ...mapping[existingIndex],
                    ...normalizedEntry,
                };
            } else {
                mapping = [...mapping, normalizedEntry];
            }
        },
        removeMappingEntry(entry) {
            mapping = mapping.filter(e => e.headerField !== entry.headerField);
        },
        setPrimaryHeaderField(headerField) {
            const primaryHeaderField = headerField || null;
            mapping = mapping.map((entry) => {
                const nextPrimary = primaryHeaderField && entry?.included !== false && entry?.headerField === primaryHeaderField ? 1 : 0;
                return { ...entry, primary: nextPrimary };
            });
        },
        setMappingIdentifier(id) {
            // Option B: primary is a property of the headerField.
            // We resolve the selected ontology field id to its headerField and apply primary to ALL entries for that headerField.
            const selectedEntry = id ? mapping.find((e) => e?.mappedField === id) : null;
            this.setPrimaryHeaderField(selectedEntry?.headerField || null);
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
            importCompleted = false;
            mapping = [];
            data = [];
            detectedPreset = null;
            availablePresets = [];
            parserWarnings = [];
            prefilledMapping = [];
            reusedTemplate = undefined;
            useMatchingTemplate = false;
            useMatchingSuggestions = false;
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