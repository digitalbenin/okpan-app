import { browser } from '$app/environment';
import { getInstitution } from "$lib/stores/InstitutionsUtils.js";
import { getOntologyFields } from '$lib/stores/OntologyFieldsUtils.js';

export const load = async ({ params }) => {
    if (!browser) return;
    // depends('app:objects', 'app:assets', 'app:datasources', 'app:institutions');
    const institutionId = params.institution_id;
    const institution = await getInstitution(institutionId)
    const ontologyFields = await getOntologyFields(institutionId)

    return {
        institution,
        ontologyFields
    };
};

