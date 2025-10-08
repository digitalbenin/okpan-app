<script>
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { createForm } from "@tanstack/svelte-form";
    import AutoForm from "$lib/components/form/AutoForm.svelte";
    import BaseModal from "$lib/components/base/BaseModal.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import {
        getValidator,
        createFieldValidator,
        registerCustomValidator,
    } from "$lib/stores/formValidationUtils.js";
    import { updateAsset, deleteAsset } from "$lib/stores/AssetsUtils.js";
    import { unlinkAssetFromObject } from "$lib/stores/ObjectsUtils.js";
    import { getObjectIdentifier } from "$lib/utils/objects.js";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import { z } from "zod";
    import { back } from "$lib/utils/navigation.js";
    import LinkObjectsModal from "$lib/components/assets/LinkObjectsModal.svelte";

    const { data } = $props();
    const asset = $state(data.asset);
    let linkedObjects = $state(data.linkedObjects || []);
    const languages = $state(data.languages);
    const project_id = $state(data.project_id);
    const institution_id = $state(data.institution_id);

    $inspect("linked objects", linkedObjects);

    // Track pending unlinks (objects to be unlinked on save)
    let pendingUnlinks = $state([]);

    $inspect("object asstes", asset.objectsAssets);

    // Extract metadata from properties JSON field
    const metadata = $derived(() => {
        if (!asset?.properties) return {};
        try {
            return typeof asset.properties === "string" 
                ? JSON.parse(asset.properties) 
                : asset.properties;
        } catch (e) {
            console.error("Error parsing asset properties:", e);
            return {};
        }
    });
    const defaultLanguage = $derived(languages?.find(l => l.is_default) || languages?.[0]);

    // Function to get the best image source from formats
    function getImageSrc(currentAsset) {
        if (!currentAsset) return null;
        if (currentAsset.type !== "image" || !currentAsset.formats) {
            return currentAsset.path || null;
        }
        
        try {
            const formats = typeof currentAsset.formats === "string" 
                ? JSON.parse(currentAsset.formats) 
                : currentAsset.formats;
            return formats?.md || formats?.lg || formats?.original || currentAsset.path || null;
        } catch (e) {
            console.error("Error parsing formats:", e);
            return currentAsset.path || null;
        }
    }

    const imageSrc = $derived(getImageSrc(asset));

    // Derived state for visible linked objects (excluding pending unlinks)
    const visibleLinkedObjects = $derived(
        linkedObjects?.filter(objAsset => !pendingUnlinks.includes(objAsset.object_id)) || []
    );

    // Register custom validator for properties field to handle metadata
    registerCustomValidator("assets", "properties", {
        validator: z.string().transform(val => {
            try { return JSON.parse(val); } catch { return {}; }
        }),
        required: false,
        defaultValue: "{}",
        transform: data => JSON.stringify({
            description: data.description || {},
            copyright: data.copyright || {},
            author: data.author || {}
        })
    });

    // Create custom validator schema for metadata fields
    const metadataSchema = z.object({
        description: z.string().optional(),
        copyright: z.string().optional(),
        author: z.string().optional(),
    });

    const validator = {
        schema: metadataSchema,
        requiredFields: new Set([]),
        validate: data => metadataSchema.safeParse(data)
    };

    // Create form with initial data from metadata
    const form = createForm(() => {
        const meta = metadata();
        const defaultValues = {
            // For translatable fields, set the default language value as string
            description: meta?.description?.[defaultLanguage?.code] || "",
            copyright: meta?.copyright?.[defaultLanguage?.code] || "",
            author: meta?.author?.[defaultLanguage?.code] || "",
        };

        // Add translation fields for secondary languages
        if (languages && meta) {
            for (const lang of languages) {
                if (!lang.is_default) {
                    defaultValues[`translations_${lang.id}_description`] =
                        meta?.description?.[lang.code] || "";
                    defaultValues[`translations_${lang.id}_copyright`] =
                        meta?.copyright?.[lang.code] || "";
                    defaultValues[`translations_${lang.id}_author`] =
                        meta?.author?.[lang.code] || "";
                }
            }
        }

        return {
            defaultValues,
            validators: {
                onChange: validator.schema,
            },
            onSubmit: async ({ value }) => {
                try {
                    // Collect translations for all languages
                    const translations = {
                        description: {},
                        copyright: {},
                        author: {}
                    };

                    // Set default language content
                    const defaultCode = defaultLanguage?.code;
                    if (value.description && defaultCode) translations.description[defaultCode] = value.description;
                    if (value.copyright && defaultCode) translations.copyright[defaultCode] = value.copyright;
                    if (value.author && defaultCode) translations.author[defaultCode] = value.author;

                    // Collect secondary language translations
                    for (const lang of languages.filter(l => !l.is_default)) {
                        const fields = ['description', 'copyright', 'author'];
                        for (const field of fields) {
                            const key = `translations_${lang.id}_${field}`;
                            if (value[key]?.trim()) {
                                translations[field][lang.code] = value[key];
                            }
                        }
                    }

                    // Create properties JSON
                    const properties = JSON.stringify(translations);

                    // Process pending unlinks first
                    for (const objectId of pendingUnlinks) {
                        try {
                            const unlinkResult = await unlinkAssetFromObject(objectId, asset.id);
                            if (unlinkResult.error) {
                                console.error("Error unlinking object:", unlinkResult.error);
                            }
                        } catch (error) {
                            console.error("Error during unlink operation:", error);
                        }
                    }

                    const result = await updateAsset(asset.id, { properties });
                    console.log("updateAsset result:", result);

                    if (result?.result) {
                        console.log("Asset updated successfully");
                        pendingUnlinks = []; // Clear pending unlinks after successful save
                        goto(`/projects/${project_id}/institutions/${institution_id}`);
                    } else {
                        console.error("Failed to update asset:", result?.error);
                        console.error("Full result object:", result);
                    }
                } catch (error) {
                    console.error("Error updating asset:", error);
                }
            },
        };
    });

    const handleCancel = () => goto(`/projects/${project_id}/institutions/${institution_id}`);
    const handleSave = () => form.handleSubmit();

    // Delete Asset Modal state and handlers
    let showDeleteModal = $state(false);
    let isDeleting = $state(false);

    function openDeleteModal() {
        showDeleteModal = true;
    }

    function cancelDelete() {
        showDeleteModal = false;
    }

    async function confirmDeleteAsset() {
        if (!asset?.id) {
            showDeleteModal = false;
            return;
        }
        isDeleting = true;
        try {
            const res = await deleteAsset(asset.id);
            if (res?.error) {
                console.error("Failed to delete asset:", res.error);
            } else {
                // Navigate back to previous history page
                back();
            }
        } catch (err) {
            console.error("Error deleting asset:", err);
        } finally {
            isDeleting = false;
            showDeleteModal = false;
        }
    }

    // Handle unlinking an object from this asset (add to pending unlinks)
    const handleUnlinkObject = (objectId) => {
        if (!pendingUnlinks.includes(objectId)) {
            pendingUnlinks = [...pendingUnlinks, objectId];
        }
    };

    // --- Link Objects Modal ---
    let showLinkObjectsModal = $state(false);
    function openLinkObjectsModal() { showLinkObjectsModal = true; }
    function handleObjectsLinked(objects) {
        try {
            const existing = new Set((linkedObjects || []).map(oa => String(oa.object_id)));
            const additions = (objects || [])
                .filter(o => !existing.has(String(o.id)))
                .map(o => ({ object_id: o.id, object: o }));
            if (additions.length) {
                linkedObjects = [...(linkedObjects || []), ...additions];
            }
        } catch (e) {
            console.error("Error updating linked objects list:", e);
        }
    }
    // --- End Link Objects Modal ---

    // Helper function to get display field values for an object
    function getDisplayFieldValue(object, displayField) {
        if (!object || !displayField) return null;

        switch (displayField.type) {
            case "object_property":
                return object[displayField.value];

            case "research_field":
                // Handle research fields
                const researchField = object.objectsResearchFields?.find(
                    (rf) => rf.researchField.id === displayField.value,
                );
                if (researchField) {
                    return (
                        researchField.vocabulary?.option?.content ||
                        researchField.value
                    );
                }
                return null;

            case "ontology_field":
                // Handle ontology fields
                const ontologyField = object.objectsOntologyFields?.find(
                    (of) => of.field_id === displayField.value,
                );
                return ontologyField?.value || null;

            default:
                return null;
        }
    }
