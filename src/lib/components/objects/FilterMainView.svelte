<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { IconChevronRight } from "@tabler/icons-svelte";

  let {
    enableInstitutionFilter = true,
    institutionCount = 0,
    visibleVocabularyFields = [],
    visibleTextResearchFields = [],
    ontologyFields = [],
    vocabularyCountForField,
    textFilterCountForKind,
    onShowDetail,
    onShowTextKind,
  } = $props();

  const { t } = getTranslationStore();
</script>

{#if enableInstitutionFilter}
  <div class="px-3 pt-4">
    <div class="small text-uppercase py-2" style="font-size: 12px; letter-spacing: 0.24px;">
      {t("filters.object-info", { fallback: "Object info" })}
    </div>
    <div class="border-top border-bottom">
      <button
        type="button"
        class="d-flex align-items-center justify-content-between w-100 py-3 border-0 bg-transparent"
        aria-label={t("filters.filter-by-institution", { fallback: "Filter by institution" })}
        onclick={() => onShowDetail({ type: "institutions", id: "institutions" })}
      >
        <div>{t("common.institution", { fallback: "Institution" })}</div>
        <div class="d-flex align-items-center gap-2">
          {#if institutionCount > 0}
            <span class="badge bg-danger px-2 rounded-3">{institutionCount}</span>
          {/if}
          <IconChevronRight size={16} />
        </div>
      </button>
    </div>
  </div>
{/if}

{#if visibleVocabularyFields.length > 0}
  <div class="px-3 pt-4">
    <div class="small text-uppercase py-2" style="font-size: 12px; letter-spacing: 0.24px;">
      {t("common.connections", { fallback: "Connections" })}
    </div>
    <div class="border-top border-bottom">
      {#each visibleVocabularyFields as field, index (`v-${field.id}`)}
        <button
          type="button"
          class="d-flex align-items-center justify-content-between w-100 py-3 border-0 bg-transparent"
          class:border-bottom={index < visibleVocabularyFields.length - 1}
          aria-label={t("filters.filter-by-field", {
            fallback: "Filter by {{field}}",
            field: field.name?.content || field.name,
          })}
          onclick={() => onShowDetail({ type: "vocabulary", id: field.id })}
        >
          <div>{field.name?.content || field.name}</div>
          <div class="d-flex align-items-center gap-2">
            {#if vocabularyCountForField(field.id) > 0}
              <span class="badge bg-danger px-2 rounded-3">{vocabularyCountForField(field.id)}</span>
            {/if}
            <IconChevronRight size={16} />
          </div>
        </button>
      {/each}
    </div>
  </div>
{/if}

<div class="px-3 pt-4 pb-3">
  <div class="small text-uppercase py-2" style="font-size: 12px; letter-spacing: 0.24px;">
    {t("filters.other-fields", { fallback: "Other fields" })}
  </div>
  <div class="border-top border-bottom">
    {#if visibleTextResearchFields.length > 0}
      <button
        type="button"
        class="d-flex align-items-center justify-content-between w-100 py-3 border-0 bg-transparent border-bottom"
        onclick={() => onShowTextKind("research")}
      >
        <div>{t("filters.custom-fields", { fallback: "Custom fields" })}</div>
        <div class="d-flex align-items-center gap-2">
          {#if textFilterCountForKind("research") > 0}
            <span class="badge bg-danger px-2 rounded-3">{textFilterCountForKind("research")}</span>
          {/if}
          <IconChevronRight size={16} />
        </div>
      </button>
    {/if}

    {#if ontologyFields.length > 0}
      <button
        type="button"
        class="d-flex align-items-center justify-content-between w-100 py-3 border-0 bg-transparent"
        class:border-top={visibleTextResearchFields.length === 0}
        onclick={() => onShowTextKind("ontology")}
      >
        <div>{t("filters.institution-mapped-fields", { fallback: "Institution mapped fields" })}</div>
        <div class="d-flex align-items-center gap-2">
          {#if textFilterCountForKind("ontology") > 0}
            <span class="badge bg-danger px-2 rounded-3">{textFilterCountForKind("ontology")}</span>
          {/if}
          <IconChevronRight size={16} />
        </div>
      </button>
    {/if}
  </div>
</div>