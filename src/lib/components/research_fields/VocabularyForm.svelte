<script>
    import { createForm } from "@tanstack/svelte-form";
    import { z } from "zod";
    import { createFieldValidator } from "$lib/stores/formValidationUtils.js";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { getMediaType, createMediaFilters } from "$lib/utils/media.js";
    import { goto } from "$app/navigation";
    import AutoForm from "$lib/components/form/AutoForm.svelte";
    import PageActionFooter from "$lib/components/common/PageActionFooter.svelte";
    import AssetPreview from "$lib/components/research_fields/AssetPreview.svelte";
    import { flip } from "svelte/animate";
    import { dndzone } from "svelte-dnd-action";
    import { DEFAULT_FIELDS_CONFIG } from "$lib/constants/connectionTemplates.js";

    let { 
        data, 
        researchField, 
        project, 
        initialValues = {}, 
        onSubmit, 
        onCancel,
        title = "",
        submitLabel = "Save"
    } = $props();

    const { t } = getTranslationStore();
    
    // Visibility config
    let visibleFields = $derived(researchField?.fields_config || DEFAULT_FIELDS_CONFIG);
    
    // Hidden fields for AutoForm
    let autoFormHiddenFields = $derived.by(() => {
        const hidden = [];
        if (!visibleFields.description) hidden.push("description");
        if (!visibleFields.url) hidden.push("externalLink");
        return hidden;
    });

    const vocabularySchema = z.object({
        option: z.string().min(1, t("common.required", { fallback: "Required" })),
        description: z.string().optional(),
        externalLink: z.string().url().optional().or(z.literal(""))
    }).passthrough();

    // Match the validator shape used across the app (schema + requiredFields)
    const validator = $derived({
        schema: vocabularySchema,
        requiredFields: new Set(["option"])
    });

    // Validated form store
    const form = createForm(() => ({
        defaultValues: {
            option: "",
            description: "",
            externalLink: "",
            ...initialValues
        },
        onSubmit: async ({ value }) => {
             // Recombine assets
            const otherAssetsCombined = [...imageAssets, ...videoAssets, ...audioAssets];
            const mainAssetId = mainAsset?.id || null;
            const otherAssetIds = otherAssetsCombined.map(a => a.id);

            await onSubmit(value, mainAssetId, otherAssetIds);
        },
        validatorAdapter: (schema) => (value) => {
            const result = schema.safeParse(value);
            return result.success ? null : result.error.errors.map(e => e.message).join(", ");
        }
    }));

    const formStore = $derived(form?.useStore ? form.useStore((state) => state) : null);

    // Media State
    // Handle both direct 'otherAssets' (if backend sends it) and 'vocabulariesGenericAssets' (from Drizzle relations)
    let initialOtherAssets = initialValues.otherAssets || initialValues.vocabulariesGenericAssets?.map(vga => vga.genericAsset) || [];
    
    let mainAsset = $state(initialValues.mainAsset || null);
    
    let imageAssets = $state(initialOtherAssets.filter(a => getMediaType(a) === 'image').map((a, i) => ({ ...a, id: a.id || `img-${i}` })));
    let videoAssets = $state(initialOtherAssets.filter(a => getMediaType(a) === 'video').map((a, i) => ({ ...a, id: a.id || `vid-${i}` })));
    let audioAssets = $state(initialOtherAssets.filter(a => getMediaType(a) === 'audio').map((a, i) => ({ ...a, id: a.id || `aud-${i}` })));
    
    const flipDurationMs = 200;

    // Helper to request asset import
    const handleAddAsset = async (type) => {
        try {
            // Use Electron API to open file dialog and import
            const result = await window.api.openFileDialog({
                properties: ['openFile', 'multiSelections'],
                filters: createMediaFilters([type])
            });

            if (result && !result.canceled && result.filePaths.length > 0) {
                 const importResult = await window.api.importAssets({
                     path: result.filePaths,
                     projectId: project.id,
                     isGenericAsset: true
                 });

                 if (importResult?.createdAssets) {
                     // Add to appropriate list
                     const newAssets = importResult.createdAssets;
                     if (type === 'image') {
                         imageAssets = [...imageAssets, ...newAssets];
                     } else if (type === 'video') {
                         videoAssets = [...videoAssets, ...newAssets];
                     } else if (type === 'audio') {
                         audioAssets = [...audioAssets, ...newAssets];
                     } else if (type === 'main') {
                         mainAsset = newAssets[0];
                     }
                 }
            }
        } catch (e) {
            console.error("Failed to add asset", e);
        }
    };

    const handleRemoveAsset = (asset, type) => {
        if (type === 'image') {
            imageAssets = imageAssets.filter(a => a.id !== asset.id);
        } else if (type === 'video') {
            videoAssets = videoAssets.filter(a => a.id !== asset.id);
        } else if (type === 'audio') {
             audioAssets = audioAssets.filter(a => a.id !== asset.id);
        } else if (type === 'main') {
            mainAsset = null;
        }
    };

    // DND Handlers
    function handleDndConsider(e, type) {
        if (type === 'image') imageAssets = e.detail.items;
        if (type === 'video') videoAssets = e.detail.items;
        if (type === 'audio') audioAssets = e.detail.items;
    }
    function handleDndFinalize(e, type) {
        if (type === 'image') imageAssets = e.detail.items;
        if (type === 'video') videoAssets = e.detail.items;
        if (type === 'audio') audioAssets = e.detail.items;
    }

    const rightActionButtons = $derived([
        {
            id: "save-vocabulary",
            text: submitLabel,
            class: "btn btn-success",
            type: "submit",
            disableOnError: true,
        }
    ]);

    const leftActionButtons = $derived([
        {
            id: "cancel-vocabulary",
            text: t("common.cancel", { fallback: "Cancel" }),
            class: "btn btn-outline-secondary",
            onClick: onCancel,
            type: "button"
        }
    ]);
