<script>
  import ObjectResearchFields from "$lib/components/objects/ObjectResearchFields.svelte";
  import ObjectConnections from "$lib/components/objects/ObjectConnections.svelte";
  import ObjectLinkedMedia from "$lib/components/objects/ObjectLinkedMedia.svelte";
  import ObjectInstitutionalData from "$lib/components/objects/ObjectInstitutionalData.svelte";
  import ObjectBasicInfo from "$lib/components/objects/ObjectBasicInfo.svelte";
  import ObjectHeader from "$lib/components/objects/ObjectHeader.svelte";
  import ObjectDeleteModal from "$lib/components/objects/ObjectDeleteModal.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { back } from "$lib/utils/navigation.js";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { updateObjectInstitution, deleteObject, updateObjectStatus, updateObjectName } from "$lib/stores/ObjectsUtils.js";
  import ManualDirtyGuard from "$lib/components/navigation/ManualDirtyGuard.svelte";
  import PageActionFooter from "$lib/components/common/PageActionFooter.svelte";
  import { createForm } from "@tanstack/svelte-form";
  import { z } from "zod";
  import { getFormConfig, createFieldValidator } from "$lib/stores/formValidationUtils.js";
  import AutoForm from "$lib/components/form/AutoForm.svelte";
  import { watch } from "runed";

  const { data } = $props();
  const { t } = getTranslationStore();

  // Get project ID and languages from page params and parent data
  const projectId = $derived($page.params.project_id);
  const currentInstitutionIdParam = $derived($page.params.institution_id);
  const languages = $derived($page.data.languages || []);
  const defaultLanguageId = $derived.by(() => {
    const langs = languages || [];
    const def = langs.find((l) => l.is_default);
    return def?.id || langs[0]?.id || null;
  });

  const objectId = $derived.by(() => {
    return (
      data.object.objectsOntologyFields?.find((f) => f.primary)?.value ||
      "Identifier not set"
    );
  });

  // Centralized change management
  let componentChanges = $state(new Map());
  let isSaving = $state(false);

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
      name: data.object.name || ""
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
      if (val !== undefined && val !== objectName) {
        onNameValueChange(val);
      }
    }
  );

  const syncComponentChanges = () => {
    componentChanges = new Map(componentChanges);
  };

  const setComponentChange = (component, hasChanges, saveFunction) => {
    componentChanges.set(component, { component, hasChanges, saveFunction });
    syncComponentChanges();
  };

  const logAndThrowIfError = (res, message) => {
    if (res?.error) {
      console.error(message, res.error);
      throw res.error;
    }
  };

  // Name field state and change tracking
  let objectName = $state(data.object.name || "");
  let nameHasChanges = false;
  function handleNameInput(event) {
    const val = event?.target?.value ?? "";
    onNameValueChange(val);
  }
  function onNameValueChange(val) {
    objectName = val ?? "";
    nameHasChanges =
      (objectName?.trim() || "") !== (data.object.name?.trim() || "");
    setComponentChange("name", nameHasChanges, saveNameChange);
  }

  async function saveNameChange() {
    if (!nameHasChanges) return;
    const res = await updateObjectName(data.object.id, objectName ?? "");
    logAndThrowIfError(res, "Failed to update object name:");
    // Reflect saved value locally and reset change state
    data.object.name = objectName ?? "";
    nameHasChanges = false;
    setComponentChange("name", false, saveNameChange);
  }

  // Institution selection (event-driven, no runes)
  let selectedInstitutionId = $state(data.object.institution_id || null);
  let institutionHasChanges = false;
  const institutionItems = data.institutions || [];

  function onInstitutionValueChange(val) {
    selectedInstitutionId = val;
    institutionHasChanges =
      selectedInstitutionId !== (data.object.institution_id || null);

    // Register/update change entry for institution
    setComponentChange("institution", institutionHasChanges, saveInstitutionChange);
  }

  async function saveInstitutionChange() {
    if (!institutionHasChanges || !selectedInstitutionId) return;
    const res = await updateObjectInstitution(
      data.object.id,
      selectedInstitutionId,
    );
    logAndThrowIfError(res, "Failed to update object institution:");
    // Reflect saved value locally and reset change state
    data.object.institution_id = selectedInstitutionId;
    institutionHasChanges = false;
    setComponentChange("institution", false, saveInstitutionChange);
  }

  // Derived state for overall changes
  const hasAnyChanges = $derived(
    Array.from(componentChanges.values()).some((comp) => comp.hasChanges),
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

  const markPageClean = () => {
    componentChanges.clear();
    syncComponentChanges();
    nameHasChanges = false;
    institutionHasChanges = false;
    objectName = data.object.name || "";
    selectedInstitutionId = data.object.institution_id || null;
    pristineVersion += 1;
  };

  // Handle changes from child components
  function handleComponentChanges(changeData) {
    componentChanges.set(changeData.component, changeData);
    syncComponentChanges();
  }

  // Save all changes from all components
  async function saveAllChanges() {
    if (!hasAnyChanges) return;

    // Capture redirect need prior to saving (because save resets flags)
    const nextInstitutionId = selectedInstitutionId;
    const redirectNeeded =
      institutionHasChanges &&
      nextInstitutionId &&
      nextInstitutionId !== currentInstitutionIdParam;

    isSaving = true;
    try {
      const savePromises = [];

      // Collect save functions from all components with changes
      for (const componentData of componentChanges.values()) {
        if (componentData.hasChanges && componentData.saveFunction) {
          savePromises.push(componentData.saveFunction());
        }
      }

      // Execute all saves in parallel
      await Promise.all(savePromises);

      if (redirectNeeded) {
        markPageClean();
        const newUrl = `/projects/${projectId}/institutions/${nextInstitutionId}/objects/${data.object.id}`;
        goto(newUrl);
        return;
      }

      // Clear dirty state before staying on current object
      markPageClean();
    } catch (error) {
      console.error("Error saving changes:", error);
    } finally {
      isSaving = false;
    }
  }

  // Delete object modal state and handlers
  let showDeleteModal = $state(false);
  let isDeleting = $state(false);

  function openDeleteModal() {
    showDeleteModal = true;
  }

  function cancelDelete() {
    showDeleteModal = false;
  }

  async function confirmDeleteObject() {
    if (!data?.object?.id) {
      showDeleteModal = false;
      return;
    }

    isDeleting = true;
    try {
      const res = await deleteObject(data.object.id);
      if (res?.error) {
        console.error("Failed to delete object:", res.error);
      } else {
        markPageClean();
        // Navigate back to the previous page
        back();
      }
    } catch (err) {
      console.error("Error deleting object:", err);
    } finally {
      isDeleting = false;
      showDeleteModal = false;
    }
  }

  // --- Status Dropdown (object detail header) ---
  let statusUpdating = $state(false);

  async function setStatus(nextStatus) {
    if (!data?.object?.id) return;
    if (statusUpdating) return;
    statusUpdating = true;
    try {
      const res = await updateObjectStatus(data.object.id, nextStatus);
      if (res?.error) {
        console.error("Failed to update object status:", res.error);
      } else {
        // reflect locally and trigger reactivity
        data.object = { ...data.object, status: nextStatus };
      }
    } catch (err) {
      console.error("Error updating status:", err);
    } finally {
      statusUpdating = false;
    }
  }

  // Display title: prefer name, fallback to primary ID
  const displayTitle = $derived.by(() => {
    const n = data.object.name?.trim();
    return n && n.length ? n : objectId;
  });

  const leftActionButtons = $derived([
    {
      id: "delete-object",
      text: t("common.delete", { fallback: "Delete object" }),
      class: "btn btn-outline-danger",
      icon: "trash",
      disabled: isSaving,
      onClick: openDeleteModal,
    },
  ]);

  const rightActionButtons = $derived([
    {
      id: "save-object",
      text: t("common.confirm", { fallback: "Confirm" }),
      class: "btn btn-success",
      disabled: !hasAnyChanges || isSaving,
      disableOnError: true,
      onClick: saveAllChanges,
    },
  ]);
</script>
<PageActionFooter
  leftButtons={leftActionButtons}
  rightButtons={rightActionButtons}
  {formStore}
>
  <ObjectHeader
    institutionName={data.institution.name.content}
    title={displayTitle}
    status={data.object.status}
    statusDisabled={statusUpdating}
    onBack={() => goto(`/projects/${projectId}/institutions/${currentInstitutionIdParam}`)}
    onStatusChange={setStatus}
  />

  <!-- Research Fields and Linked Media Section -->
  <div class="container-fluid bg-light">
    <div class="row">
      <div class="col-9">
        <div class="mt-2 mb-3 px-2">
          <ObjectBasicInfo
            bind:objectName
            {selectedInstitutionId}
            institutionItems={institutionItems}
            onNameInput={handleNameInput}
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
            object={data.object}
            onChangesUpdate={handleComponentChanges}
          />
        </div>
        <div class="mt-2 mb-3 px-2">
          <ObjectResearchFields
            object={data.object}
            researchFields={data.researchFields}
            {defaultLanguageId}
            onChangesUpdate={handleComponentChanges}
          />
        </div>
        <div class="mt-2 mb-3 px-2">
          <ObjectConnections
            object={data.object}
            researchFields={data.researchFields}
            {defaultLanguageId}
            onChangesUpdate={handleComponentChanges}
          />
        </div>
        <div class="mt-2 mb-3 px-2">
          <ObjectInstitutionalData
            object={data.object}
            datasources={data.datasources}
            templates={data.templates}
            ontologyFields={data.ontologyFields}
            {projectId}
            institutionId={currentInstitutionIdParam}
            {defaultLanguageId}
            {languages}
            onChangesUpdate={handleComponentChanges}
          />
        </div>
      </div>
    </div>
  </div>
</PageActionFooter>

<ObjectDeleteModal
  bind:isOpen={showDeleteModal}
  {isDeleting}
  onCancel={cancelDelete}
  onConfirm={confirmDeleteObject}
/>

<ManualDirtyGuard
  values={dirtyValues}
  pristineKey={pristineVersion}
  enabled={hasAnyChanges}
  message={dirtyMessage}
/>
