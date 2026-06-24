<script>
    import { page } from '$app/stores';
    import { invalidateAll } from '$app/navigation';
    import { IconWorldCog, IconBulb } from '@tabler/icons-svelte';
    import PageActionFooter from '$lib/components/common/PageActionFooter.svelte';
    import WebsiteSettingsForm from '$lib/components/website/WebsiteSettingsForm.svelte';
    import { getTranslationStore } from '$lib/stores/InterfaceTranslationStore.svelte.js';

    // Access route data safely during SSR
    const websiteSettingsList = $derived($page?.data?.websiteSettings ?? []);
    const languages = $derived($page?.data?.languages ?? []);
    const projectId = $derived($page?.params?.project_id ?? null);

    const currentSettings = $derived(websiteSettingsList?.[0] ?? null);
    const mode = $derived(currentSettings ? 'edit' : 'create');

    const { t } = getTranslationStore();
    let websiteSettingsFormRef = $state(null);

    const formStore = $derived(websiteSettingsFormRef?.getFormStore?.() || null);

    const rightActionButtons = $derived([
        {
            id: 'save-website-settings',
            text: t('common.confirm'),
            class: 'btn btn-success',
            onClick: () => websiteSettingsFormRef?.submitForm?.(),
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
                    onSuccess={handleSuccess}
                />
            </div>
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