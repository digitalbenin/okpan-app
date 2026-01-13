<script>
    import { page } from "$app/stores";
    import { createForm } from "@tanstack/svelte-form";
    import { z } from "zod";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { getMediaType, createMediaFilters } from "$lib/utils/media.js";
    import { updateVocabulary, updateVocabularyAssets } from "$lib/stores/ResearchFieldsUtils.js";
    import { goto, invalidate, invalidateAll } from "$app/navigation";
    import AutoForm from "$lib/components/form/AutoForm.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import PageActionFooter from "$lib/components/common/PageActionFooter.svelte";
    import AssetPreview from "$lib/components/research_fields/AssetPreview.svelte";
    import { flip } from "svelte/animate";
    import { dndzone } from "svelte-dnd-action";

    const { data } = $props();
    const { t } = getTranslationStore();
    
    // Initial data
    const vocabulary = $derived(data.vocabulary);
    const researchField = $derived(data.researchField);
    const project = $derived(data.project);

    const vocabularySchema = z.object({
        option: z.string().min(1, "Required"),
        description: z.string().optional(),
        externalLink: z.string().url().optional().or(z.literal(""))
    }).passthrough();

    // Helper to extract initial translations for defaultValues
    const getInitialTranslations = () => {
        const trans = {};
        data.languages?.forEach(lang => {
            if (!lang.is_default) {
                // Check option translations
                const optTrans = vocabulary?.option?.translations?.find(t => t.language_id === lang.id);
                if (optTrans) trans[`translations_${lang.id}_option`] = optTrans.content;
                
                // Check description translations
                const descTrans = vocabulary?.description?.translations?.find(t => t.language_id === lang.id);
                if (descTrans) trans[`translations_${lang.id}_description`] = descTrans.content;
            }
        });
        return trans;
    };

    // Validated form store
    const form = createForm(() => ({
        defaultValues: {
            option: vocabulary?.option?.content || "",
            description: vocabulary?.description?.content || "",
            externalLink: vocabulary?.externalLink || "",
            ...getInitialTranslations()
        },
        onSubmit: async ({ value }) => {
            await handleSave(value);
        },
        validatorAdapter: (schema) => (value) => {
             // Re-evaluate schema if needed to support translations, but simple strings are safer
            const result = schema.safeParse(value);
            return result.success ? null : result.error.errors.map(e => e.message).join(", ");
        }
        // No explicit onChange validator to avoid constant validation on typing for now, 
        // AutoForm might trigger it.
    }));

    // Media State
    let mainAsset = $state(vocabulary?.mainAsset || null);
    
    // Split otherAssets by type
    // Handle both direct 'otherAssets' (if backend sends it) and 'vocabulariesGenericAssets' (from Drizzle relations)
    let initialOtherAssets = vocabulary?.otherAssets || vocabulary?.vocabulariesGenericAssets?.map(vga => vga.genericAsset) || [];
    
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

    async function handleSave(values) {
        // Recombine assets
        const otherAssetsCombined = [...imageAssets, ...videoAssets, ...audioAssets];
        
        // Deep clone to remove Svelte 5 proxies
        const mainAssetId = mainAsset?.id || null;
        const otherAssetIds = otherAssetsCombined.map(a => a.id);

        const updateData = {
           ...values,
           mainAsset: mainAssetId,
           optionTranslations: [], 
           descriptionTranslations: [] 
        };

        // Collect translations
        const optionTranslations = [];
        const descriptionTranslations = [];
        
        data.languages?.forEach(lang => {
            if (!lang.is_default) {
                const optKey = `translations_${lang.id}_option`;
                const descKey = `translations_${lang.id}_description`;
                
                if (values[optKey] !== undefined && values[optKey] !== null) {
                    const content = values[optKey].toString();
                    if (content.trim()) {
                        optionTranslations.push({ language_code: lang.code, content: content });
                    }
                }
                
                if (values[descKey] !== undefined && values[descKey] !== null) {
                     const content = values[descKey].toString();
                     if (content.trim()) {
                        descriptionTranslations.push({ language_code: lang.code, content: content });
                     }
                }
            }
        });
        
        updateData.optionTranslations = optionTranslations;
        updateData.descriptionTranslations = descriptionTranslations;

        // Ensure the entire payload is cloneable
        const finalUpdateData = JSON.parse(JSON.stringify(updateData));

        const res = await updateVocabulary(vocabulary.id, finalUpdateData);
        if (res.error) {
             console.error("updateVocabulary failed:", res.error);
             // Show error toast
        } else {
             // Handle assets separately
             const assetsRes = await updateVocabularyAssets(vocabulary.id, otherAssetIds);
             if (assetsRes.error) {
                 console.error("Failed to update assets:", assetsRes.error);
             }
             
             await invalidateAll();
             goBack();
        }
    }

    function goBack() {
        goto(`/projects/${project.id}/connections/${researchField.id}`);
    }

    const rightActionButtons = $derived([
        {
            text: t("common.cancel", {fallback: "Cancel"}),
            class: "btn btn-outline-secondary",
            onClick: goBack,
            type: "button"
        },
        {
            text: t("common.save", {fallback: "Save"}),
            class: "btn btn-success",
            onClick: () => form.handleSubmit(),
            type: "submit"
        }
    ]);

