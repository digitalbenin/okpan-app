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
    import MediaSectionRenderer from "$lib/components/research_fields/MediaSectionRenderer.svelte";
    import imgLg from "$assets/img_lg.png";
    import { DEFAULT_FIELDS_CONFIG, getTemplateColorClasses } from "$lib/constants/connectionTemplates.js";
    import { getObjectIdentifier } from "$lib/api/ObjectsApi.js";
    import { deleteVocabulary as deleteVocabularyApi, updateVocabulary, updateVocabularyAssets, addVocabulary } from "$lib/api/ResearchFieldsApi.js";
    import { processEntityTranslations, buildTranslationFormValues } from "$lib/api/TranslationsApi.js";
    import { createDirtyTracker } from "$lib/stores/DirtyTracker.svelte.js";
    import { IconChartCircles, IconTrash, IconPencil } from "@tabler/icons-svelte";
    import { watch } from "runed";

    let {
        data,
        researchField,
        project,
        vocabulary = null,
        initialValues = {},
        linkedObjects = [],
        linkedObjectsTotalCount = 0,
        linkedObjectsPage = 1,
        linkedObjectsPageSize = 24,
        onCancel,
        title = "",
        submitLabel = ""
    } = $props();

    const { t } = getTranslationStore();

    const TRANSLATABLE_FIELDS = ["option", "description"];
    const defaultLanguage = $derived(data.languages?.find((lang) => lang.is_default) || data.languages?.[0]);
    const secondaryLanguages = $derived(data.languages?.filter((lang) => !lang.is_default) || []);

    // Visibility config
    let visibleFields = $derived(researchField?.fields_config || DEFAULT_FIELDS_CONFIG);

    // Hidden fields for AutoForm
    let autoFormHiddenFields = $derived.by(() => {
        const hidden = ["mainAsset"];
        if (!visibleFields.description) hidden.push("description");
        if (!visibleFields.url) hidden.push("externalLink");
        return hidden;
    });

    const vocabularySchema = z.object({
        option: z.string().min(1, t("common.required", { fallback: "Required" })),
        description: z.string().optional(),
        externalLink: z.string().url().optional().or(z.literal("")),
        mainAsset: z.any().optional().nullable(),
        mediaAssets: z.object({
            images: z.array(z.any()).default([]),
            videos: z.array(z.any()).default([]),
            audio: z.array(z.any()).default([]),
        }).default({ images: [], videos: [], audio: [] }),
    }).passthrough();

    const validator = $derived({
        schema: vocabularySchema,
        requiredFields: new Set(["option"])
    });

    const getInitialOtherAssets = (values = {}) =>
        values.otherAssets || values.vocabulariesGenericAssets?.map((vga) => vga.genericAsset) || [];

    const buildDefaultValues = (values = {}) => {
        const otherAssets = getInitialOtherAssets(values);
        return {
            option: values.option || "",
            description: values.description || "",
            externalLink: values.externalLink || "",
            mainAsset: values.mainAsset || null,
            mediaAssets: {
                images: otherAssets.filter((a) => getMediaType(a) === "image"),
                videos: otherAssets.filter((a) => getMediaType(a) === "video"),
                audio: otherAssets.filter((a) => getMediaType(a) === "audio"),
            },
            ...buildTranslationFormValues(vocabulary, secondaryLanguages, TRANSLATABLE_FIELDS),
        };
    };

    const defaultValues = $derived.by(() => buildDefaultValues(initialValues));

    let form = $state(null);
    const formStore = $derived(form?.useStore ? form.useStore((state) => state) : null);
    const formReady = $derived(Boolean(form));

    let autoFormDirtyTracker = $state(null);
    let pageDirtyTracker = $state(null);

    const isEditMode = $derived(Boolean(vocabulary?.id));

    // Page-level dirty tracker: watches form values and keeps its own baseline.
    // This is the tracker that PageActionFooter uses for the save button.
    watch(
        () => formStore?.current?.values,
        (values) => {
            if (!values) return;
            if (!pageDirtyTracker) {
                pageDirtyTracker = createDirtyTracker({ initialData: values });
            } else {
                pageDirtyTracker.update(values);
            }
        }
    );

    watch(() => defaultValues, (values) => {
        if (!form) {
            form = createForm(() => ({
                defaultValues: values,
                validators: { onChange: vocabularySchema },
                onSubmit: async ({ value }) => {
                    const { mainAsset, mediaAssets, ...formValue } = value;
                    const mainAssetId = mainAsset?.id || null;
                    const otherAssetIds = [
                        ...mediaAssets.images.map((a) => a.id),
                        ...mediaAssets.videos.map((a) => a.id),
                        ...mediaAssets.audio.map((a) => a.id),
                    ];

                    if (isEditMode && vocabulary?.id) {
                        // --- EDIT MODE ---
                        const payload = {
                            option: formValue.option,
                            description: formValue.description,
                            externalLink: formValue.externalLink,
                            mainAsset: mainAssetId,
                        };

                        const res = await updateVocabulary(vocabulary.id, payload);
                        if (res.error) {
                            throw new Error(res.error);
                        }

                        await updateVocabularyAssets(vocabulary.id, otherAssetIds);
                        await processEntityTranslations(vocabulary, secondaryLanguages, TRANSLATABLE_FIELDS, value, data.languages);
                        pageDirtyTracker?.markPristine();
                    } else {
                        // --- CREATE MODE ---
                        const params = {
                            languageId: defaultLanguage?.id,
                            option: formValue.option,
                            description: formValue.description,
                            externalLink: formValue.externalLink,
                            mainAsset: mainAssetId,
                        };

                        const result = await addVocabulary(researchField.id, params);
                        if (result.error) {
                            throw new Error(result.error);
                        }

                        const newVocabulary = result.result?.insertIntoVocabularies?.[0];
                        const newVocabularyId = newVocabulary?.id;
                        const optionTextId = newVocabulary?.option_id;
                        const descriptionTextId = newVocabulary?.description_id;

                        if (newVocabularyId && otherAssetIds.length > 0) {
                            await updateVocabularyAssets(newVocabularyId, otherAssetIds);
                        }

                        const textIdMap = { option: optionTextId, description: descriptionTextId };
                        await processEntityTranslations(null, secondaryLanguages, TRANSLATABLE_FIELDS, value, data.languages, textIdMap);

                        // Navigate back to the connection type page
                        await goto(`/projects/${project.id}/connections/${researchField.id}`);
                    }
                },
            }));
            return;
        }
        form.reset(values);
    });

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

    // Sidebar: connected objects
    const getObjectDisplayName = (obj) => obj?.name?.content?.trim() || (typeof obj?.name === "string" ? obj.name.trim() : null) || getObjectIdentifier(obj);
    const getObjectThumb = (obj) => obj?.objectsAssets?.[0]?.asset || null;

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
            disableWhenClean: isEditMode,
        }
    ]);

    const leftActionButtons = $derived(
        isEditMode
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
        if (!vocabulary?.id) return;
        isDeleting = true;
        try {
            const { error } = await deleteVocabularyApi(vocabulary.id);
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

    // Main asset handlers
    async function handleAddMainAsset() {
        try {
            const result = await window.api.openFileDialog({
                properties: ["openFile", "multiSelections"],
                filters: createMediaFilters(["image"])
            });
            if (result?.canceled || !result.filePaths.length) return;
            const importResult = await window.api.importAssets({
                path: result.filePaths,
                projectId: project.id,
                isGenericAsset: true
            });
            if (importResult?.createdAssets?.[0]) {
                const newAsset = importResult.createdAssets[0];
                form?.setFieldValue("mainAsset", newAsset);
            }
        } catch (e) {
            console.error("Failed to add main asset", e);
        }
    }

    const mainAsset = $derived(formStore?.current?.values?.mainAsset || null);
</script>

<form
    method="post"
    onsubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form?.handleSubmit();
    }}
>
<PageActionFooter contentClass="d-flex flex-column p-0" rightButtons={rightActionButtons} leftButtons={leftActionButtons} formStore={formStore} dirtyTracker={pageDirtyTracker}>
    <!-- Header -->
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
            <div class="col-12 col-xl-9 col-lg-8 pe-xl-4">
                <section class="mb-4 pt-4">
                    <p class="text-uppercase fs-7 mb-0">
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
                                mediaAssets: {
                                    label: t("connections.section.media", { fallback: "Media" }),
                                    renderer: MediaSectionRenderer,
                                    colSize: 12,
                                    rendererProps: {
                                        visibleFields,
                                        project,
                                    },
                                },
                            }}
                            bind:dirtyTracker={autoFormDirtyTracker}
                        />
                    {/if}
                </section>
            </div>

            {#if isEditMode}
                <!-- Right sidebar: only shown in edit mode (has activity + linked objects) -->
                <DetailSidebar class="p-0 col-12 col-xl-3 col-lg-4">
                    <div class="mb-3 p-2">
                        <p class="text-uppercase fs-7 mb-2">
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
                                <p class="text-uppercase fs-7 mb-0">
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
                                            <span class="small text-truncate">
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
            {/if}
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
