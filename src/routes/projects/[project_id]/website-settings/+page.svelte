<script>
    import { page } from '$app/stores';
    import WebsiteSettingsForm from '$lib/components/website/WebsiteSettingsForm.svelte';

    // Access route data safely during SSR
    const websiteSettingsList = $derived($page?.data?.websiteSettings ?? []);
    const languages = $derived($page?.data?.languages ?? []);
    const projectId = $derived($page?.params?.project_id ?? null);

    const currentSettings = $derived(websiteSettingsList?.[0] ?? null);
    const mode = $derived(currentSettings ? 'edit' : 'create');
</script>

<div class="container-fluid py-4">
    <div class="row">
        <div class="col-12">
            <h1 class="h3 mb-3">Website Settings</h1>
            <WebsiteSettingsForm {mode} websiteSettings={currentSettings} {languages} {projectId} />
        </div>
    </div>
</div>