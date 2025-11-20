<script>
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { createForm } from "@tanstack/svelte-form";
    import AutoForm from "$lib/components/form/AutoForm.svelte";
    import BaseModal from "$lib/components/base/BaseModal.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import LinkObjectsModal from "$lib/components/assets/LinkObjectsModal.svelte";
    import { createFieldValidator, getFormConfig } from "$lib/stores/formValidationUtils.js";
    import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";
    import { updateAsset, deleteAsset } from "$lib/stores/AssetsUtils.js";
    import { unlinkAssetFromObject } from "$lib/stores/ObjectsUtils.js";
    import { back } from "$lib/utils/navigation.js";
    import { getAssetImageUrl, getObjectImageUrl } from "$lib/utils/media.js";
    import { z } from "zod";

    const { data } = $props();
    const contentLanguageStore = getContentLanguageStore();

    // Constants
    const TRANSLATABLE_FIELDS = ["description", "copyright", "author"];

    // State
    const asset = $state(data.asset);
    let linkedObjects = $state(data.linkedObjects || []);
    const languages = $state(data.languages);
    const project_id = $state(data.project_id);
    const institution_id = $state(data.institution_id);
    let pendingUnlinks = $state([]);
    let showDeleteModal = $state(false);
    let isDeleting = $state(false);
    let showLinkObjectsModal = $state(false);

    // Derived
    const defaultLanguage = $derived(languages?.find((l) => l.is_default) || languages?.[0]);
    const secondaryLanguages = $derived(languages?.filter((l) => !l.is_default) || []);
    const metadata = $derived.by(() => {
        try {
            return typeof asset?.properties === "string" ? JSON.parse(asset.properties) : asset?.properties || {};
        } catch { return {}; }
    });

    const imageSrc = $derived(getAssetImageUrl(asset, 'md', false));
    const visibleLinkedObjects = $derived(linkedObjects?.filter((oa) => !pendingUnlinks.includes(oa.object_id)) || []);

    const getObjectDisplayName = (obj) => {
        const name = obj?.name?.content?.trim() || (typeof obj?.name === "string" && obj.name.trim());
        const primaryField = obj?.objectsOntologyFields?.find((f) => f.primary);
        return name || primaryField?.value || obj?.id;
    };

    // Validator
    const metadataSchema = z.object({
        description: z.string().optional(),
        copyright: z.string().optional(),
        author: z.string().optional(),
    });

    const validator = { schema: metadataSchema, requiredFields: new Set([]), validate: (data) => metadataSchema.safeParse(data) };

    // Build default values using ContentLanguageStore
    const defaultValues = $derived.by(() => {
        const defaultCode = defaultLanguage?.code;
        const values = {
            description: metadata?.description?.[defaultCode] || "",
            copyright: metadata?.copyright?.[defaultCode] || "",
            author: metadata?.author?.[defaultCode] || "",
        };

        // Add secondary language translations from properties JSON
        secondaryLanguages.forEach((lang) => {
            TRANSLATABLE_FIELDS.forEach((field) => {
                values[`translations_${lang.id}_${field}`] = metadata?.[field]?.[lang.code] || "";
            });
        });

        return values;
    });

    // Submit handler
    async function onSubmitForm({ value }) {
        try {
            // Process pending unlinks
            await Promise.all(pendingUnlinks.map(async (objectId) => {
                const unlinkResult = await unlinkAssetFromObject(objectId, asset.id);
                if (unlinkResult.error) console.error("Error unlinking object:", unlinkResult.error);
            }));

            // Collect translations
            const translations = { description: {}, copyright: {}, author: {} };
            const defaultCode = defaultLanguage?.code;

            if (defaultCode) {
                if (value.description) translations.description[defaultCode] = value.description;
                if (value.copyright) translations.copyright[defaultCode] = value.copyright;
                if (value.author) translations.author[defaultCode] = value.author;
            }

            secondaryLanguages.forEach((lang) => {
                TRANSLATABLE_FIELDS.forEach((field) => {
                    const key = `translations_${lang.id}_${field}`;
                    if (value[key]?.trim()) translations[field][lang.code] = value[key];
                });
            });

            const properties = JSON.stringify(translations);
            const result = await updateAsset(asset.id, { properties });

            // Check for success - updateAsset returns the GraphQL result which might have different structures
            if (!result?.error) {
                // Process secondary language translations using ContentLanguageStore
                // Note: Assets don't have separate text fields for translations like other entities
                // They store everything in the properties JSON field, which we already updated
                
                pendingUnlinks = [];
                goto(`/projects/${project_id}/institutions/${institution_id}`);
            } else {
                console.error("Failed to update asset:", result?.error);
            }
        } catch (error) {
            console.error("Error updating asset:", error);
        }
    }

    // Create form
    const form = $derived(createForm(() => getFormConfig("assets", "update", { defaultValues, onSubmit: onSubmitForm })));

    // UI Schema
    const uiSchema = $derived({
        description: { label: "Description", type: "textarea", colSize: 12, required: false },
        copyright: { label: "Copyright", type: "textarea", colSize: 12, required: false },
        author: { label: "Author", type: "textarea", colSize: 12, required: false },
    });

    // Handlers
    const handleCancel = () => back();
    const handleSave = () => form.handleSubmit();
    const openDeleteModal = () => showDeleteModal = true;
    const cancelDelete = () => showDeleteModal = false;

    const confirmDeleteAsset = async () => {
        if (!asset?.id) return showDeleteModal = false;
        isDeleting = true;
        try {
            const res = await deleteAsset(asset.id);
            res?.error ? console.error("Failed to delete asset:", res.error) : back();
        } catch (err) {
            console.error("Error deleting asset:", err);
        } finally {
            isDeleting = false;
            showDeleteModal = false;
        }
    };

    const handleUnlinkObject = (objectId) => {
        if (!pendingUnlinks.includes(objectId)) pendingUnlinks = [...pendingUnlinks, objectId];
    };

    const openLinkObjectsModal = () => showLinkObjectsModal = true;

    const handleObjectsLinked = (objects) => {
        try {
            const existing = new Set((linkedObjects || []).map((oa) => String(oa.object_id)));
            const additions = (objects || []).filter((o) => !existing.has(String(o.id))).map((o) => ({ object_id: o.id, object: o }));
            if (additions.length) linkedObjects = [...linkedObjects, ...additions];
        } catch (e) {
            console.error("Error updating linked objects list:", e);
        }
    };
