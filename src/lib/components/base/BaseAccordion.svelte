<script>
  import { Accordion } from "bits-ui";
  import BaseAccordionItem from "$lib/components/base/BaseAccordionItem.svelte";

  let {
    value = $bindable(),
    ref = $bindable(null),
    items,
    ...restProps
  } = $props();
</script>

<!--
 Since we have to destructure the `value` to make it `$bindable`, we need to use `as any` here to avoid
 type errors from the discriminated union of `"single" | "multiple"`.
 (an unfortunate consequence of having to destructure bindable values)
  -->
<Accordion.Root bind:value bind:ref {...restProps}>
  {#each items as item, i (item.title + i)}
    <BaseAccordionItem {...item} />
  {/each}
</Accordion.Root>
