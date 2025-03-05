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
</script>

{#if error}
    <div
        class={`${customClass} bg-light d-flex align-items-center justify-content-center`}
        style={`aspect-ratio: ${ratio}; width: ${width ? width + "px" : "auto"}; height: ${height ? height + "px" : "auto"}; ${customStyle}`}
    >
        <div
            class="d-flex flex-column align-items-center justify-content-center gap-2 opacity-50"
        >
            <i class="bi bi-exclamation-circle fs-1"></i>
            <span class="fs-6">Error loading image</span>
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
        <div
            class="d-flex flex-column align-items-center justify-content-center gap-2 opacity-50"
        >
            <i class="bi bi-image fs-1"></i>
            <span class="fs-6">No image</span>
        </div>
    </div>
{/if}