</script>

<div class="d-flex flex-column min-vh-100">
    <div class="container-fluid px-4 py-3 flex-grow-1">
        <!-- Header with back button -->
        <div class="d-flex align-items-center mb-4">
            <button
                class="btn btn-link p-0 me-3 text-muted"
                onclick={handleCancel}
            >
                <i class="bi bi-arrow-left fs-5"></i>
            </button>
            <div>
                <div class="text-muted small">
                    {$page.data?.institution?.name?.content || institution_id}
                </div>
                <h1 class="h4 mb-0">{asset.filename}</h1>
            </div>
        </div>

        <div class="row">
            <!-- Main Content Area - Media -->
            <div class="col-lg-8">
                <h5 class="mb-3">Media</h5>

                <!-- Large Image Display -->
                <div class="mb-4">
                    {#if asset.type === "image"}
                        <BaseImage
                            src={imageSrc ? `media://${imageSrc}` : null}
                            alt={asset.filename}
                            class="w-100 rounded"
                            style="max-height: 500px; object-fit: contain; background-color: #f8f9fa;"
                        />
                    {:else}
                        <div
                            class="w-100 d-flex flex-column align-items-center justify-content-center rounded bg-light text-muted border"
                            style="height: 400px;"
                        >
                            <i
                                class="bi bi-file-earmark"
                                style="font-size: 4rem;"
                            ></i>
                            <span class="mt-2 fw-medium"
                                >{asset.type?.toUpperCase() || "FILE"}</span
                            >
                            <span class="mt-1 small">{asset.filename}</span>
                        </div>
                    {/if}
                </div>

                <!-- File Info -->
                <div class="row mb-4">
                    <div class="col-6">
                        <div class="text-muted small">SIZE</div>
                        <div>1.0 MB</div>
                    </div>
                    <div class="col-6">
                        <div class="text-muted small">IMPORT DATE</div>
                        <div>
                            {new Date(asset.created_at).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "long",
                                year: "numeric"
                            })}
                        </div>
                    </div>
                </div>

                <!-- Media Metadata Form -->
                <h5 class="mb-3">Media metadata</h5>
                <form onsubmit={e => { e.preventDefault(); e.stopPropagation(); form.handleSubmit(); }}>
                    <AutoForm
                        {form}
                        {validator}
                        {createFieldValidator}
                        {languages}
                        translatableFields={["description", "copyright", "author"]}
                        uiSchema={{
                            description: {
                                label: "Description",
                                type: "textarea",
                                colSize: 12,
                                required: false,
                            },
                            copyright: {
                                label: "Copyright",
                                type: "textarea",
                                colSize: 12,
                                required: false,
                            },
                            author: {
                                label: "Author",
                                type: "textarea",
                                colSize: 12,
                                required: false,
                            },
                        }}
                        fieldOrder={["description", "copyright", "author"]}
                    />
                </form>
            </div>

            <!-- Right Sidebar - Linked Objects -->
            <div class="col-lg-4">
                <h5 class="mb-3">Linked objects</h5>

                {#if visibleLinkedObjects && visibleLinkedObjects.length > 0}
                    {#each visibleLinkedObjects as objectAsset}
                        <!-- Linked Object Item -->
                        <div
                            class="d-flex flex-column align-items-start gap-2 mb-3 p-2 border rounded"
                        >
                            <div class="d-flex flex-row gap-2">
                                <BaseImage
                                    src={objectAsset.object?.objectsAssets?.[0]?.asset?.path 
                                        ? `media://${objectAsset.object.objectsAssets[0].asset.path}` 
                                        : null}
                                    alt={getObjectIdentifier(objectAsset.object)}
                                    class="rounded"
                                    style="width: 68px; height: 68px; object-fit: cover;"
                                    format="sm"
                                />

                                <div class="d-flex flex-column">
                                    <span class="fw-medium mb-2">{getObjectIdentifier(objectAsset.object)}</span>
                                    <button
                                        class="btn btn-sm px-0 btn-link text-danger text-decoration-none"
                                        onclick={() => handleUnlinkObject(objectAsset.object_id)}
                                    >
                                        <i class="bi bi-dash-circle"></i> Unlink
                                        media
                                    </button>
                                </div>

                                <!-- Display Fields -->
                                <!--
                                {#if data.displayFields && data.displayFields.length > 0}
                                    <div class="small text-muted">
                                        {#each data.displayFields as displayField}
                                            {@const fieldValue =
                                                getDisplayFieldValue(
                                                    objectAsset.object,
                                                    displayField,
                                                )}
                                            {#if fieldValue}
                                                <div
                                                    class="d-flex justify-content-between align-items-center py-1 border-bottom border-light"
                                                >
                                                    <span
                                                        class="text-truncate"
                                                        style="max-width: 60%;"
                                                        >{displayField.name
                                                            ?.content ||
                                                            displayField.value}:</span
                                                    >
                                                    <span
                                                        class="fw-medium text-end"
                                                        style="max-width: 40%;"
                                                        >{fieldValue}</span
                                                    >
                                                </div>
                                            {/if}
                                        {/each}
                                    </div>
                                {/if}-->
                            </div>
                        </div>
                    {/each}
                {/if}

                <!-- Link Object Button -->
                <button class="btn btn-outline-primary w-100" onclick={openLinkObjectsModal}>
                    <i class="bi bi-plus-circle me-2"></i> Link object
                </button>
            </div>
        </div>
    </div>

    <!-- Sticky bottom action bar -->
    <div class="sticky-bottom-bar">
        <div class="container-fluid">
            <div class="row">
                <div class="col-12 d-flex justify-content-end gap-2 p-2">
                    <BaseButton
                        type="button"
                        class="btn btn-sm btn-outline-danger"
                        text="Delete Asset"
                        icon="trash"
                        onClick={openDeleteModal}
                    />
                    <button
                        type="button"
                        class="btn btn-sm btn-success"
                        onclick={handleSave}
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Delete Confirmation Modal -->
<BaseModal bind:isOpen={showDeleteModal}>
  {#snippet header()}
    Confirm Deletion
  {/snippet}

  {#snippet body()}
    <p>Are you sure you want to delete this asset? This action cannot be undone.</p>
  {/snippet}

  {#snippet actions()}
    <BaseButton
      type="button"
      class="btn btn-secondary"
      text="Cancel"
      onClick={cancelDelete}
      disabled={isDeleting}
    />
    <BaseButton
      type="button"
      class="btn btn-danger"
      text={isDeleting ? "Deleting..." : "Confirm and delete"}
      onClick={confirmDeleteAsset}
      disabled={isDeleting}
    />
  {/snippet}
</BaseModal>

<!-- Link Objects Modal Component -->
<LinkObjectsModal
  bind:isOpen={showLinkObjectsModal}
  projectId={project_id}
  assetId={asset?.id}
  preselectExisting={true}
  onLinked={handleObjectsLinked}
/>

<style>
    .sticky-bottom-bar {
        position: sticky;
        bottom: 0;
        background-color: white;
        border-top: 1px solid #dee2e6;
        margin-top: auto;
        z-index: 10;
        flex-shrink: 0;
    }

    /* Ensure the form takes full height when content is short */
    .min-vh-100 {
        min-height: 100vh;
    }
</style>
