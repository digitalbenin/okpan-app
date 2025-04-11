import { API_SECTIONS, performQuery } from "$lib/utils/queries.js";

const assetsList = API_SECTIONS.assets.operations.list;


export const getAssets = async (projectId, institutionId) => {
    let result = await performQuery(assetsList, { projectId, institutionId });
    return result.result;
};