import { getProjectInstitutions } from '$lib/stores/InstitutionsUtils.js';

export async function load({ params, fetch }) {
    const { project_id } = params;

    // Load institutions only
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

    return {
        institutions,
        project_id
    };
}