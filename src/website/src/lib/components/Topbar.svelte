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

	const titleText = $derived.by(() => (content(settings, 'title') || content(project, 'name') || t('site.untitled-project')));
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
</script>

<nav class="bg-white border-top border-bottom fixed-top px-3 py-2" style="z-index: 1030; display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 1rem;">
    <!-- Left: logo + title, truncates before the center column -->
    <div class="d-flex align-items-center gap-2" style="min-width: 0;" >
        <img src={logoUrl || logoWip} alt={titleText} style="width: 32px; height: 32px; object-fit: contain; flex-shrink: 0;" />
        <span class="fw-bold" style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{titleText}</span>
    </div>

    <!-- Center: navigation, always centered relative to the full navbar -->
    <ul class="navbar-nav flex-row gap-1 m-0 p-0" style="list-style: none;">
        <li class="nav-item">
            <a class="nav-link rounded-2 px-3 py-1 {isArchive ? 'bg-gray-200 text-dark border border-secondary-subtle' : 'text-secondary'}"
               href={archiveHref}>{t('nav.archive')}</a>
        </li>
        <li class="nav-item">
            <a class="nav-link rounded-2 px-3 py-1 {isConnections ? 'bg-gray-200 text-dark border border-secondary-subtle' : 'text-secondary'}"
               href={connectionsHref}>{t('nav.connections')}</a>
        </li>
        <li class="nav-item">
            <a class="nav-link rounded-2 px-3 py-1 {isAbout ? 'bg-gray-200 text-dark border border-secondary-subtle' : 'text-secondary'}"
               href={aboutHref}>{t('nav.about')}</a>
        </li>
    </ul>

    <!-- Right: language selector -->
    <div class="d-flex justify-content-end">
        {#if showContentLanguageSelector}
            <select
                class="form-select form-select-sm border-0"
                style="width: auto;"
                aria-label={t('nav.language')}
                value={contentState.currentLocale}
                onchange={(event) => setLocale(event.currentTarget.value)}
            >
                {#each contentState.languages as language}
                    <option value={language.code}>{language.code.toUpperCase()}</option>
                {/each}
            </select>
        {/if}
    </div>
</nav>
