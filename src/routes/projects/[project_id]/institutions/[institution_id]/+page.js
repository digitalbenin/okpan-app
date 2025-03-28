import { browser } from '$app/environment';
import { getInstitution } from "$lib/stores/InstitutionsUtils.js";
import { getAssets } from "$lib/stores/AssetsUtils.js";
import { getObjects } from '$lib/stores/ObjectsUtils.js';

export const load = async ({ params }) => {
    if (!browser) return;
    const institution = await getInstitution(params.institution_id);
    const assets = await getAssets(params.project_id, params.institution_id);
    const objects = await getObjects(params.project_id, params.institution_id);
    return {
        institution,
        assets,
        objects
    }
};

