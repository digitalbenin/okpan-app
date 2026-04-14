<script>
    import { getAssetUrl } from '$lib/utils/imgUtils.js';

    let {
        src = null,
        asset = null,
        preferredFormat = 'sm',
        alt = '',
        width,
        height,
        class: customClass = '',
        style: customStyle = '',
        placeholder = undefined,
        objectFit = 'cover',
        ratio,
        objectPosition = 'center',
        loading = 'lazy',
        assetId = null,
        projectId = null,
        compact = false
    } = $props();

    let hasError = $state(false);

    function parseFormats(formats) {
        if (!formats) return {};
        if (typeof formats === 'string') {
            try {
                return JSON.parse(formats);
            } catch {
                return {};
            }
        }
        return formats;
    }

    function normalizePath(path) {
        if (!path) return '';
        if (/^(?:data:|blob:|https?:|media:)/i.test(path)) return path;
        return getAssetUrl({ asset_path: path });
    }

    const resolvedPath = $derived.by(() => {
        if (asset) {
            const formats = parseFormats(asset.formats || asset.asset_formats);
            const preferredPath =
                formats[preferredFormat] ||
                formats.sm ||
                formats.md ||
                formats.lg ||
                formats.thumbnail ||
                formats.original;

            return preferredPath || asset.path || asset.asset_path || src || '';
        }

        return src || '';
    });

    const imageSrc = $derived(normalizePath(resolvedPath));
    const isCompact = $derived.by(() => {
        if (compact) return true;
        const numericWidth = width != null ? Number(width) : null;
        const numericHeight = height != null ? Number(height) : null;
        return (numericWidth != null && numericWidth < 200) || (numericHeight != null && numericHeight < 200);
    });
    const wrapperStyle = $derived.by(() => {
        const parts = [];
        if (ratio) parts.push(`aspect-ratio: ${ratio};`);
        if (width) parts.push(`width: ${width}px;`);
        if (height) parts.push(`height: ${height}px;`);
        if (customStyle) parts.push(customStyle);
        return parts.join(' ');
    });

    function handleError() {
        hasError = true;
    }

    $effect(() => {
        imageSrc;
        hasError = false;
    });
</script>

{#if imageSrc && !hasError}
    <img
        src={imageSrc}
        {alt}
        {width}
        {height}
        class={customClass}
        style={`${ratio ? `aspect-ratio: ${ratio};` : ''} object-fit: ${objectFit}; object-position: ${objectPosition}; ${customStyle}`}
        {loading}
        onerror={handleError}
    />
{:else}
    <div
        class={`${customClass} bg-light d-flex align-items-center justify-content-center overflow-hidden`}
        style={wrapperStyle}
    >
        <div class="d-flex flex-column align-items-center justify-content-center gap-2 opacity-50 text-center">
            <i class={`bi bi-image ${isCompact ? 'fs-3' : 'fs-1'}`}></i>
            {#if !isCompact}
                <span class="fs-6">{hasError ? 'Error loading image' : 'No image'}</span>
            {/if}
        </div>
    </div>
{/if}