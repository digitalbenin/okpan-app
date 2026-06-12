<script>
    import { createForm } from "@tanstack/svelte-form";
    import { z } from "zod";
    import { createFieldValidator } from "$lib/utils/formValidation.js";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { getMediaType, createMediaFilters } from "$lib/utils/media.js";
    import { goto, invalidateAll } from "$app/navigation";
    import { addToast } from "$lib/components/base/BaseToast.svelte";
    import BaseBreadcrumb from "$lib/components/base/BaseBreadcrumb.svelte";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BasePagination from "$lib/components/base/BasePagination.svelte";
    import AutoForm from "$lib/components/form/AutoForm.svelte";
    import PageActionFooter from "$lib/components/common/PageActionFooter.svelte";
    import DetailSidebar from "$lib/components/common/DetailSidebar.svelte";
    import AssetPreview from "$lib/components/research_fields/AssetPreview.svelte";
    import MediaUploadZone from "$lib/components/research_fields/MediaUploadZone.svelte";
    import imgLg from "$assets/img_lg.png";
    import { DEFAULT_FIELDS_CONFIG, getTemplateColorClasses } from "$lib/constants/connectionTemplates.js";
    import { getObjectIdentifier } from "$lib/api/ObjectsApi.js";
    import { deleteVocabulary as deleteVocabularyApi } from "$lib/api/ResearchFieldsApi.js";
    import { IconChartCircles, IconTrash, IconInfoCircle, IconPhoto, IconPencil } from "@tabler/icons-svelte";
    import { watch } from "runed";

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

    const validator = $derived({
        schema: vocabularySchema,
        requiredFields: new Set(["option"])
    });

    const buildDefaultValues = (values = {}) => ({
        option: "",
        description: "",
        externalLink: "",
        ...values
    });

    const getInitialOtherAssets = (values = {}) =>
        values.otherAssets || values.vocabulariesGenericAssets?.map((vga) => vga.genericAsset) || [];

    const buildAssetsByType = (assets) => ({
        image: assets.filter((asset) => getMediaType(asset) === "image").map((asset, index) => ({ ...asset, id: asset.id || `img-${index}` })),
        video: assets.filter((asset) => getMediaType(asset) === "video").map((asset, index) => ({ ...asset, id: asset.id || `vid-${index}` })),
        audio: assets.filter((asset) => getMediaType(asset) === "audio").map((asset, index) => ({ ...asset, id: asset.id || `aud-${index}` })),
    });

    const defaultValues = $derived.by(() => buildDefaultValues(initialValues));

    let form = $state(null);
    const formStore = $derived(form?.useStore ? form.useStore((state) => state) : null);
    const formReady = $derived(Boolean(form));

    // Media State
    let mainAsset = $state(null);
    let assetsByType = $state(buildAssetsByType([]));
    const flipDurationMs = 200;

    watch(() => defaultValues, (values) => {
        if (!form) {
            mainAsset = values.mainAsset || null;
            assetsByType = buildAssetsByType(getInitialOtherAssets(values));
            form = createForm(() => ({
                defaultValues: values,
                validators: { onChange: vocabularySchema },
                onSubmit: async ({ value }) => {
                    const otherAssetIds = [...assetsByType.image, ...assetsByType.video, ...assetsByType.audio].map((asset) => asset.id);
                    await onSubmit(value, mainAsset?.id || null, otherAssetIds);
                },
            }));
            return;
        }

        form.reset(values);
        mainAsset = values.mainAsset || null;
        assetsByType = buildAssetsByType(getInitialOtherAssets(values));
    });

    // Asset handlers — shared between main asset, media zones, and existing previews
    async function importPaths(paths, type) {
        try {
            const importResult = await window.api.importAssets({
                path: paths,
                projectId: project.id,
                isGenericAsset: true
            });
            if (!importResult?.createdAssets) return;
            if (type === "main") {
                mainAsset = importResult.createdAssets[0];
            } else {
                assetsByType[type] = [...assetsByType[type], ...importResult.createdAssets];
            }
        } catch (e) {
            console.error("Failed to import asset", e);
        }
    }

    async function handleAddMainAsset() {
        try {
            const result = await window.api.openFileDialog({
                properties: ["openFile", "multiSelections"],
                filters: createMediaFilters(["image"])
            });
            if (result?.canceled || !result.filePaths.length) return;
            await importPaths(result.filePaths, "main");
        } catch (e) {
            console.error("Failed to add main asset", e);
        }
    }

    const resolvedSubmitLabel = $derived(submitLabel || t("common.save", { fallback: "Save changes" }));
    const connectionTypeName = $derived(researchField?.name?.content || "");
    const vocabularyName = $derived(initialValues?.option || t("common.untitled", { fallback: "Untitled" }));
    const connectionColorClasses = $derived(getTemplateColorClasses(researchField?.fields_config?.templateId));

    const formatDate = (ts) => {
        if (!ts) return "";
        try {
            return new Date(ts).toISOString().slice(0, 10);
        } catch {
            return "";
        }
    };
    const formatRelative = (ts) => {
        if (!ts) return "";
        const now = Date.now();
        const diff = now - new Date(ts).getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days <= 0) return t("common.today", { fallback: "Today" });
        if (days === 1) return t("common.yesterday", { fallback: "Yesterday" });
        if (days < 7) return `${days} ${t("common.days-ago", { fallback: "days ago" })}`;
        if (days < 30) return `${Math.floor(days / 7)} ${t("common.weeks-ago", { fallback: "weeks ago" })}`;
        return `${Math.floor(days / 30)} ${t("common.months-ago", { fallback: "months ago" })}`;
    };

    const breadcrumbItems = $derived([
        { label: t("project.connection-types", { fallback: "Connection types" }), href: `/projects/${project?.id}/connections` },
        { label: connectionTypeName, href: `/projects/${project?.id}/connections/${researchField?.id}` },
        { label: vocabularyName }
    ]);

    // Sidebar: connected objects (object cards)
    const getObjectDisplayName = (obj) => obj?.name?.content?.trim() || (typeof obj?.name === "string" ? obj.name.trim() : null) || getObjectIdentifier(obj);
    const getObjectThumb = (obj) => obj?.objectsAssets?.[0]?.asset || null;
    const getObjectsLabel = (count) => (count === 1 ? t("common.object", { fallback: "object" }) : t("common.objects", { fallback: "objects" }));

    let currentLinkedObjectsPage = $state(linkedObjectsPage);
    const paginatedLinkedObjects = $derived(
        linkedObjects.slice(
            (currentLinkedObjectsPage - 1) * linkedObjectsPageSize,
            currentLinkedObjectsPage * linkedObjectsPageSize
        )
    );

    // Footer / actions
    const rightActionButtons = $derived([
        {
            id: "save-vocabulary",
            text: resolvedSubmitLabel,
            class: "btn btn-success",
            type: "submit",
            disableOnError: true,
        }
    ]);

    const leftActionButtons = $derived(
        initialValues?.id
            ? [
                {
                    id: "delete-vocabulary",
                    text: t("common.delete-connection", { fallback: "Delete connection" }),
                    class: "btn btn-outline-danger",
                    iconComponent: IconTrash,
                    onClick: () => (showDeleteDialog = true),
                    type: "button"
                }
            ]
            : []
    );

    // Delete dialog
    let showDeleteDialog = $state(false);
    let isDeleting = $state(false);

    async function confirmDelete() {
        if (!initialValues?.id) return;
        isDeleting = true;
        try {
            const { error } = await deleteVocabularyApi(initialValues.id);
            if (error) {
                addToast({
                    data: { type: "danger", title: t("common.delete", { fallback: "Delete" }), description: error?.message || String(error) }
                });
                return;
            }
            addToast({
                data: { type: "success", title: t("common.delete", { fallback: "Delete" }), description: t("common.delete-connection-success", { fallback: "Connection deleted." }) }
            });
            showDeleteDialog = false;
            await invalidateAll();
            await goto(`/projects/${project.id}/connections/${researchField.id}`);
        } finally {
            isDeleting = false;
        }
    }

    // Media sections config (used by the new MediaUploadZone)
    const mediaSections = $derived([
        { type: "image", visible: visibleFields.images },
        { type: "video", visible: visibleFields.videos },
        { type: "audio", visible: visibleFields.audios },
    ]);
