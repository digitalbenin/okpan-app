import { browser } from '$app/environment';
import { getProjectInstitutions } from "$lib/stores/InstitutionsUtils.js";

export const load = async ({ params }) => {
    if (!browser) return;
    const institutions = await getProjectInstitutions(params.id);
    return {
        institutions
    }
};

