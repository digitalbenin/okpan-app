<script>
    import { IconFilter, IconX } from '@tabler/icons-svelte';
    import BaseImage from '$lib/components/base/BaseImage.svelte';
    import BasePagination from '$lib/components/base/BasePagination.svelte';
    import ObjectAdvancedFilters from '$lib/components/objects/ObjectAdvancedFilters.svelte';
    import { getTranslationStore } from '$lib/stores/InterfaceTranslationStore.svelte.js';

    const { t } = getTranslationStore();

    function getFirstImageAsset(object) {
        const list = object?.objectsAssets || [];
        const first = list.find((oa) => oa?.asset?.type === 'image') || list[0];
        return first?.asset ?? first ?? null;
    }

    let {
        projectId = null,
        selectedStatus = $bindable(),
        statusOptions = [],
        showAdvancedFilters = false,
        advancedFiltersPanelOpen = $bindable(),
        advancedFilters = $bindable(),
        searchResult = { items: [], totalCount: 0, facets: {} },
        searchLoading = false,
        pageNum = $bindable(),
        pageSize = 10,
        researchFields = [],
        ontologyFields = [],
        institutions = [],
        vocabularies = [],
        onStatusChange = () => {},
        onFiltersChange = () => {},
        onPageChange = () => {},
        onOpenFilterPanel = () => {},
        onAdvancedFiltersChange = () => {},
        excludeObjectIds = new Set(),
        onToggleObjectExclusion = () => {},
        onToggleAllObjects = () => {},
    } = $props();

    // --- Build active filter chips from advancedFilters ---
    const activeFilterChips = $derived.by(() => {
        if (!showAdvancedFilters || !advancedFilters) return [];
        const chips = [];

        // Institution chips
        const institutionIds = advancedFilters.institutions || [];
        for (const id of institutionIds) {
            const inst = institutions.find(i => String(i.id) === String(id));
            const label = inst?.name?.content || inst?.name || String(id);
            chips.push({ type: 'institution', id: String(id), label });
        }

        // Vocabulary / research-field chips
        for (const key of Object.keys(advancedFilters)) {
            if (key === 'institutions' || key.startsWith('__')) continue;
            const ids = advancedFilters[key];
            if (!Array.isArray(ids) || ids.length === 0) continue;
            const field = researchFields.find(f => String(f.id) === String(key));
            const fieldLabel = field?.name?.content || field?.name || key;
            for (const vid of ids) {
                const vocab = vocabularies.find(v => String(v.id) === String(vid) && String(v.field_id) === String(key));
                const vocabLabel = vocab?.name || String(vid);
                chips.push({ type: 'vocab', fieldId: String(key), id: String(vid), label: `${fieldLabel}: ${vocabLabel}` });
            }
        }

        // Text filter chips
        for (const tf of advancedFilters.__textFilters || []) {
            if (!tf?.fieldId) continue;
            const field = researchFields.find(f => String(f.id) === String(tf.fieldId));
            const fieldLabel = field?.name?.content || field?.name || tf.fieldId;
            chips.push({ type: 'text', fieldId: String(tf.fieldId), label: `${fieldLabel}: "${tf.query}"` });
        }

        return chips;
    });

    function removeFilterChip(chip) {
        const next = { ...(advancedFilters || {}) };
        if (chip.type === 'institution') {
            next.institutions = (next.institutions || []).filter(id => String(id) !== chip.id);
        } else if (chip.type === 'vocab') {
            next[chip.fieldId] = (next[chip.fieldId] || []).filter(id => String(id) !== chip.id);
        } else if (chip.type === 'text') {
            next.__textFilters = (next.__textFilters || []).filter(tf => String(tf.fieldId) !== chip.fieldId);
        }
        advancedFilters = next;
        onFiltersChange(next);
    }

    // Total exported count: totalCount minus excluded
    const exportedCount = $derived(
        Math.max(0, (searchResult.totalCount ?? 0) - excludeObjectIds.size)
    );
</script>

