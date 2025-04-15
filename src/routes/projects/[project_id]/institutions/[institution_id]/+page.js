import { browser } from '$app/environment';
import { getInstitution } from "$lib/stores/InstitutionsUtils.js";
import { getAssets } from "$lib/stores/AssetsUtils.js";
import { getObjects } from '$lib/stores/ObjectsUtils.js';

export const load = async ({ params }) => {
    if (!browser) return;

    const projectId = params.project_id;
    const institutionId = params.institution_id;

    // Load all data in parallel for better performance
    const [institution, assets, objects] = await Promise.all([
        getInstitution(institutionId),
        getAssets(projectId, institutionId),
        getObjects(projectId, institutionId)
    ]);

    return {
        institution,
        assets,
        objects,
        projectId,
        institutionId
    }
};

