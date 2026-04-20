<script>
    import ObjectResearchFields from "$lib/components/objects/ObjectResearchFields.svelte";
    import ObjectConnections from "$lib/components/objects/ObjectConnections.svelte";
    import ObjectLinkedMedia from "$lib/components/objects/ObjectLinkedMedia.svelte";
    import ObjectInstitutionalData from "$lib/components/objects/ObjectInstitutionalData.svelte";
    import ObjectBasicInfo from "$lib/components/objects/ObjectBasicInfo.svelte";
    import ObjectHeader from "$lib/components/objects/ObjectHeader.svelte";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { back } from "$lib/utils/navigation.js";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { createObject } from "$lib/stores/ObjectsUtils.js";
    import { getTemplatesByInstitution } from "$lib/stores/TemplatesUtils.js";
    import { queryParameters, ssp } from "sveltekit-search-params";
    import ManualDirtyGuard from "$lib/components/navigation/ManualDirtyGuard.svelte";
    import { watch } from "runed";
    import PageActionFooter from "$lib/components/common/PageActionFooter.svelte";
    import { createForm } from "@tanstack/svelte-form";
    import { z } from "zod";
    import { createFieldValidator } from "$lib/stores/formValidationUtils.js";
    import AutoForm from "$lib/components/form/AutoForm.svelte";

    const { data } = $props();
    const { t } = getTranslationStore();

    // Get project ID and languages from page params and parent data
    const projectId = $derived($page.params.project_id);
    const languages = $derived($page.data.languages || []);
    const defaultLanguageId = $derived.by(() => {
        const langs = languages || [];
        const def = langs.find((l) => l.is_default);
        return def?.id || langs[0]?.id || null;
    });

    // Institution selection
    let selectedInstitutionId = $state(null);
    const institutionItems = data.institutions || [];
    let templates = $state([]);

    // Read institution_id from query params using sveltekit-search-params
    const params = queryParameters({
        institution_id: ssp.string(undefined),
    });

    // Prefill selection if institution_id is present
    watch(
        () => params.institution_id,
        (qId) => {
            if (qId && !selectedInstitutionId) {
                selectedInstitutionId = qId;
            }
        }
    );

    // Load templates when institution changes
    watch(
        () => selectedInstitutionId,
        async (institutionId) => {
            if (institutionId) {
                const response = await getTemplatesByInstitution(institutionId);
                templates = response?.result || [];
            } else {
                templates = [];
            }
        }
    );

    function onInstitutionValueChange(val) {
        selectedInstitutionId = val;
    }

    const selectedInstitutionName = $derived.by(() => {
        const match = (institutionItems || []).find(
            (i) => String(i.value) === String(selectedInstitutionId)
        );
        return match?.label || "";
    });

    function backToInstitution() {
        if (selectedInstitutionId) {
            goto(`/projects/${projectId}/institutions/${selectedInstitutionId}`);
            return;
        }
        back();
    }

    // Object name input (default language only for now)
    let objectName = $state("");

    // Form setup for validation
    const nameSchema = z.object({
        name: z.string().min(1, t("objects.object_name_required", { fallback: "Object name is required" }))
    });

    const customValidator = {
        schema: nameSchema,
        requiredFields: new Set(["name"])
    };

    const form = createForm(() => ({
        defaultValues: {
            name: objectName
        },
        onSubmit: async () => {}, // Handled by saveAllChanges
        validators: {
            onChange: nameSchema
        }
    }));

    const formStore = form.useStore((state) => state);

    // Sync form name changes to local state
    watch(
        () => formStore?.current?.values?.name,
        (val) => {
            if (val !== undefined) {
                objectName = val;
            }
        }
    );

    // Centralized change management
    let componentChanges = $state(new Map());
    let isSaving = $state(false);

    // Derived state for overall changes
    const hasAnyChanges = $derived(
        !!objectName?.trim() ||
            Array.from(componentChanges.values()).some((comp) => comp.hasChanges)
    );

    let pristineVersion = $state(0);

    const dirtyValues = $derived.by(() => ({
        name: objectName?.trim() || "",
        institution: selectedInstitutionId || null,
        changedComponents: Array.from(componentChanges.values())
            .filter((comp) => comp?.component)
            .map((comp) => ({ component: comp.component, hasChanges: comp.hasChanges })),
    }));

    const dirtyMessage = $derived(t("form.unsaved-changes"));

    const rightActionButtons = $derived.by(() => [{
        id: "create-object",
        text: t("common.confirm", { fallback: "Confirm" }),
        class: "btn btn-success",
        disabled: !hasAnyChanges || isSaving || !selectedInstitutionId,
        disableOnError: true,
        onClick: saveAllChanges,
    }]);

    const leftActionButtons = $derived.by(() => [{
        id: "back-object-add",
        text: t("common.back", { fallback: "Back" }),
        class: "btn btn-outline-secondary",
        onClick: backToInstitution,
    }]);

    const resetDirtyState = () => {
        objectName = "";
        componentChanges.clear();
        componentChanges = new Map(componentChanges);
        pristineVersion += 1;
    };

    // Handle changes from child components
    function handleComponentChanges(changeData) {
        componentChanges.set(changeData.component, changeData);
        // Trigger reactivity
        componentChanges = new Map(componentChanges);
    }

    // Save all changes from all components
    async function saveAllChanges() {
        if (!hasAnyChanges || !selectedInstitutionId) return;

        isSaving = true;
        try {
            // 1. Create the object and get the new ID (include name if provided)
            const { result, error } = await createObject(
                projectId,
                selectedInstitutionId,
                "in progress",
                objectName?.trim() || undefined,
            );
            const newObjectId = result?.id;

            if (error || !newObjectId) {
                console.error(
                    "Error creating object:",
                    error || "New object ID not found",
                );
                // Optionally, show an error message to the user
                return;
            }

            // 2. Collect save functions from all components with changes
            const savePromises = [];
            for (const [componentName, componentData] of componentChanges) {
                if (componentData.hasChanges && componentData.saveFunction) {
                    // Pass the new objectId to the save function
                    savePromises.push(componentData.saveFunction(newObjectId));
                }
            }

            // 3. Execute all saves in parallel without blocking navigation
            const saveResults = await Promise.allSettled(savePromises);
            const failedSaves = saveResults.filter((r) => r.status === "rejected");
            if (failedSaves.length > 0) {
                console.error("Some object sub-sections failed to save:", failedSaves);
            }

            // 4. Clear local changes before navigating away
            resetDirtyState();

            // 5. Navigate to the new object's page
            await goto(
                `/projects/${projectId}/institutions/${selectedInstitutionId}/objects/${newObjectId}`,
            );
        } catch (error) {
            console.error("Error saving changes:", error);
        } finally {
            isSaving = false;
        }
    }
