import { getContext, setContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';

const IMPORT_WIZARD_KEY = 'importWizard';

export function createImportWizardContext(params) {
    let steps = $state([
        { id: 1, t: 'upload-data', fallback: 'Add your data file' },
        { id: 2, t: 'give-datasource-name', fallback: 'Give Data Source Name' },
        { id: 3, t: 'match-data', fallback: 'Match your data' },
        { id: 4, t: 'choose-id', fallback: 'Choose your object identifier' },
        { id: 5, t: 'review-save', fallback: 'Review and Save' }
    ]);
    let currentStep = $state(1);
    let nextEnabled = $state(false);
    let saving = $state(false);
    let projectId = $state(params?.projectId);
    let institutionId = $state(params?.institutionId ?? null);
    let datasourceId = $state();
    let mappingId = $state();
    let file = $state();
    let mapping = $state([])
    let data = $state([])
    let useMatchingSuggestions = $state(false);
    let reusedTemplate = $state();
    let useMatchingTemplate = $state(false);
    let importCompleted = $state(false);
    let submitStep = $state(null);
    let fieldMappingsInitialized = $state(false);
    const matchingRequests = new Map();
    const excludedMappings = new SvelteMap();
    const autoMatches = new SvelteMap();

    function resetMatchingPreview() {
        matchingRequests.clear();
        excludedMappings.clear();
        autoMatches.clear();
        fieldMappingsInitialized = false;
    }
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

        get institutionId() { return institutionId; },
        set institutionId(value) { institutionId = value; },

        get datasourceId() { return datasourceId; },
        set datasourceId(value) { datasourceId = value; },

        get mappingId() { return mappingId; },
        set mappingId(value) { mappingId = value; },

        get file() { return file; },
        set file(value) { file = value; },

        get mapping() { return mapping; },
        set mapping(value) { mapping = value; },

        get data() { return data; },
        set data(value) {
            if (value === data) return;
            data = value;
            resetMatchingPreview();
        },

        get useMatchingSuggestions() { return useMatchingSuggestions; },
        set useMatchingSuggestions(value) { useMatchingSuggestions = value; },

        get useMatchingTemplate() { return useMatchingTemplate; },
        set useMatchingTemplate(value) { useMatchingTemplate = value; },

        get importCompleted() { return importCompleted; },
        set importCompleted(value) { importCompleted = value; },

        get submitStep() { return submitStep; },
        set submitStep(value) { submitStep = value; },

        get reusedTemplate() { return reusedTemplate; },
        set reusedTemplate(value) {
            if (value?.mapping) {
                mapping = value.mapping;
            }
            reusedTemplate = value;
        },

        // get formData() { return formData; },
        // set formData(value) { formData = value; },

        // get isValid() { return isValid; },
        // set isValid(value) { isValid = value; },

        // get errors() { return errors; },
        // set errors(value) { errors = value; },

        get fieldMappingsInitialized() { return fieldMappingsInitialized; },

        getMatchingRequest(kind, fetch) {
            if (!matchingRequests.has(kind)) matchingRequests.set(kind, fetch());
            return matchingRequests.get(kind);
        },

        initializeFieldMappings(fields, suggestions) {
            if (fieldMappingsInitialized) return;
            const entriesByField = new Map();
            for (const entry of mapping) {
                if (!entriesByField.has(entry.headerField)) entriesByField.set(entry.headerField, []);
                entriesByField.get(entry.headerField).push(entry);
            }
            const bestMatches = new Map(suggestions.map(({ csvField, suggestions }) => [
                csvField, suggestions?.[0]?.ontologyFieldId,
            ]));
            const replaced = new Set();
            const additions = [];
            for (const headerField of fields) {
                const entries = entriesByField.get(headerField) || [];
                if (excludedMappings.has(headerField) || entries.some((entry) => entry.mappedField)) continue;
                const mappedField = bestMatches.get(headerField);
                if (mappedField) {
                    autoMatches.set(headerField, mappedField);
                    replaced.add(headerField);
                    additions.push({ headerField, mappedField, primary: entries.some((entry) => entry.primary) });
                } else if (!entries.length) {
                    additions.push({ headerField, mappedField: null, primary: false });
                }
            }
            mapping = [...mapping.filter((entry) => !replaced.has(entry.headerField)), ...additions];
            fieldMappingsInitialized = true;
        },

        isAutoMatch(headerField, mappedField) {
            return autoMatches.get(headerField) === mappedField;
        },

        isFieldIncluded(headerField) {
            return !excludedMappings.has(headerField);
        },

        setFieldIncluded(headerField, included) {
            if (included) {
                const entries = excludedMappings.get(headerField);
                if (!entries) return;
                excludedMappings.delete(headerField);
                mapping = [...mapping, ...entries];
            } else if (!excludedMappings.has(headerField)) {
                excludedMappings.set(headerField, mapping.filter((entry) => entry.headerField === headerField));
                mapping = mapping.filter((entry) => entry.headerField !== headerField);
            }
        },

        setFieldMatches(headerField, mappedFields) {
            const previous = mapping.filter((entry) => entry.headerField === headerField);
            const primary = previous.some((entry) => entry.primary);
            autoMatches.delete(headerField);
            mapping = [
                ...mapping.filter((entry) => entry.headerField !== headerField),
                ...(mappedFields.length ? mappedFields : [null]).map((mappedField) => ({
                    ...previous.find((entry) => entry.mappedField === mappedField),
                    headerField,
                    mappedField,
                    primary,
                })),
            ];
        },
        setPrimaryHeaderField(headerField) {
            const primaryHeaderField = headerField || null;
            for (const [field, entries] of excludedMappings) {
                if (entries.some((entry) => entry.primary)) {
                    excludedMappings.set(field, entries.map((entry) => ({ ...entry, primary: 0 })));
                }
            }
            mapping = mapping.map((entry) => {
                const nextPrimary = primaryHeaderField && entry?.headerField === primaryHeaderField ? 1 : 0;
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
            resetMatchingPreview();
            currentStep = 1;
            importCompleted = false;
            institutionId = null;
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
