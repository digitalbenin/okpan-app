<script>
  let { selected = $bindable(), id } = $props();
  let checked = $derived.by(() => selected.includes(id));
  function handleInputChange(event) {
    const value = event.target.value;
    if (selected.includes(value)) {
      selected = selected.filter((item) => item !== value);
    } else {
      selected = [...selected, value];
    }
  }
</script>

<input
  type="checkbox"
  class="form-check-input"
  bind:checked
  onchange={handleInputChange}
  value={id}
/>