</script>

<PageActionFooter leftButtons={leftActionButtons} rightButtons={rightActionButtons} {formStore}>
    <ObjectHeader
        institutionName={selectedInstitutionName}
        title={t("menu.add-object", { fallback: "Add Object" })}
        status="in progress"
        statusDisabled={true}
        showStatus={false}
    />

    <!-- Research Fields and Linked Media Section -->
    <div class="container-fluid bg-white">
        <div class="row">
            <div class="col-10">
                <div class="mt-2 mb-3 px-2">
                    <ObjectBasicInfo
                        bind:objectName
                        bind:selectedInstitutionId
                        institutionItems={institutionItems}
                        onInstitutionValueChange={onInstitutionValueChange}
                    >
                           <AutoForm 
                              {form} 
                              validator={customValidator}
                              {createFieldValidator}
                              margin={0}
                              enableDirtyTracking={false}
                              uiSchema={{
                                name: { label: t("objects.object_name", { fallback: "Object name" }), placeholder: t("objects.object_name", { fallback: "Object name" }) }
                              }}
                           />
                    </ObjectBasicInfo>
                </div>
                <div class="mt-2 mb-3 px-2">
                    <ObjectLinkedMedia
                        {projectId}
                        institutionId={selectedInstitutionId}
                        onChangesUpdate={handleComponentChanges}
                    />
                </div>
                <div class="mt-2 mb-3 px-2">
                    <ObjectResearchFields
                        researchFields={data.researchFields}
                        {defaultLanguageId}
                        onChangesUpdate={handleComponentChanges}
                    />
                </div>
                <div class="mt-2 mb-3 px-2">
                    <ObjectConnections
                        researchFields={data.researchFields}
                        {defaultLanguageId}
                        onChangesUpdate={handleComponentChanges}
                    />
                </div>
                {#if selectedInstitutionId}
                    <div class="mt-2 mb-3 px-2">
                        <ObjectInstitutionalData
                            datasources={[]}
                            {templates}
                            ontologyFields={data.ontologyFields}
                            {projectId}
                            institutionId={selectedInstitutionId}
                            {defaultLanguageId}
                            {languages}
                            onChangesUpdate={handleComponentChanges}
                        />
                    </div>
                {/if}
            </div>
        </div>
    </div>
</PageActionFooter>

<ManualDirtyGuard
    values={dirtyValues}
    pristineKey={pristineVersion}
    enabled={hasAnyChanges}
    message={dirtyMessage}
/> 
