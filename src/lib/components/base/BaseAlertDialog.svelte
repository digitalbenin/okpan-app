<script>
  import { fade } from "svelte/transition";
  import { AlertDialog } from "bits-ui";
  import { onDestroy } from 'svelte';
  import { IconX } from '@tabler/icons-svelte';

  let {
    open = $bindable(false),
    children,
    contentProps,
    buttonProps,
    title,
    trigger,
    description,
    footer,
    size = "",
    ...restProps
  } = $props();

  // Workaround for bits-ui pointer-events bug
  $effect(() => {
    if (!open) {
      setTimeout(() => {
        document.body.style.pointerEvents = '';
      }, 150);
    }
  });

  // Also clean up on component destroy
  onDestroy(() => {
    setTimeout(() => {
      document.body.style.pointerEvents = '';
    }, 100);
  });
</script>

<AlertDialog.Root bind:open {...restProps} class="modal d-block">
  {#if buttonProps || trigger}
    <AlertDialog.Trigger {...buttonProps}>
      {@render trigger()}
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
    <AlertDialog.Content class="" style="max-height:75vh;" {...contentProps} forceMount>
      {#snippet child({ props, open })}
        {#if open}
          <div {...props} class="modal d-block" transition:fade>
            <div
              class={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${size ? ` modal-${size}` : ""}`}
            >
              <div class="modal-content">
                <AlertDialog.Title class="modal-header">
                  <p class="modal-title fs-5">{@render title()}</p>
                  <AlertDialog.Cancel class="btn-close border-0 bg-transparent p-0 d-flex align-items-center justify-content-center" style="width: 24px; height: 24px;">
                    <IconX size={24} stroke={2} />
                  </AlertDialog.Cancel>
                </AlertDialog.Title>
                <div class="modal-body">
                  <AlertDialog.Description>
                    {@render description()}
                  </AlertDialog.Description>
                  {@render children?.()}
                </div>

                {#if footer}
                  <div class="modal-footer">
                    {@render footer()}
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/if}
      {/snippet}
    </AlertDialog.Content>
  </AlertDialog.Portal>
</AlertDialog.Root>
