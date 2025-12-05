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
    formStore = null,
    children,
  } = $props();

  const resolvedLeftButtons = $derived(Array.isArray(leftButtons) ? leftButtons : []);
  const resolvedRightButtons = $derived(Array.isArray(rightButtons) ? rightButtons : []);
  const footerPositionClass = $derived(sticky ? "position-sticky bottom-0" : "");

  // Comprehensive error detection from formStore
  const hasFormStoreErrors = $derived.by(() => {
    if (!formStore?.current) return false;
    
    const state = formStore.current;
    
    // Don't show errors while submitting successfully
    if (state.isSubmitting) return false;
    
    return Boolean(
      state.errors?.length > 0 ||
      (state.errorMap && Object.keys(state.errorMap).some(k => {
        const errors = state.errorMap[k];
        return errors && errors.length > 0;
      })) ||
      // Check if form cannot be submitted due to validation errors (not just during submit)
      (state.canSubmit === false && state.isDirty && !state.isValidating)
    );
  });

  // Check for structured errors in field meta (for array fields like links, vocabularies)
  const hasStructuredErrors = $derived.by(() => {
    if (!formStore?.current?.fieldMeta) return false;
    return Object.values(formStore.current.fieldMeta).some(meta => 
      meta?.structuredErrors?.length > 0
    );
  });

  const hasAnyErrors = $derived(hasFormStoreErrors || hasStructuredErrors);
</script>
<div class={`d-flex flex-column ${containerClass}`.trim()} style="min-height: calc(100vh - 60px);">
  <div class={`flex-grow-1 w-100 ${contentClass}`.trim()}>
    {@render children?.()}
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
        <div class="d-flex flex-wrap gap-2 justify-content-end align-items-center">
          {#if hasAnyErrors}
            <div class="alert alert-warning d-flex align-items-center gap-2 mb-0 py-2" role="alert">
              <i class="bi bi-exclamation-triangle-fill"></i>
              <span>Fill all the required fields to save</span>
            </div>
          {/if}
          {#each resolvedRightButtons as button, index (button?.id ?? `${button?.text ?? "right"}-${index}`)}
            <BaseButton
              text={button?.text}
              icon={button?.icon}
              iconPosition={button?.iconPosition}
              disabled={button?.disabled || (button?.disableOnError && hasAnyErrors)}
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
