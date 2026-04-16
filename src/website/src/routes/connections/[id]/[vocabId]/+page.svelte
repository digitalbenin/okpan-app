<script>
    import { getAssetUrl } from '$lib/utils/imgUtils.js';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import { getWebsiteTranslationStore } from '$lib/stores/WebsiteTranslationStore.svelte.js';
    import { buildPathWithProjectId } from '$lib/utils/projectContext.js';
    import { resolveStaticHref } from '$lib/utils/sitePaths.js';
    const { t } = getWebsiteTranslationStore();

    const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';

    let { data } = $props();
    let researchField = $derived(data.researchField);
    let vocabulary = $derived(data.vocabulary);
    let allObjects = $derived(data.connectedObjects || []);
    const projectId = $derived(data?.queryParams?.projectId || data?.activeProjectId || null);
    const staticObjectBackHref = $derived.by(() => {
        if (!researchField?.id || !vocabulary?.id) return 'connections';
        return `connections/${researchField.id}/${vocabulary.id}`;
    });
    
    // Pagination
    let currentPage = $state(1);
    const pageSize = 5;
    let paginatedObjects = $derived(allObjects.slice((currentPage - 1) * pageSize, currentPage * pageSize));
    let totalPages = $derived(Math.ceil(allObjects.length / pageSize));

    function goToPage(p) {
        if (p >= 1 && p <= totalPages) {
            currentPage = p;
        }
    }

    // Process generic assets
    // vocabulary.assets contains list of attached generic assets.
    // Need to split into images, videos, audio.
    
    let videos = $derived((vocabulary?.assets || []).filter(a => a.type === 'video' || a.path.match(/\.(mp4|webm|ogg)$/i)));
    
    let images = $derived.by(() => {
        const list = (vocabulary?.assets || []).filter(a => a.type === 'image' || a.path.match(/\.(jpg|jpeg|png|gif|webp|avif)$/i));
        // Add main asset as first item if it exists and isn't already included
        if (vocabulary?.main_asset_path) {
            const isDuplicate = list.some(a => a.path === vocabulary.main_asset_path);
            if (!isDuplicate) {
                // Assuming main asset is an image since it's used as icon
                return [{ path: vocabulary.main_asset_path, type: 'image' }, ...list];
            }
        }
        return list;
    });

    let audio = $derived((vocabulary?.assets || []).filter(a => a.type === 'audio' || a.path.match(/\.(mp3|wav)$/i)));
    
    // Carousel state
    let videoIndex = $state(0);
    function nextVideo() {
        if (videos.length > 0) videoIndex = (videoIndex + 1) % videos.length;
    }
    function prevVideo() {
        if (videos.length > 0) videoIndex = (videoIndex - 1 + videos.length) % videos.length;
    }

    let imageIndex = $state(0);
    function nextImage() {
        if (images.length > 0) imageIndex = (imageIndex + 1) % images.length;
    }
    function prevImage() {
        if (images.length > 0) imageIndex = (imageIndex - 1 + images.length) % images.length;
    }
</script>

