import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
const { t } = getTranslationStore();

export const getObjectIdentifier = (object) => {
    return object.objectsOntologyFields?.find(
        (f) => f.primary
    )?.value || t("common.identifier-not-set", { fallback: "Identifier not set" });
}