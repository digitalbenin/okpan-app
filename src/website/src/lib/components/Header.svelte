<script>
    import { getWebsiteTranslationStore } from '$lib/stores/WebsiteTranslationStore.svelte.js';
    import { getWebsiteContentStore } from '$lib/stores/WebsiteContentStore.svelte.js';
    import { buildPathWithProjectId } from '$lib/utils/projectContext.js';
    import { resolveStaticHref } from '$lib/utils/sitePaths.js';

    let { project, settings, activeProjectId = null, title = undefined, description = undefined, showButton = true } = $props();
    const { t } = getWebsiteTranslationStore();
    const { content } = getWebsiteContentStore();

    const titleText = $derived.by(() => (
        title
        || content(settings, 'title')
        || content(project, 'name')
        || t('site.untitled-project')
    ));

    const descriptionText = $derived.by(() => (
        description
        || content(settings, 'short_description')
        || content(project, 'description')
        || ''
    ));

    const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';
    const aboutHref = $derived.by(() => isStaticExport
        ? resolveStaticHref('about')
        : buildPathWithProjectId('/about', activeProjectId)
    );
</script>

<div class="w-100 bg-white py-5 border-bottom border-secondary-subtle">
<header class="container d-flex flex-column gap-2">
    <h1 class="mb-2">{titleText}</h1>
    {#if descriptionText}
        <p class="mb-2 col-md-12 col-lg-7">{descriptionText}</p>
    {/if}
    {#if showButton}
    <a class="btn btn-dark rounded-3 align-self-start" href={aboutHref}>
        {t('home.know-more')}
    </a>
    {/if}
</header>
</div>
