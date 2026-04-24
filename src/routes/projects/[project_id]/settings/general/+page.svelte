<script>
  import { updateProject, removeLanguageFromProject, getProjectLanguages } from "$lib/stores/ProjectsUtils.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import AddProjectLanguagesModal from "$lib/components/projects/AddProjectLanguagesModal.svelte";
  import ManualDirtyGuard from "$lib/components/navigation/ManualDirtyGuard.svelte";
  import LanguageSelector from "$lib/components/form/LanguageSelector.svelte";
  import { watch } from "runed";
  import PageActionFooter from "$lib/components/common/PageActionFooter.svelte";

  const { data } = $props();
  const { t } = getTranslationStore();
  const project = $derived(data.project);
  let projectLanguages = $state(data.languages || []);
  const languages = $derived(projectLanguages || []);
  const defaultLanguage = $derived(languages.find((l) => l.is_default) || languages[0]);
  const secondaryLanguages = $derived(languages.filter((l) => !l.is_default));

  let showAddLanguages = $state(false);
  let isSaving = $state(false);
  let editTitle = $state({});
  let editDescription = $state({});
  let initialTitleSnapshot = $state({});
  let initialDescriptionSnapshot = $state({});
  let pristineVersion = $state(0);

  // Language selector
  let activeLanguageCode = $state("default");
  
  const currentLangCode = $derived.by(() => {
    if (activeLanguageCode === "default") return defaultLanguage?.code || "";
    const lang = languages.find(l => l.id === activeLanguageCode);
    return lang?.code || defaultLanguage?.code || "";
  });

  // Helpers
  const i18n = $derived({
    settings: t("project.settings"),
    settingsDesc: t("project.settings-desc"),
    title: t("common.title"),
    description: t("common.description"),
    titlePlaceholder: t("project.title.placeholder"),
    contentLanguages: t("project.content_languages"),
    defaultLanguage: t("project.default_language"),
    addLanguage: t("project.add_language"),
    saving: t("common.saving"),
    confirm: t("common.confirm")
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

  $effect(() => {
    projectLanguages = data.languages || [];
  });

  $effect(() => {
    if (!project || !languages?.length) {
      return;
    }

    const incomingSignature = getIncomingSignature();
    if (!incomingSignature || incomingSignature === lastIncomingSignature) {
      return;
    }

    lastIncomingSignature = incomingSignature;
    initValues();
  });

  async function removeLanguage(lang) {
    if (!lang || lang.is_default) return;
    try {
      const response = await removeLanguageFromProject(lang.id);
      if (!response?.error) {
        await refreshProjectLanguages();
      }
    } 
    catch (e) { console.error("Failed to remove language:", e); }
  }

  async function refreshProjectLanguages() {
    if (!project?.id) return;
    const nextLanguages = await getProjectLanguages(project.id);
    projectLanguages = nextLanguages || [];

    if (
      activeLanguageCode !== "default" &&
      !projectLanguages.some((lang) => lang.id === activeLanguageCode)
    ) {
      activeLanguageCode = "default";
    }
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
    t("form.unsaved-changes")
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
        <!-- Language Selector -->
        <div class="mb-4 d-flex justify-content-end">
          <LanguageSelector {languages} bind:activeLanguageCode />
        </div>

        <!-- Content Fields -->
        <div class="pt-3">
          <div class="mb-3">
            <p class="form-label">{i18n.title}</p>
            <input class="form-control" type="text" value={editTitle[currentLangCode] ?? ""} 
              oninput={(e) => (editTitle[currentLangCode] = e.currentTarget.value)}
              placeholder={i18n.titlePlaceholder} required={currentLangCode === defaultLanguage?.code} />
          </div>
          <div class="mb-3">
            <p class="form-label">{i18n.description}</p>
            <textarea class="form-control" rows="4" 
              oninput={(e) => (editDescription[currentLangCode] = e.currentTarget.value)}
              >{editDescription[currentLangCode] ?? ""}</textarea>
          </div>
        </div>

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
                      onclick={() => removeLanguage(lang)} aria-label={t("common.remove")}>
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
          existingLanguages={languages} onAdded={async () => {
            await refreshProjectLanguages();
            activeLanguageCode = "default";
          }} />
      </div>
    </div>
  </PageActionFooter>
</form>

<ManualDirtyGuard
  values={dirtyValues}
  pristineKey={pristineVersion}
  enabled={hasUnsavedChanges}
  message={dirtyMessage}
/>
