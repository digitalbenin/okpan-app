<script>
    import { page } from '$app/stores';
    import { invalidateAll } from '$app/navigation';
    import { watch } from 'runed';
    import { IconWorldCog, IconBulb } from '@tabler/icons-svelte';
    import PageActionFooter from '$lib/components/common/PageActionFooter.svelte';
    import WebsiteSettingsForm from '$lib/components/website/WebsiteSettingsForm.svelte';
    import WebsiteSettingsFilter from '$lib/components/website/WebsiteSettingsFilter.svelte';
    import { searchObjects } from '$lib/api/ObjectsApi.js';
    import { updateWebsiteSettings } from '$lib/api/WebsiteSettingsApi.js';
    import { getTranslationStore } from '$lib/stores/InterfaceTranslationStore.svelte.js';

    const { t } = getTranslationStore();

    // --- Route data ---
    const websiteSettingsList = $derived($page?.data?.websiteSettings ?? []);
    const languages = $derived($page?.data?.languages ?? []);
    const projectId = $derived($page?.params?.project_id ?? null);
    const layoutResearchFields = $derived($page?.data?.researchFields ?? []);
    const layoutOntologyFields = $derived($page?.data?.ontologyFields ?? []);
    const layoutInstitutions = $derived($page?.data?.institutions ?? []);
    const initialSearch = $page?.data?.initialSearch ?? null;

    const getFieldList = (fields) => fields?.result || (Array.isArray(fields) ? fields : []);
    const fieldList = $derived({
        researchFields: getFieldList(layoutResearchFields),
        ontologyFields: getFieldList(layoutOntologyFields),
        institutions: getFieldList(layoutInstitutions),
    });

    const currentSettings = $derived(websiteSettingsList?.[0] ?? null);
    const mode = $derived(currentSettings ? 'edit' : 'create');
    const isEditMode = $derived(!!currentSettings);

    const vocabularies = $derived(
        getFieldList(layoutResearchFields)
            .filter((f) => (f.type || '').toLowerCase() === 'vocabulary')
            .flatMap((f) =>
                (f.vocabularies || []).map((v) => ({ id: v.id, field_id: f.id, name: v.option?.content || v.option || '' }))
            )
    );

    // --- Form ref ---
    let websiteSettingsFormRef = $state(null);
    const formStore = $derived(websiteSettingsFormRef?.getFormStore?.() || null);

    // --- Filter state ---
    let selectedStatus = $state('all');
    let showAdvancedFilters = $state(false);       // checkbox: controls visibility of filter button + object list
    let advancedFiltersPanelOpen = $state(false);   // whether the ObjectAdvancedFilters side panel is open
    let advancedFilters = $state({});               // the actual applied filters
    let excludeObjectIds = $state(new Set());       // set of excluded object IDs (individually unmarked)
    let searchResult = $state(initialSearch ?? { items: [], totalCount: 0, facets: { institutions: [], statuses: [], researchFields: [] } });
    let searchLoading = $state(false);
    let pageNum = $state(0);                        // 0-based for API
    const PAGE_SIZE = 10;

    // --- Derived counts ---
    const completedCount = $derived(
        (searchResult.facets?.statuses || []).find((s) => (s.id ?? s.name) === 'completed')?.count ?? 0
    );
    const inProgressCount = $derived(
        (searchResult.facets?.statuses || []).find((s) => (s.id ?? s.name) === 'in progress')?.count ?? 0
    );
    const allCount = $derived(completedCount + inProgressCount);

    const statusOptions = $derived([
        { value: 'all', label: t('filters.all', { fallback: 'All' }), count: allCount },
        { value: 'completed', label: t('common.completed', { fallback: 'Completed' }), count: completedCount },
        { value: 'in progress', label: t('common.in-progress', { fallback: 'Draft' }), count: inProgressCount },
    ]);

    // --- Build the filters payload that gets saved to DB (same format as stored filters) ---
    const currentFiltersPayload = $derived.by(() => {
        if (!showAdvancedFilters) return {};
        const payload = {};
        if (selectedStatus !== 'all') payload.status = selectedStatus;
        if (advancedFilters.institutions?.length) payload.institutionIds = [...advancedFilters.institutions];
        const rff = [];
        for (const key of Object.keys(advancedFilters)) {
            if (key.startsWith('__') || key === 'institutions') continue;
            const ids = advancedFilters[key];
            if (Array.isArray(ids) && ids.length)
                rff.push({ fieldId: key, vocabularyIds: [...ids] });
        }
        if (advancedFilters.__textFilters?.length) {
            for (const tf of advancedFilters.__textFilters) {
                if (!tf?.fieldId) continue;
                rff.push({ fieldId: tf.fieldId, query: tf.query || '' });
            }
        }
        if (rff.length) payload.researchFieldFilters = rff;
        if (excludeObjectIds.size > 0) payload.excludeObjectIds = [...excludeObjectIds];
        return payload;
    });

    // --- Build search params from current state ---
    function buildParams() {
        const params = { projectId, page: pageNum, pageSize: PAGE_SIZE };
        if (!showAdvancedFilters) return params;
        if (selectedStatus !== 'all') params.status = selectedStatus;

        if (advancedFilters.institutions?.length)
            params.institutionIds = [...advancedFilters.institutions];

        const researchFieldFilters = [];
        for (const key of Object.keys(advancedFilters)) {
            if (key.startsWith('__') || key === 'institutions') continue;
            const ids = advancedFilters[key];
            if (Array.isArray(ids) && ids.length)
                researchFieldFilters.push({ fieldId: key, vocabularyIds: [...ids] });
        }
        if (advancedFilters.__textFilters?.length) {
            for (const tf of advancedFilters.__textFilters) {
                if (!tf?.fieldId) continue;
                researchFieldFilters.push({ fieldId: tf.fieldId, query: tf.query || '' });
            }
        }
        if (researchFieldFilters.length) params.researchFieldFilters = researchFieldFilters;
        return params;
    }

    // --- Search ---
    async function doSearch() {
        if (!projectId) return;
        searchLoading = true;
        try {
            const params = buildParams();
            console.log('[WebsiteSettings] Search params:', params);
            const response = await searchObjects(params);
            searchResult = response ?? { items: [], totalCount: 0, facets: {} };
            console.log('[WebsiteSettings] Search results:', {
                totalCount: searchResult.totalCount,
                itemsCount: searchResult.items?.length,
                items: searchResult.items,
                facets: searchResult.facets
            });
        } catch (e) {
            console.error('[WebsiteSettings] Search failed:', e);
            searchResult = { items: [], totalCount: 0, facets: {} };
        } finally {
            searchLoading = false;
        }
    }
    // --- Called by ObjectAdvancedFilters when "Apply" is clicked ---
    function onFiltersChange(nextFilters) {
        console.log('[WebsiteSettings] Filters applied:', nextFilters);
        advancedFilters = nextFilters;
        pageNum = 0;
        doSearch();
    }

    // --- Status radio changed ---
    function onStatusChange() {
        console.log('[WebsiteSettings] Status changed to:', selectedStatus);
        pageNum = 0;
        doSearch();
    }

    // --- Pagination (BasePagination is 1-based) ---
    function onPageChange(p) {
        pageNum = p - 1;
        doSearch();
    }

    // --- Handle Advanced Filters checkbox change manually to prevent auto-save ---
    function handleAdvancedFiltersChange(checked) {
        showAdvancedFilters = checked;
        if (checked) {
            console.log('[WebsiteSettings] Advanced filters enabled manually');
            advancedFiltersPanelOpen = true;
        } else {
            console.log('[WebsiteSettings] Advanced filters disabled manually — resetting');
            advancedFiltersPanelOpen = false;
            advancedFilters = {};
            selectedStatus = 'all';
            excludeObjectIds = new Set();
            pageNum = 0;
            doSearch();
        }
    }

    // --- Individual object selection/exclusion ---
    function onToggleObjectExclusion(id) {
        if (excludeObjectIds.has(id)) {
            excludeObjectIds.delete(id);
        } else {
            excludeObjectIds.add(id);
        }
        excludeObjectIds = new Set(excludeObjectIds);
    }

    function onToggleAllObjects() {
        const visibleIds = (searchResult.items || []).map(obj => String(obj.id));
        const allVisibleChecked = visibleIds.every(id => !excludeObjectIds.has(id));
        
        if (allVisibleChecked) {
            // Exclude all currently visible objects
            visibleIds.forEach(id => excludeObjectIds.add(id));
        } else {
            // Include all currently visible objects (remove from exclusion)
            visibleIds.forEach(id => excludeObjectIds.delete(id));
        }
        excludeObjectIds = new Set(excludeObjectIds);
    }

    // --- Restore stored filters from DB whenever currentSettings changes ---
    // (runs on mount AND after invalidateAll() reloads data)
    function restoreFilters(settings) {
        if (!settings) {
            console.log('[WebsiteSettings] restoreFilters: no settings yet');
            return;
        }

        let stored = settings?.filters;
        console.log('[WebsiteSettings] restoreFilters — raw filters:', stored, 'type:', typeof stored, 'settings.id:', settings.id);

        // GraphQL may return JSON as a string — parse it
        if (typeof stored === 'string' && stored.trim()) {
            try { stored = JSON.parse(stored); } catch (e) {
                console.error('[WebsiteSettings] Failed to parse filters JSON:', stored, e);
                stored = null;
            }
        }

        if (stored && typeof stored === 'object' && Object.keys(stored).length > 0) {
            if (stored.status && stored.status !== 'all') {
                selectedStatus = stored.status;
                console.log('[WebsiteSettings] Restored status:', selectedStatus);
            }
            if (stored.excludeObjectIds?.length) {
                excludeObjectIds = new Set(stored.excludeObjectIds.map(String));
                console.log('[WebsiteSettings] Restored excludeObjectIds:', excludeObjectIds);
            } else {
                excludeObjectIds = new Set();
            }
            const adv = {};
            if (stored.institutionIds?.length) {
                adv.institutions = [...stored.institutionIds];
                console.log('[WebsiteSettings] Restored institutions:', adv.institutions);
            }
            if (stored.researchFieldFilters?.length) {
                for (const rf of stored.researchFieldFilters) {
                    if (rf.vocabularyIds?.length) {
                        adv[rf.fieldId] = [...rf.vocabularyIds];
                        console.log('[WebsiteSettings] Restored vocab field:', rf.fieldId, adv[rf.fieldId]);
                    }
                    if (rf.query) {
                        adv.__textFilters = [...(adv.__textFilters || []), { kind: 'research', fieldId: rf.fieldId, query: rf.query }];
                        console.log('[WebsiteSettings] Restored text filter:', rf.fieldId, rf.query);
                    }
                }
            }
            if (Object.keys(adv).length) {
                advancedFilters = adv;
                showAdvancedFilters = true;
                console.log('[WebsiteSettings] Restored advancedFilters:', advancedFilters, 'showAdvancedFilters:', showAdvancedFilters);
            } else if (stored.status && stored.status !== 'all') {
                showAdvancedFilters = true;
                console.log('[WebsiteSettings] Only status stored, showAdvancedFilters = true');
            }
        } else {
            console.log('[WebsiteSettings] No stored filters to restore (stored is empty/null)');
        }
    }
    watch(
        () => currentSettings,
        (settings, prevSettings) => {
            console.log('[WebsiteSettings] watch currentSettings fired. settings?.id:', settings?.id, 'prev?.id:', prevSettings?.id);
            restoreFilters(settings);
        }
    );

    // --- Form submit ---
    const rightActionButtons = $derived([
        {
            id: 'save-website-settings',
            text: t('common.confirm'),
            class: 'btn btn-success',
            onClick: async () => {
                console.log('[WebsiteSettings] Submitting form...');
                websiteSettingsFormRef?.submitForm?.();
            },
            disableOnError: true,
        },
    ]);

    async function handleSuccess() {
        await invalidateAll();
    }
