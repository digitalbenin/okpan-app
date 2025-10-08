<script>
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { updateProject } from "$lib/stores/ProjectsUtils.js";
  import { removeLanguageFromProject } from "$lib/stores/ProjectsUtils.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { Tabs } from "melt/builders";
  import AddProjectLanguagesModal from "$lib/components/projects/AddProjectLanguagesModal.svelte";

  const { data } = $props();
  const { t } = getTranslationStore();

  // Data from parent layout
  const project = $derived(data.project);
  const languages = $derived(data.languages || []);

  // Language helpers
  const defaultLanguage = $derived(
    languages.find((l) => l.is_default) || languages[0],
  );
  const secondaryLanguages = $derived(languages.filter((l) => !l.is_default));

  // Add/Remove languages modal state
  let showAddLanguages = $state(false);

  // Tabs state
  let activeLanguageCode = $derived(
    defaultLanguage?.code || languages?.[0]?.code || "",
  );
  // Melt Tabs (match Edit Institution)
  const tabs = new Tabs({
    value: () => activeLanguageCode,
    onValueChange: (v) => {
      if (v) activeLanguageCode = v;
    },
  });
  tabs.value = activeLanguageCode;

  // Editable values per language
  let editTitle = $state({});
  let editDescription = $state({});

  // Initialize form values from current project
  function initValues() {
    if (!project || !languages?.length) return;

    // Prepare a safe accessor for translations which may be array or stringified JSON
    function getTranslations(fieldObj) {
      let translations = fieldObj?.translations ?? [];
      if (typeof translations === "string") {
        try {
          translations = JSON.parse(translations);
        } catch (_) {
          translations = [];
        }
      }
      return Array.isArray(translations) ? translations : [];
    }

    const titleTranslations = getTranslations(project.title);
    const descTranslations = getTranslations(project.description);

    for (const lang of languages) {
      const code = lang.code;
      if (lang.is_default) {
        editTitle[code] = project?.title?.content || "";
        editDescription[code] = project?.description?.content || "";
        if (!activeLanguageCode) activeLanguageCode = code;
      } else {
        // Support both { language: { code } } and { language_code }
        const tTitle = titleTranslations.find(
          (t) => (t.language?.code || t.language_code) === code,
        );
        const tDesc = descTranslations.find(
          (t) => (t.language?.code || t.language_code) === code,
        );
        editTitle[code] = tTitle?.content || "";
        editDescription[code] = tDesc?.content || "";
      }
    }
  }

  initValues();

  async function removeLanguage(lang) {
    if (!lang || lang.is_default) return; // guard default
    try {
      await removeLanguageFromProject(lang.id);
    } catch (e) {
      console.error("Failed to remove language:", e);
    }
  }

  // Helper to get existing translation ID if present (for updates/deletes)
  function getExistingTranslationId(fieldName, langCode) {
    if (!project || !project[fieldName]) return null;

    let translations = project[fieldName].translations;
    if (!translations) return null;

    if (typeof translations === "string") {
      try {
        translations = JSON.parse(translations);
      } catch (_) {
        translations = [];
      }
    }

    if (!Array.isArray(translations)) return null;

    const tr = translations.find(
      (t) => (t.language?.code || t.language_code) === langCode,
    );
    return tr ? tr.id : null;
  }

  let isSaving = $state(false);

  async function handleSubmit(e) {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!defaultLanguage) return;

    isSaving = true;
    try {
      // Default language contents
      const titleContent = (editTitle[defaultLanguage.code] ?? "").trim();
      const descContent = (editDescription[defaultLanguage.code] ?? "").trim();

      // Build translation arrays for secondary languages
      const titleTranslations = [];
      const descriptionTranslations = [];

      for (const lang of secondaryLanguages) {
        const code = lang.code;

        const ttl = (editTitle[code] ?? "").trim();
        const ttlExistingId = getExistingTranslationId("title", code);
        if (ttl || ttlExistingId) {
          titleTranslations.push({
            id: ttlExistingId || undefined,
            language_code: code,
            content: ttl || null,
          });
        }

        const dsc = (editDescription[code] ?? "").trim();
        const dscExistingId = getExistingTranslationId("description", code);
        if (dsc || dscExistingId) {
          descriptionTranslations.push({
            id: dscExistingId || undefined,
            language_code: code,
            content: dsc || null,
          });
        }
      }

      const payload = {
        title: { content: titleContent },
        description: { content: descContent },
        titleTranslations: titleTranslations.filter(
          (t) => t.content !== undefined,
        ),
        descriptionTranslations: descriptionTranslations.filter(
          (t) => t.content !== undefined,
        ),
      };

      const { error } = await updateProject(project.id, payload);
      if (error) throw error;
    } catch (err) {
      console.error("Failed to update project:", err);
    } finally {
      isSaving = false;
    }
  }
</script>

