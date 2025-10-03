<script>
  import { page } from "$app/stores";
  import { getContext } from "svelte";
  import { goto } from "$app/navigation";
  import { createForm } from "@tanstack/svelte-form";
  import AutoForm from "$lib/components/form/AutoForm.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { updateAsset, getAssetById } from "$lib/stores/AssetsUtils.js";
  import { z } from "zod";
  import { createFieldValidator } from "$lib/stores/formValidationUtils.js";

  // Read params and data from layout
  const project_id = $state($page.params.project_id);
  const institution_id = $state($page.params.institution_id);
  const languages = $state($page.data.languages || []);

  // Read selected asset IDs from institution-level context
  const assetsCtx = getContext("institutionAssetsSelection");

  const defaultLanguage = $derived(
    languages?.find((l) => l.is_default) || languages?.[0],
  );

  // Schema for metadata fields
  const metadataSchema = z.object({
    description: z.string().optional(),
    copyright: z.string().optional(),
    author: z.string().optional(),
    // Secondary language fields follow naming: translations_<langId>_<field>
  });

  const validator = {
    schema: metadataSchema,
    requiredFields: new Set([]),
    validate: (data) => metadataSchema.safeParse(data),
  };

  // Helper to merge new translations into existing properties
  function mergeTranslations(existingProps, newTranslations) {
    const existing = typeof existingProps === "string"
      ? (() => {
          try { return JSON.parse(existingProps); } catch { return {}; }
        })()
      : (existingProps || {});

    const merged = {
      description: { ...(existing.description || {}) },
      copyright: { ...(existing.copyright || {}) },
      author: { ...(existing.author || {}) },
    };

    for (const key of ["description", "copyright", "author"]) {
      if (newTranslations[key]) {
        for (const [langCode, content] of Object.entries(newTranslations[key])) {
          if (typeof content === "string" && content.trim() !== "") {
            merged[key][langCode] = content;
          }
        }
      }
    }

    return JSON.stringify(merged);
  }

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
          // Build translations object from form values
          const translations = { description: {}, copyright: {}, author: {} };
          const defaultCode = defaultLanguage?.code;
          if (defaultCode) {
            if (value.description?.trim()) translations.description[defaultCode] = value.description;
            if (value.copyright?.trim()) translations.copyright[defaultCode] = value.copyright;
            if (value.author?.trim()) translations.author[defaultCode] = value.author;
          }

          for (const lang of languages.filter((l) => !l.is_default)) {
            for (const field of ["description", "copyright", "author"]) {
              const key = `translations_${lang.id}_${field}`;
              if (value[key]?.trim()) {
                translations[field][lang.code] = value[key];
              }
            }
          }

  // Update each asset: merge existing properties with new translations
          for (const id of (assetsCtx?.getSelected?.() || [])) {
            try {
              const assetRes = await getAssetById(id);
              const asset = Array.isArray(assetRes?.result) ? assetRes.result[0] : null;
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
    <h4 class="m-0">Bulk edit asset metadata</h4>
    <span class="text-muted">{(assetsCtx?.getSelected?.() || []).length} selected</span>
  </div>

  {#if (assetsCtx?.getSelected?.() || []).length === 0}
    <div class="alert alert-warning">No assets selected.</div>
  {:else}
    <div class="mb-3">
      <AutoForm
        {form}
        {validator}
        {createFieldValidator}
        {languages}
        translatableFields={["description", "copyright", "author"]}
        uiSchema={{
          description: { label: "Description", type: "textarea", colSize: 12, required: false },
          copyright: { label: "Copyright", type: "textarea", colSize: 12, required: false },
          author: { label: "Author", type: "textarea", colSize: 12, required: false },
        }}
        fieldOrder={["description", "copyright", "author"]}
      />
    </div>

    <div class="d-flex gap-2">
      <BaseButton type="button" class="btn btn-secondary" text="Cancel" onClick={handleCancel} />
      <BaseButton type="button" class="btn btn-primary" text="Save" onClick={handleSave} />
    </div>
  {/if}
</div>