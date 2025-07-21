<script>
  let { selected = $bindable(), objects } = $props();
  const checked = $derived.by(() => {
    const selectedLocal = selected.filter((id) =>
      objects.some((obj) => obj.id === id)
    );
    return (
      selectedLocal.length === objects.length &&
      selectedLocal.every((id) => objects.some((obj) => obj.id === id))
    );
  });

  const indeterminate = $derived.by(() => {
    const selectedLocal = selected.filter((id) =>
      objects.some((obj) => obj.id === id)
    );
    return selectedLocal.length > 0 && selectedLocal.length < objects.length;
  });
  function handleInputChange(event) {
    if (event.target.checked) {
      // Add all object ids to selected
      selected = [...selected, ...objects.map((obj) => obj.id)];
    } else {
      // Remove all object ids from selected
      selected = selected.filter((id) => !objects.some((obj) => obj.id === id));
    }
  }
</script>

<input
  type="checkbox"
  class="form-check-input"
  {checked}
  onchange={handleInputChange}
  {indeterminate}
/>
