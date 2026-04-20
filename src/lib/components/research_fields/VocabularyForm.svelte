<script>
    import { createForm } from "@tanstack/svelte-form";
    import { z } from "zod";
    import { createFieldValidator } from "$lib/stores/formValidationUtils.js";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { getMediaType, createMediaFilters, getAssetImageUrl } from "$lib/utils/media.js";
    import { goto } from "$app/navigation";
    import BasePagination from "$lib/components/base/BasePagination.svelte";
    import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import AutoForm from "$lib/components/form/AutoForm.svelte";
    import PageActionFooter from "$lib/components/common/PageActionFooter.svelte";
    import AssetPreview from "$lib/components/research_fields/AssetPreview.svelte";
    import { flip } from "svelte/animate";
    import { dndzone } from "svelte-dnd-action";
    import { DEFAULT_FIELDS_CONFIG } from "$lib/constants/connectionTemplates.js";
    import { getObjectIdentifier } from "$lib/utils/objects.js";

    let { 
        data, 
        researchField, 
        project, 
        initialValues = {}, 
        linkedObjects = [],
        linkedObjectsTotalCount = 0,
        linkedObjectsPage = 1,
        linkedObjectsPageSize = 24,
        onSubmit, 
        onCancel,
        title = "",
        submitLabel = ""
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
            const otherAssetIds = [...assetsByType.image, ...assetsByType.video, ...assetsByType.audio].map(a => a.id);
            await onSubmit(value, mainAsset?.id || null, otherAssetIds);
        },
        validatorAdapter: (schema) => (value) => {
            const result = schema.safeParse(value);
            return result.success ? null : result.error.errors.map(e => e.message).join(", ");
        }
    }));

    const formStore = $derived(form?.useStore ? form.useStore((state) => state) : null);

    // Media State - consolidated asset management
    const initialOtherAssets = initialValues.otherAssets || initialValues.vocabulariesGenericAssets?.map(vga => vga.genericAsset) || [];
    let mainAsset = $state(initialValues.mainAsset || null);
    let assetsByType = $state({
        image: initialOtherAssets.filter(a => getMediaType(a) === 'image').map((a, i) => ({ ...a, id: a.id || `img-${i}` })),
        video: initialOtherAssets.filter(a => getMediaType(a) === 'video').map((a, i) => ({ ...a, id: a.id || `vid-${i}` })),
        audio: initialOtherAssets.filter(a => getMediaType(a) === 'audio').map((a, i) => ({ ...a, id: a.id || `aud-${i}` }))
    });
    const flipDurationMs = 200;

    // Unified asset handlers
    const handleAddAsset = async (type) => {
        try {
            const result = await window.api.openFileDialog({
                properties: ['openFile', 'multiSelections'],
                filters: createMediaFilters([type])
            });

            if (result?.canceled || !result.filePaths.length) return;

            const importResult = await window.api.importAssets({
                path: result.filePaths,
                projectId: project.id,
                isGenericAsset: true
            });

            if (importResult?.createdAssets) {
                if (type === 'main') {
                    mainAsset = importResult.createdAssets[0];
                } else {
                    assetsByType[type] = [...assetsByType[type], ...importResult.createdAssets];
                }
            }
        } catch (e) {
            console.error("Failed to add asset", e);
        }
    };

    const handleRemoveAsset = (asset, type) => {
        if (type === 'main') {
            mainAsset = null;
        } else {
            assetsByType[type] = assetsByType[type].filter(a => a.id !== asset.id);
        }
    };

    const handleDndConsider = (e, type) => { assetsByType[type] = e.detail.items; };
    const handleDndFinalize = (e, type) => { assetsByType[type] = e.detail.items; };

    const rightActionButtons = $derived([
        {
            id: "save-vocabulary",
            text: resolvedSubmitLabel,
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

    const resolvedSubmitLabel = $derived(submitLabel || t("common.save", { fallback: "Save" }));

    const mediaSections = $derived([
        { type: 'image', icon: 'images', emptyIcon: 'images', size: 150, label: t("common.images", {fallback: "Images"}), addLabel: t("common.add-images", {fallback: "Add Images"}), emptyText: t("common.drag-upload-images", {fallback: "No images"}), visible: visibleFields.images },
        { type: 'video', icon: 'camera-video', emptyIcon: 'camera-video', size: 200, label: t("common.videos", {fallback: "Videos"}), addLabel: t("common.add-videos", {fallback: "Add Videos"}), emptyText: t("common.no-videos", {fallback: "No videos. Click to add."}), visible: visibleFields.videos },
        { type: 'audio', icon: 'mic', emptyIcon: 'mic', size: 200, label: t("common.audio", {fallback: "Audio"}), addLabel: t("common.add-audio", {fallback: "Add Audio"}), emptyText: t("common.no-audio", {fallback: "No audio. Click to add."}), visible: visibleFields.audios }
    ]);

    // Linked objects pagination
    let loPage = $state(linkedObjectsPage);
    let loPageSize = $state(linkedObjectsPageSize);
    let lastNavigated = $state({ page: linkedObjectsPage, pageSize: linkedObjectsPageSize });
    let navReady = $state(false);

    const pageSizeOptions = [12, 24, 48, 96].map((n) => ({ value: n, label: String(n) }));
    const getObjectDisplayName = (obj) => obj?.name?.content?.trim() || (typeof obj?.name === "string" ? obj.name.trim() : null) || getObjectIdentifier(obj);
    const getObjectThumb = (obj) => obj?.objectsAssets?.[0]?.asset || null;
    const getObjectsLabel = (count) => (count === 1 ? t("common.object", { fallback: "object" }) : t("common.objects", { fallback: "objects" }));

    const navigateLinkedObjects = async (page, pageSize) => {
        const vocabularyId = initialValues?.id;
        const fieldId = researchField?.id;
        const projectId = project?.id;
        if (!projectId || !fieldId || !vocabularyId) return;

        try {
            const u = new URL(window.location.href);
            u.searchParams.set("loPage", String(page));
            u.searchParams.set("loPageSize", String(pageSize));
            await goto(`${u.pathname}${u.search}`, { replaceState: true, keepfocus: true, noscroll: true });
        } catch (e) {
            console.error("Failed to navigate linked objects pagination", e);
        }
    };

    $effect(() => {
        loPage = linkedObjectsPage;
        loPageSize = linkedObjectsPageSize;
    });

    $effect(() => { navReady = true; });

    // Navigate on pagination change
    $effect(() => {
        if (!navReady) return;

        const page = Math.max(1, Math.floor(Number(loPage) || 1));
        const pageSize = Math.max(1, Math.floor(Number(loPageSize) || 24));

        if (pageSize !== lastNavigated.pageSize && page !== 1) {
            loPage = 1;
            return;
        }

        if (page === lastNavigated.page && pageSize === lastNavigated.pageSize) return;

        lastNavigated = { page, pageSize };
        navigateLinkedObjects(page, pageSize);
    });
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
                {researchField?.name?.content || t("nav.back", { fallback: "Back" })}
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
                     <div class="card-body p-0">
                         <AutoForm 
                            {form} 
                            {createFieldValidator}
                            languages={data.languages}
                            translatableFields={["option", visibleFields.description ? "description" : null].filter(Boolean)}
                            {validator}
                            hiddenFields={autoFormHiddenFields}
                            uiSchema={{
                                description: { type: "textarea", colSize: 12, label: t("common.description", { fallback: "Description" }) },
                                externalLink: { colSize: 12, label: t("common.external-link", { fallback: "External link" }) },
                                option: { label: t("common.name", { fallback: "Name" }) }
                            }}
                        />
                     </div>
                </div>

                <!-- Media Sections -->
                {#each mediaSections as section}
                    {#if section.visible}
                        <div class="card shadow-sm mb-4">
                            <div class="card-header bg-white py-3 border-0 d-flex justify-content-between align-items-center">
                                <div class="m-0 text-muted fw-bold">{section.label}</div>
                                <button type="button" class="btn btn-sm btn-secondary d-flex align-items-center gap-2" onclick={() => handleAddAsset(section.type)}>
                                    <i class="bi bi-plus-lg"></i> {section.addLabel}
                                </button>
                            </div>
                            <div class="card-body">
                                {#if assetsByType[section.type].length > 0}
                                    <div class="d-flex flex-wrap gap-3" use:dndzone={{items: assetsByType[section.type], flipDurationMs}} onconsider={(e) => handleDndConsider(e, section.type)} onfinalize={(e) => handleDndFinalize(e, section.type)}>
                                        {#each assetsByType[section.type] as asset (asset.id)}
                                            <div animate:flip={{duration: flipDurationMs}}>
                                                <AssetPreview {asset} size={section.size} showRemoveButton={true} onRemove={() => handleRemoveAsset(asset, section.type)} />
                                            </div>
                                        {/each}
                                    </div>
                                {:else}
                                    <div class="text-muted text-center py-5 m-0 bg-light rounded border border-dashed hover-bg-light-dark">
                                        <i class="bi bi-{section.emptyIcon} fs-1 mb-2 d-block opacity-50"></i>
                                        {section.emptyText}
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {/if}
                {/each}

                <!-- Linked Objects (objects using this connection option) -->
                {#if linkedObjectsTotalCount > 0}
                    <div class="card shadow-sm mb-4">
                        <div class="card-header bg-white py-3 border-0">
                            <div class="m-0 text-muted fw-bold">
                                {t("common.linked-objects", { fallback: "Linked objects" })}
                            </div>
                        </div>
                        <div class="card-body p-0">
                            <div class="px-3 pt-3 pb-2 text-muted">
                                {linkedObjectsTotalCount} {getObjectsLabel(linkedObjectsTotalCount)}
                            </div>
                            <div class="list-group list-group-flush">
                                {#each linkedObjects as obj (obj.id)}
                                    <div class="list-group-item d-flex align-items-center gap-3">
                                        <div class="flex-shrink-0" style="width: 64px; height: 64px;">
                                            <BaseImage
                                                src={getObjectThumb(obj) ? getAssetImageUrl(getObjectThumb(obj), 'sm') : null}
                                                alt={getObjectDisplayName(obj)}
                                                width={64}
                                                height={64}
                                                class="rounded"
                                                ratio="1/1"
                                                objectFit="cover"
                                            />
                                        </div>

                                        <div class="flex-grow-1 min-w-0">
                                            <div class="fw-medium text-truncate">
                                                <a
                                                    href={`/projects/${project.id}/institutions/${obj.institution_id}/objects/${obj.id}`}
                                                    class="link-primary text-decoration-underline"
                                                >
                                                    {getObjectDisplayName(obj)}
                                                </a>
                                            </div>
                                            <div class="text-muted small text-truncate">
                                                {obj?.institution?.name?.content || ""}
                                            </div>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </div>

                        <div class="card-footer bg-white d-flex justify-content-between align-items-center">
                            <div class="d-flex align-items-center gap-2">
                                {#if linkedObjectsTotalCount > loPageSize}
                                    <BasePagination bind:page={loPage} pageSize={loPageSize} count={linkedObjectsTotalCount} size="sm" />
                                {/if}
                            </div>

                            <div class="d-flex align-items-center gap-2">
                                <span class="text-muted">{t("common.show", { fallback: "Show" })}</span>
                                <BaseSelect
                                    items={pageSizeOptions}
                                    bind:value={loPageSize}
                                    as="button"
                                    inputClass="btn-light btn-sm border"
                                >
                                    <i class="bi bi-chevron-down"></i>
                                </BaseSelect>
                                <span class="text-muted">{t("common.objects", { fallback: "Objects" })}</span>
                            </div>
                        </div>
                    </div>
                {/if}
            </div>

            <!-- Right Column (Main Image) -->
            <div class="col-12 col-xl-4">
                 <!-- Main Asset -->
                 {#if visibleFields.thumbnail}
                    <div class="card shadow-sm mb-4 sticky-top" style="z-index: 1;">
                         <div class="card-header bg-white py-3 border-0 d-flex justify-content-between align-items-center">
                            <div class="m-0 text-muted fw-bold">{t("connections.main-image", {fallback: "Main image"})}</div>
                            {#if !mainAsset}
                                <button type="button" class="btn btn-sm btn-secondary d-flex align-items-center gap-2" onclick={() => handleAddAsset('main')}>
                                    <i class="bi bi-plus-lg"></i> {t("connections.add-main-image", {fallback: "Add main image"})}
                                </button>
                            {/if}
                         </div>
                         <div class="card-body text-center p-4">
                            {#if mainAsset}
                                <div class="d-inline-flex justify-content-center border rounded p-1 mb-2 shadow-sm bg-white w-100">
                                    <AssetPreview asset={mainAsset} size={200} width="100%" showRemoveButton={true} onRemove={() => handleRemoveAsset(mainAsset, 'main')} />
                                </div>
                                <div class="text-muted small text-truncate mw-100 px-2" title={mainAsset?.filename || mainAsset?.name}>
                                    {mainAsset?.filename || mainAsset?.name || t("common.untitled", { fallback: "Untitled" })}
                                </div>
                            {:else}
                                <div class="text-muted text-center py-5 m-0 bg-light rounded border border-dashed hover-bg-light-dark">
                                    <i class="bi bi-card-image fs-1 mb-2 d-block opacity-50"></i>
                                    {t("connections.no-main-image", {fallback: "No main image"})}
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