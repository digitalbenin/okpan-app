<script>
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const { t } = getTranslationStore();

  let {
    value = $bindable(),
    items,
    onValueChange = () => {},
  } = $props();
</script>

<div class="d-inline-block">
  <BaseSelect
    {items}
    bind:value
    size={"sm"}
    inputClass={"btn-secondary"}
    as="button"
    {onValueChange}
  >
    <span>
      {t("common.change-status", { fallback: "Change status" })}
    </span>
    <i class="bi bi-chevron-down"></i>
  </BaseSelect>
</div>