<div class="py-4 col-lg-8 col-md-12">
    <!-- Breadcrumb / Header -->
    <div class="mb-4">
        {#if researchField}
            <a href={isStaticExport ? resolveStaticHref(`connections/${researchField.id}`) : buildPathWithProjectId(`/connections/${researchField.id}`, projectId)} class="text-secondary text-decoration-none small mb-2 d-inline-block">
                {researchField.name}
            </a>
        {/if}
        
        <h1 class="fw-bold mb-3">{vocabulary?.name || t('common.unknown-item')}</h1>

        {#if vocabulary?.description}
            <p class="text-muted mb-3">{vocabulary.description}</p>
        {/if}

        {#if vocabulary?.external_link}
            <p class="mb-3">
                <span class="text-muted me-1">{t('common.link')}:</span>
                <a href={vocabulary.external_link} target="_blank" rel="noopener noreferrer" class="text-decoration-underline text-dark">
                    {vocabulary.external_link}
                </a>
            </p>
        {/if}
    </div>

    <!-- Media Sections -->
    
    <!-- Videos -->
    {#if videos.length > 0}
        <div class="mb-5">
            <h6 class="fw-bold mb-3"><i class="bi bi-play-btn me-2"></i>{t('media.videos')}</h6>
            <div class="card border-0 bg-light rounded-3 overflow-hidden position-relative" style="height: 400px;">
                <div class="w-100 h-100 d-flex align-items-center justify-content-center bg-black">
                    {#key videos[videoIndex].path}
                        <video controls class="d-block mw-100 mh-100">
                            <source src={getAssetUrl({ asset_path: videos[videoIndex].path })} type="video/mp4">
                            <track kind="captions" />
                            {t('media.browser-no-video')}
                        </video>
                    {/key}
                </div>
                
                {#if videos.length > 1}
                    <button class="btn btn-dark bg-opacity-50 border-0 position-absolute start-0 top-50 translate-middle-y ms-2 rounded-circle" onclick={prevVideo} aria-label={t('media.previous')}>
                        <i class="bi bi-chevron-left text-white"></i>
                    </button>
                    <button class="btn btn-dark bg-opacity-50 border-0 position-absolute end-0 top-50 translate-middle-y me-2 rounded-circle" onclick={nextVideo} aria-label={t('media.next')}>
                        <i class="bi bi-chevron-right text-white"></i>
                    </button>
                    
                    <div class="position-absolute bottom-0 start-50 translate-middle-x mb-2 d-flex gap-2">
                        {#each videos as vid, i}
                            <button 
                                class="btn p-0 rounded-circle border-0 {i === videoIndex ? 'bg-white' : 'bg-white bg-opacity-50'}"
                                style="width: 8px; height: 8px; transition: all 0.2s;"
                                onclick={() => videoIndex = i}
                                aria-label={t('media.go-to-video', { count: i + 1 })}
                            ></button>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    {/if}

    <!-- Images -->
    {#if images.length > 0}
        <div class="mb-5">
            <h6 class="fw-bold  mb-3"><i class="bi bi-images me-2"></i>{t('media.images')}</h6>
            <div class="card border-0 bg-light rounded-3 overflow-hidden position-relative" style="height: 400px;">
                <div class="w-100 h-100 d-flex align-items-center justify-content-center bg-secondary bg-opacity-10">
                     <img 
                        src={getAssetUrl({ asset_path: images[imageIndex].path })} 
                        alt={vocabulary.name}
                        class="mw-100 mh-100 object-fit-contain"
                     />
                </div>
                
                {#if images.length > 1}
                    <button class="btn btn-dark bg-opacity-50 border-0 position-absolute start-0 top-50 translate-middle-y ms-2 rounded-circle" onclick={prevImage} aria-label={t('media.previous')}>
                        <i class="bi bi-chevron-left text-white"></i>
                    </button>
                    <button class="btn btn-dark bg-opacity-50 border-0 position-absolute end-0 top-50 translate-middle-y me-2 rounded-circle" onclick={nextImage} aria-label={t('media.next')}>
                        <i class="bi bi-chevron-right text-white"></i>
                    </button>
                    
                    <div class="position-absolute bottom-0 start-50 translate-middle-x mb-2 d-flex gap-2">
                        {#each images as img, i}
                            <button 
                                class="btn p-0 rounded-circle border-0 {i === imageIndex ? 'bg-white' : 'bg-white bg-opacity-50'}"
                                style="width: 8px; height: 8px; transition: all 0.2s;"
                                onclick={() => imageIndex = i}
                                aria-label={t('media.go-to-image', { count: i + 1 })}
                            ></button>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    {/if}

    <!-- Audio -->
    {#if audio.length > 0}
        <div class="mb-5">
            <h6 class="fw-bold  mb-3"><i class="bi bi-volume-up me-2"></i>{t('media.audio')}</h6>
            <div class="d-flex flex-column gap-3">
                {#each audio as aud}
                    <div class="card border-0 bg-light p-3 rounded-pill">
                        <div class="d-flex align-items-center gap-3">
                            <audio controls class="flex-grow-1" style="height: 32px;">
                                <source src={getAssetUrl({ asset_path: aud.path })} type="audio/mpeg">
                                {t('media.browser-no-audio')}
                            </audio>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {/if}

    <!-- Linked Objects -->
    {#if allObjects.length > 0}
        <div class="card border rounded-3 mt-5">
            <div class="card-header bg-white border-bottom p-3">
                <h6 class="fw-bold mb-0"><i class="bi bi-box-seam me-2"></i>{t('object.linked-objects')}</h6>
                <small class="text-muted">{t('object.objects-count', { count: allObjects.length })}</small>
            </div>
            
            <div class="list-group list-group-flush">
                {#each paginatedObjects as obj}
                         <a href={isStaticExport ? `${resolveStaticHref(`${obj.id}`)}?back=${encodeURIComponent(staticObjectBackHref)}` : buildPathWithProjectId(`/${obj.id}`, projectId)} 
                             class="list-group-item list-group-item-action p-3 d-flex align-items-center"
                    >
                        <div class="bg-light rounded me-3 d-flex align-items-center justify-content-center overflow-hidden" style="width: 60px; height: 60px;">
                            {#if obj.main_image}
                                 <img src={getAssetUrl({ asset_path: obj.main_image })} alt={obj.name} class="w-100 h-100 object-fit-cover">
                            {:else}
                                <i class="bi bi-image text-secondary fs-4"></i>
                            {/if}
                        </div>
                        <div>
                            <div class="fw-bold text-decoration-underline text-success-emphasis">{obj.name || obj.id}</div> 
                            <div class="small text-muted">{obj.institution_name}</div>
                        </div>
                    </a>
                {/each}
            </div>

            {#if totalPages > 1}
                <div class="card-footer bg-white p-2 d-flex justify-content-center">
                    <nav>
                        <ul class="pagination pagination-sm mb-0">
                            <li class="page-item {currentPage === 1 ? 'disabled' : ''}">
                                <button class="page-link text-dark" onclick={() => goToPage(currentPage - 1)} aria-label={t('pagination.previous-page')}>
                                    <i class="bi bi-chevron-left"></i>
                                </button>
                            </li>
                            
                            {#each Array(totalPages) as _, i}
                                <li class="page-item {currentPage === i + 1 ? 'active' : ''}">
                                    <button class="page-link {currentPage === i + 1 ? 'bg-success border-success text-white' : 'text-dark'}" onclick={() => goToPage(i + 1)}>
                                        {i + 1}
                                    </button>
                                </li>
                            {/each}

                            <li class="page-item {currentPage === totalPages ? 'disabled' : ''}">
                                <button class="page-link text-dark" onclick={() => goToPage(currentPage + 1)} aria-label={t('pagination.next-page')}>
                                    <i class="bi bi-chevron-right"></i>
                                </button>
                            </li>
                        </ul>
                    </nav>
                </div>
            {/if}
        </div>
    {/if}
</div>
