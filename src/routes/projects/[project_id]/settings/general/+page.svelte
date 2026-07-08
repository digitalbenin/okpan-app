<script>
  import { IconSettings, IconBulb, IconCirclePlus, IconX, IconDeviceFloppy } from "@tabler/icons-svelte";
  import { updateProject, removeLanguageFromProject } from "$lib/api/ProjectsApi.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import AddProjectLanguagesModal from "$lib/components/projects/AddProjectLanguagesModal.svelte";
  import ManualDirtyGuard from "$lib/components/navigation/ManualDirtyGuard.svelte";
  import LanguageSelector from "$lib/components/form/LanguageSelector.svelte";
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
  let lastIncomingSignature = $state("");

  // Language selector
  let activeLanguageCode = $state("default");
  
  const currentLangCode = $derived.by(() => {
    if (activeLanguageCode === "default") return defaultLanguage?.code || "";
    const lang = languages.find(l => l.id === activeLanguageCode);
    return lang?.code || defaultLanguage?.code || "";
  });

  // Helpers
  const i18n = $derived({
    title: t("project.title"),
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

  function buildEditState() {
    if (!project || !languages?.length) {
      return { titleValues: {}, descriptionValues: {} };
    }

    const titleTranslations = getTranslations(project.title);
    const descTranslations = getTranslations(project.description);
    const titleValues = {};
    const descriptionValues = {};

    for (const lang of languages) {
      if (lang.is_default) {
        titleValues[lang.code] = project?.title?.content || "";
        descriptionValues[lang.code] = project?.description?.content || "";
      } else {
        const tTitle = titleTranslations.find((t) => (t.language?.code || t.language_code) === lang.code);
        const tDesc = descTranslations.find((t) => (t.language?.code || t.language_code) === lang.code);
        titleValues[lang.code] = tTitle?.content || "";
        descriptionValues[lang.code] = tDesc?.content || "";
      }
    }

    return { titleValues, descriptionValues };
  }

  const getIncomingSignature = () => {
    if (!project || !languages?.length) return "";

    return JSON.stringify({
      projectId: project.id,
      title: project.title?.content || "",
      description: project.description?.content || "",
      titleTranslations: getTranslations(project.title).map((translation) => ({
        id: translation.id || null,
        language_code: translation.language?.code || translation.language_code || null,
        content: translation.content || "",
      })),
      descriptionTranslations: getTranslations(project.description).map((translation) => ({
        id: translation.id || null,
        language_code: translation.language?.code || translation.language_code || null,
        content: translation.content || "",
      })),
    });
  };

  function initValues() {
    const { titleValues, descriptionValues } = buildEditState();
    editTitle = titleValues;
    editDescription = descriptionValues;
    syncSnapshots();
  }

  watch(
    () => getIncomingSignature(),
    (incomingSignature) => {
      if (!incomingSignature || incomingSignature === lastIncomingSignature) {
        return;
      }

      lastIncomingSignature = incomingSignature;
      initValues();
    },
  );

  watch(
    () => ({
      activeLanguageCode,
      languageIds: languages.map((lang) => lang.id),
    }),
    ({ activeLanguageCode: nextActiveLanguageCode, languageIds }) => {
      if (nextActiveLanguageCode === "default") {
        return;
      }

      if (!languageIds.includes(nextActiveLanguageCode)) {
        activeLanguageCode = "default";
      }
    },
  );

  async function removeLanguage(lang) {
    if (!lang || lang.is_default) return;
    try {
      const response = await removeLanguageFromProject(lang.id);
      if (!response?.error) {
        activeLanguageCode = "default";
      }
    } 
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
        if (ttl || ttlId) titleTranslations.push({ id: ttlId || undefined, language_id: lang.id, language_code: lang.code, content: ttl || null });

        const dsc = (editDescription[lang.code] ?? "").trim();
        const dscId = getExistingTranslationId("description", lang.code);
        if (dsc || dscId) descriptionTranslations.push({ id: dscId || undefined, language_id: lang.id, language_code: lang.code, content: dsc || null });
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
      text: isSaving ? t("common.saving", { fallback: "Saving..." }) : t("objects.save-changes", { fallback: "Save changes" }),
      class: "btn btn-success me-3",
      iconComponent: IconDeviceFloppy,
      type: "submit",
      disabled: isSaving || !defaultLanguage || !hasUnsavedChanges,
    },
  ]);
