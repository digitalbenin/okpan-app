import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte";

export const load = async () => {
    const { fetchLanguages } = getContentLanguageStore();
    const languages = await fetchLanguages();

    console.log("languages", languages);

    return {
        languages
    };
};