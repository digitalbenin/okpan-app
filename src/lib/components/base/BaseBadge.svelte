<script>
    let {
        text,
        value,
        class: customClass = "badge bg-primary", // Default to Bootstrap primary badge class
        style: customStyle = "",
    } = $props();
</script>

<span class={`badge rounded-pill px-3 ${customClass}`} style={customStyle}>
    {text || value}
</span>
