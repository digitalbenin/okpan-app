<script>
    import { getAssetUrl } from '$lib/utils/imgUtils.js';
    import { buildPathWithProjectId } from '$lib/utils/projectContext.js';
    
    let { data } = $props();
    let researchField = $derived(data.researchField);
    let vocabularies = $derived(data.vocabularies);
    const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';
    const projectId = $derived(data?.queryParams?.projectId || data?.activeProjectId || null);
</script>

<div class="py-4">
    <div class="mb-4">
        <a href={isStaticExport ? '/connections' : buildPathWithProjectId('/connections', projectId)} class="text-secondary text-decoration-none small mb-2 d-inline-block">Connections</a>
        <h1 class="fw-bold mb-3">{researchField?.name || 'Unknown'}</h1>
        
        {#if researchField?.description}
            <p class="text-muted">{researchField.description}</p>
        {/if}
    </div>

    <div class="d-flex flex-column gap-3">
        {#each vocabularies as item}
            <a href={isStaticExport ? `/connections/${researchField.id}/${item.id}` : buildPathWithProjectId(`/connections/${researchField.id}/${item.id}`, projectId)} class="text-decoration-none text-dark">
                <div class="card border rounded-3 p-2 hover-shadow">
                    <div class="d-flex align-items-center">
                        <div class="flex-shrink-0 me-2">
                            {#if item.main_asset_path}
                                 <img 
                                    src={getAssetUrl({ asset_path: item.main_asset_path })} 
                                    alt={item.name} 
                                    class="rounded-circle object-fit-cover" 
                                    style="width: 64px; height: 64px;"
                                    loading="lazy"
                                 >
                            {:else}
                                 <div class="rounded-circle bg-light d-flex align-items-center justify-content-center text-secondary fw-bold" style="width: 64px; height: 64px; font-size: 1.5rem;">
                                    {item.name?.[0]?.toUpperCase()}
                                 </div>
                            {/if}
                        </div>
                        
                        <div class="flex-grow-1">
                            <h5 class="mb-1 text-dark fw-bold">{item.name}</h5>
                            <div class="text-muted small">
                                 {item.count || 0} objects connected
                            </div>
                        </div>
                    </div>
                </div>
            </a>
        {/each}
        {#if vocabularies.length === 0}
            <div class="card p-4 text-center text-muted">
                No items found.
            </div>
        {/if}
    </div>
</div>
