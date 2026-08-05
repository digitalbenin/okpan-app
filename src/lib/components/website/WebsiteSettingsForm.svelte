<script>
  import { watch } from "runed";
  import { createForm } from "@tanstack/svelte-form";
  import AutoForm from "$lib/components/form/AutoForm.svelte";
  import MediaUploadZone from "$lib/components/research_fields/MediaUploadZone.svelte";
  import { getValidator, createFieldValidator, getFormConfig } from "$lib/utils/formValidation.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { createWebsiteSettings, updateWebsiteSettings } from "$lib/api/WebsiteSettingsApi.js";
  import { page } from "$app/stores";
  import BaseRichTextEditor from "$lib/components/base/BaseRichTextEditor.svelte";

  const translationStore = getTranslationStore();
  const t = $derived(translationStore.t);

  let { mode = "create", websiteSettings = null, languages = [], projectId = null, currentFilters = null, onSuccess = null } = $props();

  const isEditMode = $derived(mode === "edit");
  const defaultLanguage = $derived(languages?.find((l) => l.is_default) || languages?.[0] || null);
  const secondaryLanguages = $derived(languages?.filter((l) => !l.is_default) || []);
  const operationName = $derived(isEditMode ? "update" : "create");
  const validator = $derived(getValidator("websiteSettings", operationName));

  let logoFile = $state(null);
  let logoAssets = $state([]);

  watch(
    () => logoAssets,
    (assets) => { logoFile = assets.length ? assets[0] : null; }
  );

  // Init from existing settings
  let _logoInit = false;
  watch(
    () => websiteSettings,
    (settings) => {
      if (!_logoInit && isEditMode && settings?.logo) {
        _logoInit = true;
        logoAssets = [settings.logo];
      }
    }
  );

  async function onAddLogo(paths) {
    if (!paths?.length) return;
    const p = paths[0];
    logoAssets = [{ path: p, name: p.split(/[/\\]/).pop() }];
  }

  function removeLogo() {
    logoAssets = [];
  }

  const findTranslationForLanguage = (textField, lang) =>
    textField?.translations?.find((translation) =>
      translation?.language_id === lang.id || translation?.language?.code === lang.code
    ) || null;

  const defaultValues = $derived.by(() => {
    const baseValues = {
      title: "",
      shortDescription: "",
      about: "",
      authors: "",
      subfolderPath: "",
      showUnmapped: false,
      filters: {},
      projectId: projectId || $page.params.project_id,
      languageId: defaultLanguage?.id || "",
      titleTranslations: [],
      shortDescriptionTranslations: [],
      aboutTranslations: [],
      logoFile: null,
    };

    if (isEditMode) {
      baseValues.id = websiteSettings?.id || "";
      baseValues.title = websiteSettings?.title?.content || "";
      baseValues.shortDescription = websiteSettings?.shortDescription?.content || "";
      baseValues.about = websiteSettings?.about?.content || "";
      baseValues.authors = websiteSettings?.authors || "";
      baseValues.subfolderPath = websiteSettings?.subfolder_path || "";
      baseValues.showUnmapped = Boolean(websiteSettings?.show_unmapped);
      baseValues.filters = websiteSettings?.filters || {};
      baseValues.logoFile = websiteSettings?.logo || null;

      secondaryLanguages.forEach((lang) => {
        baseValues[`translations_${lang.id}_title`] = findTranslationForLanguage(websiteSettings?.title, lang)?.content || "";
        baseValues[`translations_${lang.id}_shortDescription`] = findTranslationForLanguage(websiteSettings?.shortDescription, lang)?.content || "";
        baseValues[`translations_${lang.id}_about`] = findTranslationForLanguage(websiteSettings?.about, lang)?.content || "";
      });
    } else {
      secondaryLanguages.forEach((lang) => {
        baseValues[`translations_${lang.id}_title`] = "";
        baseValues[`translations_${lang.id}_shortDescription`] = "";
        baseValues[`translations_${lang.id}_about`] = "";
      });
    }

    return baseValues;
  });

  const onSubmitForm = async ({ value }) => {
    try {
      const payloadBase = {
        title: value.title?.trim() || "",
        shortDescription: value.shortDescription?.trim() || "",
        about: value.about?.trim() || "",
        authors: value.authors?.trim() || "",
        subfolderPath: value.subfolderPath?.trim() || "",
        showUnmapped: value.showUnmapped ? 1 : 0,
        filters: (currentFilters && Object.keys(currentFilters).length) ? currentFilters : null,
        languageId: defaultLanguage?.id || value.languageId || "",
        logoFile: logoFile || null,
      };

      const titleTranslations = [];
      const shortDescriptionTranslations = [];
      const aboutTranslations = [];

      secondaryLanguages.forEach((lang) => {
        const tContent = (value?.[`translations_${lang.id}_title`] || "").trim();
        const sdContent = (value?.[`translations_${lang.id}_shortDescription`] || "").trim();
        const aContent = (value?.[`translations_${lang.id}_about`] || "").trim();
        const existingTitle = findTranslationForLanguage(websiteSettings?.title, lang);
        const existingShortDesc = findTranslationForLanguage(websiteSettings?.shortDescription, lang);
        const existingAbout = findTranslationForLanguage(websiteSettings?.about, lang);
        // Include translation if there's an existing record (to allow clearing) or new content (to create)
        if (existingTitle || tContent) {
          titleTranslations.push(existingTitle?.id
            ? { id: existingTitle.id, language_id: lang.id, language_code: lang.code, content: tContent }
            : { language_id: lang.id, language_code: lang.code, content: tContent }
          );
        }
        if (existingShortDesc || sdContent) {
          shortDescriptionTranslations.push(existingShortDesc?.id
            ? { id: existingShortDesc.id, language_id: lang.id, language_code: lang.code, content: sdContent }
            : { language_id: lang.id, language_code: lang.code, content: sdContent }
          );
        }
        if (existingAbout || aContent) {
          aboutTranslations.push(existingAbout?.id
            ? { id: existingAbout.id, language_id: lang.id, language_code: lang.code, content: aContent }
            : { language_id: lang.id, language_code: lang.code, content: aContent }
          );
        }
      });

      const payload = {
        ...payloadBase,
        projectId: projectId || $page.params.project_id,
        ...(titleTranslations.length && { titleTranslations }),
        ...(shortDescriptionTranslations.length && { shortDescriptionTranslations }),
        ...(aboutTranslations.length && { aboutTranslations }),
      };

      if (!isEditMode) {
        const res = await createWebsiteSettings(payload);
        if (res?.error) throw res.error;
        onSuccess?.(res?.result?.[0] || null);
      } else {
        const res = await updateWebsiteSettings({ id: websiteSettings?.id || value.id, ...payload });
        if (res?.error) throw res.error;
        const freshSettings = Array.isArray(res?.websiteSettings) ? res.websiteSettings[0] : null;
        onSuccess?.(freshSettings || websiteSettings || null);
      }
    } catch (error) {
      console.error("WebsiteSettingsForm submit error:", error);
    }
  };

  const form = $derived(createForm(() => getFormConfig("websiteSettings", operationName, {
    validators: {
      onChange: validator?.schema?.passthrough ? validator.schema.passthrough() : validator.schema
    },
    defaultValues,
    onSubmit: onSubmitForm
  })));
  const formStore = $derived(form?.useStore ? form.useStore((state) => state) : null);

  export function submitForm() {
    form.handleSubmit();
  }

  export function getFormStore() {
    return formStore;
  }

  const uiSchema = $derived({
    ...(isEditMode && { id: { hidden: true } }),
    projectId: { hidden: true },
    languageId: { hidden: true },
    titleTranslations: { hidden: true },
    shortDescriptionTranslations: { hidden: true },
    aboutTranslations: { hidden: true },
    logoId: { hidden: true },
    logoFile: { hidden: true },
    title: { label: t("settings.title"), colSize: 12, charLimit: 100 },
    shortDescription: { label: t("common.short-description"), type: "textarea", colSize: 12, charLimit: 300 },
    about: { label: t("common.about"), type: "textarea", colSize: 12, renderer: BaseRichTextEditor, rendererProps: { placeholder: t("common.about-placeholder", { fallback: "Write about your project..." }) } },
    authors: { label: t("common.authors"), colSize: 12, hidden: true },
    subfolderPath: { label: t("common.subfolder-path"), colSize: 12, hidden: true },
    showUnmapped: { label: t("common.show-unmapped"), type: "checkbox", colSize: 12, hidden: true },
  });

  const fieldOrder = $derived(["title", "shortDescription", "about"]);

  const hiddenValueProviders = $derived({
    ...(isEditMode && { id: () => websiteSettings?.id || "" }),
    projectId: () => projectId || $page.params.project_id,
    languageId: () => defaultLanguage?.id || "",
  });
</script>

<div>
  <AutoForm
    {form}
    {validator}
    {createFieldValidator}
    {languages}
    translatableFields={["title", "shortDescription", "about"]}
    translationsValidator={getValidator("translations", "create")}
    defaultColSize={12}
    {fieldOrder}
    {uiSchema}
    {hiddenValueProviders}
  />

  <div class="mt-4">
    <p class="fw-semibold mb-2">{t("common.logo")}</p>
    <MediaUploadZone type="image" assets={logoAssets} onAdd={onAddLogo} onRemove={removeLogo} />
  </div>
</div>
