<script>
  import { page } from "$app/stores";
  import { getContext } from "svelte";
  import { goto } from "$app/navigation";
  import { createForm } from "@tanstack/svelte-form";
  import AutoForm from "$lib/components/form/AutoForm.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { updateAsset, getAssetById } from "$lib/api/AssetsApi.js";
  import { createFieldValidator } from "$lib/utils/formValidation.js";
  import {
    buildTranslationsFromValue,
    createMetadataValidator,
    mergeTranslations,
  } from "$lib/utils/assetMetadata.js";

  // Read params and data from layout
  const project_id = $state($page.params.project_id);
  const institution_id = $state($page.params.institution_id);
  const languages = $state($page.data.languages || []);

  // Read selected asset IDs from institution-level context
  const assetsCtx = getContext("institutionAssetsSelection");
  const { t } = getTranslationStore();

  const defaultLanguage = $derived(
    languages?.find((l) => l.is_default) || languages?.[0],
  );

  const validator = createMetadataValidator();

  const form = createForm(() => {
    const defaultValues = {};

    // Create empty defaults for secondary languages so AutoForm renders inputs
    for (const lang of languages) {
      if (!lang.is_default) {
        for (const field of ["description", "copyright", "author"]) {
          defaultValues[`translations_${lang.id}_${field}`] = "";
        }
      }
    }

    return {
      defaultValues,
      validators: { onChange: validator.schema },
      onSubmit: async ({ value }) => {
        try {
          const translations = buildTranslationsFromValue(value, languages, defaultLanguage);

  // Update each asset: merge existing properties with new translations
          for (const id of (assetsCtx?.getSelected?.() || [])) {
            try {
              const assetRes = await getAssetById(id);
              const asset = Array.isArray(assetRes) ? assetRes[0] : null;
              const mergedProps = mergeTranslations(asset?.properties, translations);
              await updateAsset(id, { properties: mergedProps });
            } catch (e) {
              console.error(`Failed to update asset ${id}:`, e);
            }
          }

          // Navigate back to the institution assets page
          goto(`/projects/${project_id}/institutions/${institution_id}`);
        } catch (err) {
          console.error("Bulk metadata update failed:", err);
        }
      },
    };
  });

  const handleCancel = () => goto(`/projects/${project_id}/institutions/${institution_id}`);
  const handleSave = () => form.handleSubmit();
</script>

<div class="container py-3">
  <div class="d-flex align-items-center justify-content-between mb-3">
    <h4 class="m-0">{t("common.bulk-edit-asset-metadata")}</h4>
    <span class="text-muted">{(assetsCtx?.getSelected?.() || []).length} {t("common.selected")}</span>
  </div>

  {#if (assetsCtx?.getSelected?.() || []).length === 0}
    <div class="alert alert-warning">{t("common.no-assets-selected")}</div>
  {:else}
    <div class="mb-3">
      <AutoForm
        {form}
        {validator}
        {createFieldValidator}
        {languages}
        translatableFields={["description", "copyright", "author"]}
        uiSchema={{
          description: { label: t("common.description"), type: "textarea", colSize: 12, required: false },
          copyright: { label: t("common.copyright"), type: "textarea", colSize: 12, required: false },
          author: { label: t("media.author"), type: "textarea", colSize: 12, required: false },
        }}
        fieldOrder={["description", "copyright", "author"]}
      />
    </div>

    <div class="d-flex gap-2">
      <BaseButton type="button" class="btn btn-secondary" text={t("common.cancel")} onClick={handleCancel} />
      <BaseButton type="button" class="btn btn-primary" text={t("common.save")} onClick={handleSave} />
    </div>
  {/if}
</div>