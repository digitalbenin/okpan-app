import { browser } from '$app/environment';
import { getAssets } from "$lib/stores/AssetsUtils.js";
import { getObjects } from "$lib/stores/ObjectsUtils.js";
import { getDatasources } from '$lib/stores/DatasourcesUtils.js';
// import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";

export const load = async ({ params, depends, url }) => {
    if (!browser) return;
    // depends('app:objects', 'app:assets', 'app:datasources', 'app:institutions');

    const projectId = params.project_id;
    const institutionId = params.institution_id;

    // common params
    const page = url.searchParams.get('page');
    const pageSize = url.searchParams.get('pageSize')
    // objects params
    const oOrderBy = url.searchParams.get('oOrderBy')
    const oDirection = url.searchParams.get('oDirection')
    const oStatus = url.searchParams.get('oStatus')
    const oSearch = url.searchParams.get('oSearch')
    const oSearchField = url.searchParams.get('oSearchField')

    const oOptions = {
        projectId,
        institutionId,
        page: +page - 1,
        pageSize: +pageSize,
        orderBy: oOrderBy,
        direction: oDirection,
        search: oSearch,
        status: oStatus,
        searchField: oSearchField
    }
    // assets params
    const aOrderBy = url.searchParams.get('aOrderBy')
    const aDirection = url.searchParams.get('aDirection')
    const aLinked = url.searchParams.get('aLinked')
    const aSearch = url.searchParams.get('aSearch')

    const aOptions = {
        projectId,
        institutionId,
        page: +page - 1,
        pageSize: +pageSize,
        orderBy: aOrderBy,
        direction: aDirection,
        search: aSearch,
        linked: aLinked === 'true' ? true : false
    }
    // data sources params
    const sOrderBy = url.searchParams.get('sOrderBy')
    const sDirection = url.searchParams.get('sDirection')
    const sSearch = url.searchParams.get('sSearch')

    const sOptions = {
        projectId,
        institutionId,
        page: +page - 1,
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
        // projectLanguages,
    ] = await Promise.all([
        getAssets(aOptions),
        getObjects(oOptions),
        getDatasources(sOptions),
        // getAvaliableLocalesForProject(projectId),
    ]);

    const res = {
        assets: assetsData,
        objects: objectsData,
        // projectId,
        // institutionId,
        datasources: datasourcesData,
        //projectLanguages: projectLanguages?.result || projectLanguages || [] // Adjust as per getAvaliableLocalesForProject's return
    };
    return res;
};