<div class="bg-white rounded-3 p-4 mt-3">
    <div class="d-flex flex-column gap-3">
        <p class="mb-0 fw-normal text-body text-uppercase" style="font-size: 12px; letter-spacing: 2px;">
            {t('website-settings.filter-objects', { fallback: 'Filter objects' })}
        </p>

        <!-- Status radio pills -->
        <div class="d-flex flex-column gap-1">
            <p class="fw-semibold mb-1">{t('website-settings.filter-by-status', { fallback: 'Filter objects by status' })}</p>
            <div class="d-flex gap-2">
                {#each statusOptions as opt}
                    <label class="d-inline-flex align-items-center gap-3 px-3 py-1 border rounded-2 {selectedStatus === opt.value ? 'border-success' : ''} {opt.count === 0 ? 'opacity-50 pe-none' : ''}" style="cursor: pointer;">
                        <input
                            type="radio"
                            class="form-check-input m-0"
                            bind:group={selectedStatus}
                            value={opt.value}
                            disabled={opt.count === 0}
                            onchange={onStatusChange}
                        />
                        <span class="text-nowrap">{opt.label}</span>
                        <span class="badge bg-gray-300 text-body rounded-pill px-2 py-1" style="font-size: 10px;">{opt.count}</span>
                    </label>
                {/each}
            </div>
        </div>

        <!-- Advanced filtering checkbox -->
        <div class="form-check">
            <input
                type="checkbox"
                class="form-check-input"
                id="advanced-filtering-check"
                checked={showAdvancedFilters}
                onchange={(e) => onAdvancedFiltersChange(e.currentTarget.checked)}
            />
            <label class="form-check-label" for="advanced-filtering-check">
                {t('website-settings.advanced-filtering', { fallback: 'Advanced filtering' })}
            </label>
        </div>

        <!-- Filter button + object list (visible only when checkbox is checked) -->
        {#if showAdvancedFilters}
            <div class="d-flex flex-column gap-3 mt-2">
                <div class="d-flex align-items-center justify-content-between">
                    <p class="mb-0 fw-normal text-body text-uppercase" style="font-size: 12px; letter-spacing: 2px;">
                        {t('website-settings.preview-objects', { fallback: 'Preview objects on display' })}
                    </p>
                    <button type="button" class="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1" onclick={onOpenFilterPanel}>
                        <IconFilter size={14} />
                        {t('filters.title', { fallback: 'Filter' })}
                    </button>
                </div>

                <!-- Active filter chips -->
                {#if activeFilterChips.length > 0}
                    <div class="d-flex flex-wrap gap-2">
                        {#each activeFilterChips as chip}
                            <button
                                type="button"
                                class="d-inline-flex align-items-center gap-1 px-2 py-1  btn btn-outline-secondary"
                                onclick={() => removeFilterChip(chip)}
                            >
                                <span>{chip.type}: {chip.label}</span>
                                <IconX size={12} />
                            </button>
                        {/each}
                    </div>
                {/if}

                {#if searchLoading}
                    <p class="mb-0 text-body-secondary" style="font-size: 14px;">Loading...</p>
                {:else if searchResult.items?.length > 0}
                    <!-- Object preview table -->
                    <div class="border rounded-3 overflow-hidden">
                        <div class="d-flex gap-2 align-items-center px-2 py-1 bg-white">
                            <div style="width: 30px;">
                                <input
                                    type="checkbox"
                                    class="form-check-input m-0"
                                    checked={searchResult.items?.length > 0 && searchResult.items.every(obj => !excludeObjectIds.has(String(obj.id)))}
                                    onchange={onToggleAllObjects}
                                />
                            </div>
                            <p class="mb-0 fw-semibold text-body-secondary" style="width: 190px; font-size: 14px;">{t('common.object-id', { fallback: 'Object ID' })}</p>
                            <p class="mb-0 fw-semibold text-body-secondary" style="width: 180px; font-size: 14px;">{t('common.status', { fallback: 'Status' })}</p>
                            <p class="mb-0 fw-semibold text-body-secondary" style="font-size: 14px;">{t('common.institution', { fallback: 'Institution' })}</p>
                        </div>
                        {#each searchResult.items as obj, idx}
                            <div class="d-flex gap-2 align-items-center px-2 py-1 border-top bg-white" style="min-height: 52px;">
                                <div style="width: 30px;">
                                    <input
                                        type="checkbox"
                                        class="form-check-input m-0"
                                        checked={!excludeObjectIds.has(String(obj.id))}
                                        onchange={() => onToggleObjectExclusion(String(obj.id))}
                                    />
                                </div>
                                <div class="flex-shrink-0 rounded overflow-hidden" style="width: 51px; height: 52px;">
                                    <BaseImage
                                        asset={getFirstImageAsset(obj)}
                                        preferredFormat="sm"
                                        alt=""
                                        class="w-100 h-100"
                                        objectFit="cover"
                                        compact={true}
                                    />
                                </div>
                                <p class="mb-0 fw-semibold text-nowrap" style="width: 139px; font-size: 14px;">{obj?.name || obj?.id || ''}</p>
                                <div style="width: 180px;">
                                    {#if obj?.status === 'completed'}
                                        <span class="badge bg-success-subtle text-success-emphasis border border-success-subtle rounded-pill px-2 py-1">{t('common.completed', { fallback: 'Complete' })}</span>
                                    {:else if obj?.status === 'in progress'}
                                        <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill px-2 py-1">{t('common.in-progress', { fallback: 'Draft' })}</span>
                                    {:else}
                                        <span class="badge bg-secondary-subtle text-body-secondary rounded-pill px-2 py-1">{obj?.status || ''}</span>
                                    {/if}
                                </div>
                                <p class="mb-0 text-body-secondary text-nowrap" style="font-size: 14px;">{obj?.institution?.name?.content || obj?.institution?.name || ''}</p>
                            </div>
                        {/each}
                    </div>

                    <!-- Pagination -->
                    {#if searchResult.totalCount > pageSize}
                        <BasePagination bind:page={() => pageNum + 1, (p) => onPageChange(p)} {pageSize} count={searchResult.totalCount} size="sm" />
                    {/if}
                {:else}
                    <p class="mb-0 text-body-secondary" style="font-size: 14px;">
                        {t('export.no-objects-match', { fallback: 'No objects match the current filters' })}
                    </p>
                {/if}
            </div>
        {/if}
    </div>

   
</div>

 <!-- Green objects-exported counter bar (always visible) -->
    <div class="rounded border border-success  px-4 py-3 mt-4 mx-0 bg-success-subtle" >
        <p class="mb-0  text-black" style="font-size: 14px;">
            {t('website-settings.objects-exported-count', { count: exportedCount, fallback: '{{count}} objects will be shown on the website' })}
        </p>
    </div>

<!-- ObjectAdvancedFilters side panel -->
{#if advancedFiltersPanelOpen}
    <ObjectAdvancedFilters
        {researchFields}
        {ontologyFields}
        {institutions}
        {vocabularies}
        bind:advancedFilters
        facets={searchResult.facets || {}}
        onClose={() => advancedFiltersPanelOpen = false}
        {onFiltersChange}
    />
{/if}
