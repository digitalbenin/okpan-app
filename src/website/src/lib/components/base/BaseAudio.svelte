<script>
    import { getAssetUrl } from '$lib/utils/imgUtils.js';

    let {
        src = null,
        asset = null,
        class: customClass = '',
        style: customStyle = '',
        controls = true,
        preload = 'metadata',
        assetId = null,
        projectId = null,
        compact = false,
        element = $bindable(null),
        ontimeupdate = null,
        onloadedmetadata = null,
        onplay = null,
        onpause = null
    } = $props();

    let hasError = $state(false);

    function normalizePath(path) {
        if (!path) return '';
        if (/^(?:data:|blob:|https?:|media:)/i.test(path)) return path;
        return getAssetUrl({ asset_path: path });
    }

    const resolvedPath = $derived.by(() => asset?.path || asset?.asset_path || src || '');
    const audioSource = $derived(normalizePath(resolvedPath));

    function handleError() {
        hasError = true;
    }

    $effect(() => {
        audioSource;
        hasError = false;
    });
</script>

{#if audioSource && !hasError}
    <audio
        bind:this={element}
        src={audioSource}
        {controls}
        {preload}
        class={customClass}
        style={customStyle}
        onerror={handleError}
        {ontimeupdate}
        {onloadedmetadata}
        {onplay}
        {onpause}
    ></audio>
{:else}
    <div
        class={`${customClass} bg-light d-flex align-items-center justify-content-center overflow-hidden rounded`}
        style={`min-height: 54px; ${customStyle}`}
    >
        <div class="d-flex flex-row align-items-center justify-content-center gap-2 opacity-50 px-3">
            <i class="bi bi-music-note-beamed"></i>
            {#if !compact}
                <span class="small">{hasError ? 'Error loading audio' : 'No audio'}</span>
            {/if}
        </div>
    </div>
{/if}