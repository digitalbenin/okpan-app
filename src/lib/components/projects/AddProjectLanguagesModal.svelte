<script>
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import {
    addLanguageToProject,
    removeLanguageFromProject,
  } from "$lib/stores/ProjectsUtils.js";

  const { t } = getTranslationStore();

  let {
    isOpen = $bindable(false),
    projectId = null,
    existingLanguages = [], // [{ id, code, name, is_default }]
    onAdded = null, // optional callback when languages added
  } = $props();

  // World languages fetched from IPC
  let worldLanguages = $state([]);
  let isLoading = $state(false);
  let error = $state(null);
  let search = $state("");
  let selectedCodes = $state(new Set());
  let removeCodes = $state(new Set());

  // Cache of existing language codes for quick lookup
  const existingCodes = $derived(
    (existingLanguages || []).map((l) => l.code.toLowerCase()),
  );

  // Default project language (cannot be toggled in this modal)
  const defaultLangCode = $derived(
    (existingLanguages || []).find((l) => l.is_default)?.code?.toLowerCase() ||
      null,
  );

  $effect(() => {
    // Fetch when first opened
    if (isOpen && worldLanguages.length === 0 && !isLoading) {
      loadWorldLanguages();
    }
  });

  async function loadWorldLanguages() {
    isLoading = true;
    try {
      const resp = await window.api.getLanguages();
      if (resp?.success && Array.isArray(resp.result)) {
        worldLanguages = resp.result;
      } else {
        error = resp?.error || "Failed to load languages";
      }
    } catch (e) {
      console.error("Error loading languages:", e);
      error = e?.message || "Error loading languages";
    } finally {
      isLoading = false;
    }
  }

  const filteredLanguages = $derived.by(() => {
    const q = (search || "").toLowerCase().trim();
    const list = worldLanguages || [];
    if (!q) return list;
    return list.filter((lang) => {
      const label = (
        lang.name ||
        lang.native ||
        lang.englishName ||
        lang.code ||
        ""
      ).toLowerCase();
      return label.includes(q) || (lang.code || "").toLowerCase().includes(q);
    });
  });

  function toggleAdd(code) {
    const c = (code || "").toLowerCase();
    if (!c || c === defaultLangCode || existingCodes.includes(c)) return;
    const next = new Set(selectedCodes);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    selectedCodes = next;
  }

  function toggleRemove(code) {
    const c = (code || "").toLowerCase();
    if (!c || c === defaultLangCode || !existingCodes.includes(c)) return;
    const next = new Set(removeCodes);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    removeCodes = next;
  }

  async function handleSave() {
    if (!projectId || (selectedCodes.size === 0 && removeCodes.size === 0)) {
      isOpen = false;
      return;
    }
    error = null;
    try {
      // Add each selected language
      for (const code of selectedCodes) {
        const lang = worldLanguages.find(
          (l) => (l.code || "").toLowerCase() === code,
        );
        if (!lang) continue;
        const response = await addLanguageToProject(
          projectId,
          lang.code,
          lang.name || lang.native || lang.englishName || lang.code,
          0,
        );
        if (response?.error) {
          error = response.error;
          return;
        }
      }

      // Remove each selected existing secondary language
      for (const code of removeCodes) {
        const existing = (existingLanguages || []).find(
          (l) => (l.code || "").toLowerCase() === code,
        );
        if (!existing || existing.is_default) continue;
        const response = await removeLanguageFromProject(existing.id);
        if (response?.error) {
          error = response.error;
          return;
        }
      }

      // Optional callback
      if (typeof onAdded === "function") {
        await onAdded({
          added: Array.from(selectedCodes),
          removed: Array.from(removeCodes),
        });
      }

      // Close and reset selection
      selectedCodes = new Set();
      removeCodes = new Set();
      isOpen = false;
    } catch (e) {
      console.error("Failed adding languages:", e);
      error = e?.message || "Failed to save languages";
    }
  }

  function handleCancel() {
    selectedCodes = new Set();
    removeCodes = new Set();
    isOpen = false;
  }
</script>

<BaseModal bind:isOpen size="lg" contentStyle="height: 75vh;">
  {#snippet header()}
    {t("project.select_content_languages", {
      fallback: "Select content languages",
    })}
  {/snippet}

  {#snippet body()}
    {#if isLoading}
      <div class="d-flex justify-content-center py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
    {:else}
      {#if error}
        <div class="alert alert-danger">{error}</div>
      {/if}
      <div class="input-group mb-3">
        <span class="input-group-text"><i class="bi bi-search"></i></span>
        <input
          class="form-control"
          type="text"
          placeholder={t("common.search", { fallback: "Search" })}
          bind:value={search}
        />
      </div>
      <div class="list-group">
        {#each filteredLanguages as lang}
          {@const code = (lang.code || "").toLowerCase()}
          {@const isDefault = defaultLangCode && code === defaultLangCode}
          {@const isEnabled = existingCodes.includes(code)}
          <div
            class="list-group-item d-flex justify-content-between align-items-center"
          >
            <div>
              <div class="fw-semibold">
                {lang.name || lang.native || lang.englishName || lang.code}
              </div>
              <small class="text-muted">{lang.code}</small>
            </div>
            <div class="d-flex align-items-center gap-2">
              {#if isDefault}
                <BaseButton
                  class="btn btn-secondary btn-sm"
                  text={t("project.default_language", { fallback: "Default" })}
                  disabled={true}
                />
              {:else if isEnabled}
                <BaseButton
                  class="btn btn-sm {removeCodes.has(code)
                    ? 'btn-outline-primary'
                    : 'btn-success'}"
                  text={removeCodes.has(code)
                    ? t("common.add", { fallback: "Add" })
                    : t("common.added", { fallback: "Added" })}
                  onClick={() => toggleRemove(code)}
                />
              {:else}
                <BaseButton
                  class="btn btn-sm {selectedCodes.has(code)
                    ? 'btn-success'
                    : 'btn-outline-primary'}"
                  text={selectedCodes.has(code)
                    ? t("common.added", { fallback: "Added" })
                    : t("common.add", { fallback: "Add" })}
                  onClick={() => toggleAdd(code)}
                />
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/snippet}

  {#snippet actions()}
    <div class="d-flex gap-2">
      <BaseButton
        class="btn btn-secondary"
        text={t("common.cancel", { fallback: "Cancel" })}
        onClick={handleCancel}
      />
      <BaseButton
        class="btn btn-primary"
        text={t("common.save", { fallback: "Save" })}
        onClick={handleSave}
        disabled={selectedCodes.size === 0 && removeCodes.size === 0}
      />
    </div>
  {/snippet}
</BaseModal>

<style>
  .list-group-item {
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
  }
  .fw-semibold {
    font-weight: 600;
  }
</style>
