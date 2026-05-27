<script>
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { watch } from "runed";

  /**
   * @prop {string} currentSavedPassword - The password already persisted. Empty string means "create" mode.
   * @prop {function} onSave - Called with the validated new password string.
   * @prop {function} onClose - Called when the dialog is dismissed without saving.
   */
  let {
    open = $bindable(false),
    currentSavedPassword = "",
    isSaving = false,
    onSave,
    onClose,
  } = $props();

  const mode = $derived(currentSavedPassword ? "change" : "create");

  let currentInput = $state("");
  let newInput = $state("");
  let formError = $state("");
  let showCurrent = $state(false);
  let showNew = $state(false);

  function reset() {
    currentInput = "";
    newInput = "";
    formError = "";
    showCurrent = false;
    showNew = false;
  }

  // Reset form state whenever the dialog closes, regardless of how it was closed
  // (Cancel button, Escape key, or parent setting open = false after a save).
  watch(() => open, (isOpen) => {
    if (!isOpen) reset();
  });

  function handleClose() {
    open = false;
    onClose?.();
  }

  function handleSave() {
    const trimmedNew = newInput.trim();

    if (!trimmedNew) {
      formError = "Insert new password";
      return;
    }

    if (currentSavedPassword && currentInput.trim() !== currentSavedPassword) {
      formError = "Current password does not match the saved password.";
      return;
    }

    formError = "";
    onSave?.(trimmedNew);
  }
</script>

<BaseAlertDialog bind:open size="lg">
  {#snippet title()}
    {mode === "change" ? "Change password" : "Set password"}
  {/snippet}

  {#snippet description()}
    <div class="pt-2">
      {#if mode === "change"}
        <div class="mb-4">
          <label class="form-label mb-2" for="current-project-password">Current password</label>
          <div class="input-group">
            <input
              id="current-project-password"
              class="form-control"
              type={showCurrent ? "text" : "password"}
              bind:value={currentInput}
              placeholder="Enter current password"
            />
            <button
              class="btn btn-outline-secondary"
              type="button"
              onclick={() => { showCurrent = !showCurrent; }}
              aria-label={showCurrent ? "Hide current password" : "Show current password"}
              title={showCurrent ? "Hide password" : "Show password"}
            >
              <i class={`bi ${showCurrent ? "bi-eye-slash" : "bi-eye"}`}></i>
            </button>
          </div>
        </div>
      {/if}

      <div class="mb-0">
        <label class="form-label mb-2" for="new-project-password">New password</label>
        <div class="input-group">
          <input
            id="new-project-password"
            class="form-control"
            type={showNew ? "text" : "password"}
            bind:value={newInput}
            placeholder="Type new password"
          />
          <button
            class="btn btn-outline-secondary"
            type="button"
            onclick={() => { showNew = !showNew; }}
            aria-label={showNew ? "Hide new password" : "Show new password"}
            title={showNew ? "Hide password" : "Show password"}
          >
            <i class={`bi ${showNew ? "bi-eye-slash" : "bi-eye"}`}></i>
          </button>
        </div>
      </div>

      {#if formError}
        <div class="alert alert-warning mt-4 mb-0 d-inline-flex align-items-center gap-2" role="alert">
          <i class="bi bi-exclamation-triangle-fill"></i>
          <span>{formError}</span>
        </div>
      {/if}
    </div>
  {/snippet}

  {#snippet footer()}
    <BaseButton
      text="Cancel"
      class="btn btn-outline-secondary"
      disabled={isSaving}
      onClick={handleClose}
    />
    <BaseButton
      text={isSaving ? "Saving..." : "Save"}
      class="btn btn-primary"
      loading={isSaving}
      disabled={isSaving}
      onClick={handleSave}
    />
  {/snippet}
</BaseAlertDialog>
