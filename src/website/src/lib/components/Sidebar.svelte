<script>
    import { page } from '$app/stores';
    import { getAssetUrl } from '$lib/utils/imgUtils.js';
    import { getWebsiteTranslationStore } from '$lib/stores/WebsiteTranslationStore.svelte.js';
    import { getWebsiteContentStore } from '$lib/stores/WebsiteContentStore.svelte.js';
    import { buildPathWithProjectId } from '$lib/utils/projectContext.js';
    import { resolveStaticHref } from '$lib/utils/sitePaths.js';
    import logoWip from '../../assets/logo_wip.png';
    let { project, settings, activeProjectId = null } = $props();
    const { t } = getWebsiteTranslationStore();
    const { contentState, setLocale, content } = getWebsiteContentStore();
    
    let isExpanded = $state(true);

	const titleText = $derived.by(() => (content(settings, 'title') || content(project, 'name') || t('site.untitled-project')));
	const descriptionText = $derived.by(() => (content(settings, 'description') || content(project, 'description') || ''));
	const showContentLanguageSelector = $derived.by(() => contentState.languages.length > 1);
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

    const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';

    const archiveHref = $derived.by(() => isStaticExport ? resolveStaticHref('') : buildPathWithProjectId('/', activeProjectId));
    const connectionsHref = $derived.by(() => isStaticExport ? resolveStaticHref('connections') : buildPathWithProjectId('/connections', activeProjectId));
    const aboutHref = $derived.by(() => isStaticExport ? resolveStaticHref('about') : buildPathWithProjectId('/about', activeProjectId));

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
              href={archiveHref} 
           title={t('nav.archive')}
           style:width={isExpanded ? '100%' : 'auto'}
           style:height={isExpanded ? 'auto' : '44px'}>
            <i class="bi bi-archive-fill fs-5"></i>
            {#if isExpanded}<span>{t('nav.archive')}</span>{/if}
        </a>

        <!-- Connections -->
        <a class={`nav-link d-flex align-items-center gap-3 rounded-2 px-3 py-2 ${isConnections ? 'bg-light text-dark fw-bold' : 'text-secondary'}`} 
              href={connectionsHref} 
           title={t('nav.connections')}
           style:width={isExpanded ? '100%' : 'auto'}
           style:height={isExpanded ? 'auto' : '44px'}>
            <i class="bi bi-share-fill fs-5"></i>
            {#if isExpanded}<span>{t('nav.connections')}</span>{/if}
        </a>

        <!-- About -->
        <a class={`nav-link d-flex align-items-center gap-3 rounded-2 px-3 py-2 ${isAbout ? 'bg-light text-dark fw-bold' : 'text-secondary'}`} 
              href={aboutHref} 
           title={t('nav.about')}
           style:width={isExpanded ? '100%' : 'auto'}
           style:height={isExpanded ? 'auto' : '44px'}>
            <i class="bi bi-info-circle-fill fs-5"></i>
            {#if isExpanded}<span>{t('nav.about')}</span>{/if}
        </a>
    </nav>

    {#if showContentLanguageSelector}
        <div class={`mt-5 w-100 ${isExpanded ? '' : 'd-none'}`}>
            <label class="form-label small text-muted mb-1" for="sidebar-language-select">{t('nav.content-language')}</label>
            <select
                id="sidebar-language-select"
                class="form-select form-select-sm"
                value={contentState.currentLocale}
                onchange={(event) => setLocale(event.currentTarget.value)}
            >
                {#each contentState.languages as language}
                    <option value={language.code}>{language.name}</option>
                {/each}
            </select>
        </div>
    {/if}

    <!-- Footer Toggle -->
    <div class={`mt-auto w-100 d-flex align-items-center pt-3 ${isExpanded ? 'justify-content-end' : 'justify-content-center'}`}>
        <button onclick={toggle} class="btn btn-link text-dark p-0" aria-label={isExpanded ? t('nav.collapse-menu') : t('nav.expand-menu')}>
             <i class={`bi bi-chevron-${isExpanded ? 'left' : 'right'} fs-4`}></i>
        </button>
    </div>
</div>
