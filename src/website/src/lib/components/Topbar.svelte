<script>
    import { getAssetUrl } from '$lib/utils/imgUtils.js';
    import { page } from '$app/stores';
    import { slide } from 'svelte/transition';
    import logoWip from '../../assets/logo_wip.png';
    import { currentProjectId } from '$lib/stores/project.js';
    let { project, settings } = $props();
    let expanded = $state(false);

    const titleText = $derived.by(() => (settings?.title?.trim() || project?.name || 'Untitled Project'));
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

    const projectQuery = $derived.by(() => $currentProjectId ? `?project_id=${$currentProjectId}` : '');

    function toggle() {
        expanded = !expanded;
    }
    
    // Auto-collapse when navigating
    $effect(() => {
        // dep on pathname
        $page.url.pathname;
        expanded = false;
    });
</script>

<div class="bg-white border-bottom sticky-top" style="z-index: 1030;">
    <div class="d-flex align-items-center justify-content-between px-3 py-2">
        <div class="d-flex align-items-center gap-3">
             <!-- Logo -->
                 <div class="rounded-1 d-flex align-items-center justify-content-center" style="width: 40px; height: 40px; background-color: #A39145;">
                     <img src={logoUrl || logoWip} alt={titleText} class="w-100 h-100 object-fit-cover rounded-1" />
                 </div>
            <div class="mb-0 fw-bold">{titleText}</div>
        </div>
        <button class="btn btn-link text-dark p-0" onclick={toggle} aria-label="Toggle menu">
            <i class={`bi fs-1 ${expanded ? 'bi-x' : 'bi-list'}`}></i>
        </button>
    </div>
</div>

{#if expanded}
    <div 
        transition:slide={{ duration: 300 }}
        class="position-fixed w-100 bg-white d-md-none shadow-lg" 
        style="z-index: 1025; top: 60px; left: 0; overflow: hidden;">
        <nav class="nav flex-column">
            <a class="nav-link text-dark px-4 py-3 border-bottom" href={`/${projectQuery}`} onclick={toggle}>Archive</a>
            <a class="nav-link text-dark px-4 py-3 border-bottom" href={`/connections${projectQuery}`} onclick={toggle}>Connections</a>
            <a class="nav-link text-dark px-4 py-3 border-bottom" href={`/about${projectQuery}`} onclick={toggle}>About</a>
        </nav>
    </div>
{/if}
