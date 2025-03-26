// import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte";
// import { getProjectStore } from "$lib/stores/ProjectStore.svelte";
import { browser } from "$app/environment";
import { getProjects } from "$lib/stores/ProjectsUtils";


export const load = async () => {
    // const { fetchLanguages } = getContentLanguageStore();
    // const { getProjects } = getProjectStore();
    // const languages = await fetchLanguages();
    // const projects = await getProjects();
    if (!browser) return;
    const projects = await getProjects();
    return {
        // languages,
        projects
    };
};