</script>

<div class="bg-white border-bottom mx-n4 mt-n4 px-4 py-3">
    <div class="d-flex flex-column gap-3">
        <div class="d-flex align-items-center gap-3">
            <div class="bg-gray-200 text-gray-500 rounded-4 d-flex align-items-center justify-content-center flex-shrink-0" style="width: 48px; height: 48px;">
                <IconWorldCog size={32} />
            </div>
            <h1 class="mb-0 flex-grow-1">{t('menu.website-settings')}</h1>
        </div>
        <p class="fs-7 text-body-secondary mb-0">{t('website-settings.page-description', { fallback: 'Configure how your project appears when exported as a static website.' })}</p>
    </div>
</div>

<PageActionFooter contentClass="container-fluid py-4" rightButtons={rightActionButtons} formStore={formStore}>
    <div class="row g-3">
        <div class="col-12 col-lg-8 col-xl-9 min-w-0 mb-5">
            <div class="bg-white rounded-3 p-4">
                <WebsiteSettingsForm
                    bind:this={websiteSettingsFormRef}
                    {mode}
                    websiteSettings={currentSettings}
                    {languages}
                    {projectId}
                    currentFilters={currentFiltersPayload}
                    onSuccess={handleSuccess}
                />
            </div>

            <WebsiteSettingsFilter
                bind:selectedStatus
                {statusOptions}
                showAdvancedFilters={showAdvancedFilters}
                bind:advancedFiltersPanelOpen
                bind:advancedFilters
                {searchResult}
                {searchLoading}
                bind:pageNum
                pageSize={PAGE_SIZE}
                researchFields={fieldList.researchFields}
                ontologyFields={fieldList.ontologyFields}
                institutions={fieldList.institutions}
                {vocabularies}
                {onStatusChange}
                {onFiltersChange}
                {onPageChange}
                onOpenFilterPanel={() => advancedFiltersPanelOpen = !advancedFiltersPanelOpen}
                onAdvancedFiltersChange={handleAdvancedFiltersChange}
                {excludeObjectIds}
                {onToggleObjectExclusion}
                {onToggleAllObjects}
            />
        </div>
        <div class="col-12 col-lg-4 col-xl-3">
            <div class="bg-white border rounded-3 p-4 sticky-lg-top" style="top: 1rem; z-index: 1;">
                <div class="d-flex flex-column gap-3">
                    <div class="flex-shrink-0">
                        <IconBulb size={16} stroke={2} />
                    </div>
                    <div>
                        <p class="fw-semibold mb-1 text-body">
                            {t('website-settings.help-title', { fallback: 'About website settings' })}
                        </p>
                        <div class="text-body-secondary fs-7">
                            <p class="mb-2">
                                {t('website-settings.help-desc-p1', { fallback: 'Configure how your project appears when exported as a public website. Set the title, description, and logo that visitors will see.' })}
                            </p>
                            <p class="mb-0">
                                {t('website-settings.help-desc-p2', { fallback: 'Changes made here are reflected in the exported website, not in the Okpan application itself.' })}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</PageActionFooter>