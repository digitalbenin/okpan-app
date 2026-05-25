import { browser } from '$app/environment';
import { getAssets } from "$lib/api/AssetsApi.js";
import { getObjects } from "$lib/api/ObjectsApi.js";
import { getDatasources } from '$lib/api/DatasourcesApi.js';
import { getTemplatesByInstitution } from "$lib/api/TemplatesApi.js";
// import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";

export const load = async ({ params, depends, url }) => {
    if (!browser) return;
    depends('app:institution');
    depends('app:templates');
    depends('app:assets');

    const projectId = params.project_id;
    const institutionId = params.institution_id;

    // common params
    const pageSize = url.searchParams.get('pageSize')
    // objects params
    const oPage = url.searchParams.get('oPage');
    const oOrderBy = url.searchParams.get('oOrderBy')
    const oDirection = url.searchParams.get('oDirection')
    const oStatus = url.searchParams.get('oStatus')
    const oSearch = url.searchParams.get('oSearch')
    const oSearchField = url.searchParams.get('oSearchField')

    const oOptions = {
        projectId,
        institutionId,
        page: +oPage - 1,
        pageSize: +pageSize,
        orderBy: oOrderBy,
        direction: oDirection,
        search: oSearch,
        status: oStatus,
        searchField: oSearchField
    }
    // assets params
    const aPage = url.searchParams.get('aPage');

    const aOrderBy = url.searchParams.get('aOrderBy')
    const aDirection = url.searchParams.get('aDirection')
    const aLinked = url.searchParams.get('aLinked')
    const aSearch = url.searchParams.get('aSearch')

    const aOptions = {
        projectId,
        institutionId,
        page: +aPage - 1,
        pageSize: +pageSize,
        orderBy: aOrderBy,
        direction: aDirection,
        search: aSearch,
        linked: aLinked === 'linked' ? true : (aLinked === 'not_linked' ? false : undefined)
    }
    // data sources params

    const sPage = url.searchParams.get('sPage');
    const sOrderBy = url.searchParams.get('sOrderBy')
    const sDirection = url.searchParams.get('sDirection')
    const sSearch = url.searchParams.get('sSearch')

    const sOptions = {
        projectId,
        institutionId,
        page: +sPage - 1,
        pageSize: +pageSize,
        orderBy: sOrderBy,
        direction: sDirection,
        search: sSearch
    }
    // Get content language store to fetch project languages
    // const { getAvaliableLocalesForProject } = getContentLanguageStore();

    // Load all data in parallel
    const [
        assetsData,
        objectsData,
        datasourcesData,
        templatesData,
        // projectLanguages,
    ] = await Promise.all([
        getAssets(aOptions),
        getObjects(oOptions),
        getDatasources(sOptions),
        getTemplatesByInstitution(institutionId),
        // getAvaliableLocalesForProject(projectId),
    ]);

    console.log(objectsData)

    const res = {
        assets: assetsData,
        objects: objectsData,
        // projectId,
        // institutionId,
        datasources: datasourcesData,
        mappingTemplates: templatesData?.result || [],
        //projectLanguages: projectLanguages?.result || projectLanguages || [] // Adjust as per getAvaliableLocalesForProject's return
    };
    return res;
};


