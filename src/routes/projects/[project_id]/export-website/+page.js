import { getProjectInstitutions } from '$lib/stores/InstitutionsUtils.js';
import { getResearchFields } from '$lib/stores/ResearchFieldsUtils.js';

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

    return {
        institutions,
        connectionFields,
        freeTextFields,
        project_id
    };
}
