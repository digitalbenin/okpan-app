<script>
  import AutoForm from "$lib/components/form/AutoForm.svelte";
  import DynamicArrayField from "$lib/components/base/DynamicArrayField.svelte";
  import { getValidator, createFieldValidator } from "$lib/utils/formValidation.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let {
    form,
    validator,
    languages = [],
    translatableFields = ["name", "description", "country", "location"],
    dirtyTracker = $bindable(null),
    defaultColSize = 7,
    fieldColSize = 9,
    margin = 0,
    usePortal = true,
    mode = "create",
    currentProjectId = null,
    institution = null,
  } = $props();

  const { t } = getTranslationStore();
  const isEditMode = $derived(mode === "edit");

  const uiSchema = $derived({
    ...(isEditMode && { id: { hidden: true } }),
    project_id: { hidden: true },
    languageId: { hidden: true },
    status: { hidden: true },
    links: {
      label: t("institutions.links"),
      renderer: DynamicArrayField,
      rendererProps: {
        arrayFieldName: "links",
        itemFields: [
          {
            name: "url",
            label: t("institutions.url"),
            type: "text",
            placeholder: t("institutions.url-placeholder"),
            required: false,
            colSize: 5,
          },
          {
            name: "label",
            label: t("common.label"),
            type: "text",
            placeholder: t("institutions.link-label-placeholder"),
            required: false,
            colSize: 5,
          },
        ],
        addButtonText: t("institutions.add-link"),
        deleteButtonTitle: t("institutions.remove-link"),
        minItems: 0,
        maxItems: 10,
        deleteColSize: 2,
      },
      colSize: fieldColSize,
    },
    name: { label: t("institutions.institution-name"), colSize: fieldColSize },
    description: { type: "textarea", label: t("common.description"), colSize: fieldColSize },
    country: { label: t("institutions.country"), colSize: fieldColSize },
    location: { label: t("institutions.location"), colSize: fieldColSize },
    website: { label: t("common.website"), colSize: fieldColSize },
  });

  const hiddenValueProviders = $derived({
    ...(isEditMode && { id: () => institution?.id || "" }),
    project_id: () => currentProjectId,
    languageId: () => languages?.find((language) => language.is_default)?.id || languages?.[0]?.id || "",
  });

  const hiddenStaticValues = $derived(isEditMode ? {} : { status: "in progress" });
  const fieldOrder = ["website", "links"];
</script>

<AutoForm
  {form}
  {validator}
  {createFieldValidator}
  languages={languages}
  translatableFields={translatableFields}
  translationsValidator={getValidator("translations", "create")}
  {fieldOrder}
  {uiSchema}
  {hiddenStaticValues}
  {hiddenValueProviders}
  {defaultColSize}
  {usePortal}
  {margin}
  bind:dirtyTracker
/>
