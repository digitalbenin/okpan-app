<script>
    import ObjectResearchFields from "$lib/components/objects/ObjectResearchFields.svelte";
    import ObjectLinkedMedia from "$lib/components/objects/ObjectLinkedMedia.svelte";
    import BaseInput from "$lib/components/base/BaseInput.svelte";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { back } from "$lib/utils/navigation.js";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import BaseSelectNew from "$lib/components/base/BaseSelectNew.svelte";
    import { createObject } from "$lib/stores/ObjectsUtils.js";
    import { queryParameters, ssp } from "sveltekit-search-params";
    import ManualDirtyGuard from "$lib/components/navigation/ManualDirtyGuard.svelte";
    import { watch } from "runed";
    import PageActionFooter from "$lib/components/common/PageActionFooter.svelte";

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

    function onInstitutionValueChange(val) {
        selectedInstitutionId = val;
    }

    // Object name input (default language only for now)
    let objectName = $state("");

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

    const dirtyMessage = $derived(
        t("form.unsaved-changes", {
            fallback:
                "You have unsaved changes. Are you sure you want to leave without saving?",
        })
    );

    const rightActionButtons = $derived.by(() => [{
        id: "create-object",
        text: t("common.confirm", { fallback: "Confirm" }),
        class: "btn btn-success",
        disabled: !hasAnyChanges || isSaving || !selectedInstitutionId,
        onClick: saveAllChanges,
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

            // 3. Execute all saves in parallel
            await Promise.all(savePromises);

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

<PageActionFooter rightButtons={rightActionButtons}>
    <div class="container-fluid pb-4">
        <div class="row mb-2">
            <div class="col-12">
                <div class="d-flex align-items-start gap-3 mt-3">
                    <div>
                        <button
                            class="btn btn-lg btn-light rounded-circle aspect-ratio-1x1"
                            aria-label="back"
                            onclick={back}
                            ><i class="bi bi-arrow-left"></i></button
                        >
                    </div>
                    <div>
                        <h1>
                            {t("objects.add_object", {
                                fallback: "Add Object",
                            })}
                        </h1>
                    </div>

                    <div class="ms-auto">
                        <i class="bi bi-three-dots-vertical"></i>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Research Fields and Linked Media Section -->
    <div class="container-fluid">
        <div class="row">
            <div class="col-8">
                <!-- Name: first field before institution -->
                <div class="mt-2 mb-2 px-2" style="max-width: 420px;">
                    <p class="fw-semibold mb-2">
                        {t("common.name", {
                            fallback: "Name",
                        })}
                    </p>
                    <BaseInput
                        placeholder={t("common.name", { fallback: "Name" })}
                        size="sm"
                        bind:value={objectName}
                    />
                </div>
                <!-- Institution selector: after primary id, before research data -->
                <div class="mt-2 mb-4 px-2" style="max-width: 420px;">
                    <h3 class="">
                        {t("institutions.institution", {
                            fallback: "Institution",
                        })}
                    </h3>
                    <BaseSelectNew
                        placeholder={t("institutions.select_institution", {
                            fallback: "Select institution",
                        })}
                        items={institutionItems}
                        value={selectedInstitutionId}
                        onValueChange={onInstitutionValueChange}
                        type="single"
                        size="sm"
                        inputClass="w-100"
                        contentProps={{ width: "anchor" }}
                    />
                </div>
                <ObjectResearchFields
                    researchFields={data.researchFields}
                    {defaultLanguageId}
                    onChangesUpdate={handleComponentChanges}
                />
                <!--<ObjectOntologyFields />-->
            </div>
            <div class="col-4">
                <ObjectLinkedMedia
                    {projectId}
                    institutionId={selectedInstitutionId}
                    onChangesUpdate={handleComponentChanges}
                />
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
