<script>
  import { fade } from "svelte/transition";
  import { AlertDialog } from "bits-ui";

  let {
    open = $bindable(false),
    children,
    buttonText,
    contentProps,
    title,
    description,
    size = "",
    ...restProps
  } = $props();
</script>

<AlertDialog.Root bind:open {...restProps} class="modal d-block">
  {#if buttonText}
    <AlertDialog.Trigger>
      {buttonText}
    </AlertDialog.Trigger>
  {/if}
  <AlertDialog.Portal>
    <AlertDialog.Overlay forceMount>
      {#snippet child({ props, open })}
        {#if open}
          <div {...props} class="modal-backdrop show" transition:fade></div>
        {/if}
      {/snippet}
    </AlertDialog.Overlay>
    <AlertDialog.Content {...contentProps} forceMount>
      {#snippet child({ props, open })}
        {#if open}
          <div {...props} class="modal d-block" transition:fade>
            <div
              class={`modal-dialog modal-dialog-scrollable ${size ? ` modal-${size}` : ""}`}
            >
              <div class="modal-content">
                <AlertDialog.Title class="modal-header">
                  <h1 class="modal-title fs-5">{@render title()}</h1>
                  <AlertDialog.Cancel class="btn-close"></AlertDialog.Cancel>
                </AlertDialog.Title>
                <AlertDialog.Description class="modal-body">
                  {@render description()}
                </AlertDialog.Description>
                {@render children?.()}
              </div>
            </div>
          </div>
        {/if}
      {/snippet}
    </AlertDialog.Content>
  </AlertDialog.Portal>
</AlertDialog.Root>
