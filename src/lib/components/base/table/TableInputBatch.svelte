<script>
  let { selected = $bindable(), items } = $props();
  const checked = $derived.by(() => {
    const selectedLocal = selected.filter((id) =>
      items.some((item) => item.id === id)
    );
    return (
      selectedLocal.length === items.length &&
      selectedLocal.every((id) => items.some((item) => item.id === id))
    );
  });

  const indeterminate = $derived.by(() => {
    const selectedLocal = selected.filter((id) =>
      items.some((item) => item.id === id)
    );
    return selectedLocal.length > 0 && selectedLocal.length < items.length;
  });
  function handleInputChange(event) {
    if (event.target.checked) {
      // Add all item ids to selected
      const newIds = items.map((item) => item.id);
      selected = [...new Set([...selected, ...newIds])];
    } else {
      // Remove all item ids from selected
      selected = selected.filter((id) => !items.some((item) => item.id === id));
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
