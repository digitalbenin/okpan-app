import { browser } from '$app/environment';
import {
    getObjectById,
} from "$lib/stores/ObjectsUtils.js";
import { getResearchFields } from "$lib/stores/ResearchFieldsUtils.js";

export const load = async ({ params, depends }) => {
    if (!browser) return;

    const objectId = params.object_id;
    const projectId = params.project_id;

    // Load both object data and all research fields for the project
    const [objectResponse, researchFieldsResponse] = await Promise.all([
        getObjectById(objectId),
        getResearchFields(projectId)
    ]);

    depends("custom:object");
    return {
        object: objectResponse.result,
        researchFields: researchFieldsResponse.result || []
    }
};



