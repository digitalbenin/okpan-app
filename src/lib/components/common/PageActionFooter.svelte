<script>
  import BaseButton from "$lib/components/base/BaseButton.svelte";

  let {
    leftButtons = [],
    rightButtons = [],
    containerClass = "",
    contentClass = "",
    footerClass = "",
    footerContainerClass = "container-fluid",
    sticky = true,
  } = $props();

  const resolvedLeftButtons = $derived(Array.isArray(leftButtons) ? leftButtons : []);
  const resolvedRightButtons = $derived(Array.isArray(rightButtons) ? rightButtons : []);
  const footerPositionClass = $derived(sticky ? "position-sticky bottom-0" : "");
</script>

<div class={`min-vh-100 d-flex flex-column ${containerClass}`.trim()}>
  <div class={`flex-grow-1 w-100 ${contentClass}`.trim()}>
    <slot />
  </div>

  <footer
    class={`${footerPositionClass} mt-auto bg-white border-top border-light-subtle z-3 ${footerClass}`.trim()}
    style="z-index: 1030;"
  >
    <div class={`${footerContainerClass} py-2`}>
      <div class="d-flex flex-column flex-md-row gap-2 align-items-stretch align-items-md-center justify-content-between">
        <div class="d-flex flex-wrap gap-2 justify-content-start">
          {#each resolvedLeftButtons as button, index (button?.id ?? `${button?.text ?? "left"}-${index}`)}
            <BaseButton
              text={button?.text}
              icon={button?.icon}
              iconPosition={button?.iconPosition}
              disabled={button?.disabled}
              loading={button?.loading}
              onClick={button?.onClick}
              class={button?.class}
              style={button?.style}
              type={button?.type ?? "button"}
            />
          {/each}
        </div>
        <div class="d-flex flex-wrap gap-2 justify-content-end">
          {#each resolvedRightButtons as button, index (button?.id ?? `${button?.text ?? "right"}-${index}`)}
            <BaseButton
              text={button?.text}
              icon={button?.icon}
              iconPosition={button?.iconPosition}
              disabled={button?.disabled}
              loading={button?.loading}
              onClick={button?.onClick}
              class={button?.class}
              style={button?.style}
              type={button?.type ?? "button"}
            />
          {/each}
        </div>
      </div>
    </div>
  </footer>
</div>
