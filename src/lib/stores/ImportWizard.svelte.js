import { getContext, setContext } from 'svelte';

const IMPORT_WIZARD_KEY = 'importWizard';

export function createImportWizardContext() {
    let steps = $state([
        { id: 1, t: 'give-datasource-name', fallback: 'Give Data Source Name' },
        { id: 2, t: 'upload-data', fallback: 'Add your data file' },
        { id: 3, t: 'match-data', fallback: 'Match your data' },
        { id: 4, t: 'choose-id', fallback: 'Choose your object identifier' }
    ]);
    let currentStep = $state(1);
    let formData = $state({});
    let isValid = $state(false);
    let errors = $state([]);

    const context = {
        // Getters and setters for reactive state
        get currentStep() { return currentStep; },
        set currentStep(value) { currentStep = value; },

        get steps() { return steps; },
        set steps(value) { steps = value; },

        get formData() { return formData; },
        set formData(value) { formData = value; },

        get isValid() { return isValid; },
        set isValid(value) { isValid = value; },

        get errors() { return errors; },
        set errors(value) { errors = value; },

        // Helper methods
        nextStep() {
            currentStep++;
        },

        prevStep() {
            if (currentStep > 1) currentStep--;
        },

        updateFormData(newData) {
            formData = { ...formData, ...newData };
        },

        reset() {
            currentStep = 1;
            formData = {};
            isValid = false;
            errors = [];
        }
    };

    setContext(IMPORT_WIZARD_KEY, context);
    return context;
}

export function getImportWizardContext() {
    return getContext(IMPORT_WIZARD_KEY);
}