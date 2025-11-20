<script>
    import { page } from '$app/stores';
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

    const rightActionButtons = $derived([
        {
            id: 'save-website-settings',
            text: t('common.confirm', { fallback: 'Confirm' }),
            class: 'btn btn-success',
            onClick: () => websiteSettingsFormRef?.submitForm?.(),
        },
    ]);
</script>

<PageActionFooter contentClass="container-fluid py-4" rightButtons={rightActionButtons}>
    <div class="row">
        <div class="col-12">
            <h1 class="h3 mb-3">Website Settings</h1>
            <WebsiteSettingsForm
                bind:this={websiteSettingsFormRef}
                {mode}
                websiteSettings={currentSettings}
                {languages}
                {projectId}
            />
        </div>
    </div>
</PageActionFooter>