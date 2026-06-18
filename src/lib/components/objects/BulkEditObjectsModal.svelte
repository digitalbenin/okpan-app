<script>
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getObjectById, updateObjectResearchFields } from "$lib/api/ObjectsApi.js";
  import { IconAlertTriangle } from "@tabler/icons-svelte";

  let {
    isOpen = $bindable(false),
    projectId,
    selectedIds = [],
    researchFields: rawFields = [],
    onSaved = () => {},
  } = $props();

  const { t } = getTranslationStore();

  const researchFields = $derived(Array.isArray(rawFields) ? rawFields : (rawFields?.result || []));

  let selected = $state({});
  let values = $state({});
  let modes = $state({});
  let isSaving = $state(false);
  let openDropdown = $state({});

  const selectedCount = $derived(selectedIds.length);

  function toggleField(fieldId) {
    const isVocabulary = (researchFields.find((f) => f.id === fieldId)?.type || "").toLowerCase() === "vocabulary";
    selected[fieldId] = !selected[fieldId];
    if (!selected[fieldId]) {
      delete values[fieldId];
      delete modes[fieldId];
    } else {
      if (!modes[fieldId]) {
        modes[fieldId] = "add";
      }
      if (isVocabulary && !values[fieldId]) {
        values[fieldId] = [];
      }
    }
  }

  function setMode(fieldId, mode) {
    modes[fieldId] = mode;
  }

  function fieldTypeLabel(field) {
    const type = (field?.type || "").toLowerCase();
    if (type === "vocabulary") return t("common.connection", { fallback: "connection" });
    return t("common.custom-field", { fallback: "custom field" });
  }

  function itemsForField(field) {
    const vocabs = Array.isArray(field?.vocabularies) ? field.vocabularies : [];
    return vocabs.map((v) => ({ value: v.id, label: v?.option?.content || v.id }));
  }

  function toggleDropdown(fieldId) {
    // Close all others first
    for (const key of Object.keys(openDropdown)) {
      if (key !== fieldId) openDropdown[key] = false;
    }
    openDropdown[fieldId] = !openDropdown[fieldId];
  }

  function closeAllDropdowns() {
    for (const key of Object.keys(openDropdown)) {
      openDropdown[key] = false;
    }
  }

  function toggleVocab(fieldId, vocabId) {
    const current = values[fieldId] || [];
    if (current.includes(vocabId)) {
      values[fieldId] = current.filter((id) => id !== vocabId);
    } else {
      values[fieldId] = [...current, vocabId];
    }
  }

  function selectedVocabLabel(fieldId, field) {
    const current = values[fieldId] || [];
    if (current.length === 0) return null;
    const items = itemsForField(field);
    return current
      .map((id) => items.find((item) => item.value === id)?.label || id)
      .join(", ");
  }

  function close() {
    isOpen = false;
  }

  const hasReplace = $derived.by(() => {
    return Object.keys(selected).some((fid) => selected[fid] && modes[fid] === "replace");
  });

  async function handleSave() {
    isSaving = true;
    try {
      for (const id of selectedIds) {
        const objRes = await getObjectById(id);
        const obj = objRes?.result;
        const currentFields = Array.isArray(obj?.objectsResearchFields) ? obj.objectsResearchFields : [];

        const changes = [];
        for (const field of researchFields) {
          if (!selected[field.id]) continue;
          const isVocabulary = (field.type || "").toLowerCase() === "vocabulary";
          const mode = modes[field.id] || "add";
          const existingForField = currentFields.filter((rf) => (rf?.researchField?.id || rf?.field_id) === field.id);

          if (mode === "replace") {
            // Delete all existing records for this field
            for (const existing of existingForField) {
              if (existing.id) {
                changes.push({ action: "delete", id: existing.id });
              }
            }
          }

          if (isVocabulary) {
            const selectedVocabs = Array.isArray(values[field.id])
              ? values[field.id]
              : (values[field.id] ? [values[field.id]] : []);
            if (selectedVocabs.length === 0) continue;

            for (const vocabId of selectedVocabs) {
              if (mode === "add") {
                // Skip if already exists
                const exists = existingForField.some((rf) => (rf?.vocabulary?.id || rf?.vocabulary_id) === vocabId);
                if (exists) continue;
              }
              changes.push({ fieldId: field.id, vocabularyId: String(vocabId) });
            }
          } else {
            const newVal = values[field.id];
            if (!newVal || !String(newVal).trim()) continue;

            if (mode === "add") {
              // Append to existing value
              const firstExisting = existingForField[0];
              if (firstExisting?.id) {
                const oldValue = firstExisting.value || "";
                changes.push({ id: firstExisting.id, value: oldValue + " " + String(newVal) });
              } else {
                changes.push({ fieldId: field.id, value: String(newVal) });
              }
            } else {
              // Replace: create a new record (old ones were deleted above)
              changes.push({ fieldId: field.id, value: String(newVal) });
            }
          }
        }

        if (changes.length > 0) {
          await updateObjectResearchFields(id, changes);
        }
      }

      onSaved();
      close();
    } catch (e) {
      console.error("Bulk edit save failed:", e);
    } finally {
      isSaving = false;
    }
  }

  function handleGlobalClick(e) {
    if (!e.target.closest('.vocab-dropdown')) {
      closeAllDropdowns();
    }
  }
</script>

<svelte:window onclick={handleGlobalClick} />

