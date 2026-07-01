<script>
    import ConnectionMedia from '$lib/components/ConnectionMedia.svelte';
    import { getAssetUrl } from '$lib/utils/imgUtils.js';
    import { getConnectionTextColor } from '$lib/utils/connectionColors.js';
    import { getWebsiteTranslationStore } from '$lib/stores/WebsiteTranslationStore.svelte.js';
    import { getWebsiteContentStore } from '$lib/stores/WebsiteContentStore.svelte.js';
    import { buildPathWithProjectId } from '$lib/utils/projectContext.js';
    import { resolveStaticHref } from '$lib/utils/sitePaths.js';
    const { t } = getWebsiteTranslationStore();
    const { content } = getWebsiteContentStore();

    const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';

    let { data } = $props();
    let researchField = $derived(data.researchField);
    let vocabulary = $derived(data.vocabulary);
    let allObjects = $derived(data.connectedObjects || []);
    const projectId = $derived(data?.queryParams?.projectId || data?.activeProjectId || null);
    const staticObjectBackHref = $derived.by(() => {
        if (!researchField?.id || !vocabulary?.id) return 'connections';
        return `connections/${researchField.id}/${vocabulary.id}`;
    });
    const connectionLabelColor = $derived(getConnectionTextColor(researchField?.fields_config));
    const mainThumbnailUrl = $derived(vocabulary?.main_asset_path ? getAssetUrl({ asset_path: vocabulary.main_asset_path }) : null);
    const MAX_VISIBLE_OBJECTS = 5;
    const displayObjects = $derived(allObjects.slice(0, MAX_VISIBLE_OBJECTS));
    const hasMoreObjects = $derived(allObjects.length > MAX_VISIBLE_OBJECTS);

    // Build archive URL filtered by this connection
    const connectionFilterUrl = $derived.by(() => {
        const filters = JSON.stringify({ [researchField?.id]: [vocabulary?.id] });
        if (isStaticExport) {
            return resolveStaticHref('/') + '?filters=' + encodeURIComponent(filters);
        }
        const base = buildPathWithProjectId('/', projectId);
        return base + '&filters=' + encodeURIComponent(filters);
    });
</script>

<div class="bg-gray-200">
    <div class="container-xl py-5">
        <!-- Header: thumbnail + label + name -->
        <div class="d-flex gap-2 mb-4">
            {#if mainThumbnailUrl}
                <div class="flex-shrink-0 overflow-hidden rounded-2" style="width: 55px; height: 56px;">
                    <img src={mainThumbnailUrl} alt={content(vocabulary, 'name')} class="w-100 h-100 object-fit-cover" />
                </div>
            {/if}
            <div class="d-flex flex-column gap-1">
                <span class="text-uppercase fs-8" style="color: {connectionLabelColor};">
                    {content(researchField, 'name') || ''}
                </span>
                <h1 class="h2 text-body mb-0">
                    {content(vocabulary, 'name') || t('common.unknown-item')}
                </h1>
            </div>
        </div>

        <!-- Two-column layout: left media/details, right linked objects -->
        <div class="row g-4">
            <!-- Left column -->
            <div class="col-lg-8 col-md-12 d-flex flex-column gap-4">
                <!-- DESCRIPTION -->
                {#if content(vocabulary, 'description')}
                    <div class="d-flex flex-column gap-1">
                        <span class="text-uppercase fs-8 text-body">
                            {t('common.description')}
                        </span>
                        <span class="fs-6 text-body" style="white-space: pre-wrap;">
                            {content(vocabulary, 'description')}
                        </span>
                    </div>
                {/if}

                <!-- External link -->
                {#if vocabulary?.external_link}
                    <div class="d-flex flex-column gap-1">
                        <span class="text-uppercase fs-8 text-body">
                            {t('object.external-link')}
                        </span>
                        <a href={vocabulary.external_link} target="_blank" rel="noopener noreferrer" class="fs-6 text-body text-break">
                            {vocabulary.external_link}
                        </a>
                    </div>
                {/if}

                <!-- MEDIA -->
                <ConnectionMedia mainAssetPath={vocabulary?.main_asset_path} assets={vocabulary?.assets || []} />
            </div>

            <!-- Right column: Linked Objects -->
            <div class="col-lg-4 col-md-12">
                {#if allObjects.length > 0}
                    <div class="d-flex flex-column gap-2">
                        <span class="text-uppercase fs-8 text-body">
                            {t('object.linked-objects')}
                        </span>
                       
                        <div class="d-flex flex-column">
                            {#each displayObjects as obj}
                                <a
                                    href={isStaticExport ? `${resolveStaticHref(`${obj.id}`)}?back=${encodeURIComponent(staticObjectBackHref)}` : buildPathWithProjectId(`/${obj.id}`, projectId)}
                                    class="text-decoration-none text-dark d-flex align-items-center gap-2 py-2 border-top border-gray-400"
                                >
                                    <div class="flex-shrink-0 overflow-hidden rounded" style="width: 41px; height: 41px;">
                                        {#if obj.main_image}
                                            <img src={getAssetUrl({ asset_path: obj.main_image })} alt={content(obj, 'name') || obj.id} class="w-100 h-100 object-fit-cover" />
                                        {:else}
                                            <div class="w-100 h-100 bg-light d-flex align-items-center justify-content-center text-secondary fw-semibold fs-5">
                                                {(content(obj, 'name') || obj.id)?.[0]?.toUpperCase()}
                                            </div>
                                        {/if}
                                    </div>
                                    <div class="d-flex flex-column px-1">
                                        <span class="fw-semibold fs-7 text-body">
                                            {content(obj, 'name') || obj.id}
                                        </span>
                                        <span class="fs-7 text-body-secondary">
                                            {content(obj, 'institution_name') || obj.institution_name}
                                        </span>
                                    </div>
                                </a>
                            {/each}
                        </div>

                        {#if hasMoreObjects}
                            <a href={connectionFilterUrl} class="btn btn-link rounded-3 text-black align-self-start mt-1 ps-0">
                                {t('common.see-all', { count: allObjects.length })}
                            </a>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>
