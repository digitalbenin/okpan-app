<script>
  import { updateProject, removeLanguageFromProject } from "$lib/stores/ProjectsUtils.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { Tabs } from "melt/builders";
  import AddProjectLanguagesModal from "$lib/components/projects/AddProjectLanguagesModal.svelte";
  import ManualDirtyGuard from "$lib/components/navigation/ManualDirtyGuard.svelte";
  import { watch } from "runed";
  import PageActionFooter from "$lib/components/common/PageActionFooter.svelte";

  const { data } = $props();
  const { t } = getTranslationStore();
  const project = $derived(data.project);
  const languages = $derived(data.languages || []);
  const defaultLanguage = $derived(languages.find((l) => l.is_default) || languages[0]);
  const secondaryLanguages = $derived(languages.filter((l) => !l.is_default));

  let showAddLanguages = $state(false);
  let isSaving = $state(false);
  let editTitle = $state({});
  let editDescription = $state({});
  let initialTitleSnapshot = $state({});
  let initialDescriptionSnapshot = $state({});
  let pristineVersion = $state(0);

  // Tabs
  const initialLanguageCode = $derived(defaultLanguage?.code || languages?.[0]?.code || "");
  let activeLanguageCode = $state("");
  const tabs = new Tabs({ 
    value: () => activeLanguageCode || initialLanguageCode,
    onValueChange: (v) => { if (v) activeLanguageCode = v; }
  });

  watch(
    () => ({ active: activeLanguageCode, initial: initialLanguageCode }),
    ({ active, initial }) => {
      if (!active && initial) {
        activeLanguageCode = initial;
      }
      tabs.value = active || initial || "";
    }
  );

  // Helpers
  const i18n = $derived({
    settings: t("project.settings", { fallback: "Project Settings" }),
    settingsDesc: t("project.settings-desc", { fallback: "Edit your project's title and description in all enabled languages." }),
    title: t("common.title", { fallback: "Title" }),
    description: t("common.description", { fallback: "Description" }),
    titlePlaceholder: t("project.title.placeholder", { fallback: "Project title" }),
    contentLanguages: t("project.content_languages", { fallback: "Content languages" }),
    defaultLanguage: t("project.default_language", { fallback: "Default language" }),
    addLanguage: t("project.add_language", { fallback: "Add language" }),
    saving: t("common.saving", { fallback: "Saving..." }),
    confirm: t("common.confirm", { fallback: "Confirm" })
  });

  function getTranslations(fieldObj) {
    let translations = fieldObj?.translations ?? [];
    if (typeof translations === "string") {
      try { translations = JSON.parse(translations); } 
      catch (_) { translations = []; }
    }
    return Array.isArray(translations) ? translations : [];
  }

  function getExistingTranslationId(fieldName, langCode) {
    const translations = getTranslations(project?.[fieldName]);
    const tr = translations.find((t) => (t.language?.code || t.language_code) === langCode);
    return tr?.id || null;
  }

  const snapshot = (obj) => {
    try {
      return JSON.parse(JSON.stringify(obj || {}));
    } catch {
      const clone = {};
      Object.entries(obj || {}).forEach(([key, value]) => {
        clone[key] = value;
      });
      return clone;
    }
  };

  const syncSnapshots = () => {
    initialTitleSnapshot = snapshot(editTitle);
    initialDescriptionSnapshot = snapshot(editDescription);
    pristineVersion += 1;
  };

  function initValues() {
    if (!project || !languages?.length) return;
    const titleTranslations = getTranslations(project.title);
    const descTranslations = getTranslations(project.description);

    for (const lang of languages) {
      if (lang.is_default) {
        editTitle[lang.code] = project?.title?.content || "";
        editDescription[lang.code] = project?.description?.content || "";
      } else {
        const tTitle = titleTranslations.find((t) => (t.language?.code || t.language_code) === lang.code);
        const tDesc = descTranslations.find((t) => (t.language?.code || t.language_code) === lang.code);
        editTitle[lang.code] = tTitle?.content || "";
        editDescription[lang.code] = tDesc?.content || "";
      }
    }

    syncSnapshots();
  }
  initValues();

  async function removeLanguage(lang) {
    if (!lang || lang.is_default) return;
    try { await removeLanguageFromProject(lang.id); } 
    catch (e) { console.error("Failed to remove language:", e); }
  }

  async function handleSubmit(e) {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!defaultLanguage) return;
    isSaving = true;

    try {
      const titleContent = (editTitle[defaultLanguage.code] ?? "").trim();
      const descContent = (editDescription[defaultLanguage.code] ?? "").trim();
      const titleTranslations = [];
      const descriptionTranslations = [];

      for (const lang of secondaryLanguages) {
        const ttl = (editTitle[lang.code] ?? "").trim();
        const ttlId = getExistingTranslationId("title", lang.code);
        if (ttl || ttlId) titleTranslations.push({ id: ttlId || undefined, language_code: lang.code, content: ttl || null });

        const dsc = (editDescription[lang.code] ?? "").trim();
        const dscId = getExistingTranslationId("description", lang.code);
        if (dsc || dscId) descriptionTranslations.push({ id: dscId || undefined, language_code: lang.code, content: dsc || null });
      }

      const { error } = await updateProject(project.id, {
        title: { content: titleContent },
        description: { content: descContent },
        titleTranslations: titleTranslations.filter((t) => t.content !== undefined),
        descriptionTranslations: descriptionTranslations.filter((t) => t.content !== undefined)
      });
      if (error) throw error;

      syncSnapshots();
    } catch (err) {
      console.error("Failed to update project:", err);
    } finally {
      isSaving = false;
    }
  }

  const valuesDiffer = (current, baseline) => {
    const keys = new Set([
      ...Object.keys(baseline || {}),
      ...Object.keys(current || {}),
    ]);
    for (const key of keys) {
      const nextVal = (current?.[key] ?? "").trim?.() ?? current?.[key] ?? "";
      const baseVal = (baseline?.[key] ?? "").trim?.() ?? baseline?.[key] ?? "";
      if (nextVal !== baseVal) return true;
    }
    return false;
  };

  const hasUnsavedChanges = $derived(
    valuesDiffer(editTitle, initialTitleSnapshot) ||
      valuesDiffer(editDescription, initialDescriptionSnapshot),
  );

  const dirtyMessage = $derived(
    t("form.unsaved-changes", {
      fallback:
        "You have unsaved changes. Are you sure you want to leave without saving?",
    })
  );

  const dirtyValues = $derived.by(() => ({
    title: snapshot(editTitle),
    description: snapshot(editDescription),
  }));

  const rightActionButtons = $derived([
    {
      id: "save-project-settings",
      text: isSaving ? i18n.saving : i18n.confirm,
      class: "btn btn-success",
      type: "submit",
      disabled: isSaving || !defaultLanguage,
    },
  ]);
