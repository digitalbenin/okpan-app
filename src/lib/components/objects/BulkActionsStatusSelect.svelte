<script>
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { IconTransform } from "@tabler/icons-svelte";

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
  <IconTransform size={16} class="ms-n1"/>
    <span>
      {t("common.change-status", { fallback: "Change status" })}
    </span>
  </BaseSelect>
</div>