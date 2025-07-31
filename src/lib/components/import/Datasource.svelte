<script>
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { createForm } from "@tanstack/svelte-form";
  import {
    getValidator,
    getFieldValidators,
  } from "$lib/stores/formValidationUtils.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { page } from "$app/stores";
  import { Tabs } from "melt/builders";
  import { createDatasource } from "$lib/stores/DatasourcesUtils.js";
  import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";
  import { goto } from "$app/navigation";

  const { t } = getTranslationStore();

  // Extract data from props
  const { institutions, languages, templates } = $props();
  const defaultLanguage =
    languages?.find((lang) => lang.is_default) || languages?.[0];
  const secondaryLanguages =
    languages?.filter((lang) => !lang.is_default) || [];

  // Translation state - only for translatable fields
  const translatableFields = ["name", "method", "notes"];
  let activeLanguageCode = $state("default");

  // Initialize tabs
  const tabs = new Tabs({
    value: "default",
    onValueChange: (value) => {
      activeLanguageCode = value;
    },
  });

  const validator = getValidator("datasources", "create");
  const fieldValidators = getFieldValidators("datasources", "create");
  const translationsFieldValidators = getFieldValidators(
    "translations",
    "create",
  );

  // Create default values including translation fields
  const createDefaultValues = () => {
    const defaults = {
      institutionId: institutions?.result?.[0]?.id || "",
      templateId: "", // Optional template selection
      languageId: defaultLanguage?.id || "",
      name: "",
      method: "",
      notes: "",
      language: "", // datasource language code
      copyright: "",
      contact: "",
      date: new Date().toISOString(),
    };

    // Add translation fields for each secondary language
    secondaryLanguages.forEach((lang) => {
      translatableFields.forEach((field) => {
        defaults[`translations_${lang.id}_${field}`] = "";
      });
    });

    return defaults;
  };

  // Create form instance
  const form = createForm(() => ({
    defaultValues: createDefaultValues(),
    onSubmit: async ({ value }) => {
      try {
        // Create the datasource (real call)
        const { datasource, nameId, methodId, notesId } =
          await createDatasource({
            institutionId: value.institutionId,
            templateId: value.templateId || undefined,
            languageId: value.languageId,
            name: value.name,
            method: value.method,
            notes: value.notes,
            language: value.language,
            copyright: value.copyright,
            contact: value.contact,
            date: value.date,
          });

        // Prepare translation creation promises
        const contentLanguageStore = getContentLanguageStore();
        const translationFieldToTextId = {
          name: nameId,
          method: methodId,
          notes: notesId,
        };

        const translationPromises = [];
        for (const lang of secondaryLanguages) {
          for (const fieldName of translatableFields) {
            const translationFieldKey = `translations_${lang.id}_${fieldName}`;
            const content = value[translationFieldKey];

            if (content?.trim() && translationFieldToTextId[fieldName]) {
              translationPromises.push(
                contentLanguageStore
                  .addTranslation(
                    translationFieldToTextId[fieldName],
                    lang.code,
                    content,
                  )
                  .catch((err) => {
                    throw err;
                  }),
              );
            }
          }
        }
        await Promise.all(translationPromises);

        // Navigate to next step or datasource view
        goto(
          `/projects/${$page.params.project_id}/datasources/${datasource.id}`,
        );
      } catch (error) {
        console.error("Error creating datasource:", error);
      }
    },
  }));
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
        <h2 class="mt-3">
          {t("common.add-new-datasource", { fallback: "Add New Datasource" })}
        </h2>
        <p>
          {t("common.add-new-datasource-desc", {
          fallback:
              "Please fill out the details below to add a new datasource to your project.",
        })}
      </p>
    </div>
  </div>

  <div class="row">
      <!-- Language tabs for translatable fields -->
      <div class="col-12 mb-4">
          <!-- Tab navigation -->
          <div {...tabs.triggerList} class="nav nav-tabs mb-3" role="tablist">
            <button
              {...tabs.getTrigger("default")}
              type="button"
              class="btn btn-link rounded-0 text-decoration-none {activeLanguageCode ===
              'default'
                ? 'text-primary border-0 border-bottom border-primary'
                : 'text-dark'}"
              role="tab"
              aria-selected={activeLanguageCode === "default"}
              data-active={activeLanguageCode === "default" ? "" : undefined}
            >
              {defaultLanguage?.name || "Default"}
            </button>
            {#each secondaryLanguages as lang}
              <button
                {...tabs.getTrigger(lang.id)}
                type="button"
                class="btn btn-link rounded-0 text-decoration-none {activeLanguageCode ===
                lang.id
                  ? 'text-primary border-0 border-bottom border-primary'
                  : 'text-dark'}"
                role="tab"
                aria-selected={activeLanguageCode === lang.id}
                data-active={activeLanguageCode === lang.id ? "" : undefined}
              >
                {lang.name}
              </button>
            {/each}
          </div>

          <!-- Default language content -->
          <div {...tabs.getContent("default")}>
            <div class="pt-2">
              <form.Field name="name" validators={fieldValidators.name}>
                {#snippet children(field)}
      <div class="mb-3">
                    <p class="form-label" for={field.name}>
                      {t("common.datasource-name", {
                        fallback: "Datasource Name",
                      })} ({defaultLanguage?.code || "default"})
                      {#if validator.requiredFields.has("name")}
                        <span class="text-danger">*</span>
                      {/if}
                    </p>
        <input
                      id={field.name}
                      name={field.name}
          type="text"
                      class="form-control {field.state.meta.errors.length > 0
                        ? 'is-invalid'
                        : ''}"
                      placeholder={t("common.datasource-name", {
                        fallback: "Datasource Name",
                      })}
                      value={field.state.value}
                      oninput={(e) => field.handleChange(e.target.value)}
                      onblur={field.handleBlur}
                    />
                    {#if field.state.meta.errors.length > 0}
                      <div class="invalid-feedback">
                        {field.state.meta.errors.join(", ")}
                      </div>
                    {/if}
                  </div>
                {/snippet}
              </form.Field>

              <form.Field name="method" validators={fieldValidators.method}>
                {#snippet children(field)}
                  <div class="mb-3">
                    <p class="form-label" for={field.name}>
                      {t("common.method", { fallback: "Method" })} ({defaultLanguage?.code ||
                        "default"})
                      {#if validator.requiredFields.has("method")}
                        <span class="text-danger">*</span>
                      {/if}
                    </p>
                    <textarea
                      id={field.name}
                      name={field.name}
                      class="form-control {field.state.meta.errors.length > 0
                        ? 'is-invalid'
                        : ''}"
                      rows="3"
                      placeholder={t("common.method", {
                        fallback: "Method",
                      })}
                      value={field.state.value}
                      oninput={(e) => field.handleChange(e.target.value)}
                      onblur={field.handleBlur}
                    ></textarea>
                    {#if field.state.meta.errors.length > 0}
                      <div class="invalid-feedback">
                        {field.state.meta.errors.join(", ")}
                      </div>
                    {/if}
                  </div>
                {/snippet}
              </form.Field>

              <form.Field name="notes" validators={fieldValidators.notes}>
                {#snippet children(field)}
                  <div class="mb-3">
                    <p class="form-label" for={field.name}>
                      {t("common.notes", { fallback: "Notes" })} ({defaultLanguage?.code ||
                        "default"})
                      {#if validator.requiredFields.has("notes")}
                        <span class="text-danger">*</span>
                      {/if}
                    </p>
                    <textarea
                      id={field.name}
                      name={field.name}
                      class="form-control {field.state.meta.errors.length > 0
                        ? 'is-invalid'
                        : ''}"
                      rows="3"
                      placeholder={t("common.notes", {
                        fallback: "Notes",
                      })}
                      value={field.state.value}
                      oninput={(e) => field.handleChange(e.target.value)}
                      onblur={field.handleBlur}
                    ></textarea>
                    {#if field.state.meta.errors.length > 0}
                      <div class="invalid-feedback">
                        {field.state.meta.errors.join(", ")}
                      </div>
                    {/if}
                  </div>
                {/snippet}
              </form.Field>
            </div>
      </div>

          <!-- Secondary language content -->
          {#each secondaryLanguages as lang}
            <div {...tabs.getContent(lang.id)}>
              <div class="pt-2">
                <form.Field
                  name="translations_{lang.id}_name"
                  validators={translationsFieldValidators.content}
                >
                  {#snippet children(field)}
      <div class="mb-3">
                      <p class="form-label" for={field.name}>
                        {t("common.datasource-name", {
                          fallback: "Datasource Name",
                        })} ({lang.code})
                      </p>
        <input
                        id={field.name}
                        name={field.name}
                        type="text"
                        class="form-control {field.state.meta.errors.length > 0
                          ? 'is-invalid'
                          : ''}"
                        placeholder={t("common.datasource-name", {
                          fallback: "Datasource Name",
                        })}
                        value={field.state.value}
                        oninput={(e) => field.handleChange(e.target.value)}
                        onblur={field.handleBlur}
                      />
                      {#if field.state.meta.errors.length > 0}
                        <div class="invalid-feedback">
                          {field.state.meta.errors.join(", ")}
                        </div>
                      {/if}
                    </div>
                  {/snippet}
                </form.Field>

                <form.Field
                  name="translations_{lang.id}_method"
                  validators={translationsFieldValidators.content}
                >
                  {#snippet children(field)}
                    <div class="mb-3">
                      <p class="form-label" for={field.name}>
                        {t("common.method", { fallback: "Method" })} ({lang.code})
                      </p>
                      <textarea
                        id={field.name}
                        name={field.name}
                        class="form-control {field.state.meta.errors.length > 0
                          ? 'is-invalid'
                          : ''}"
                        rows="3"
                        placeholder={t("common.method", {
                          fallback: "Method",
                        })}
                        value={field.state.value}
                        oninput={(e) => field.handleChange(e.target.value)}
                        onblur={field.handleBlur}
                      ></textarea>
                      {#if field.state.meta.errors.length > 0}
                        <div class="invalid-feedback">
                          {field.state.meta.errors.join(", ")}
                        </div>
                      {/if}
                    </div>
                  {/snippet}
                </form.Field>

                <form.Field
                  name="translations_{lang.id}_notes"
                  validators={translationsFieldValidators.content}
                >
                  {#snippet children(field)}
                    <div class="mb-3">
                      <p class="form-label" for={field.name}>
                        {t("common.notes", { fallback: "Notes" })} ({lang.code})
                      </p>
                      <textarea
                        id={field.name}
                        name={field.name}
                        class="form-control {field.state.meta.errors.length > 0
                          ? 'is-invalid'
                          : ''}"
                        rows="3"
                        placeholder={t("common.notes", {
                          fallback: "Notes",
                        })}
                        value={field.state.value}
                        oninput={(e) => field.handleChange(e.target.value)}
                        onblur={field.handleBlur}
                      ></textarea>
                      {#if field.state.meta.errors.length > 0}
                        <div class="invalid-feedback">
                          {field.state.meta.errors.join(", ")}
                        </div>
                      {/if}
                    </div>
                  {/snippet}
                </form.Field>
              </div>
            </div>
          {/each}
        </div>

      </div>
    </div>

    <!-- Non-translatable fields in two columns -->
    <div class="row">
      <div class="col-md-6">
        <form.Field
          name="institutionId"
          validators={fieldValidators.institutionId}
        >
          {#snippet children(field)}
            <div class="mb-3">
              <p class="form-label" for={field.name}>
                {t("common.institution", { fallback: "Institution" })}
                {#if validator.requiredFields.has("institutionId")}
                  <span class="text-danger">*</span>
                {/if}
              </p>
              <select
                id={field.name}
                name={field.name}
                class="form-select {field.state.meta.errors.length > 0
                  ? 'is-invalid'
                  : ''}"
                value={field.state.value}
                onchange={(e) => field.handleChange(e.target.value)}
                onblur={field.handleBlur}
              >
                <option value="">Select an institution</option>
                {#each institutions as institution}
            <option value={institution.id}>
              {institution.name.content}
            </option>
          {/each}
        </select>
              {#if field.state.meta.errors.length > 0}
                <div class="invalid-feedback">
                  {field.state.meta.errors.join(", ")}
                </div>
              {/if}
            </div>
          {/snippet}
        </form.Field>

        <form.Field name="templateId" validators={fieldValidators.templateId}>
          {#snippet children(field)}
            <div class="mb-3">
              <p class="form-label" for={field.name}>
                {t("common.template", { fallback: "Template" })}
                {#if validator.requiredFields.has("templateId")}
                  <span class="text-danger">*</span>
                {/if}
              </p>
              <select
                id={field.name}
                name={field.name}
                class="form-select {field.state.meta.errors.length > 0
                  ? 'is-invalid'
                  : ''}"
                value={field.state.value}
                onchange={(e) => field.handleChange(e.target.value)}
                onblur={field.handleBlur}
              >
                <option value="">Select a template (optional)</option>
                {#each templates?.result || [] as template}
                  <option value={template.id}>
                    {template.name}
                  </option>
                {/each}
              </select>
              {#if field.state.meta.errors.length > 0}
                <div class="invalid-feedback">
                  {field.state.meta.errors.join(", ")}
                </div>
              {/if}
            </div>
          {/snippet}
        </form.Field>

        <form.Field name="date" validators={fieldValidators.date}>
          {#snippet children(field)}
            <div class="mb-3">
              <p class="form-label" for={field.name}>
                {t("common.date", { fallback: "Date" })}
                {#if validator.requiredFields.has("date")}
                  <span class="text-danger">*</span>
                {/if}
              </p>
              <input
                id={field.name}
                name={field.name}
                type="date"
                class="form-control {field.state.meta.errors.length > 0
                  ? 'is-invalid'
                  : ''}"
                value={field.state.value
                  ? new Date(field.state.value).toISOString().split("T")[0]
                  : ""}
                onchange={(e) =>
                  field.handleChange(
                    e.target.value
                      ? new Date(e.target.value).toISOString()
                      : "",
                  )}
                onblur={field.handleBlur}
              />
              {#if field.state.meta.errors.length > 0}
                <div class="invalid-feedback">
                  {field.state.meta.errors.join(", ")}
                </div>
              {/if}
            </div>
          {/snippet}
        </form.Field>
      </div>

      <div class="col-md-6">
        <form.Field name="language" validators={fieldValidators.language}>
          {#snippet children(field)}
            <div class="mb-3">
              <p class="form-label" for={field.name}>
                {t("common.datasource-language", {
                  fallback: "Datasource Language",
                })}
                {#if validator.requiredFields.has("language")}
                  <span class="text-danger">*</span>
                {/if}
              </p>
              <input
                id={field.name}
                name={field.name}
                type="text"
                class="form-control {field.state.meta.errors.length > 0
                  ? 'is-invalid'
                  : ''}"
                placeholder="e.g., en, es, fr"
                value={field.state.value}
                oninput={(e) => field.handleChange(e.target.value)}
                onblur={field.handleBlur}
              />
              {#if field.state.meta.errors.length > 0}
                <div class="invalid-feedback">
                  {field.state.meta.errors.join(", ")}
                </div>
              {/if}
            </div>
          {/snippet}
        </form.Field>

        <form.Field name="copyright" validators={fieldValidators.copyright}>
          {#snippet children(field)}
            <div class="mb-3">
              <p class="form-label" for={field.name}>
                {t("common.copyright", { fallback: "Copyright" })}
                {#if validator.requiredFields.has("copyright")}
                  <span class="text-danger">*</span>
                {/if}
              </p>
              <input
                id={field.name}
                name={field.name}
                type="text"
                class="form-control {field.state.meta.errors.length > 0
                  ? 'is-invalid'
                  : ''}"
                placeholder={t("common.copyright", {
                  fallback: "Copyright",
                })}
                value={field.state.value}
                oninput={(e) => field.handleChange(e.target.value)}
                onblur={field.handleBlur}
              />
              {#if field.state.meta.errors.length > 0}
                <div class="invalid-feedback">
                  {field.state.meta.errors.join(", ")}
        </div>
      {/if}
            </div>
          {/snippet}
        </form.Field>

        <form.Field name="contact" validators={fieldValidators.contact}>
          {#snippet children(field)}
            <div class="mb-3">
              <p class="form-label" for={field.name}>
                {t("common.contact", { fallback: "Contact" })}
                {#if validator.requiredFields.has("contact")}
                  <span class="text-danger">*</span>
                {/if}
              </p>
              <input
                id={field.name}
                name={field.name}
                type="text"
                class="form-control {field.state.meta.errors.length > 0
                  ? 'is-invalid'
                  : ''}"
                placeholder={t("common.contact", {
                  fallback: "Contact",
                })}
                value={field.state.value}
                oninput={(e) => field.handleChange(e.target.value)}
                onblur={field.handleBlur}
              />
              {#if field.state.meta.errors.length > 0}
                <div class="invalid-feedback">
                  {field.state.meta.errors.join(", ")}
                </div>
              {/if}
            </div>
          {/snippet}
        </form.Field>
      </div>
    </div>

    <!-- Show form-level errors and debug state -->
    <div class="row">
      <div class="col-12">
        <form.Subscribe
          selector={(state) => ({
            errors: state.errors,
            canSubmit: state.canSubmit,
            isSubmitting: state.isSubmitting,
            fieldMeta: state.fieldMeta,
          })}
        >
          {#snippet children(formState)}
            {#if formState.errors.length > 0}
              <div class="alert alert-danger">
                <strong>Please fix the following errors:</strong>
                <ul class="mb-0 mt-1">
                  {#each formState.errors as error}
                    <li>{error}</li>
                  {/each}
                </ul>
        </div>
      {/if}
          {/snippet}
        </form.Subscribe>
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