</script>

<PageActionFooter containerClass="bg-light" contentClass="d-flex flex-column" rightButtons={rightActionButtons}>
    <!-- Header -->
    <div class="pt-3 pb-3 px-4">
        <div class="d-flex align-items-center gap-2 mb-2 text-muted">
            <button class="btn btn-link p-0 text-decoration-none text-muted d-flex align-items-center" onclick={goBack}>
                <i class="bi bi-arrow-left me-1"></i>
                {researchField?.name?.content || "Back"}
            </button>
        </div>
        <h2 class="m-0">{vocabulary?.option?.content || t("common.untitled", {fallback: "Untitled"})}</h2>
    </div>

    <!-- Scrollable Content -->
    <div class="flex-grow-1 overflow-auto p-4">
        <div class="row g-4">
            <!-- Main Content Column -->
            <div class="col-12 col-xl-10">
                <div class="card shadow-sm mb-4">
                     <div class="card-header bg-white py-3">
                        <div class="m-0 text-muted fw-bold">{t("common.general-info", {fallback: "General Information"})}</div>
                     </div>
                     <div class="card-body">
                         <AutoForm 
                            {form} 
                            languages={data.languages}
                            translatableFields={["option", "description"]}
                            validator={{ schema: vocabularySchema }}
                            uiSchema={{
                                description: { type: "textarea", colSize: 12 },
                                externalLink: { colSize: 12 },
                                option: { label: t("common.name", {fallback: "Name"}) }
                            }}
                        />
                     </div>
                </div>

                <!-- Images -->
                <div class="card shadow-sm mb-4">
                     <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                        <div class="m-0 text-muted fw-bold">{t("common.images", {fallback: "Images"})}</div>
                        <button class="btn btn-sm btn-secondary d-flex align-items-center gap-2" onclick={() => handleAddAsset('image')}>
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
                
                 <!-- Video -->
                <div class="card shadow-sm mb-4">
                     <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                        <div class="m-0 text-muted fw-bold">{t("common.videos", {fallback: "Videos"})}</div>
                        <button class="btn btn-sm btn-secondary d-flex align-items-center gap-2" onclick={() => handleAddAsset('video')}>
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

                 <!-- Audio -->
                <div class="card shadow-sm mb-4">
                     <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                        <div class="m-0 text-muted fw-bold">{t("common.audio", {fallback: "Audio"})}</div>
                        <button class="btn btn-sm btn-secondary d-flex align-items-center gap-2" onclick={() => handleAddAsset('audio')}>
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
            </div>

            <!-- Right Column (Thumbnail) -->
            <div class="col-12 col-xl-2">
                 <!-- Main Asset (Thumbnail) -->
                <div class="card shadow-sm mb-4 sticky-top" style="top: 1rem; z-index: 1;">
                     <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                        <div class="m-0 text-muted fw-bold">{t("common.thumbnail", {fallback: "Thumbnail"})}</div>
                     </div>
                     <div class="card-body text-center p-4">
                        {#if mainAsset}
                            <div class="d-inline-flex border rounded p-1 mb-2 shadow-sm bg-white">
                                <AssetPreview asset={mainAsset} size={200} showRemoveButton={true} onRemove={() => handleRemoveAsset(mainAsset, 'main')} />
                            </div>
                            <!-- Show filename below thumbnail if explicitly requested by 'its name under the image' complaint -->
                            <div class="text-muted small text-truncate mw-100 px-2" title={mainAsset?.filename || mainAsset?.name}>
                                {mainAsset?.filename || mainAsset?.name || "Untitled"}
                            </div>
                        {:else}
                            <div class="btn btn-outline-secondary border-dashed w-100 p-4 d-flex flex-column align-items-center justify-content-center gap-2" role="button" tabindex="0" onclick={() => handleAddAsset('main')} onkeydown={(e) => e.key === 'Enter' && handleAddAsset('main')}>
                                <i class="bi bi-card-image fs-1 opacity-50"></i>
                                <span class="small fw-medium">{t("common.add-thumbnail", {fallback: "Add Thumbnail"})}</span>
                            </div>
                        {/if}
                     </div>
                </div>
            </div>
        </div>
    </div>
</PageActionFooter>

<style>
    .border-dashed {
        border: 2px dashed var(--bs-border-color);
    }
</style>
