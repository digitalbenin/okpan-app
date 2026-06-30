<script>
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import ResearchFieldForm from "$lib/components/research_fields/ResearchFieldForm.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { page } from "$app/stores";

  let {
    open = $bindable(false),
    mode = "create",
    initialData = null,
    fixedType = null,
    onSaved = () => {},
  } = $props();

  const { t } = getTranslationStore();
  const languages = $derived($page.data?.languages ?? []);
  const projectId = $derived($page.params.project_id);

  const modalTitle = $derived.by(() => {
    if (mode === "create") {
      if (fixedType === "vocabulary") {
        const itemLabel = t("common.connection", { fallback: "Connection" });
        return t("common.add-item", { item: itemLabel, fallback: `Add ${itemLabel}` });
      }
      return t("common.add-custom-field", { fallback: "Add a custom field" });
    }
    if (fixedType === "vocabulary") {
      return initialData?.name?.content || t("common.edit", { fallback: "Edit" });
    }
    return t("common.edit-custom-field", { fallback: "Edit custom field" });
  });

  const modalDescription = $derived(
    mode === "create"
      ? t("research-fields.modal-create-description", { fallback: "Don\u2019t worry, you can edit them later." })
      : ""
  );

  function handleSubmit() {
    document.getElementById('research-field-form')?.requestSubmit();
  }

  function handleCancel() {
    open = false;
  }
</script>

<BaseAlertDialog bind:open size="md">
  {#snippet title()}
    {modalTitle}
  {/snippet}

  {#snippet description()}
    {#if modalDescription}
      <p class="mb-0 text-body-secondary">{modalDescription}</p>
    {:else}
        <div class="mt-n3"></div>
    {/if}
  {/snippet}

  <div class="pb-3">
    <ResearchFieldForm
      {languages}
      {mode}
      {initialData}
      {projectId}
      {fixedType}
      showTitle={false}
      showDescription={false}
      noFooter={true}
      onSuccess={() => {
        open = false;
        onSaved();
      }}
      onCancel={handleCancel}
    />
  </div>

  {#snippet footer()}
    <button type="button" class="btn btn-outline-secondary" onclick={handleCancel}>
      {t("common.cancel", { fallback: "Cancel" })}
    </button>
    <button type="button" class="btn btn-success" onclick={handleSubmit}>
      {mode === "create" ? t("export.add-field", { fallback: "Add custom field" }) : t("common.save", { fallback: "Save changes" })}
    </button>
  {/snippet}
</BaseAlertDialog>