</script>
<form onsubmit={handleSubmit}>
  <PageActionFooter contentClass="container-fluid" rightButtons={rightActionButtons}>
    <div class="row">
      <div class="col-md-6 col-sm-12">
        <h2 class="mt-3">{i18n.settings}</h2>
        <p class="text-muted">{i18n.settingsDesc}</p>
      </div>
    </div>

    <div class="row">
      <div class="col-md-6 col-sm-12">
        <!-- Language Tabs -->
        <div class="mb-4">
          <div {...tabs.triggerList} class="d-flex border-bottom gap-2 mb-3" role="tablist">
            {#each languages as lang}
              {@const isActive = (activeLanguageCode || initialLanguageCode) === lang.code}
              <button {...tabs.getTrigger(lang.code)} type="button" 
                class="nav-link {isActive ? 'border-bottom border-primary text-primary' : 'text-dark'}"
                role="tab" aria-selected={isActive} data-active={isActive ? "" : undefined}>
                {lang.name || lang.code}
              </button>
            {/each}
          </div>
        </div>

        <!-- Tab Panels -->
        {#each languages as lang}
          <div {...tabs.getContent(lang.code)}>
            <div class="pt-3">
              <div class="mb-3">
                <p class="form-label">{i18n.title}</p>
                <input class="form-control" type="text" value={editTitle[lang.code] ?? ""} 
                  oninput={(e) => (editTitle[lang.code] = e.currentTarget.value)}
                  placeholder={i18n.titlePlaceholder} required={!!lang.is_default} />
              </div>
              <div class="mb-3">
                <p class="form-label">{i18n.description}</p>
                <textarea class="form-control" rows="4" 
                  oninput={(e) => (editDescription[lang.code] = e.currentTarget.value)}
                  >{editDescription[lang.code] ?? ""}</textarea>
              </div>
            </div>
          </div>
        {/each}

        <!-- Content languages management -->
        <div class="mb-3">
          <p class="form-label mb-2">{i18n.contentLanguages}</p>
          <div class="d-flex flex-column gap-2">
            {#each languages as lang}
              <div class="d-flex align-items-center justify-content-between border rounded px-3 py-2">
                <span>{lang.name || lang.code}</span>
                <div>
                  {#if lang.is_default}
                    <span class="badge bg-success">{i18n.defaultLanguage}</span>
                  {:else}
                    <button type="button" class="btn btn-sm btn-link text-dark text-decoration-none" 
                      onclick={() => removeLanguage(lang)} aria-label="Remove">
                      <i class="bi bi-x-circle"></i>
                    </button>
                  {/if}
                </div>
              </div>
            {/each}
            <div>
              <button type="button" class="btn btn-outline-secondary" 
                onclick={() => (showAddLanguages = true)}>
                <i class="bi bi-plus"></i> {i18n.addLanguage}
              </button>
            </div>
          </div>
        </div>

        <AddProjectLanguagesModal bind:isOpen={showAddLanguages} projectId={project?.id} 
          existingLanguages={languages} onAdded={() => {
            const currentActive = activeLanguageCode || initialLanguageCode;
            if (!languages.find((l) => l.code === currentActive)) {
              const def = languages.find((l) => l.is_default) || languages[0];
              if (def) activeLanguageCode = def.code;
            }
          }} />
      </div>
    </div>
  </PageActionFooter>
</form>

<style>
  /* Melt UI tabs styling - required for proper tab functionality */
  [data-melt-tabs-trigger] { background: none; border: none; padding: 0.5rem 1rem; border-radius: 0.25rem 0.25rem 0 0; cursor: pointer; border-bottom: 1px solid transparent; margin-bottom: -1px; }
  [data-melt-tabs-trigger][data-state="active"] { border: 1px solid #dee2e6; border-bottom-color: white; background-color: white; color: var(--bs-nav-tabs-link-active-color, #495057); }
  [data-melt-tabs-trigger]:not([data-state="active"]) { color: var(--bs-nav-link-color, #0d6efd); }
  [data-melt-tabs-trigger]:hover:not([data-state="active"]) { border-color: var(--bs-border-color-translucent, #dee2e6); color: var(--bs-nav-link-hover-color, #0a58ca); }
  [data-melt-tabs-content] { padding: 1rem 0; }
</style>

<ManualDirtyGuard
  values={dirtyValues}
  pristineKey={pristineVersion}
  enabled={hasUnsavedChanges}
  message={dirtyMessage}
/>
