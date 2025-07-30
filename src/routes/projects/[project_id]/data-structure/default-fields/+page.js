import { browser } from '$app/environment';
import { getOntologyFields } from '$lib/stores/OntologyFieldsUtils.js';

/** @type {import('./$types').PageLoad} */
export async function load() {
    if (!browser) return;
    const ontologyFieldsResponse = await getOntologyFields()

    return {
        ontologyFields: ontologyFieldsResponse.result,
    };
} 