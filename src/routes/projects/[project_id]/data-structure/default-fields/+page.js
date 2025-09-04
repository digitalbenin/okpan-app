import { browser } from '$app/environment';
import { getOntologyFields } from '$lib/stores/OntologyFieldsUtils.js';

/** @type {import('./$types').PageLoad} */
export async function load({ params, depends, parent }) {
    if (!browser) return

    depends("app:ontology_fields");

    const ontologyFieldsResponse = await getOntologyFields();

    return {
        ontologyFields: ontologyFieldsResponse.result || []
    };
}