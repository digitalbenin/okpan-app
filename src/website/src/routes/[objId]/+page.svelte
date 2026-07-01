<script>
    import ObjectImages from '$lib/components/ObjectImages.svelte';
    import ObjectConnections from '$lib/components/ObjectConnections.svelte';
    import ObjectInstitutionData from '$lib/components/ObjectInstitutionData.svelte';
    import { getWebsiteTranslationStore } from '$lib/stores/WebsiteTranslationStore.svelte.js';
    import { getWebsiteContentStore } from '$lib/stores/WebsiteContentStore.svelte.js';
    import { getAssetUrl } from '$lib/utils/imgUtils.js';
    const { t } = getWebsiteTranslationStore();
    const { content } = getWebsiteContentStore();

    const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';

    const { data } = $props();
    const institution = $derived(
            data?.institution || data?.institutions?.find((e) => e.id == data?.object?.institution_id)
    );
    const researchFields = $derived(data.research_fields || []);
    const ontologyFields = $derived(data.ontology_fields || []);
    const objectResearchFields = $derived(data.objectResearchFields || []);
    const objectOntologyFields = $derived(data.objectOntologyFields || []);
    const vocabularies = $derived(data.vocabularies || []);
    const datasources = $derived(data.datasources || []);
    const objId = $derived(data?.objectOntologyFields?.find((e) => e.primary)?.value);
    const title = $derived.by(() => {
            const localizedName = content(data?.object, 'name');
            const name = (localizedName && String(localizedName).trim()) || '';
            if (name) return name;
            const primary = data?.objectOntologyFields?.find((e) => e.primary)?.value;
            return primary || t('common.untitled');
    });
    const assets = $derived(data?.assets || []);

    // Derive custom fields: research fields that are NOT vocabulary type, with a value
    const customFields = $derived.by(() => {
        const rfMap = {};
        for (const rf of researchFields) {
            rfMap[rf.id] = rf;
        }
        const results = [];
        for (const orf of objectResearchFields) {
            const rf = rfMap[orf.field_id];
            if (!rf || rf.type === 'vocabulary') continue;
            if (!orf.value || !String(orf.value).trim()) continue;
            const name = content(rf, 'name') || '';
            if (!name) continue;
            results.push({
                id: orf.id,
                name,
                value: orf.value
            });
        }
        return results;
    });

    // SEO: Get first asset image for social media preview
    const firstAsset = $derived(assets?.[0]);
    const ogImage = $derived(firstAsset ? getAssetUrl({ asset_path: `project_assets/${data?.object?.project_id}/${firstAsset.asset_path}` }) : null);

    // SEO: Build description from object data
    const pageDescription = $derived.by(() => {
            const parts = [];
            const institutionName = content(institution, 'name');
            if (institutionName) parts.push(institutionName);
            const typeField = objectOntologyFields?.find(f => (content(ontologyFields?.find(of => of.id === f.field_id), 'name') || '').toLowerCase().includes('type'));
            if (typeField?.value) parts.push(typeField.value);
            return parts.length > 0 ? parts.join(t('common.meta-separator')) : t('object.details');
    });
</script>

<svelte:head>
    {#if isStaticExport}
    <!-- Primary Meta Tags -->
    <title>{title}</title>
    <meta name="title" content={title} />
    <meta name="description" content={pageDescription} />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="article" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={pageDescription} />
    {#if ogImage}
    <meta property="og:image" content={ogImage} />
    {/if}

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={pageDescription} />
    {#if ogImage}
    <meta name="twitter:image" content={ogImage} />
    {/if}
    {/if}
</svelte:head>

<div class="bg-gray-200">
    <div class="container-xl py-5">
        <!-- Top: Media + Details -->
        <div class="row g-4">
            <!-- Left: Media section -->
            <div class="col-lg-8 col-md-12">
                <div class="d-flex flex-column gap-2">
                    <span class="text-uppercase fs-8 text-body">
                        {t('object.media')}
                    </span>
                    <ObjectImages {assets} />
                </div>
            </div>
            <!-- Right: Details section -->
            <div class="col-lg-4 col-md-12 d-flex flex-column gap-4">
                <!-- Object Title -->
                <div class="d-flex flex-column gap-1">
                    <span class="text-uppercase fs-8 text-body">
                        {t('object.object-title')}
                    </span>
                    <h1 class="h2 mb-0 text-body">
                        {objId || title}
                    </h1>
                </div>

                <!-- Institution -->
                <div class="d-flex flex-column gap-1">
                    <span class="text-uppercase fs-8 text-body">
                        {t('object.institution')}
                    </span>
                    <span class="fs-6 text-body">
                        {content(institution, 'name') || ''}
                    </span>
                </div>

                <!-- Custom Fields (free-text research fields with values) -->
                {#each customFields as field}
                    <div class="d-flex flex-column gap-1">
                        <span class="text-uppercase fs-8 text-body">
                            {field.name}
                        </span>
                        <span class="fs-6 text-body">
                            {field.value}
                        </span>
                    </div>
                {/each}

                <!-- Connections -->
                <ObjectConnections {objectResearchFields} {researchFields} {vocabularies} />
            </div>
        </div>

        <!-- Divider + Institution metadata section -->
        <hr class="border-top border-dark my-5">

        <div>
            <ObjectInstitutionData {objectOntologyFields} {ontologyFields} {datasources} {institution} />
        </div>
    </div>
</div>