</script>


<form onsubmit={handleSubmit}>
  <PageActionFooter contentClass="container-fluid p-0 m-0" rightButtons={rightActionButtons}>
    <!-- Heading section -->
<div class="bg-white border-bottom px-4 py-3 d-flex flex-column gap-2 mx-n4 mt-n4">
	<div class="d-flex flex-column gap-3">
		<div class="d-flex align-items-center gap-3">
			<div class="bg-gray-200 text-gray-500 rounded-4 d-flex align-items-center justify-content-center flex-shrink-0" style="width: 48px; height: 48px;">
				<IconSettings size={32} />
			</div>
			<h1 class="mb-0 flex-grow-1">{t("menu.general-settings", { fallback: "General settings" })}</h1>
		</div>
		<p class="mb-0" style="font-size: 14px;">{t("general-settings.page-description", { fallback: "Edit your project\u2019s title and description in all enabled languages." })}</p>
	</div>
</div>
    
    <div class="row g-3 mt-2">
      <div class="col-12 col-lg-8 col-xl-9 min-w-0">
        <div class="bg-white rounded-3 p-4">
        <!-- Language Selector - top right -->
        <div class="d-flex justify-content-end mb-4">
           <LanguageSelector {languages} bind:activeLanguageCode usePortal={false} />
        </div>

        <!-- Content Fields -->
        <div class="">
          <div class="mb-3 position-relative">
            <p class="form-label">{i18n.title}</p>
            <span class="position-absolute end-0 top-0 text-muted" style="font-size: 0.75rem;">{(editTitle[currentLangCode] ?? "").length}/150</span>
            <input class="form-control" type="text" maxlength="150" value={editTitle[currentLangCode] ?? ""} 
              oninput={(e) => (editTitle[currentLangCode] = e.currentTarget.value)}
              placeholder={i18n.titlePlaceholder} required={currentLangCode === defaultLanguage?.code} />
          </div>
          <div class="mb-3 position-relative">
            <p class="form-label">{i18n.description}</p>
            <span class="position-absolute end-0 top-0 text-muted" style="font-size: 0.75rem;">{(editDescription[currentLangCode] ?? "").length}/500</span>
            <textarea class="form-control" rows="4" maxlength="500"
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
                <span>{lang.name || lang.code} {lang.is_default ? `(${i18n.defaultLanguage})` : ""}</span>
                
                <div>
                  {#if !lang.is_default}
                    <button type="button" class="btn btn-sm btn-link text-dark text-decoration-none" 
                      onclick={() => removeLanguage(lang)} aria-label={t("common.remove")}>
                      <IconX size={16} />
                    </button>
                  {/if}
                </div>
              </div>
            {/each}
            <div>
              <button type="button" class="btn btn-sm btn-primary" 
                onclick={() => (showAddLanguages = true)}>
                <IconCirclePlus size={16}  class="me-1" /> {i18n.addLanguage}
              </button>
            </div>
          </div>
        </div>

        <AddProjectLanguagesModal bind:isOpen={showAddLanguages} projectId={project?.id} 
          existingLanguages={languages} onAdded={async () => {
            activeLanguageCode = "default";
          }} />
      </div>
      </div>

      <!-- Sidebar -->
      <div class="col-12 col-lg-4 col-xl-3">
        <div class="bg-white border rounded-3 p-4 d-flex flex-column">
          <div class="d-flex flex-column gap-1">
            <div class="flex-shrink-0">
              <IconBulb size={16} stroke={2} />
            </div>
            <div>
              <p class="fw-semibold mb-1 text-body">{t("general-settings.help-title", { fallback: "Need a preview?" })}</p>
              <div class="text-body-secondary fs-7">
                <p class="mb-3">{t("general-settings.help-desc-p1", { fallback: "Click on \u201cWebsite preview\u201d to see how the title, description and icon will be seen by other people when you publish the website." })}</p>
              </div>
            </div>
          </div>
        </div>
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
