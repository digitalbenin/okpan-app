<script>
    import { getAssetUrl } from '$lib/utils/imgUtils.js';
    let { project, settings } = $props();
    const titleText = $derived.by(() => settings?.title || project?.name || 'Untitled Project');
    const logoUrl = $derived.by(() => (settings?.logo_asset_path ? getAssetUrl({ asset_path: settings.logo_asset_path }) : ''));
</script>

<div class="flex align-items-between sticky-top">
    <div class="w-100 my-3 d-flex justify-content-start">
        {#if logoUrl}
            <img src={logoUrl} alt={titleText} class="img-fluid w-100" />
        {:else}
            <i class="bi bi-image text-secondary opacity-50 display-1"></i>
        {/if}
    </div>
    {#if project}
        <h1 class="mb-4">{titleText}</h1>
        <p>{project.description}</p>
    {/if}
</div>
