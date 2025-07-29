<script>
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { createForm } from "@tanstack/svelte-form";
  import {
    getValidator,
    getFieldValidators,
  } from "$lib/stores/formValidationUtils.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { page } from "$app/stores";
  import DynamicArrayField from "$lib/components/base/DynamicArrayField.svelte";
  import { Tabs } from "melt/builders";
  import { createInstitution } from "$lib/stores/InstitutionsUtils.js";
  import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";
  import { goto } from "$app/navigation";

  const { t } = getTranslationStore();

  let { data } = $props();

  // Extract languages from layout data
  const { languages } = data;
  const defaultLanguage =
    languages?.find((lang) => lang.is_default) || languages?.[0];
  const secondaryLanguages =
    languages?.filter((lang) => !lang.is_default) || [];

  // Translation state - only for translatable fields
  const translatableFields = ["name", "description", "country", "location"];
  let activeLanguageCode = $state("default");

  // Initialize tabs
  const tabs = new Tabs({
    value: activeLanguageCode,
    onValueChange: (value) => {
      activeLanguageCode = value;
    },
  });

  const validator = getValidator("institutions", "create");
  const fieldValidators = getFieldValidators("institutions", "create");
  const translationsFieldValidators = getFieldValidators(
    "translations",
    "create",
  );

  // Create default values including translation fields
  const createDefaultValues = () => {
    const defaults = {
      project_id: $page.params.project_id,
      languageId: defaultLanguage?.id || "",
      name: "",
      description: "",
      country: "",
      location: "",
      website: "",
      links: [{ url: "", label: "" }],
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
        // Transform links array to native array for the mutation
        const transformedValue = {
          ...value,
          links:
            value.links?.filter(
              (link) => link.url?.trim() && link.label?.trim(),
            ) || [],
        };

        // Create the institution (real call)
        const { institution, nameId, descriptionId, countryId, locationId } =
          await createInstitution({
            project_id: transformedValue.project_id,
            languageId: transformedValue.languageId,
            name: transformedValue.name,
            description: transformedValue.description,
            country: transformedValue.country,
            location: transformedValue.location,
            website: transformedValue.website,
            links: transformedValue.links,
            status: transformedValue.status,
          });

        // Prepare translation creation promises
        const contentLanguageStore = getContentLanguageStore();
        const translationFieldToTextId = {
          name: nameId,
          description: descriptionId,
          country: countryId,
          location: locationId,
        };

        const translationPromises = [];
        for (const lang of secondaryLanguages) {
          for (const fieldName of translatableFields) {
            const translationFieldKey = `translations_${lang.id}_${fieldName}`;
            const content = transformedValue[translationFieldKey];

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

        goto(
          `/projects/${transformedValue.project_id}/institutions/${institution.id}`,
        );
      } catch (error) {
        console.error("Error creating institution:", error);
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
      <div class="col-6">
        <h2 class="mt-3">
          {t("common.add-new-institution", { fallback: "Add New Institution" })}
        </h2>
        <p>
          {t("common.add-new-institution-desc", {
            fallback:
              "Please fill out the details below to add a new institution to your project.",
          })}
        </p>

        <!-- Language tabs for translatable fields -->
        <div class="mb-4">
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
                      {t("common.institution-name", {
                        fallback: "Institution Name",
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
                      placeholder={t("common.institution-name", {
                        fallback: "Institution Name",
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
                name="description"
                validators={fieldValidators.description}
              >
                {#snippet children(field)}
                  <div class="mb-3">
                    <p class="form-label" for={field.name}>
                      {t("common.description", { fallback: "Description" })} ({defaultLanguage?.code ||
                        "default"})
                      {#if validator.requiredFields.has("description")}
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
                      placeholder={t("common.description", {
                        fallback: "Description",
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

              <form.Field name="country" validators={fieldValidators.country}>
                {#snippet children(field)}
                  <div class="mb-3">
                    <p class="form-label" for={field.name}>
                      {t("common.country", { fallback: "Country" })} ({defaultLanguage?.code ||
                        "default"})
                      {#if validator.requiredFields.has("country")}
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
                      placeholder={t("common.country", {
                        fallback: "Country",
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

              <form.Field name="location" validators={fieldValidators.location}>
                {#snippet children(field)}
                  <div class="mb-3">
                    <p class="form-label" for={field.name}>
                      {t("common.location", { fallback: "Location" })} ({defaultLanguage?.code ||
                        "default"})
                      {#if validator.requiredFields.has("location")}
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
                      placeholder={t("common.location", {
                        fallback: "Location",
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
                        {t("common.institution-name", {
                          fallback: "Institution Name",
                        })} ({lang.code})
                      </p>
                      <input
                        id={field.name}
                        name={field.name}
                        type="text"
                        class="form-control {field.state.meta.errors.length > 0
                          ? 'is-invalid'
                          : ''}"
                        placeholder={t("common.institution-name", {
                          fallback: "Institution Name",
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
                  name="translations_{lang.id}_description"
                  validators={translationsFieldValidators.content}
                >
                  {#snippet children(field)}
                    <div class="mb-3">
                      <p class="form-label" for={field.name}>
                        {t("common.description", { fallback: "Description" })} ({lang.code})
                      </p>
                      <textarea
                        id={field.name}
                        name={field.name}
                        class="form-control {field.state.meta.errors.length > 0
                          ? 'is-invalid'
                          : ''}"
                        rows="3"
                        placeholder={t("common.description", {
                          fallback: "Description",
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
                  name="translations_{lang.id}_country"
                  validators={translationsFieldValidators.content}
                >
                  {#snippet children(field)}
                    <div class="mb-3">
                      <p class="form-label" for={field.name}>
                        {t("common.country", { fallback: "Country" })} ({lang.code})
                      </p>
                      <input
                        id={field.name}
                        name={field.name}
                        type="text"
                        class="form-control {field.state.meta.errors.length > 0
                          ? 'is-invalid'
                          : ''}"
                        placeholder={t("common.country", {
                          fallback: "Country",
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
                  name="translations_{lang.id}_location"
                  validators={translationsFieldValidators.content}
                >
                  {#snippet children(field)}
                    <div class="mb-3">
                      <p class="form-label" for={field.name}>
                        {t("common.location", { fallback: "Location" })} ({lang.code})
                      </p>
                      <input
                        id={field.name}
                        name={field.name}
                        type="text"
                        class="form-control {field.state.meta.errors.length > 0
                          ? 'is-invalid'
                          : ''}"
                        placeholder={t("common.location", {
                          fallback: "Location",
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
          {/each}
        </div>

        <!-- Non-translatable fields -->
        <div class="mb-4">
          <form.Field name="website" validators={fieldValidators.website}>
            {#snippet children(field)}
              <div class="mb-3">
                <p class="form-label" for={field.name}>
                  {t("common.website", { fallback: "Website" })}
                  {#if validator.requiredFields.has("website")}
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
                  placeholder="https://example.com"
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

          <form.Field name="links" validators={fieldValidators.links}>
            {#snippet children(field)}
              <div class="mb-3">
                <p class="form-label">
                  {t("common.links", { fallback: "Links" })}
                  {#if validator.requiredFields.has("links")}
                    <span class="text-danger">*</span>
                  {/if}
                </p>
                <DynamicArrayField
                  bind:value={field.state.value}
                  itemFields={[
                    {
                      name: "url",
                      label: "URL",
                      type: "text",
                      placeholder: "https://example.com",
                      required: false,
                      colSize: 7,
                    },
                    {
                      name: "label",
                      label: "Label",
                      type: "text",
                      placeholder: "Website, Online Catalogue, etc.",
                      required: false,
                      colSize: 4,
                    },
                  ]}
                  addButtonText="Add Link"
                  itemTitle="Link"
                  minItems={0}
                  maxItems={10}
                  errors={field.state.meta.errors}
                  onChange={(newValue) => {
                    field.handleChange(newValue);
                  }}
                />
              </div>
            {/snippet}
          </form.Field>
        </div>

        <!-- Show form-level errors and debug state -->
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
