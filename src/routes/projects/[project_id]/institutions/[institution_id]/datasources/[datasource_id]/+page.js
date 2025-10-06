import { browser } from '$app/environment';
import { getDatasource, getObjectsByDatasource } from '$lib/stores/DatasourcesUtils.js';

export const load = async ({ params, depends }) => {
    if (!browser) return;

    depends('app:datasources');
    depends('app:institution');

    const projectId = params.project_id;
    const institutionId = params.institution_id;
    const datasourceId = params.datasource_id;

    // Fetch datasource details via existing store util
    const datasourceRes = await getDatasource(datasourceId);

    // Fetch distinct objects linked to this datasource via store util
    const objects = await getObjectsByDatasource({
        datasourceId,
        projectId,
        institutionId,
        page: 0,
        pageSize: 25
    });

    console.log(datasourceRes.result);

    return {
        projectId,
        institutionId,
        datasourceId,
        datasource: datasourceRes?.result ?? null,
        objects
    };
};