</script>

<div class="d-flex flex-column min-vh-100">
    <div class="container-fluid px-4 py-3 flex-grow-1">
        <!-- Header -->
        <div class="d-flex align-items-center mb-4">
            <button type="button" aria-label="Back to institution" class="btn btn-link p-0 me-3 text-muted" onclick={handleCancel}>
                <i class="bi bi-arrow-left fs-5"></i>
            </button>
            <div>
                <div class="text-muted small">{$page.data?.institution?.name?.content || institution_id}</div>
                <h1 class="h4 mb-0">{asset.filename}</h1>
            </div>
        </div>

        <div class="row">
            <!-- Main Content - Media -->
            <div class="col-lg-8">
                <h5 class="mb-3">Media</h5>

                <!-- Media Display -->
                <div class="mb-4">
                    {#if asset.type === "image"}
                        <BaseImage
                            src={imageSrc ? `media://${imageSrc}` : null}
                            alt={asset.filename}
                            class="w-100 rounded"
                            style="max-height: 500px; object-fit: contain; background-color: #f8f9fa;"
                        />
                    {:else}
                        <div class="w-100 d-flex flex-column align-items-center justify-content-center rounded bg-light text-muted border" style="height: 400px;">
                            <i class="bi bi-file-earmark" style="font-size: 4rem;"></i>
                            <span class="mt-2 fw-medium">{asset.type?.toUpperCase() || "FILE"}</span>
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
                            {new Date(asset.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                        </div>
                    </div>
                </div>

                <!-- Media Metadata Form -->
                <h5 class="mb-3">Media metadata</h5>
                <form onsubmit={(e) => { e.preventDefault(); e.stopPropagation(); form.handleSubmit(); }}>
                    <AutoForm
                        {form}
                        {validator}
                        {createFieldValidator}
                        {languages}
                        translatableFields={TRANSLATABLE_FIELDS}
                        {uiSchema}
                        fieldOrder={TRANSLATABLE_FIELDS}
                    />
                </form>
            </div>

            <!-- Right Sidebar - Linked Objects -->
            <div class="col-lg-4">
                <h5 class="mb-3">Linked objects</h5>

                {#if visibleLinkedObjects?.length > 0}
                    {#each visibleLinkedObjects as objectAsset}
                        <div class="d-flex flex-column align-items-start gap-2 mb-3 p-2 border rounded">
                            <div class="d-flex flex-row gap-2">
                                <BaseImage
                                    src={getObjectImageUrl(objectAsset.object, 'sm')}
                                    alt={getObjectDisplayName(objectAsset.object)}
                                    class="rounded"
                                    style="width: 68px; height: 68px; object-fit: cover;"
                                    format="sm"
                                />

                                <div class="d-flex flex-column">
                                    <span class="fw-medium mb-2">{getObjectDisplayName(objectAsset.object)}</span>
                                    <button class="btn btn-sm px-0 btn-link text-danger text-decoration-none" onclick={() => handleUnlinkObject(objectAsset.object_id)}>
                                        <i class="bi bi-dash-circle"></i> Unlink media
                                    </button>
                                </div>
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
                    <BaseButton type="button" class="btn btn-sm btn-outline-danger" text="Delete Asset" icon="trash" onClick={openDeleteModal} />
                    <button type="button" class="btn btn-sm btn-success" onclick={handleSave}>Save Changes</button>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Delete Confirmation Modal -->
<BaseModal bind:isOpen={showDeleteModal}>
    {#snippet header()}Confirm Deletion{/snippet}
    {#snippet body()}
        <p>Are you sure you want to delete this asset? This action cannot be undone.</p>
    {/snippet}
    {#snippet actions()}
        <BaseButton type="button" class="btn btn-secondary" text="Cancel" onClick={cancelDelete} disabled={isDeleting} />
        <BaseButton type="button" class="btn btn-danger" text={isDeleting ? "Deleting..." : "Confirm and delete"} onClick={confirmDeleteAsset} disabled={isDeleting} />
    {/snippet}
</BaseModal>

<!-- Link Objects Modal -->
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
