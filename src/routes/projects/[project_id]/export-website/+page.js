import { getProjectInstitutions } from '$lib/api/InstitutionsApi.js';
import { getResearchFields } from '$lib/api/ResearchFieldsApi.js';
import { browser } from '$app/environment';
import { executeQuery } from '$lib/api/graphqlClient.js';

export async function load({ params, fetch }) {
    const { project_id } = params;

    const institutionsResponse = await getProjectInstitutions(
        {
            projectId: project_id,
            pageSize: 1000
        },
        fetch
    );

    const institutions = institutionsResponse?.result
        ? institutionsResponse.result.map((inst) => ({
                value: inst.id,
                label: inst.name.content
            }))
        : [];

    const researchFieldsResponse = await getResearchFields(project_id);
    const allResearchFields = researchFieldsResponse?.result || [];

    const connectionFields = allResearchFields.filter(
        (field) => (field.type || '').toLowerCase() === 'vocabulary'
    );

    const freeTextFields = allResearchFields.filter(
        (field) => (field.type || '').toLowerCase() !== 'vocabulary'
    );

    let contentLanguages = [];
    if (browser) {
        try {
            const languageResponse = await executeQuery('languages', 'listByProject', {
                projectId: project_id
            });
            contentLanguages = Array.isArray(languageResponse?.result) ? languageResponse.result : [];
        } catch (error) {
            console.error('Failed to load content languages for website export:', error);
            contentLanguages = [];
        }
    }

    return {
        institutions,
        connectionFields,
        freeTextFields,
        contentLanguages,
        project_id
    };
}
