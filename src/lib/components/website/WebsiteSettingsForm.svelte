<script>
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { createForm } from "@tanstack/svelte-form";
  import AutoForm from "$lib/components/form/AutoForm.svelte";
  import FileUpload from "$lib/components/base/FileUpload.svelte";
  import {
    getValidator,
    createFieldValidator,
    getFormConfig,
  } from "$lib/stores/formValidationUtils.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import {
    createWebsiteSettings,
    updateWebsiteSettings,
  } from "$lib/stores/WebsiteSettingsUtils.js";
  import { page } from "$app/stores";

  const { t } = getTranslationStore();

  // Props
  let {
    mode = "create",
    websiteSettings = null,
    languages = [],
    projectId = null,
    onSuccess = null,
  } = $props();

  const isEditMode = $derived(mode === "edit");
  const defaultLanguage = $derived(
    languages?.find((l) => l.is_default) || languages?.[0] || null,
  );

  // Default values for the plain form
  const defaultValues = $derived.by(() => {
    if (isEditMode) {
      const values = {
        id: websiteSettings?.id || "",
        title: websiteSettings?.title?.content || "",
        about: websiteSettings?.about?.content || "",
        authors: websiteSettings?.authors || "",
        subfolderPath: websiteSettings?.subfolder_path || "",
        showUnmapped: Boolean(websiteSettings?.show_unmapped) || false,
        // Hidden fields used by validators/mutations
        projectId: projectId || $page.params.project_id,
        languageId: defaultLanguage?.id || "",
        titleTranslations: [],
        aboutTranslations: [],
        logoFile: null,
      };
      // Prefill secondary language translation inputs for title and about
      try {
        const secs = (languages || []).filter((l) => !l.is_default);
        for (const lang of secs) {
          const tContent =
            (websiteSettings?.title?.translations || []).find(
              (t) => t?.language_id === lang.id,
            )?.content || "";
          const aContent =
            (websiteSettings?.about?.translations || []).find(
              (t) => t?.language_id === lang.id,
            )?.content || "";
          values[`translations_${lang.id}_title`] = tContent;
          values[`translations_${lang.id}_about`] = aContent;
        }
      } catch {}
      return values;
    }
    // Create mode
    const values = {
      title: "",
      about: "",
      authors: "",
      subfolderPath: "",
      showUnmapped: false,
      // Hidden fields used by validators/mutations
      projectId: projectId || $page.params.project_id,
      languageId: defaultLanguage?.id || "",
      titleTranslations: [],
      aboutTranslations: [],
      logoFile: null,
    };
    // Prefill empty keys for secondary languages in create mode (stable field map)
    try {
      const secs = (languages || []).filter((l) => !l.is_default);
      for (const lang of secs) {
        values[`translations_${lang.id}_title`] = "";
        values[`translations_${lang.id}_about`] = "";
      }
    } catch {}
    return values;
  });

  // Submit handler: transforms boolean showUnmapped -> Int and calls proper util
  async function onSubmitForm({ value }) {
    try {
      console.log("[WebsiteSettingsForm] Submit value:", value);
      const payloadBase = {
        title: value.title?.trim() || "",
        about: value.about?.trim() || "",
        authors: value.authors?.trim() || "",
        subfolderPath: value.subfolderPath?.trim() || "",
        showUnmapped: value.showUnmapped ? 1 : 0,
        languageId: defaultLanguage?.id || value.languageId || "",
        // Include logo file in payload when present
        logoFile: value.logoFile || null,
      };
      console.log("[WebsiteSettingsForm] payloadBase:", payloadBase);
      try {
        $inspect("WebsiteSettingsForm payloadBase", payloadBase);
      } catch {}

      // Build translation arrays from multilingual AutoForm inputs
      const secondaryLanguages = (languages || []).filter((l) => !l.is_default);
      console.log("[WebsiteSettingsForm] languages info", {
        defaultLanguage,
        secondaryLanguages,
      });
      const titleTranslations = [];
      const aboutTranslations = [];
      const existingTitleByLang = new Map(
        (websiteSettings?.title?.translations || []).map((t) => [
          t.language_id,
          t,
        ]),
      );
      const existingAboutByLang = new Map(
        (websiteSettings?.about?.translations || []).map((t) => [
          t.language_id,
          t,
        ]),
      );
      console.log("[WebsiteSettingsForm] existing translations maps", {
        titleKeys: Array.from(existingTitleByLang.keys()),
        aboutKeys: Array.from(existingAboutByLang.keys()),
      });

      for (const lang of secondaryLanguages) {
        const tKey = `translations_${lang.id}_title`;
        const aKey = `translations_${lang.id}_about`;
        const tContent = (value?.[tKey] || "").trim();
        const aContent = (value?.[aKey] || "").trim();

        if (tContent) {
          const existing = existingTitleByLang.get(lang.id);
          titleTranslations.push(
            existing?.id
              ? { id: existing.id, language_code: lang.code, content: tContent }
              : { language_code: lang.code, content: tContent },
          );
        }
        if (aContent) {
          const existing = existingAboutByLang.get(lang.id);
          aboutTranslations.push(
            existing?.id
              ? { id: existing.id, language_code: lang.code, content: aContent }
              : { language_code: lang.code, content: aContent },
          );
        }
      }

      console.log(
        `[WS] built tTr=${titleTranslations.length} aTr=${aboutTranslations.length} langs=${secondaryLanguages
          .map((l) => l.code)
          .join(",")}`,
      );

      if (!isEditMode) {
        const createPayload = {
          ...payloadBase,
          projectId: projectId || $page.params.project_id,
          // Only include translation arrays when non-empty so downstream
          // mutation steps can conditionally run based on param presence
          ...(titleTranslations.length
            ? { titleTranslations }
            : {}),
          ...(aboutTranslations.length
            ? { aboutTranslations }
            : {}),
        };
        console.log(
          `[WS] submit create includeTitleTr=${titleTranslations.length > 0} includeAboutTr=${aboutTranslations.length > 0}`,
        );
        const res = await createWebsiteSettings(createPayload);
        console.log(
          `[WS] create ok=${!(res && res.error)} err=${res?.error ? String(res.error).slice(0, 120) : "none"}`,
        );
        if (res?.error) throw res.error;
        onSuccess?.(res?.result?.[0] || null);
      } else {
        const updatePayload = {
          id: websiteSettings?.id || value.id,
          ...payloadBase,
          projectId: projectId || $page.params.project_id,
          ...(titleTranslations.length
            ? { titleTranslations }
            : {}),
          ...(aboutTranslations.length
            ? { aboutTranslations }
            : {}),
        };
        console.log(
          `[WS] submit update includeTitleTr=${titleTranslations.length > 0} includeAboutTr=${aboutTranslations.length > 0}`,
        );
        const res = await updateWebsiteSettings(updatePayload);
        console.log(
          `[WS] update ok=${!(res && res.error)} err=${res?.error ? String(res.error).slice(0, 120) : "none"}`,
        );
        if (res?.error) throw res.error;
        // Prefer updated settings from response to refresh UI (includes nested translations)
        onSuccess?.(res?.websiteSettings?.[0] || websiteSettings || null);
      }
    } catch (error) {
      console.error("WebsiteSettingsForm submit error:", error);
      // No toast notifications per request; keep console error for debugging
    }
  }

  // Form instance via form config util
  const operationName = $derived(isEditMode ? "update" : "create");
  const validator = $derived(getValidator("websiteSettings", operationName));
  const form = $derived(
    createForm(() =>
      getFormConfig("websiteSettings", operationName, {
        defaultValues,
        onSubmit: onSubmitForm,
      }),
    ),
  );

  // UI schema and field order for a plain layout
  const uiSchema = $derived({
    ...(isEditMode ? { id: { hidden: true } } : {}),
    projectId: { hidden: true },
    languageId: { hidden: true },
    titleTranslations: { hidden: true },
    aboutTranslations: { hidden: true },
    logoFile: {
      label: t("common.logo", { fallback: "Website Logo" }),
      renderer: FileUpload,
      rendererProps: {
        accept: "image/*",
        placeholder: "Choose logo image or drag and drop",
        maxSize: 5 * 1024 * 1024,
        allowedTypes: [
          "image/jpeg",
          "image/png",
          "image/svg+xml",
          "image/webp",
        ],
      },
      colSize: 12,
    },
    title: {
      label: t("common.title", { fallback: "Title" }),
      colSize: 12,
    },
    about: {
      label: t("common.about", { fallback: "About" }),
      type: "textarea",
      colSize: 12,
    },
    authors: {
      label: t("common.authors", { fallback: "Authors" }),
      colSize: 12,
    },
    subfolderPath: {
      label: t("common.subfolder-path", { fallback: "Subfolder Path" }),
      colSize: 12,
    },
    showUnmapped: {
      label: t("common.show-unmapped", { fallback: "Show Unmapped Objects" }),
      type: "checkbox",
      colSize: 12,
    },
  });

  const fieldOrder = $derived([
    "title",
    "about",
    "authors",
    "subfolderPath",
    "showUnmapped",
    "logoFile",
  ]);

  // Hidden value providers (keep values in sync)
  const hiddenValueProviders = $derived({
    ...(isEditMode ? { id: () => websiteSettings?.id || "" } : {}),
    projectId: () => projectId || $page.params.project_id,
    languageId: () => defaultLanguage?.id || "",
  });

  const hiddenStaticValues = $derived({});
</script>

<form
  onsubmit={(e) => {
    e.preventDefault();
    e.stopPropagation();
    form.handleSubmit();
  }}
>
  <div class="container-fluid">
    <div class="row">
      <div class="col-12">
        <!-- Remove inner title to avoid duplication with page heading -->
        <AutoForm
          {form}
          {validator}
          {createFieldValidator}
          entity={"websiteSettings"}
          operation={operationName}
          {languages}
          translatableFields={["title", "about"]}
          translationsValidator={getValidator("translations", "create")}
          defaultColSize={12}
          {fieldOrder}
          {uiSchema}
          {hiddenStaticValues}
          {hiddenValueProviders}
        />
      </div>
    </div>
  </div>

  <div
    class="position-absolute bottom-0 start-0 w-100 bg-light z-1 p-3 d-flex justify-content-end"
  >
    <BaseButton
      type="submit"
      class="btn btn-success"
      text={t("common.confirm", { fallback: "Confirm" })}
    />
  </div>
</form>
