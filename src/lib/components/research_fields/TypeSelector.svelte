<script>
    let {
        value = $bindable("free text"),
        onChange = () => {},
        errors = [],
        onTypeChange = () => {}, // Custom callback for type changes
    } = $props();

    function handleChange(e) {
        const newValue = e.target.value;
        value = newValue;
        onChange(newValue);
        onTypeChange(newValue); // Call our custom callback
    }
</script>

<select
    class="form-select {errors.length > 0 ? 'is-invalid' : ''}"
    {value}
    onchange={handleChange}
>
    <option value="free text">Free Text</option>
    <option value="vocabulary">Vocabulary</option>
</select>

{#if errors.length > 0}
    <div class="invalid-feedback">
        {errors.join(", ")}
    </div>
{/if}
