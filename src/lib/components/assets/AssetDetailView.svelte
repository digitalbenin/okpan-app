<script>
    import { page } from "$app/stores";
    import { createForm } from "@tanstack/svelte-form";
    import AutoForm from "$lib/components/form/AutoForm.svelte";
    import BaseModal from "$lib/components/base/BaseModal.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import LinkObjectsModal from "$lib/components/assets/LinkObjectsModal.svelte";
    import AssetMediaDisplay from "$lib/components/assets/AssetMediaDisplay.svelte";
    import LinkedObjectsPanel from "$lib/components/assets/LinkedObjectsPanel.svelte";
    import PageActionFooter from "$lib/components/common/PageActionFooter.svelte";
    import { createFieldValidator, getFormConfig } from "$lib/utils/formValidation.js";
    import { updateAsset, deleteAsset } from "$lib/api/AssetsApi.js";
    import { linkAssetToObject, unlinkAssetFromObject } from "$lib/api/ObjectsApi.js";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import {
        METADATA_FIELDS,
        createMetadataValidator,
        buildMetadataFormValues,
        buildTranslationsFromValue,
        parseMetadata,
    } from "$lib/utils/assetMetadataUtils.js";
    import { z } from "zod";

    let { asset: initialAsset, linkedObjects: initialLinkedObjects = [], languages = [], project_id, institution_id } = $props();
    const { t } = getTranslationStore();

    const LINKED_IDS_FIELD = "linkedIdsSignature";

    let asset = $state(initialAsset);
    let linkedObjects = $state(initialLinkedObjects);
    let showDeleteModal = $state(false);
    let isDeleting = $state(false);
    let showLinkObjectsModal = $state(false);

    const defaultLanguage = $derived(languages?.find((l) => l.is_default) || languages?.[0]);
    const secondaryLanguages = $derived(languages?.filter((l) => !l.is_default) || []);
    const metadata = $derived(parseMetadata(asset?.properties));

    const currentLinkedObjectIds = $derived(linkedObjects.map((oa) => String(oa.object_id)).sort());
    const initialLinkedObjectIds = $derived(
        (initialLinkedObjects || []).map((oa) => String(oa.object_id)).sort()
    );

    const computeLinkedIdsSignature = (ids) => (ids?.length ? ids.join("::") : "");
    const linkedIdsSignature = $derived(computeLinkedIdsSignature(currentLinkedObjectIds));

    const defaultValues = $derived.by(() => {
        const values = buildMetadataFormValues(metadata, defaultLanguage?.code, secondaryLanguages);
        values[LINKED_IDS_FIELD] = computeLinkedIdsSignature(initialLinkedObjectIds);
        return values;
    });

    const baseValidator = createMetadataValidator();
    const extendedSchema = baseValidator.schema.extend({ [LINKED_IDS_FIELD]: z.string().optional() });
    const validator = { schema: extendedSchema, requiredFields: new Set([]), validate: (data) => extendedSchema.safeParse(data) };

    async function onSubmitForm({ value }) {
        try {
            const initialIds = new Set(initialLinkedObjectIds);
            const currentIds = new Set(currentLinkedObjectIds);
            const toLink = currentLinkedObjectIds.filter((id) => !initialIds.has(id));
            const toUnlink = initialLinkedObjectIds.filter((id) => !currentIds.has(id));

            await Promise.all(toLink.map((id) =>
                linkAssetToObject(String(id), String(asset.id)).catch((e) => console.error("Error linking:", e))
            ));
            await Promise.all(toUnlink.map((id) =>
                unlinkAssetFromObject(id, asset.id).catch((e) => console.error("Error unlinking:", e))
            ));

            const translations = buildTranslationsFromValue(value, languages, defaultLanguage);
            const result = await updateAsset(asset.id, { properties: JSON.stringify(translations) });

            if (!result?.error) {
                asset.properties = JSON.stringify(translations);
                initialLinkedObjects = linkedObjects.map((oa) => ({ ...oa }));
            } else {
                console.error("Failed to update asset:", result?.error);
            }
        } catch (error) {
            console.error("Error updating asset:", error);
        }
    }

    const form = $derived(createForm(() => getFormConfig("assets", "update", { defaultValues, onSubmit: onSubmitForm })));
    const formStore = $derived(form?.useStore ? form.useStore((state) => state) : null);

    const hiddenFields = [LINKED_IDS_FIELD];
    const hiddenValueProviders = $derived({ [LINKED_IDS_FIELD]: () => linkedIdsSignature });

    const uiSchema = $derived({
        description: { label: t("common.description"), type: "textarea", colSize: 12, required: false },
        copyright: { label: t("common.copyright"), type: "textarea", colSize: 12, required: false },
        author: { label: t("media.author"), type: "textarea", colSize: 12, required: false },
    });

    const confirmDeleteAsset = async () => {
        if (!asset?.id) return (showDeleteModal = false);
        isDeleting = true;
        try {
            const res = await deleteAsset(asset.id);
            res?.error ? console.error("Failed to delete asset:", res.error) : window.history.back();
        } catch (err) {
            console.error("Error deleting asset:", err);
        } finally {
            isDeleting = false;
            showDeleteModal = false;
        }
    };

    const handleUnlinkObject = (objectId) => {
        linkedObjects = linkedObjects.filter((oa) => String(oa.object_id) !== String(objectId));
    };

    const handleObjectsLinked = (objects) => {
        if (!objects?.length) return;
        const existing = new Set(linkedObjects.map((oa) => String(oa.object_id)));
        const additions = objects.filter((o) => !existing.has(String(o.id))).map((o) => ({ object_id: o.id, object: o }));
        if (additions.length) linkedObjects = [...linkedObjects, ...additions];
    };

    const handleObjectsUnlinked = (objectIds) => {
        if (!objectIds?.length) return;
        linkedObjects = linkedObjects.filter((oa) => !objectIds.includes(String(oa.object_id)));
    };

    const leftButtons = $derived([
        { text: t("common.delete-media"), icon: "trash", class: "btn btn-outline-danger", onClick: () => (showDeleteModal = true) },
    ]);

    const rightButtons = $derived([
        { text: t("common.save"), class: "btn btn-success", onClick: () => form?.handleSubmit(), disableOnError: true },
    ]);