</script>

<form
    method="post"
    onsubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form?.handleSubmit();
    }}
>
<PageActionFooter contentClass="d-flex flex-column p-0" rightButtons={rightActionButtons} leftButtons={leftActionButtons} formStore={formStore}>
    <!-- Header: white band with left border in the connection-type color -->
    <div class="border-bottom mx-n4 mt-n4 border-2">
        <div class={`border-start border-4 ${connectionColorClasses.border} py-3 px-4`}>
            <BaseBreadcrumb items={breadcrumbItems} icon={IconChartCircles} />
            <div class="d-flex align-items-center gap-3 mt-2">
                <button
                    type="button"
                    class="flex-shrink-0 bg-light rounded-2 border-0 p-0 d-flex align-items-center justify-content-center position-relative"
                    style="width: 56px; height: 56px; overflow: hidden; cursor: pointer;"
                    onclick={handleAddMainAsset}
                aria-label={mainAsset ? t("connections.main-image", { fallback: "Main image" }) : t("connections.add-main-image", { fallback: "Add main image" })}
            >
                {#if mainAsset}
                    <AssetPreview asset={mainAsset} size={56} width="100%" height="100%" showRemoveButton={false} />
                {:else}
                    <img src="/src/assets/img_lg.png" alt="" class="w-100 h-100 object-fit-cover" />
                {/if}
                <div class="position-absolute top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-center justify-content-center">
                    <IconPencil size={16} class="text-white" />
                </div>
            </button>
                <div class="d-flex flex-column min-w-0">
                    <h2 class="fs-4 fw-semibold mb-0 text-truncate">{vocabularyName}</h2>
                    <div class="text-muted small text-truncate">
                        {linkedObjectsTotalCount} {t("common.objects-connected", { fallback: "objects connected" })}
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Body: 2 columns -->
    <div class="flex-grow-1 pt-0">
        <div class="row g-4">
            <!-- Main column -->
            <div class="col-12 col-xl-8 pe-xl-4">
                <section class="mb-4 pt-4">
                    <p class="text-uppercase fs-7 text-body-tertiary mb-2">
                        {t("connections.section.main-info", { fallback: "Main info" })}
                    </p>
                    {#if formReady}
                        <AutoForm
                            {form}
                            {createFieldValidator}
                            languages={data.languages}
                            translatableFields={["option", visibleFields.description ? "description" : null].filter(Boolean)}
                            {validator}
                            hiddenFields={autoFormHiddenFields}
                            margin={0}
                            defaultColSize={12}
                            uiSchema={{
                                option: { label: t("common.name", { fallback: "Name" }), colSize: 12, charLimit: 150 },
                                description: { type: "textarea", colSize: 12, label: t("common.description", { fallback: "Description" }), charLimit: 150 },
                                externalLink: { colSize: 12, label: t("common.external-link", { fallback: "External link" }), charLimit: 150 },
                            }}
                        />
                    {/if}
                </section>

                <section>
                    <p class="text-uppercase fs-7 text-body-tertiary mb-2">
                        {t("connections.section.media", { fallback: "Media" })}
                    </p>
                    <div class="d-flex flex-column gap-3">
                        {#each mediaSections as section}
                            {#if section.visible}
                                <div>
                                    <div class="d-flex align-items-center gap-1 mb-1 fs-7 text-body-secondary text-uppercase">
                                        {t(`common.${section.type === "image" ? "images" : section.type === "video" ? "videos" : "audio"}`, { fallback: section.type.charAt(0).toUpperCase() + section.type.slice(1) + "s" })}
                                        <IconInfoCircle size={12} />
                                    </div>
                                    <MediaUploadZone
                                        type={section.type}
                                        assets={assetsByType[section.type]}
                                        onAdd={(paths) => importPaths(paths, section.type)}
                                        onRemove={(asset) => (assetsByType[section.type] = assetsByType[section.type].filter((a) => a.id !== asset.id))}
                                    />
                                </div>
                            {/if}
                        {/each}
                    </div>
                </section>
            </div>

            <!-- Right sidebar (uses DetailSidebar) -->
            <DetailSidebar class="p-0">
                <div class="mb-3 p-2">
                    <p class="text-uppercase fs-7 text-body-tertiary mb-2">
                        {t("common.activity", { fallback: "Recent activity" })}
                    </p>
                    <div class="small text-body-secondary d-flex flex-column gap-1">
                        <div>
                            <span class="text-body">{t("common.created-at", { fallback: "Created at" })}:</span>
                            {formatDate(initialValues?.created_at)}
                        </div>
                        <div>
                            <span class="text-body">{t("common.updated-at", { fallback: "Updated at" })}:</span>
                            {formatRelative(initialValues?.updated_at)}
                        </div>
                    </div>
                </div>

                {#if linkedObjectsTotalCount > 0}
                    <div class="mb-3 p-2">
                        <div class="d-flex align-items-center justify-content-between mb-2">
                                <p class="text-uppercase fs-7 text-body-tertiary mb-0">
                                {t("common.linked-objects", { fallback: "Linked objects" })} ({linkedObjectsTotalCount})
                            </p>
                        </div>
                        <div class="d-flex flex-column">
                            {#each paginatedLinkedObjects as obj (obj.id)}
                                <a
                                    href={`/projects/${project.id}/institutions/${obj.institution_id}/objects/${obj.id}`}
                                    class="d-flex align-items-center gap-2 py-2 border-top text-decoration-none text-body"
                                >
                                    <div class="flex-shrink-0 rounded overflow-hidden" style="width: 51px; height: 52px;">
                                        <BaseImage
                                            asset={getObjectThumb(obj)}
                                            preferredFormat="sm"
                                            alt={getObjectDisplayName(obj)}
                                            width={51}
                                            height={52}
                                            ratio="1/1"
                                            objectFit="cover"
                                            compact={true}
                                        />
                                    </div>
                                    <div class="d-flex flex-column min-w-0">
                                        <span class="fw-semibold text-truncate">{getObjectDisplayName(obj)}</span>
                                        <span class="text-body-secondary small text-truncate">
                                            {obj?.institution?.name?.content || ""}
                                        </span>
                                    </div>
                                </a>
                            {/each}
                        </div>
                        {#if linkedObjectsTotalCount > linkedObjectsPageSize}
                            <div class="d-flex justify-content-center mt-2">
                                <BasePagination bind:page={currentLinkedObjectsPage} pageSize={linkedObjectsPageSize} count={linkedObjectsTotalCount} />
                            </div>
                        {/if}
                    </div>
                {/if}
            </DetailSidebar>
        </div>
    </div>
</PageActionFooter>
</form>

<BaseAlertDialog bind:open={showDeleteDialog}>
    {#snippet title()}
        {t("common.delete-connection", { fallback: "Delete connection" })}
    {/snippet}
    {#snippet description()}
        {t("common.delete-connection-confirmation", { fallback: "Are you sure you want to delete this connection? This action cannot be undone." })}
    {/snippet}
    {#snippet footer()}
        <BaseButton class="btn btn-secondary" onClick={() => (showDeleteDialog = false)} text={t("common.cancel", { fallback: "Cancel" })} disabled={isDeleting} />
        <BaseButton class="btn btn-danger ms-2" onClick={confirmDelete} text={t("common.delete", { fallback: "Delete" })} loading={isDeleting} />
    {/snippet}
</BaseAlertDialog>
