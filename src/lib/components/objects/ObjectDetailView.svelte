<script>
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { watch } from "runed";
  import { createForm } from "@tanstack/svelte-form";
  import { z } from "zod";
  import { createFieldValidator } from "$lib/utils/formValidation.js";
  import { updateObjectInstitution, deleteObject, updateObjectStatus, updateObjectName } from "$lib/api/ObjectsApi.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import ObjectResearchFields from "$lib/components/objects/ObjectResearchFields.svelte";
  import ObjectConnections from "$lib/components/objects/ObjectConnections.svelte";
  import ObjectLinkedMedia from "$lib/components/objects/ObjectLinkedMedia.svelte";
  import ObjectInstitutionalData from "$lib/components/objects/ObjectInstitutionalData.svelte";
  import ObjectBasicInfo from "$lib/components/objects/ObjectBasicInfo.svelte";
  import ObjectHeader from "$lib/components/objects/ObjectHeader.svelte";
  import ObjectDeleteModal from "$lib/components/objects/ObjectDeleteModal.svelte";
  import ManualDirtyGuard from "$lib/components/navigation/ManualDirtyGuard.svelte";
  import PageActionFooter from "$lib/components/common/PageActionFooter.svelte";
  import AutoForm from "$lib/components/form/AutoForm.svelte";

  let { object, institution, researchFields, institutions, datasources, templates, ontologyFields } = $props();

  const { t } = getTranslationStore();

  const projectId = $derived(page.params.project_id);
  const currentInstitutionIdParam = $derived(page.params.institution_id);
  const languages = $derived(page.data.languages || []);
  const listQuery = $derived(page.url.search || "");
  const defaultLanguageId = $derived.by(() => {
    const langs = languages || [];
    const def = langs.find((l) => l.is_default);
    return def?.id || langs[0]?.id || null;
  });

  const objectId = $derived.by(() => {
    return (
      object.objectsOntologyFields?.find((f) => f.primary)?.value ||
      "Identifier not set"
    );
  });

  // Centralized change management
  let componentChanges = $state(new Map());
  let isSaving = $state(false);

  // Form setup for name validation
  const nameSchema = z.object({
    name: z.string().min(1, t("objects.object_name_required", { fallback: "Object name is required" }))
  });

  const customValidator = {
    schema: nameSchema,
    requiredFields: new Set(["name"])
  };

  const form = createForm(() => ({
    defaultValues: {
      name: object.name || ""
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
  let objectName = $state(object.name || "");
  let nameHasChanges = false;

  // Sync name from remote data changes (e.g. P2P invalidation)
  watch(
    () => object.name,
    (newName) => {
      if (!nameHasChanges) {
        objectName = newName || "";
        form.setFieldValue("name", objectName);
      }
    }
  );

  function handleNameInput(event) {
    const val = event?.target?.value ?? "";
    onNameValueChange(val);
  }

  function onNameValueChange(val) {
    objectName = val ?? "";
    nameHasChanges = (objectName?.trim() || "") !== (object.name?.trim() || "");
    setComponentChange("name", nameHasChanges, saveNameChange);
  }

  async function saveNameChange() {
    if (!nameHasChanges) return;
    const res = await updateObjectName(object.id, objectName ?? "");
    logAndThrowIfError(res, "Failed to update object name:");
    object.name = objectName ?? "";
    nameHasChanges = false;
    setComponentChange("name", false, saveNameChange);
  }

  // Institution selection
  let selectedInstitutionId = $state(object.institution_id || null);
  let institutionHasChanges = false;

  // Sync institution from remote data changes (e.g. P2P invalidation)
  watch(
    () => object.institution_id,
    (newId) => {
      if (!institutionHasChanges) {
        selectedInstitutionId = newId || null;
      }
    }
  );

  function onInstitutionValueChange(val) {
    selectedInstitutionId = val;
    institutionHasChanges = selectedInstitutionId !== (object.institution_id || null);
    setComponentChange("institution", institutionHasChanges, saveInstitutionChange);
  }

  async function saveInstitutionChange() {
    if (!institutionHasChanges || !selectedInstitutionId) return;
    const res = await updateObjectInstitution(object.id, selectedInstitutionId);
    logAndThrowIfError(res, "Failed to update object institution:");
    object.institution_id = selectedInstitutionId;
    institutionHasChanges = false;
    setComponentChange("institution", false, saveInstitutionChange);
  }

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

  const markPageClean = () => {
    componentChanges.clear();
    syncComponentChanges();
    nameHasChanges = false;
    institutionHasChanges = false;
    objectName = object.name || "";
    selectedInstitutionId = object.institution_id || null;
    pristineVersion += 1;
  };

  function handleComponentChanges(changeData) {
    const previousChange = componentChanges.get(changeData.component);
    if (previousChange?.hasChanges === changeData.hasChanges) {
      return;
    }
    componentChanges.set(changeData.component, changeData);
    syncComponentChanges();
  }

  async function saveAllChanges() {
    if (!hasAnyChanges) return;

    // Capture redirect need before saving (save resets flags)
    const nextInstitutionId = selectedInstitutionId;
    const redirectNeeded =
      institutionHasChanges &&
      nextInstitutionId &&
      nextInstitutionId !== currentInstitutionIdParam;

    isSaving = true;
    try {
      const savePromises = [];
      for (const componentData of componentChanges.values()) {
        if (componentData.hasChanges && componentData.saveFunction) {
          savePromises.push(componentData.saveFunction());
        }
      }
      await Promise.all(savePromises);

      if (redirectNeeded) {
        markPageClean();
        goto(`/projects/${projectId}/institutions/${nextInstitutionId}/objects/${object.id}`);
        return;
      }

      markPageClean();
    } catch (error) {
      console.error("Error saving changes:", error);
    } finally {
      isSaving = false;
    }
  }

  // Delete object
  let showDeleteModal = $state(false);
  let isDeleting = $state(false);

  async function confirmDeleteObject() {
    if (!object?.id) {
      showDeleteModal = false;
      return;
    }
    isDeleting = true;
    try {
      const res = await deleteObject(object.id);
      if (res?.error) {
        console.error("Failed to delete object:", res.error);
      } else {
        markPageClean();
        window.history.back();
      }
    } catch (err) {
      console.error("Error deleting object:", err);
    } finally {
      isDeleting = false;
      showDeleteModal = false;
    }
  }

  // Status update
  let statusUpdating = $state(false);

  async function setStatus(nextStatus) {
    if (!object?.id || statusUpdating) return;
    statusUpdating = true;
    try {
      const res = await updateObjectStatus(object.id, nextStatus);
      if (res?.error) {
        console.error("Failed to update object status:", res.error);
      } else {
        object.status = nextStatus;
      }
    } catch (err) {
      console.error("Error updating status:", err);
    } finally {
      statusUpdating = false;
    }
  }

  const displayTitle = $derived.by(() => {
    const n = object.name?.trim();
    return n && n.length ? n : objectId;
  });

  const leftActionButtons = $derived([
    {
      id: "delete-object",
      text: t("common.delete", { fallback: "Delete object" }),
      class: "btn btn-outline-danger",
      icon: "trash",
      disabled: isSaving,
      onClick: () => { showDeleteModal = true; },
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
    {projectId}
    institutionId={currentInstitutionIdParam}
    institutionName={institution.name.content}
    title={displayTitle}
    status={object.status}
    statusDisabled={statusUpdating}
    onStatusChange={setStatus}
  />

  <div class="container-fluid">
    <div class="row">
      <div class="col-9 mb-4">
        <div class="mt-2 mb-3 px-2">
          <ObjectBasicInfo
            bind:objectName
            {selectedInstitutionId}
            institutionItems={institutions || []}
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
          <ObjectLinkedMedia {object} onChangesUpdate={handleComponentChanges} />
        </div>
        <div class="mt-2 mb-3 px-2">
          <ObjectResearchFields
            {object}
            {researchFields}
            {defaultLanguageId}
            onChangesUpdate={handleComponentChanges}
          />
        </div>
        <div class="mt-2 mb-3 px-2">
          <ObjectConnections
            {object}
            {researchFields}
            {defaultLanguageId}
            onChangesUpdate={handleComponentChanges}
          />
        </div>
        <div class="mt-2 mb-3 px-2 pb-4">
          <ObjectInstitutionalData
            {object}
            {datasources}
            {templates}
            {ontologyFields}
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
  onCancel={() => { showDeleteModal = false; }}
  onConfirm={confirmDeleteObject}
/>

<ManualDirtyGuard
  values={dirtyValues}
  pristineKey={pristineVersion}
  enabled={hasAnyChanges}
  message={t("form.unsaved-changes")}
/>
