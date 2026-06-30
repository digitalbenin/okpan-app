<script>
    import { createForm } from "@tanstack/svelte-form";
    import { z } from "zod";
    import { createFieldValidator } from "$lib/utils/formValidation.js";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { getMediaType, createMediaFilters } from "$lib/utils/media.js";
    import { goto, invalidateAll } from "$app/navigation";
    import { addToast } from "$lib/components/base/BaseToast.svelte";
    import BaseBreadcrumb from "$lib/components/base/BaseBreadcrumb.svelte";
    import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import AutoForm from "$lib/components/form/AutoForm.svelte";
    import PageActionFooter from "$lib/components/common/PageActionFooter.svelte";
    import DetailSidebar from "$lib/components/common/DetailSidebar.svelte";
    import AssetPreview from "$lib/components/research_fields/AssetPreview.svelte";
    import MediaSectionRenderer from "$lib/components/research_fields/MediaSectionRenderer.svelte";
    import VocabularySidebar from "$lib/components/research_fields/VocabularySidebar.svelte";
    import { DEFAULT_FIELDS_CONFIG, getTemplateColorClasses } from "$lib/constants/connectionTemplates.js";
    import { deleteVocabulary as deleteVocabularyApi, updateVocabulary, updateVocabularyAssets, addVocabulary } from "$lib/api/ResearchFieldsApi.js";
    import { processEntityTranslations, buildTranslationFormValues } from "$lib/api/TranslationsApi.js";
    import { createDirtyTracker } from "$lib/stores/DirtyTracker.svelte.js";
    import { IconChartCircles, IconTrash, IconPencil, IconDeviceFloppy } from "@tabler/icons-svelte";
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
    const defaultLanguage = $derived(data.languages?.find((l) => l.is_default) || data.languages?.[0]);
    const secondaryLanguages = $derived(data.languages?.filter((l) => !l.is_default) || []);

    const visibleFields = $derived(researchField?.fields_config || DEFAULT_FIELDS_CONFIG);
    const isEditMode = $derived(Boolean(vocabulary?.id));
    const connectionColorClasses = $derived(getTemplateColorClasses(researchField?.fields_config?.templateId));
    const connectionTypeName = $derived(researchField?.name?.content || "");
    const vocabularyName = $derived(initialValues?.option || t("common.untitled", { fallback: "Untitled" }));

    const hiddenFields = $derived.by(() => {
        const h = ["mainAsset"];
        if (!visibleFields.description) h.push("description");
        if (!visibleFields.url) h.push("externalLink");
        return h;
    });

    const schema = z.object({
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

    const validator = $derived({ schema, requiredFields: new Set(["option"]) });

    const buildDefaultValues = (values = {}) => {
        const otherAssets = values.otherAssets || values.vocabulariesGenericAssets?.map((vga) => vga.genericAsset) || [];
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

    watch(() => formStore?.current?.values, (values) => {
        if (!values) return;
        if (!pageDirtyTracker) {
            pageDirtyTracker = createDirtyTracker({ initialData: values });
        } else {
            pageDirtyTracker.update(values);
        }
    });

    watch(() => defaultValues, (values) => {
        if (!form) {
            form = createForm(() => ({
                defaultValues: values,
                validators: { onChange: schema },
                onSubmit: async ({ value }) => {
                    const { mainAsset, mediaAssets, ...rest } = value;
                    const mainAssetId = mainAsset?.id || null;
                    const otherAssetIds = [...mediaAssets.images, ...mediaAssets.videos, ...mediaAssets.audio].map((a) => a.id);

                    if (isEditMode && vocabulary?.id) {
                        const res = await updateVocabulary(vocabulary.id, {
                            option: rest.option,
                            description: rest.description,
                            externalLink: rest.externalLink,
                            mainAsset: mainAssetId,
                        });
                        if (res.error) throw new Error(res.error);
                        await updateVocabularyAssets(vocabulary.id, otherAssetIds);
                        await processEntityTranslations(vocabulary, secondaryLanguages, TRANSLATABLE_FIELDS, value, data.languages);
                        pageDirtyTracker?.markPristine();
                    } else {
                        const result = await addVocabulary(researchField.id, {
                            languageId: defaultLanguage?.id,
                            option: rest.option,
                            description: rest.description,
                            externalLink: rest.externalLink,
                            mainAsset: mainAssetId,
                        });
                        if (result.error) throw new Error(result.error);

                        const newVocab = result.result?.insertIntoVocabularies?.[0];
                        const textIdMap = { option: newVocab?.option_id, description: newVocab?.description_id };
                        if (newVocab?.id && otherAssetIds.length) {
                            await updateVocabularyAssets(newVocab.id, otherAssetIds);
                        }
                        await processEntityTranslations(null, secondaryLanguages, TRANSLATABLE_FIELDS, value, data.languages, textIdMap);
                        await goto(`/projects/${project.id}/connections/${researchField.id}`);
                    }
                },
            }));
            return;
        }
        form.reset(values);
    });

    const breadcrumbItems = $derived([
        { label: t("project.connection-types", { fallback: "Connection types" }), href: `/projects/${project?.id}/connections` },
        { label: connectionTypeName, href: `/projects/${project?.id}/connections/${researchField?.id}` },
        { label: vocabularyName }
    ]);

    const rightButtons = $derived([
        { id: "save-vocabulary", text: submitLabel || t("common.save", { fallback: "Save changes" }), class: "btn btn-success btn-sm", type: "submit", disableOnError: true, disableWhenClean: isEditMode, iconComponent: IconDeviceFloppy }
    ]);

    const leftButtons = $derived(
        isEditMode
            ? [{ id: "delete-vocabulary", text: t("common.delete-connection", { fallback: "Delete connection" }), class: "btn btn-sm btn-outline-danger", iconComponent: IconTrash, onClick: () => (showDeleteDialog = true), type: "button" }]
            : []
    );

    let showDeleteDialog = $state(false);
    let isDeleting = $state(false);

    async function confirmDelete() {
        if (!vocabulary?.id) return;
        isDeleting = true;
        try {
            const { error: err } = await deleteVocabularyApi(vocabulary.id);
            if (err) {
                addToast({ data: { type: "danger", title: t("common.delete", { fallback: "Delete" }), description: err?.message || String(err) } });
                return;
            }
            addToast({ data: { type: "success", title: t("common.delete", { fallback: "Delete" }), description: t("common.delete-connection-success", { fallback: "Connection deleted." }) } });
            showDeleteDialog = false;
            await invalidateAll();
            await goto(`/projects/${project.id}/connections/${researchField.id}`);
        } finally {
            isDeleting = false;
        }
    }

    async function handleAddMainAsset() {
        try {
            const result = await window.api.openFileDialog({ properties: ["openFile", "multiSelections"], filters: createMediaFilters(["image"]) });
            if (result?.canceled || !result.filePaths.length) return;
            const importResult = await window.api.importAssets({ path: result.filePaths, projectId: project.id, isGenericAsset: true });
            if (importResult?.createdAssets?.[0]) {
                form?.setFieldValue("mainAsset", importResult.createdAssets[0]);
            }
        } catch (e) {
            console.error("Failed to add main asset", e);
        }
    }

    const mainAsset = $derived(formStore?.current?.values?.mainAsset || null);
</script>

<form method="post" onsubmit={(e) => { e.preventDefault(); e.stopPropagation(); form?.handleSubmit(); }}>
    <PageActionFooter contentClass="d-flex flex-column p-0" rightButtons={rightButtons} leftButtons={leftButtons} formStore={formStore} dirtyTracker={pageDirtyTracker}>
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
                            <AssetPreview asset={mainAsset} size={56} width="100%" height="100%" showRemoveButton={false} showFilename={false} />
                        {:else}
                            <img src="/src/assets/img_lg.png" alt="" class="w-100 h-100 object-fit-cover" />
                        {/if}
                        <div class="position-absolute top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-center justify-content-center">
                            <IconPencil size={16} class="text-white" />
                        </div>
                    </button>
                    <div class="d-flex flex-column min-w-0">
                        <h2 class=" mb-0 text-truncate">{vocabularyName}</h2>
                        <div class="text-muted small text-truncate">
                            {linkedObjectsTotalCount} {t("common.linked-objects", { fallback: "linked objects" })}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Body -->
        <div class="flex-grow-1 pt-0">
            <div class="row me-n4">
                <div class="col-12 col-xl-9 col-lg-8 pe-xl-4">
                    <section class="mb-4 pt-4">
                        <p class="text-uppercase fs-7 mb-0">{t("connections.section.main-info", { fallback: "Main info" })}</p>
                        {#if formReady}
                            <AutoForm
                                {form}
                                {createFieldValidator}
                                languages={data.languages}
                                translatableFields={["option", visibleFields.description ? "description" : null].filter(Boolean)}
                                {validator}
                                hiddenFields={hiddenFields}
                                margin={0}
                                defaultColSize={12}
                                uiSchema={{
                                    option: { label: t("common.name", { fallback: "Name" }), colSize: 12, charLimit: 150 },
                                    description: { type: "textarea", colSize: 12, label: t("common.description", { fallback: "Description" }), charLimit: 150 },
                                    externalLink: { colSize: 12, label: t("common.external-link", { fallback: "External link" }), charLimit: 150 },
                                    mediaAssets: {
                                        label: t("connections.section-media", { fallback: "Media" }),
                                        renderer: MediaSectionRenderer,
                                        colSize: 12,
                                        rendererProps: { visibleFields, project },
                                    },
                                }}
                                bind:dirtyTracker={autoFormDirtyTracker}
                            />
                        {/if}
                    </section>
                </div>

                {#if isEditMode}
                    <DetailSidebar class="p-0 col-12 col-xl-3 col-lg-4">
                        <VocabularySidebar
                            {initialValues}
                            {linkedObjects}
                            {linkedObjectsTotalCount}
                            {linkedObjectsPage}
                            {linkedObjectsPageSize}
                            {project}
                        />
                    </DetailSidebar>
                {/if}
            </div>
        </div>
    </PageActionFooter>
</form>

<BaseAlertDialog bind:open={showDeleteDialog}>
    {#snippet title()}{t("common.delete-connection", { fallback: "Delete connection" })}{/snippet}
    {#snippet description()}{t("common.delete-connection-confirmation", { fallback: "Are you sure you want to delete this connection? This action cannot be undone." })}{/snippet}
    {#snippet footer()}
        <BaseButton class="btn btn-secondary" onClick={() => (showDeleteDialog = false)} text={t("common.cancel", { fallback: "Cancel" })} disabled={isDeleting} />
        <BaseButton class="btn btn-danger ms-2" onClick={confirmDelete} text={t("common.delete", { fallback: "Delete" })} loading={isDeleting} />
    {/snippet}
</BaseAlertDialog>
