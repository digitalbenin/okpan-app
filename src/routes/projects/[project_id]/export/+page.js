import { getProjectInstitutions } from '$lib/stores/InstitutionsUtils.js';
import { getResearchFields } from '$lib/stores/ResearchFieldsUtils.js';

export async function load({ params, fetch }) {
    const { project_id } = params;

    // Load institutions
    const institutionsResponse = await getProjectInstitutions({ 
        projectId: project_id, 
        pageSize: 1000 
    }, fetch);

    const institutions = institutionsResponse?.result
        ? institutionsResponse.result.map((inst) => ({
            value: inst.id,
            label: inst.name.content
          }))
        : [];

    // Load research fields
    const researchFieldsResponse = await getResearchFields(project_id);
    const allResearchFields = researchFieldsResponse?.result || [];

    // Separate research fields by type
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