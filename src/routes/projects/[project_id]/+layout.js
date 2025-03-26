import { browser } from '$app/environment';
import { getProject } from "$lib/stores/ProjectsUtils.js";

export const load = async ({ params }) => {
    if (!browser) return;
    const project = await getProject(params.project_id);
    return {
        project
    }
};