<BaseModal bind:isOpen={isOpen} size="lg">
  {#snippet header()}
    <div>
      {t("objects.edit-multiple-objects", { fallback: "Edit multiple objects" })}
    </div>
  {/snippet}

  {#snippet body()}
    <div class="d-flex flex-column gap-4">
      <!-- Hint text -->
      <div class="text-dark fs-6">
        <span class="fw-semibold">{t("objects.bulk-edit-hint-count", { count: selectedCount }, { fallback: `${selectedCount} objects selected` })}</span>
        <span>{t("objects.bulk-edit-hint-action", { fallback: " — toggle the fields you want to edit" })}</span>
      </div>

      {#if researchFields && researchFields.length > 0}
        <div class="d-flex flex-column gap-3">
          {#each researchFields as field (field.id)}
            {@const isVocabulary = (field.type || "").toLowerCase() === "vocabulary"}
            {@const isChecked = !!selected[field.id]}
            {@const currentMode = modes[field.id] || "add"}

            <div class="border rounded-3 p-2">
              <!-- Field header: checkbox + label + mode toggle -->
              <div class="d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center gap-2 px-0 py-3">
                  <div class="form-check mb-0">
                    <input
                      type="checkbox"
                      class="form-check-input"
                      checked={isChecked}
                      onchange={() => toggleField(field.id)}
                      style="accent-color: var(--bs-primary)"
                    />
                  </div>
                  <span class="text-dark">{field?.name?.content || field.id}</span>
                  <span class="badge bg-light text-secondary">
                    {fieldTypeLabel(field)}
                  </span>
                </div>

                <div class="d-flex gap-1 p-1 rounded-2" role="group" style="background-color: #eaebe7;" class:opacity-50={!isChecked}>
                  <button
                    type="button"
                    class="btn btn-sm border-0 rounded-2 {currentMode === 'add' && isChecked ? 'bg-white shadow-sm fw-medium' : 'text-link bg-transparent'}"
                    onclick={() => setMode(field.id, "add")}
                    disabled={!isChecked}
                  >
                    {t("objects.bulk-edit-add", { fallback: "Add" })}
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm border-0 rounded-2 {currentMode === 'replace' && isChecked ? 'bg-white shadow-sm fw-medium' : 'text-link bg-transparent'}"
                    onclick={() => setMode(field.id, "replace")}
                    disabled={!isChecked}
                  >
                    {t("objects.bulk-edit-replace-all", { fallback: "Replace all" })}
                  </button>
                </div>
              </div>

              <!-- Input area (visible when checked) -->
              {#if isChecked}
                <div class="mt-2">
                  {#if isVocabulary}
                    {@const vocabs = itemsForField(field)}
                    {@const selectedLabel = selectedVocabLabel(field.id, field)}
                    <div class="dropdown vocab-dropdown w-100" class:show={!!openDropdown[field.id]}>
                      <button
                        type="button"
                        class="form-select text-start w-100 d-flex align-items-center justify-content-between"
                        onclick={() => toggleDropdown(field.id)}
                        onkeydown={(e) => { if (e.key === 'Escape') openDropdown[field.id] = false; }}
                      >
                        <span class="text-truncate">{selectedLabel || t("common.select", { fallback: "Select" })}</span>
                      </button>
                      {#if openDropdown[field.id]}
                        <div class="dropdown-menu show w-100" style="max-height: 200px; overflow-y: auto;">
                          {#each vocabs as { value, label } (value)}
                            <label class="dropdown-item d-flex align-items-center gap-2">
                              <input
                                type="checkbox"
                                class="form-check-input"
                                checked={!!(values[field.id] || []).includes(value)}
                                onchange={() => toggleVocab(field.id, value)}
                                style="accent-color: var(--bs-primary)"
                              />
                              <span class="text-truncate">{label}</span>
                            </label>
                          {/each}
                          {#if vocabs.length === 0}
                            <div class="dropdown-item text-muted small">{t("common.no-results", { fallback: "No results" })}</div>
                          {/if}
                        </div>
                      {/if}
                    </div>
                  {:else}
                    <BaseInput
                      bind:value={values[field.id]}
                      placeholder={t("objects.bulk-edit-write-here", { fallback: "Write here" })}
                      class="w-100"
                    />
                  {/if}
                  <div class="text-muted small mt-2">
                    {#if isVocabulary}
                      {currentMode === "add"
                        ? t("objects.bulk-edit-add-hint-vocab", { fallback: "These relations will be added to all selected objects." })
                        : t("objects.bulk-edit-replace-hint-vocab", { fallback: "Existing relations will be replaced on all selected objects." })}
                    {:else}
                      {currentMode === "add"
                        ? t("objects.bulk-edit-add-hint-text", { fallback: "Text will be added at the end of existing notes" })
                        : t("objects.bulk-edit-replace-hint-text", { fallback: "Existing notes will be replaced on all selected objects." })}
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div class="text-muted fst-italic">{t("common.no-research-fields", { fallback: "No research fields available." })}</div>
      {/if}

      <!-- Overwrite warning -->
      {#if hasReplace}
        <div class="d-flex gap-2 align-items-start p-3 border border-warning rounded-3" style="background: linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,255,255,0.8)), linear-gradient(90deg, #D3A621, #D3A621);">
          <IconAlertTriangle size={16} class="text-warning flex-shrink-0 mt-1" />
          <div class="text-dark fs-6">
            {t("objects.bulk-edit-overwrite-warning", { count: selectedCount }, { fallback: `Overwrite is on for some fields. Existing content on all ${selectedCount} objects will be permanently replaced. This cannot be undone.` })}
          </div>
        </div>
      {/if}
    </div>
  {/snippet}

  {#snippet actions()}
    <div class="d-flex gap-2">
      <BaseButton
        class="btn btn-outline-secondary"
        text={t("common.cancel", { fallback: "Cancel" })}
        onClick={close}
      />
      <BaseButton
        class="btn btn-primary"
        text={t("objects.save-changes", { fallback: "Save changes" })}
        onClick={handleSave}
        disabled={isSaving}
      />
    </div>
  {/snippet}
</BaseModal>
