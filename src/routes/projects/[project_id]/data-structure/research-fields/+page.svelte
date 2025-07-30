<script>
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseCheckBox from "$lib/components/base/BaseCheckBox.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const { data } = $props();
  const { t } = getTranslationStore();

  let search = $state();

  $inspect(data.researchFields);
</script>

<div class="container-fluid">
  <div class="row my-3">
    <div class="col-12">
      <h1>{t("project.research-fields", { fallback: "Research Fields" })}</h1>
    </div>
  </div>
  <div class="row align-items-center mb-3">
    <div class="col-3">
      <BaseInput
        icon="search"
        placeholder={t("common.search", { fallback: "Search" })}
        clearable
        size="sm"
        bind:value={search}
      />
    </div>
    <div class="col-9 d-flex justify-content-end gap-3 align-items-center">
      <div class="d-flex align-items-center gap-2">
        <a
          class="btn btn-primary btn-sm"
          href="/projects/{data.project.id}/data-structure/research-fields/add"
          ><i class="bi bi-plus-lg"></i>
          {t("common.add-field", {
            fallback: "Add Field",
          })}</a
        >
      </div>
    </div>
  </div>
  {#if data.researchFields.length > 0}
    <div class="border-bottom mb-3">
      {data.researchFields.length}
      {#if data.researchFields.length > 1}
        {t("common.research-fields", { fallback: "research fields" })}
      {:else}
        {t("common.research-field", { fallback: "research field" })}
      {/if}
    </div>
    {#each data.researchFields as researchField (researchField.id)}
      <div class="d-flex py-2 border-bottom">
        <div class="col-3">
          <a
            href={`/projects/${data.project.id}/data-structure/research-fields/${researchField.id}`}
          >
            {researchField.name.content}
          </a>
        </div>
        <div class="col-6">
          {researchField.description.content}
        </div>
        <div class="col-3">
          <div class="d-flex flex-column align-items-start gap-2">
            <button class="btn btn-sm btn-light"
              ><i class="bi bi-pencil"></i>
              {t("common.edit", {
                fallback: "Edit",
              })}</button
            >
            <button class="btn btn-sm btn-danger"
              ><i class="bi bi-trash"></i>
              {t("common.delete", {
                fallback: "Delete",
              })}</button
            >
            <BaseCheckBox
              labelText={t("common.public-website", {
                fallback: "Show on website",
              })}
            />
          </div>
        </div>
      </div>
    {/each}
  {:else}
    <div class="text-center fst-italic text-muted mt-5">
      {t("common.no-research-fields-found", {
        fallback: "No research field found.",
      })}
    </div>
  {/if}
</div>
