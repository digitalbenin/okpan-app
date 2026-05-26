import { browser } from '$app/environment';
import {
    getObjectById,
} from "$lib/api/ObjectsApi.js";
import { getResearchFields } from "$lib/api/ResearchFieldsApi.js";
import { getProjectInstitutions } from "$lib/api/InstitutionsApi.js";
import { getDatasourcesByObject } from "$lib/api/DatasourcesApi.js";
import { getTemplatesByInstitution } from "$lib/api/TemplatesApi.js";
import { getOntologyFields } from "$lib/api/OntologyFieldsApi.js";

export const load = async ({ params, depends }) => {
    // Invalidate when institutions are updated elsewhere
    depends('app:institutions');
    if (!browser) return;

    const objectId = params.object_id;
    const projectId = params.project_id;
    const institutionId = params.institution_id;

    // Load object data, research fields, institutions, datasources, templates, and ontology fields
    const [objectResponse, researchFieldsResponse, institutionsResponse, datasourcesResponse, templatesResponse, ontologyFieldsResponse] = await Promise.all([
        getObjectById(objectId),
        getResearchFields(projectId),
        getProjectInstitutions({ projectId, page: 0, pageSize: 50, orderBy: 'created_at', direction: 'desc' }),
        getDatasourcesByObject(objectId),
        getTemplatesByInstitution(institutionId),
        getOntologyFields(projectId)
    ]);

    const institutionItems = (institutionsResponse?.result || []).map((inst) => ({
        value: inst.id,
        label: inst?.name?.content ?? ''
    }));

    depends("custom:object");
    return {
        object: objectResponse.result,
        researchFields: researchFieldsResponse || [],
        institutions: institutionItems,
        datasources: datasourcesResponse.items || [],
        templates: templatesResponse || [],
        ontologyFields: ontologyFieldsResponse || []
    }
};



