<script>
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { deleteAssetsBulk } from "$lib/stores/AssetsUtils.js";
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  let {
    isOpen = $bindable(false),
    selectedIds = [],
  } = $props();

  const { t } = getTranslationStore();

  let isDeleting = $state(false);
  let deleteErrors = $state([]);

  function cancel() {
    isOpen = false;
    deleteErrors = [];
  }

  async function confirmDelete() {
    if (!selectedIds || selectedIds.length === 0) {
      cancel();
      return;
    }
    isDeleting = true;
    try {
      const { successes, errors, error } = await deleteAssetsBulk(selectedIds);
      deleteErrors = [];
      if (error) deleteErrors.push(error);
      if (errors && errors.length > 0) {
        deleteErrors.push(...errors.map((e) => e.error || "Unknown error"));
      }
      isOpen = false;
      dispatch("deleted", { successes, errors });
    } catch (e) {
      deleteErrors = [e.message];
    } finally {
      isDeleting = false;
    }
  }
</script>

<BaseModal bind:isOpen={isOpen}>
  {#snippet header()}
    <div>
      {t("common.delete", { fallback: "Delete" })}
      {" "}
      {t("common.assets", { fallback: "Assets" })}
    </div>
  {/snippet}

  {#snippet body()}
    <div>
      <p>
        {t("common.you-are-about-to-delete", { fallback: "You are about to delete" })}
        <strong> {selectedIds?.length || 0} </strong>
        {t("common.assets", { fallback: "assets" })}.
      </p>
      <p class="text-danger">
        {t("common.operation-irreversible", { fallback: "This operation is irreversible." })}
      </p>
      {#if deleteErrors && deleteErrors.length > 0}
        <div class="alert alert-danger" role="alert">
          {t("common.errors-occurred", { fallback: "Some errors occurred:" })}
          <ul class="mb-0">
            {#each deleteErrors as err}
              <li>{err}</li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  {/snippet}

  {#snippet actions()}
    <div class="d-flex gap-2">
      <BaseButton
        text={t("common.cancel", { fallback: "Cancel" })}
        class="btn btn-secondary"
        onClick={cancel}
        disabled={isDeleting}
      />
      <BaseButton
        text={t("common.confirm-delete", { fallback: "Confirm delete" })}
        icon="trash"
        class="btn btn-danger"
        onClick={confirmDelete}
        disabled={isDeleting}
      />
    </div>
  {/snippet}
</BaseModal>