<div class="d-flex flex-column min-vh-100 col-md-6 col-sm-12">
  <form onsubmit={handleSubmit} class="flex-grow-1">
    <div class="container-fluid">
      <div class="row">
        <div class="col-12">
          <h2 class="mt-3">
            {t("project.settings", { fallback: "Project Settings" })}
          </h2>
          <p class="text-muted">
            {t("project.settings-desc", {
              fallback:
                "Edit your project's title and description in all enabled languages.",
            })}
          </p>
        </div>
      </div>

      <!-- Language Tabs (match Edit Institution) -->
      <div class="mb-4">
        <div {...tabs.triggerList} class="nav nav-tabs mb-3" role="tablist">
          {#each languages as lang}
            {@const langCode = lang.code}
            <button
              {...tabs.getTrigger(langCode)}
              type="button"
              class="nav-link {activeLanguageCode === langCode
                ? 'border-bottom border-primary text-primary'
                : 'text-dark'} "
              role="tab"
              aria-selected={activeLanguageCode === langCode}
              data-active={activeLanguageCode === langCode ? "" : undefined}
            >
              {lang.name || lang.code}
            </button>
          {/each}
        </div>
      </div>

      <!-- Tab Panels (Melt Tabs content) -->
      {#each languages as lang}
        {@const langCode = lang.code}
        <div {...tabs.getContent(langCode)}>
          <div class="pt-3">
            <div class="mb-3">
              <p class="form-label">
                {t("common.title", { fallback: "Title" })}
              </p>
              <input
                class="form-control"
                type="text"
                value={editTitle[lang.code] ?? ""}
                oninput={(e) => (editTitle[lang.code] = e.currentTarget.value)}
                placeholder={t("project.title.placeholder", {
                  fallback: "Project title",
                })}
                required={!!lang.is_default}
              />
            </div>
            <div class="mb-3">
              <p class="form-label">
                {t("common.description", { fallback: "Description" })}
              </p>
              <textarea
                class="form-control"
                rows="4"
                oninput={(e) =>
                  (editDescription[lang.code] = e.currentTarget.value)}
                >{editDescription[lang.code] ?? ""}</textarea
              >
            </div>
          </div>
        </div>
      {/each}

      <!-- Content languages management -->
      <div class="mb-3">
        <p class="form-label mb-2">
          {t("project.content_languages", { fallback: "Content languages" })}
        </p>
        <div class="d-flex flex-column gap-2">
          {#each languages as lang}
            <div
              class="d-flex align-items-center justify-content-between border rounded px-3 py-2"
            >
              <div class="d-flex align-items-center gap-2">
                <span>{lang.name || lang.code}</span>
              </div>
              <div>
                {#if lang.is_default}
                  <span class="badge bg-success"
                    >{t("project.default_language", {
                      fallback: "Default language",
                    })}</span
                  >
                {/if}
                {#if !lang.is_default}
                  <button
                    type="button"
                    class="btn btn-sm btn-link text-dark text-decoration-none"
                    onclick={() => removeLanguage(lang)}
                    aria-label="Remove"
                  >
                    <i class="bi bi-x-circle"></i>
                  </button>
                {/if}
              </div>
            </div>
          {/each}
          <div>
            <button
              type="button"
              class="btn btn-outline-secondary"
              onclick={() => (showAddLanguages = true)}
            >
              <i class="bi bi-plus"></i>
              {t("project.add_language", { fallback: "Add language" })}
            </button>
          </div>
        </div>
      </div>

      <AddProjectLanguagesModal
        bind:isOpen={showAddLanguages}
        projectId={project?.id}
        existingLanguages={languages}
        onAdded={() => {
          // keep tabs consistent when new languages are added
          if (!languages.find((l) => l.code === activeLanguageCode)) {
            const def = languages.find((l) => l.is_default) || languages[0];
            if (def) activeLanguageCode = def.code;
          }
        }}
      />
    </div>
  </form>

  <!-- Sticky bottom action bar -->
  <div
    class="sticky-bottom-bar position-sticky bottom-0 bg-white border-top border-light-subtle mt-auto z-1 flex-shrink-0"
  >
    <div class="container-fluid">
      <div class="row">
        <div class="col-12 d-flex justify-content-end gap-2 p-2">
          <BaseButton
            type="submit"
            class="btn btn-sm btn-success"
            text={isSaving
              ? t("common.saving", { fallback: "Saving..." })
              : t("common.confirm", { fallback: "Confirm" })}
            disabled={isSaving || !defaultLanguage}
            onClick={handleSubmit}
          />
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  /* Ensure the form takes full height when content is short */
  .min-vh-100 {
    min-height: 100vh;
  }
  .sticky-bottom-bar {
    position: sticky;
    bottom: 0;
    background-color: white;
    border-top: 1px solid #dee2e6;
    margin-top: auto;
    z-index: 10;
    flex-shrink: 0;
  }

  /* Tabs styling copied from Edit Institution (InstitutionData.svelte) */
  [data-melt-tabs-trigger] {
    background: none;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem 0.25rem 0 0;
    cursor: pointer;
    border-bottom: 1px solid transparent; /* Add transparent bottom border */
    margin-bottom: -1px; /* Overlap the main border */
  }

  /* Style the active/selected tab */
  [data-melt-tabs-trigger][data-state="active"] {
    border: 1px solid #dee2e6;
    border-bottom-color: white;
    background-color: white;
    /* Ensure active tab text matches Bootstrap's active link style */
    color: var(--bs-nav-tabs-link-active-color, #495057);
  }

  [data-melt-tabs-trigger]:not([data-state="active"]) {
    color: var(--bs-nav-link-color, #0d6efd); /* Default Bootstrap link color */
  }

  [data-melt-tabs-trigger]:hover:not([data-state="active"]) {
    border-color: var(--bs-border-color-translucent, #dee2e6);
    color: var(
      --bs-nav-link-hover-color,
      #0a58ca
    ); /* Default Bootstrap link hover color */
  }

  [data-melt-tabs-content] {
    padding: 1rem 0;
  }

  /* Keep nav-tabs styling for the container */
  .nav-tabs {
    display: flex;
    border-bottom: 1px solid #dee2e6;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
</style>
