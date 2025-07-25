import { browser } from '$app/environment';
import { getProject } from "$lib/stores/ProjectsUtils.js";
import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";

export const load = async ({ params }) => {
    if (!browser) return;
    const { getAvaliableLocalesForProject, setProjectLanguages } = getContentLanguageStore();

    const [project, languages] = await Promise.all([
        getProject(params.project_id),
        getAvaliableLocalesForProject(params.project_id)
    ]);

    setProjectLanguages(languages);

    return {
        project,
        languages
    };
};
