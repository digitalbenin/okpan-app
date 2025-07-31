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

<RadioGroup.Root bind:value bind:ref {...restProps}>
  {#each items as item}
    {@const id = useId()}
    <div class="form-check">
      <RadioGroup.Item {id} value={item.value} disabled={item.disabled}>
        {#snippet child({ props, checked })}
          <input
            class="form-check-input"
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
          <span class=" badge rounded-pill bg-primary">
            {t("import.suggested", { fallback: "Suggested" })}
          </span>
        {/if}
      </Label.Root>
    </div>
  {/each}
</RadioGroup.Root>
