<script>
  import { Tooltip } from "bits-ui";

  let {
    open = $bindable(false),
    children,
    delayDuration = 250,
    trigger,
    rootProps = {},
    triggerProps = {},
    contentProps = {},
    ...restProps
  } = $props();
</script>

<Tooltip.Provider {delayDuration} {...restProps}>
  <Tooltip.Root bind:open {...rootProps}>
    <Tooltip.Trigger {...triggerProps}>
      {#snippet child({ props })}
        {@render trigger(props)}
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <!-- z-index must sit on the positioned content to stay above Bootstrap modals (1055). -->
      <Tooltip.Content sideOffset={3} style="z-index: 1080;" {...contentProps}>
        <!-- <Tooltip.Arrow /> -->
        <div class="text-bg-dark py-1 px-2 rounded fs-7">
          {@render children?.()}
        </div>
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
</Tooltip.Provider>
