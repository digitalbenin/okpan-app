<script>
    import { getAssetUrl } from '$lib/utils/imgUtils.js';
    import { page } from '$app/stores';
    import { getWebsiteTranslationStore } from '$lib/stores/WebsiteTranslationStore.svelte.js';
    import { getWebsiteContentStore } from '$lib/stores/WebsiteContentStore.svelte.js';
    import { buildPathWithProjectId } from '$lib/utils/projectContext.js';
    import { resolveStaticHref } from '$lib/utils/sitePaths.js';
    import { slide } from 'svelte/transition';
    import logoWip from '../../assets/logo_wip.png';
    let { project, settings, activeProjectId = null } = $props();
    let expanded = $state(false);
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

    function toggle() {
        expanded = !expanded;
    }

    const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';
    const archiveHref = $derived.by(() => isStaticExport ? resolveStaticHref('') : buildPathWithProjectId('/', activeProjectId));
    const connectionsHref = $derived.by(() => isStaticExport ? resolveStaticHref('connections') : buildPathWithProjectId('/connections', activeProjectId));
    const aboutHref = $derived.by(() => isStaticExport ? resolveStaticHref('about') : buildPathWithProjectId('/about', activeProjectId));
    
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
        <button class="btn btn-link text-dark p-0" onclick={toggle} aria-label={t('nav.toggle-menu')}>
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
            <a class="nav-link text-dark px-4 py-3 border-bottom" href={archiveHref} onclick={toggle}>{t('nav.archive')}</a>
            <a class="nav-link text-dark px-4 py-3 border-bottom" href={connectionsHref} onclick={toggle}>{t('nav.connections')}</a>
            <a class="nav-link text-dark px-4 py-3 border-bottom" href={aboutHref} onclick={toggle}>{t('nav.about')}</a>
            {#if showContentLanguageSelector}
                <div class="px-4 py-3 border-bottom">
                    <label class="form-label small text-muted mb-1" for="mobile-language-select">{t('nav.content-language')}</label>
                    <select
                        id="mobile-language-select"
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
        </nav>
    </div>
{/if}
