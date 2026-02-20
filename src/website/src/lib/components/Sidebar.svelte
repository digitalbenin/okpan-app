<script>
    import { page } from '$app/stores';
    import { getAssetUrl } from '$lib/utils/imgUtils.js';
    import logoWip from '../../assets/logo_wip.png';
    import { currentProjectId } from '$lib/stores/project.js';
    let { project, settings } = $props();
    
    let isExpanded = $state(true);

    const titleText = $derived.by(() => (settings?.title?.trim() || project?.name || 'Untitled Project'));
    const descriptionText = $derived.by(() => (settings?.description?.trim() || project?.description || ''));
    const logoUrl = $derived.by(() => {
        const rawLogo = settings?.logo_asset_path;
        if (rawLogo && typeof rawLogo === 'object' && rawLogo.asset_path) {
            return getAssetUrl(rawLogo);
        }
        if (typeof rawLogo === 'string' && rawLogo.trim()) {
            const trimmed = rawLogo.trim();
            if (trimmed.startsWith('http') || trimmed.startsWith('/')) {
                return trimmed;
            }
            return getAssetUrl({ asset_path: trimmed });
        }
        return '';
    });

    const pathname = $derived.by(() => $page.url.pathname || '/');
    const isConnections = $derived.by(() => pathname.startsWith('/connections'));
    const isAbout = $derived.by(() => pathname.startsWith('/about'));
    const isArchive = $derived.by(() => !isConnections && !isAbout);

    // Append project_id query param to internal links in preview mode
    const projectQuery = $derived.by(() => $currentProjectId ? `?project_id=${$currentProjectId}` : '');

    function toggle() {
        isExpanded = !isExpanded;
    }
</script>

<div class={`d-flex flex-column h-100 bg-white border-end shadow-sm ${isExpanded ? 'p-4' : 'align-items-center py-3 px-3'}`} 
    style:width={isExpanded ? '20vw' : '78px'}
    style:min-width={isExpanded ? '20vw' : '78px'}
    style:max-width={isExpanded ? '20vw' : '78px'}
    style:overflow-x="hidden"
    style:overflow-y="auto"
    style:transition="width 0.3s ease-in-out">
    
    <!-- Logo Section -->
    <div class={`mb-4 w-100 d-flex flex-column ${isExpanded ? '' : 'align-items-center'}`}>
        {#if isExpanded}
             <!-- Large Logo -->
             <div class="w-100 mb-3 position-relative" style="padding-bottom: 100%;">
                <img src={logoUrl || logoWip} alt={titleText} class="position-absolute top-0 start-0 rounded-4 w-100 h-100" style="object-fit: contain;" />
             </div>
             <p class="mb-3 fw-bold">{titleText}</p>
             {#if descriptionText}
                <p class="text-muted small mb-4 lh-base">{descriptionText}</p>
             {/if}
        {:else}
             <!-- Small Icon/Logo -->
             <img src={logoUrl || logoWip} alt={titleText} style="width: 46px; height: 46px; object-fit: contain;" />
        {/if}
    </div>

    <!-- Navigation -->
    <nav class={`nav flex-column w-100 gap-1 ${isExpanded ? '' : 'align-items-center'}`}>
        <!-- Archive -->
        <a class={`nav-link d-flex align-items-center gap-3 rounded-2 px-3 py-2 ${isArchive ? 'bg-light text-dark fw-bold' : 'text-secondary'}`} 
           href={`/${projectQuery}`} 
           title="Archive"
           style:width={isExpanded ? '100%' : 'auto'}
           style:height={isExpanded ? 'auto' : '44px'}>
            <i class="bi bi-archive-fill fs-5"></i>
            {#if isExpanded}<span>Archive</span>{/if}
        </a>

        <!-- Connections -->
        <a class={`nav-link d-flex align-items-center gap-3 rounded-2 px-3 py-2 ${isConnections ? 'bg-light text-dark fw-bold' : 'text-secondary'}`} 
           href={`/connections${projectQuery}`} 
           title="Connections"
           style:width={isExpanded ? '100%' : 'auto'}
           style:height={isExpanded ? 'auto' : '44px'}>
            <i class="bi bi-share-fill fs-5"></i>
            {#if isExpanded}<span>Connections</span>{/if}
        </a>

        <!-- About -->
        <a class={`nav-link d-flex align-items-center gap-3 rounded-2 px-3 py-2 ${isAbout ? 'bg-light text-dark fw-bold' : 'text-secondary'}`} 
           href={`/about${projectQuery}`} 
           title="About"
           style:width={isExpanded ? '100%' : 'auto'}
           style:height={isExpanded ? 'auto' : '44px'}>
            <i class="bi bi-info-circle-fill fs-5"></i>
            {#if isExpanded}<span>About</span>{/if}
        </a>
    </nav>

    <!-- Footer Toggle -->
    <div class={`mt-auto w-100 d-flex align-items-center pt-3 ${isExpanded ? 'justify-content-end' : 'justify-content-center'}`}>
        <button onclick={toggle} class="btn btn-link text-dark p-0" aria-label={isExpanded ? "Collapse menu" : "Expand menu"}>
             <i class={`bi bi-chevron-${isExpanded ? 'left' : 'right'} fs-4`}></i>
        </button>
    </div>
</div>