</script>

<form
    method="post"
    onsubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
    }}
>
<PageActionFooter containerClass="bg-light" contentClass="d-flex flex-column" rightButtons={rightActionButtons} leftButtons={leftActionButtons} formStore={formStore}>
    <!-- Header -->
    <div class="pt-3 pb-3 px-4">
        <div class="d-flex align-items-center gap-2 mb-2 text-muted">
            <button type="button" class="btn btn-link p-0 text-decoration-none text-muted d-flex align-items-center" onclick={onCancel}>
                <i class="bi bi-arrow-left me-1"></i>
                {researchField?.name?.content || "Back"}
            </button>
        </div>
        <h2 class="m-0">{title}</h2>
    </div>

    <!-- Scrollable Content -->
    <div class="flex-grow-1 overflow-auto p-4">
        <div class="row g-4">
            <!-- Main Content Column -->
            <div class="col-12 col-xl-8">
                <div class="card shadow-sm mb-4">
                     <div class="card-header bg-white py-3">
                        <div class="m-0 text-muted fw-bold">{t("common.general-info", {fallback: "General Information"})}</div>
                     </div>
                     <div class="card-body">
                         <AutoForm 
                            {form} 
                                     {createFieldValidator}
                            languages={data.languages}
                            translatableFields={["option", visibleFields.description ? "description" : null].filter(Boolean)}
                            {validator}
                            hiddenFields={autoFormHiddenFields}
                            uiSchema={{
                                description: { type: "textarea", colSize: 12 },
                                externalLink: { colSize: 12 },
                                option: { label: t("common.name", { fallback: "Name" }) }
                            }}
                        />
                     </div>
                </div>

                <!-- Images -->
                {#if visibleFields.images}
                    <div class="card shadow-sm mb-4">
                         <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                            <div class="m-0 text-muted fw-bold">{t("common.images", {fallback: "Images"})}</div>
                               <button type="button" class="btn btn-sm btn-secondary d-flex align-items-center gap-2" onclick={() => handleAddAsset('image')}>
                                 <i class="bi bi-plus-lg"></i> {t("common.add-images", {fallback: "Add Images"})}
                            </button>
                         </div>
                         <div class="card-body">
                            {#if imageAssets.length > 0}
                                <div class="d-flex flex-wrap gap-3" use:dndzone={{items: imageAssets, flipDurationMs}} onconsider={(e) => handleDndConsider(e, 'image')} onfinalize={(e) => handleDndFinalize(e, 'image')}>
                                    {#each imageAssets as asset (asset.id)}
                                        <div animate:flip={{duration: flipDurationMs}}>
                                            <AssetPreview {asset} size={150} showRemoveButton={true} onRemove={() => handleRemoveAsset(asset, 'image')} />
                                        </div>
                                    {/each}
                                </div>
                            {:else}
                                 <div class="text-muted text-center py-5 m-0 bg-light rounded border border-dashed  hover-bg-light-dark" >
                                    <i class="bi bi-images fs-1 mb-2 d-block opacity-50"></i>
                                    {t("common.drag-upload-images", {fallback: "No images"})}
                                 </div>
                            {/if}
                         </div>
                    </div>
                {/if}
                
                 <!-- Video -->
                {#if visibleFields.videos}
                    <div class="card shadow-sm mb-4">
                         <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                            <div class="m-0 text-muted fw-bold">{t("common.videos", {fallback: "Videos"})}</div>
                               <button type="button" class="btn btn-sm btn-secondary d-flex align-items-center gap-2" onclick={() => handleAddAsset('video')}>
                                 <i class="bi bi-plus-lg"></i> {t("common.add-videos", {fallback: "Add Videos"})}
                            </button>
                         </div>
                         <div class="card-body">
                            {#if videoAssets.length > 0}
                                <div class="d-flex flex-wrap gap-3" use:dndzone={{items: videoAssets, flipDurationMs}} onconsider={(e) => handleDndConsider(e, 'video')} onfinalize={(e) => handleDndFinalize(e, 'video')}>
                                    {#each videoAssets as asset (asset.id)}
                                        <div animate:flip={{duration: flipDurationMs}}>
                                            <AssetPreview {asset} size={200} showRemoveButton={true} onRemove={() => handleRemoveAsset(asset, 'video')} />
                                        </div>
                                    {/each}
                                </div>
                            {:else}
                                 <div class="text-muted text-center py-5 m-0 bg-light rounded border border-dashed  hover-bg-light-dark" >
                                    <i class="bi bi-camera-video fs-1 mb-2 d-block opacity-50"></i>
                                    {t("common.no-videos", {fallback: "No videos. Click to add."})}
                                 </div>
                            {/if}
                         </div>
                    </div>
                {/if}

                 <!-- Audio -->
                {#if visibleFields.audios}
                    <div class="card shadow-sm mb-4">
                         <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                            <div class="m-0 text-muted fw-bold">{t("common.audio", {fallback: "Audio"})}</div>
                               <button type="button" class="btn btn-sm btn-secondary d-flex align-items-center gap-2" onclick={() => handleAddAsset('audio')}>
                                 <i class="bi bi-plus-lg"></i> {t("common.add-audio", {fallback: "Add Audio"})}
                            </button>
                         </div>
                         <div class="card-body">
                            {#if audioAssets.length > 0}
                                <div class="d-flex flex-wrap gap-3" use:dndzone={{items: audioAssets, flipDurationMs}} onconsider={(e) => handleDndConsider(e, 'audio')} onfinalize={(e) => handleDndFinalize(e, 'audio')}>
                                    {#each audioAssets as asset (asset.id)}
                                        <div animate:flip={{duration: flipDurationMs}}>
                                            <AssetPreview {asset} size={200} showRemoveButton={true} onRemove={() => handleRemoveAsset(asset, 'audio')} />
                                        </div>
                                    {/each}
                                </div>
                            {:else}
                                 <div class="text-muted text-center py-5 m-0 bg-light rounded border border-dashed  hover-bg-light-dark" >
                                    <i class="bi bi-mic fs-1 mb-2 d-block opacity-50"></i>
                                    {t("common.no-audio", {fallback: "No audio. Click to add."})}
                                 </div>
                            {/if}
                         </div>
                    </div>
                {/if}
            </div>

            <!-- Right Column (Thumbnail) -->
            <div class="col-12 col-xl-4">
                 <!-- Main Asset (Thumbnail) -->
                 {#if visibleFields.thumbnail}
                    <div class="card shadow-sm mb-4 sticky-top" style="z-index: 1;">
                         <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                            <div class="m-0 text-muted fw-bold">{t("common.thumbnail", {fallback: "Thumbnail"})}</div>
                            {#if !mainAsset}
                                <button type="button" class="btn btn-sm btn-secondary d-flex align-items-center gap-2" onclick={() => handleAddAsset('main')}>
                                    <i class="bi bi-plus-lg"></i> {t("common.add-thumbnail", {fallback: "Add thumbnail"})}
                                </button>
                            {/if}
                         </div>
                         <div class="card-body text-center p-4">
                            {#if mainAsset}
                                <div class="d-inline-flex justify-content-center border rounded p-1 mb-2 shadow-sm bg-white w-100">
                                    <AssetPreview asset={mainAsset} size={200} width="100%" showRemoveButton={true} onRemove={() => handleRemoveAsset(mainAsset, 'main')} />
                                </div>
                                <div class="text-muted small text-truncate mw-100 px-2" title={mainAsset?.filename || mainAsset?.name}>
                                    {mainAsset?.filename || mainAsset?.name || "Untitled"}
                                </div>
                            {:else}
                                <div class="text-muted text-center py-5 m-0 bg-light rounded border border-dashed hover-bg-light-dark">
                                    <i class="bi bi-card-image fs-1 mb-2 d-block opacity-50"></i>
                                    {t("common.no-thumbnail", {fallback: "No thumbnail"})}
                                </div>
                            {/if}
                         </div>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</PageActionFooter>
</form>

<style>
    .border-dashed {
        border: 2px dashed var(--bs-border-color);
    }
</style>