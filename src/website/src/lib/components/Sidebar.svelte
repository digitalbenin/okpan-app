<script>
    import { page } from '$app/stores';
    import { getAssetUrl } from '$lib/utils/imgUtils.js';
    let { project, settings } = $props();
    const titleText = $derived.by(() => settings?.title || project?.name || 'Untitled Project');
    const descriptionText = $derived.by(() => settings?.description || project?.description || '');
    const logoUrl = $derived.by(() => (settings?.logo_asset_path ? getAssetUrl({ asset_path: settings.logo_asset_path }) : ''));

    const pathname = $derived.by(() => $page.url.pathname || '/');
    const isConnections = $derived.by(() => pathname.startsWith('/connections'));
    const isAbout = $derived.by(() => pathname.startsWith('/about'));
    const isArchive = $derived.by(() => !isConnections && !isAbout);
</script>

<div class="d-flex flex-column align-items-start sticky-top gap-3">
    <div class="w-100 my-3 d-flex justify-content-start">
        {#if logoUrl}
            <img src={logoUrl} alt={titleText} class="img-fluid w-100" />
        {:else}
            <i class="bi bi-image text-secondary opacity-50 display-1"></i>
        {/if}
    </div>
    {#if project}
        <h1 class="mb-2 h4">{titleText}</h1>
        {#if descriptionText}
            <p class="text-muted small mb-2">{descriptionText}</p>
        {/if}
    {/if}

    <nav class="nav flex-column w-100 gap-2">
        <a class={`nav-link d-flex align-items-center gap-2 rounded-3 px-3 py-2 text-dark ${isArchive ? 'bg-light fw-semibold' : 'text-muted'}`} href="/">
            <i class="bi bi-house-fill"></i>
            <span>Archive</span>
        </a>
        <a class={`nav-link d-flex align-items-center gap-2 rounded-3 px-3 py-2 text-dark ${isConnections ? 'bg-light fw-semibold' : 'text-muted'}`} href="/connections">
            <i class="bi bi-bank2"></i>
            <span>Connections</span>
        </a>
        <a class={`nav-link d-flex align-items-center gap-2 rounded-3 px-3 py-2 text-dark ${isAbout ? 'bg-light fw-semibold' : 'text-muted'}`} href="/about">
            <i class="bi bi-box"></i>
            <span>About</span>
        </a>
    </nav>
</div>