</script>

<PageActionFooter {formStore} leftButtons={leftButtons} rightButtons={rightButtons}>
    <div class="container-fluid px-4 py-3">
        <div class="d-flex align-items-center mb-4">
            <button type="button" aria-label={t("common.back")} class="btn btn-link p-0 me-3 text-muted" onclick={() => window.history.back()}>
                <i class="bi bi-arrow-left fs-5"></i>
            </button>
            <div>
                <div class="text-muted small">{$page.data?.institution?.name?.content || institution_id}</div>
                <h1 class="h4 mb-0">{asset.filename}</h1>
            </div>
        </div>

        <div class="row">
            <div class="col-lg-8">
                <h5 class="mb-3">{t("common.media")}</h5>
                <AssetMediaDisplay {asset} />

                <h5 class="mb-3">{t("media.media-metadata")}</h5>
                <form onsubmit={(e) => { e.preventDefault(); e.stopPropagation(); form?.handleSubmit(); }}>
                    <AutoForm
                        {form}
                        {validator}
                        {createFieldValidator}
                        {languages}
                        translatableFields={METADATA_FIELDS}
                        {uiSchema}
                        fieldOrder={METADATA_FIELDS}
                        {hiddenFields}
                        {hiddenValueProviders}
                        usePortal={false}
                    />
                </form>
            </div>

            <div class="col-lg-4">
                <LinkedObjectsPanel
                    {linkedObjects}
                    onLink={() => (showLinkObjectsModal = true)}
                    onUnlink={handleUnlinkObject}
                />
            </div>
        </div>
    </div>
</PageActionFooter>

<BaseModal bind:isOpen={showDeleteModal}>
    {#snippet header()}{t("common.confirm-delete")}{/snippet}
    {#snippet body()}
        <p>{t("common.confirm-delete-asset")}</p>
    {/snippet}
    {#snippet actions()}
        <BaseButton type="button" class="btn btn-secondary" text={t("common.cancel")} onClick={() => (showDeleteModal = false)} disabled={isDeleting} />
        <BaseButton type="button" class="btn btn-danger" text={isDeleting ? t("common.deleting") : t("common.confirm-and-delete")} onClick={confirmDeleteAsset} disabled={isDeleting} />
    {/snippet}
</BaseModal>

<LinkObjectsModal
    bind:isOpen={showLinkObjectsModal}
    projectId={project_id}
    assetId={asset?.id}
    preselectExisting={true}
    linkedObjectIds={currentLinkedObjectIds}
    onLinked={handleObjectsLinked}
    onUnlinked={handleObjectsUnlinked}
/>
