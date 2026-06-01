<script>
  import { createForm } from "@tanstack/svelte-form";
  import AutoForm from "$lib/components/form/AutoForm.svelte";
  import FileUpload from "$lib/components/base/FileUpload.svelte";
  import { getValidator, createFieldValidator, getFormConfig } from "$lib/utils/formValidation.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { createWebsiteSettings, updateWebsiteSettings } from "$lib/api/WebsiteSettingsApi.js";
  import { page } from "$app/stores";

  const translationStore = getTranslationStore();
  const t = $derived(translationStore.t);

  // Props
  let { mode = "create", websiteSettings = null, languages = [], projectId = null, onSuccess = null } = $props();

  // Derived
  const isEditMode = $derived(mode === "edit");
  const defaultLanguage = $derived(languages?.find((l) => l.is_default) || languages?.[0] || null);
  const secondaryLanguages = $derived(languages?.filter((l) => !l.is_default) || []);
  const operationName = $derived(isEditMode ? "update" : "create");
  const validator = $derived(getValidator("websiteSettings", operationName));

  const findTranslationForLanguage = (textField, lang) =>
    textField?.translations?.find((translation) =>
      translation?.language_id === lang.id || translation?.language?.code === lang.code
    ) || null;

  // Default values
  const defaultValues = $derived.by(() => {
    const baseValues = {
      title: "",
      about: "",
      authors: "",
      subfolderPath: "",
      showUnmapped: false,
      projectId: projectId || $page.params.project_id,
      languageId: defaultLanguage?.id || "",
      titleTranslations: [],
      aboutTranslations: [],
      logoFile: null,
    };

    if (isEditMode) {
      baseValues.id = websiteSettings?.id || "";
      baseValues.title = websiteSettings?.title?.content || "";
      baseValues.about = websiteSettings?.about?.content || "";
      baseValues.authors = websiteSettings?.authors || "";
      baseValues.subfolderPath = websiteSettings?.subfolder_path || "";
      baseValues.showUnmapped = Boolean(websiteSettings?.show_unmapped);
      baseValues.logoFile = websiteSettings?.logo || null;

      // Add translation fields
      secondaryLanguages.forEach((lang) => {
        baseValues[`translations_${lang.id}_title`] = findTranslationForLanguage(websiteSettings?.title, lang)?.content || "";
        baseValues[`translations_${lang.id}_about`] = findTranslationForLanguage(websiteSettings?.about, lang)?.content || "";
      });
    } else {
      // Create mode - add empty translation fields
      secondaryLanguages.forEach((lang) => {
        baseValues[`translations_${lang.id}_title`] = "";
        baseValues[`translations_${lang.id}_about`] = "";
      });
    }

    return baseValues;
  });

  // Submit handler
  const onSubmitForm = async ({ value }) => {
    try {
      const payloadBase = {
        title: value.title?.trim() || "",
        about: value.about?.trim() || "",
        authors: value.authors?.trim() || "",
        subfolderPath: value.subfolderPath?.trim() || "",
        showUnmapped: value.showUnmapped ? 1 : 0,
        languageId: defaultLanguage?.id || value.languageId || "",
        logoFile: value.logoFile || null,
      };

      // Build translation arrays
      const titleTranslations = [];
      const aboutTranslations = [];

      secondaryLanguages.forEach((lang) => {
        const tContent = (value?.[`translations_${lang.id}_title`] || "").trim();
        const aContent = (value?.[`translations_${lang.id}_about`] || "").trim();

        if (tContent) {
          const existing = findTranslationForLanguage(websiteSettings?.title, lang);
          titleTranslations.push(existing?.id
            ? { id: existing.id, language_id: lang.id, language_code: lang.code, content: tContent }
            : { language_id: lang.id, language_code: lang.code, content: tContent }
          );
        }
        if (aContent) {
          const existing = findTranslationForLanguage(websiteSettings?.about, lang);
          aboutTranslations.push(existing?.id
            ? { id: existing.id, language_id: lang.id, language_code: lang.code, content: aContent }
            : { language_id: lang.id, language_code: lang.code, content: aContent }
          );
        }
      });

      const payload = {
        ...payloadBase,
        projectId: projectId || $page.params.project_id,
        ...(titleTranslations.length && { titleTranslations }),
        ...(aboutTranslations.length && { aboutTranslations }),
      };

      if (!isEditMode) {
        const res = await createWebsiteSettings(payload);
        if (res?.error) throw res.error;
        onSuccess?.(res?.result?.[0] || null);
      } else {
        const res = await updateWebsiteSettings({ id: websiteSettings?.id || value.id, ...payload });
        if (res?.error) throw res.error;
        // updateWebsiteSettings refetches fresh data; res.websiteSettings is the fresh array
        const freshSettings = Array.isArray(res?.websiteSettings) ? res.websiteSettings[0] : null;
        onSuccess?.(freshSettings || websiteSettings || null);
      }
    } catch (error) {
      console.error("WebsiteSettingsForm submit error:", error);
    }
  };

  // Form instance
  const form = $derived(createForm(() => getFormConfig("websiteSettings", operationName, {
    // Keep dynamic translation fields like `translations_<langId>_<field>` in form values.
    validators: {
      onChange: validator?.schema?.passthrough ? validator.schema.passthrough() : validator.schema
    },
    defaultValues,
    onSubmit: onSubmitForm
  })));
  const formStore = $derived(form?.useStore ? form.useStore((state) => state) : null);

  // Export functions for parent component
  export function submitForm() {
    form.handleSubmit();
  }

  export function getFormStore() {
    return formStore;
  }
  // UI schema
  const uiSchema = $derived({
    ...(isEditMode && { id: { hidden: true } }),
    projectId: { hidden: true },
    languageId: { hidden: true },
    titleTranslations: { hidden: true },
    aboutTranslations: { hidden: true },
    logoId: { hidden: true },
    logoFile: {
      label: t("common.logo"),
      renderer: FileUpload,
      rendererProps: { accept: "image/*", maxSize: 5 * 1024 * 1024, allowedTypes: ["image/jpeg", "image/png", "image/svg+xml", "image/webp"] },
      colSize: 12,
    },
    title: { label: t("settings.title"), colSize: 12 },
    about: { label: t("common.about"), type: "textarea", colSize: 12 },
    authors: { label: t("common.authors"), colSize: 12, hidden: true },
    subfolderPath: { label: t("common.subfolder-path"), colSize: 12, hidden: true },
    showUnmapped: { label: t("common.show-unmapped"), type: "checkbox", colSize: 12, hidden: true },
  });

  const fieldOrder = $derived(["title", "about", "logoFile"]);

  const hiddenValueProviders = $derived({
    ...(isEditMode && { id: () => websiteSettings?.id || "" }),
    projectId: () => projectId || $page.params.project_id,
    languageId: () => defaultLanguage?.id || "",
  });
</script>

<form
  onsubmit={(e) => {
    e.preventDefault();
    e.stopPropagation();
    form.handleSubmit();
  }}
>
  <div class="row">
    <div class="col-12">
      <!-- Remove inner title to avoid duplication with page heading -->
      <AutoForm
        {form}
        {validator}
        {createFieldValidator}
        {languages}
        translatableFields={["title", "about"]}
        translationsValidator={getValidator("translations", "create")}
        defaultColSize={12}
        {fieldOrder}
        {uiSchema}
        {hiddenValueProviders}
      />
    </div>
  </div>
</form>
