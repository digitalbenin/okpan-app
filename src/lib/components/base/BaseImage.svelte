<script>
    let {
        src,
        alt,
        width,
        height,
        class: customClass = "", // Add class prop with default empty string
        style: customStyle = "", // Add style prop with default empty string
        placeholder,
        objectFit = "cover",
        ratio,
        objectPosition = "center",
        loading = "lazy",
    } = $props();

    let error = $state(false);

    const onError = (event) => {
        error = true;
    };

    // Determine if placeholder should be compact (icon only) for small sizes
    const smallPlaceholder = $derived.by(() => {
        const w = width != null ? Number(width) : null;
        const h = height != null ? Number(height) : null;
        return (w != null && w < 200) || (h != null && h < 200);
    });
</script>

{#if error}
    <div
        class={`${customClass} bg-light d-flex align-items-center justify-content-center`}
        style={`aspect-ratio: ${ratio}; width: ${width ? width + "px" : "auto"}; height: ${height ? height + "px" : "auto"}; ${customStyle}`}
    >
        <div class="d-flex flex-column align-items-center justify-content-center gap-2 opacity-50">
            <i class={`bi bi-exclamation-circle ${smallPlaceholder ? 'fs-3' : 'fs-1'}`}></i>
            {#if !smallPlaceholder}
                <span class="fs-6">Error loading image</span>
            {/if}
        </div>
    </div>
{:else if src}
    <img
        {src}
        {alt}
        width={width ? width + "px" : "auto"}
        height={height ? height + "px" : "auto"}
        class={customClass}
        style={`aspect-ratio: ${ratio}; object-fit: ${objectFit}; object-position: ${objectPosition}; ${customStyle}`}
        {loading}
        {placeholder}
        onerror={onError}
    />
{:else}
    <div
        class={`${customClass} bg-light d-flex align-items-center justify-content-center`}
        style={`aspect-ratio: ${ratio}; width: ${width ? width + "px" : "auto"}; height: ${height ? height + "px" : "auto"}; ${customStyle}`}
    >
        <div class="d-flex flex-column align-items-center justify-content-center gap-2 opacity-50">
            <i class={`bi bi-image ${smallPlaceholder ? 'fs-3' : 'fs-1'}`}></i>
            {#if !smallPlaceholder}
                <span class="fs-6">No image</span>
            {/if}
        </div>
    </div>
{/if}
