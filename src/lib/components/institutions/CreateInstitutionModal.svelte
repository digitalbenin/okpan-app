<script>
  import { createForm } from "@tanstack/svelte-form";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import InstitutionFormFields from "$lib/components/institutions/InstitutionFormFields.svelte";
  import { getValidator, getFormConfig } from "$lib/utils/formValidation.js";
  import { createInstitution } from "$lib/api/InstitutionsApi.js";
  import { processEntityTranslations } from "$lib/api/TranslationsApi.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let {
    isOpen = $bindable(false),
    languages = [],
    projectId = null,
    onCreated = null,
    onCancel = null,
  } = $props();

  const { t } = getTranslationStore();
  const translatableFields = ["name", "description", "country", "location"];
  const validator = $derived(getValidator("institutions", "create"));
  const defaultLanguage = $derived(languages?.find((language) => language.is_default) || languages?.[0]);
  const secondaryLanguages = $derived(languages?.filter((language) => !language.is_default) || []);
  let dirtyTracker = $state(null);

  const defaultValues = $derived({
    status: "in progress",
    name: "",
    description: "",
    country: "",
    location: "",
    website: "",
    links: [],
  });

  const form = $derived(createForm(() => getFormConfig("institutions", "create", {
    defaultValues,
    onSubmit: async ({ value }) => {
      const links = value.links
        ?.filter((link) => link.url?.trim() && link.label?.trim())
        .map((link) => ({ url: link.url, label: link.label })) || [];

      const result = await createInstitution({
        project_id: projectId,
        languageId: defaultLanguage?.id,
        links,
        name: value.name,
        description: value.description,
        country: value.country,
        location: value.location,
        website: value.website,
        status: value.status,
      });

      if (!result?.institution) {
        throw new Error(result?.error || "Failed to create institution");
      }

      const textIdMap = {
        name: result.nameId,
        description: result.descriptionId,
        country: result.countryId,
        location: result.locationId,
      };
      await processEntityTranslations(null, secondaryLanguages, translatableFields, value, languages, textIdMap);
      onCreated?.(result.institution);
      isOpen = false;
    },
  })));

  const cancel = () => {
    isOpen = false;
    onCancel?.();
  };

  const submit = () => form?.handleSubmit();

  const formStore = $derived(form?.useStore ? form.useStore((state) => state) : null);

  const hasErrors = $derived.by(() => {
    const state = formStore?.current;
    if (!state) return false;
    if (state.isSubmitting) return false;
    return Boolean(
      state.errors?.length > 0 ||
      (state.errorMap && Object.keys(state.errorMap).some((key) => {
        const errors = state.errorMap[key];
        return errors && errors.length > 0;
      })) ||
      (state.canSubmit === false && state.isDirty && !state.isValidating)
    );
  });

  const canConfirm = $derived(Boolean(formStore?.current?.isDirty) && !hasErrors);
</script>

{#if isOpen}
  {#snippet header()}
    {t("institutions.add-new-institution", { fallback: "Add new institution" })}
  {/snippet}

  {#snippet body()}
    <form id="create-institution-form" onsubmit={(event) => { event.preventDefault(); submit(); }}>
      <InstitutionFormFields
        {form}
        {validator}
        {languages}
        mode="create"
        currentProjectId={projectId}
        margin={0}
        defaultColSize={12}
        fieldColSize={12}
        usePortal={false}
        bind:dirtyTracker
      />
    </form>
  {/snippet}

  {#snippet actions()}
    <BaseButton type="button" class="btn btn-secondary" text={t("common.cancel", { fallback: "Cancel" })} onClick={cancel} />
    <BaseButton type="button" class="btn btn-success" text={t("common.confirm", { fallback: "Confirm" })} onClick={submit} disabled={!canConfirm} />
  {/snippet}

  <BaseModal bind:isOpen size="lg" {header} {body} {actions} />
{/if}
