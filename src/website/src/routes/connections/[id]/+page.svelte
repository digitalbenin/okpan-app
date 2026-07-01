<script>
    import Header from '$lib/components/Header.svelte';
    import { getAssetUrl } from '$lib/utils/imgUtils.js';
    import { getConnectionBorderColor } from '$lib/utils/connectionColors.js';
    import { getWebsiteTranslationStore } from '$lib/stores/WebsiteTranslationStore.svelte.js';
    import { getWebsiteContentStore } from '$lib/stores/WebsiteContentStore.svelte.js';
    import { buildPathWithProjectId } from '$lib/utils/projectContext.js';
    import { resolveStaticHref } from '$lib/utils/sitePaths.js';
    const { t } = getWebsiteTranslationStore();
    const { content } = getWebsiteContentStore();
    
    let { data } = $props();
    let researchField = $derived(data.researchField);
    let vocabularies = $derived(data.vocabularies);
    const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';
    const projectId = $derived(data?.queryParams?.projectId || data?.activeProjectId || null);
    const borderColor = $derived(getConnectionBorderColor(researchField?.fields_config));

    // Sort state
    const SORT_OPTIONS = [
        { value: 'name', label: t('connections.sort-name') },
        { value: 'count', label: t('connections.sort-count') }
    ];
    let sortBy = $state('name');

    const sortedVocabularies = $derived.by(() => {
        const list = [...vocabularies];
        if (sortBy === 'name') {
            list.sort((a, b) => (content(a, 'name') || '').localeCompare(content(b, 'name') || ''));
        } else if (sortBy === 'count') {
            list.sort((a, b) => (b.count || 0) - (a.count || 0));
        }
        return list;
    });
</script>

{#if !researchField}
    <div class="bg-gray-200">
        <p class="text-muted">{t('page.connections.no-items')}</p>
    </div>
{:else}
    <div class="bg-gray-200">
        <Header
            title={content(researchField, 'name') || t('common.unknown')}
            description={content(researchField, 'description') || ''}
            showButton={false}
            {...data}
        />
        <div class="container-xl">
            <div class="d-flex align-items-center justify-content-between my-4">
                <span class="fs-6 text-body">
                    {vocabularies.length} {t('nav.connections')}
                </span>
                <div class="d-flex align-items-center gap-2">
                    <select
                        class="form-select bg-transparent border-secondary-subtle text-body-secondary"
                        style="width: auto;"
                        bind:value={sortBy}
                        aria-label={t('connections.sort-label')}
                    >
                        {#each SORT_OPTIONS as opt}
                            <option value={opt.value}>{opt.label}</option>
                        {/each}
                    </select>
                </div>
            </div>

            {#if vocabularies.length > 0}
                <div class="row g-3">
                    {#each sortedVocabularies as item}
                        <div class="col-lg-3 col-md-6 col-12">
                            <a
                                href={isStaticExport ? resolveStaticHref(`connections/${researchField.id}/${item.id}`) : buildPathWithProjectId(`/connections/${researchField.id}/${item.id}`, projectId)}
                                class="text-decoration-none text-dark d-block"
                            >
                                <div
                                    class="bg-white d-flex flex-column p-2 rounded-3"
                                    style="border-left: 3px solid {borderColor};"
                                >
                                    {#if item.main_asset_path}
                                        <div
                                            class="w-100 overflow-hidden rounded-2 mb-2"
                                            style="height: 260px;"
                                        >
                                            <img
                                                src={getAssetUrl({ asset_path: item.main_asset_path })}
                                                alt={content(item, 'name')}
                                                class="w-100 h-100 object-fit-cover"
                                                loading="lazy"
                                            />
                                        </div>
                                    {:else}
                                        <div
                                            class="overflow-hidden w-100"
                                            style="height: 260px;"
                                        >
                                            <div
                                                class="w-100 h-100 bg-secondary-subtle d-flex align-items-center justify-content-center text-secondary fw-semibold"
                                                style="font-size: 10rem;"
                                            >
                                                {(content(item, 'name') || '')?.[0]?.toUpperCase()}
                                            </div>
                                        </div>
                                    {/if}
                                    <div class="d-flex flex-column px-1">
                                        <span class="fs-5 fw-semibold text-body">
                                            {content(item, 'name')}
                                        </span>
                                        <span class="fs-7 text-body-secondary">
                                           {t('object.objects-connected', { count: item.count || 0 })}
                                        </span>
                                    </div>
                                </div>
                            </a>
                        </div>
                    {/each}
                </div>
            {:else}
                <div class="card p-4 text-center text-muted">
                    {t('page.connections.no-items')}
                </div>
            {/if}
        </div>
    </div>
{/if}