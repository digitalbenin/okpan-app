import { browser } from '$app/environment';
import { getInstitution } from "$lib/api/InstitutionsApi.js";

export const load = async ({ params, depends }) => {
    if (!browser) return;
    // Ensure the layout reloads when institution data is invalidated
    depends('app:institution');

    const institutionId = params.institution_id;
    const institution = await getInstitution(institutionId);

    return {
        institution
    };
};

