<script>
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import {
    getObjectById,
    updateObjectResearchFields,
  } from "$lib/stores/ObjectsUtils.js";

  const { t } = getTranslationStore();

  // Route params
  const projectId = $derived($page.params.project_id);

  // Selected IDs and return path from URL params
  const urlParams = $derived($page.url.searchParams);
  const selectedIds = $derived.by(() => {
    const raw = urlParams.get("ids") || "";
    return raw ? raw.split(",").filter(Boolean) : [];
  });
  const returnTo = $derived(urlParams.get("returnTo") || `/projects/${projectId}/objects`);

  // Research fields loaded in parent project layout
  const researchFields = $derived($page.data.researchFields || []);

  // Checkbox selections and values per field
  let selected = $state({});
  let values = $state({});

  function itemsForField(field) {
    const vocabs = Array.isArray(field?.vocabularies) ? field.vocabularies : [];
    return vocabs.map((v) => ({ value: v.id, label: v?.option?.content || v.id }));
  }

  async function handleSave() {
    try {
      for (const id of selectedIds) {
        // Fetch object to detect existing research field records
        const objRes = await getObjectById(id);
        const obj = objRes?.result;
        const currentFields = Array.isArray(obj?.objectsResearchFields) ? obj.objectsResearchFields : [];

        const changes = [];
        for (const field of researchFields) {
          if (!selected[field.id]) continue;
          const isVocabulary = (field.type || "").toLowerCase() === "vocabulary";
          const newVal = values[field.id];
          if (isVocabulary && !newVal) continue;
          if (!isVocabulary && (!newVal || !String(newVal).trim())) continue;

          const existing = currentFields.find((rf) => (rf?.researchField?.id || rf?.field_id) === field.id);
          if (existing?.id) {
            changes.push({
              id: existing.id,
              value: isVocabulary ? undefined : String(newVal),
              vocabularyId: isVocabulary ? String(newVal) : undefined,
            });
          } else {
            changes.push({
              fieldId: field.id,
              value: isVocabulary ? undefined : String(newVal),
              vocabularyId: isVocabulary ? String(newVal) : undefined,
            });
          }
        }

        if (changes.length > 0) {
          await updateObjectResearchFields(id, changes);
        }
      }

      // Navigate back to originating page
      goto(returnTo);
    } catch (e) {
      console.error("Bulk edit save failed:", e);
    }
  }

  function handleCancel() {
    goto(returnTo);
  }
</script>

<div class="container py-3">
  <div class="d-flex align-items-center mb-3">
    <h3 class="mb-0">{t("common.bulk-edit", { fallback: "Bulk Edit" })}</h3>
    <div class="ms-3 text-muted">
      {selectedIds.length}
      {t("common.selected-objects", { fallback: "selected objects" })}
    </div>
    <div class="ms-auto d-flex gap-2">
      <BaseButton class="btn btn-secondary" text={t("common.cancel", { fallback: "Cancel" })} onClick={handleCancel} />
      <BaseButton class="btn btn-primary" text={t("common.save", { fallback: "Save" })} onClick={handleSave} />
    </div>
  </div>

  {#if researchFields && researchFields.length > 0}
    <div class="list-group">
      {#each researchFields as field (field.id)}
        <div class="list-group-item py-3">
          <div class="d-flex align-items-center gap-2">
            <input type="checkbox" bind:checked={selected[field.id]} />
            <div class="fw-bold">{field?.name?.content || field.id}</div>
            <span class="badge text-bg-light text-secondary">
              {(field?.type || "free text").toLowerCase()}
            </span>
          </div>

          <div class="mt-2">
            {#if (field.type || "").toLowerCase() === "vocabulary"}
              <BaseSelect items={itemsForField(field)} bind:value={values[field.id]} placeholder={t("common.select", { fallback: "Select" })} />
            {:else}
              <BaseInput bind:value={values[field.id]} placeholder={t("common.new-value", { fallback: "New value" })} />
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="text-muted fst-italic mt-4">{t("common.no-research-fields", { fallback: "No research fields available." })}</div>
  {/if}
</div>