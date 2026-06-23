<script>
  import { RadioGroup, Label, useId } from "bits-ui";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let {
    value = $bindable(""),
    ref = $bindable(null),
    items,
    ...restProps
  } = $props();

  const { t } = getTranslationStore();
</script>

<RadioGroup.Root bind:value bind:ref class="border rounded" {...restProps}>
  {#each items as item}
    {@const id = useId()}
    <div class="form-check py-2 px-0  m-0 border-bottom"
      class:bg-primary-subtle={item.value === value}>
      <RadioGroup.Item {id} value={item.value} disabled={item.disabled}>
        {#snippet child({ props, checked })}
          <input
            class="form-check-input mx-2 px-0"
            type="radio"
            aria-checked={props["aria-checked"]}
            {checked}
            {value}
            {id}
            onclick={props.onclick}
            disabled={props.disabled}
            required={props.required}
          />
        {/snippet}
      </RadioGroup.Item>
      <Label.Root for={id} class="form-check-label text-capitalize ">
        {item.label}
        {#if item.suggested}
          <span class=" badge rounded p-2 ms-2 bg-primary fw-normal">
            {t("import.suggested", { fallback: "Suggested" })}
          </span>
        {/if}
      </Label.Root>
    </div>
  {/each}
</RadioGroup.Root>
