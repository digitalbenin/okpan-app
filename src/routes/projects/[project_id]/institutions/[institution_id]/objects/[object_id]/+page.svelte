<script>
  import ObjectResearchFields from "$lib/components/objects/ObjectResearchFields.svelte";
  import ObjectConnections from "$lib/components/objects/ObjectConnections.svelte";
  import ObjectLinkedMedia from "$lib/components/objects/ObjectLinkedMedia.svelte";
  import ObjectInstitutionalData from "$lib/components/objects/ObjectInstitutionalData.svelte";
  import ObjectBasicInfo from "$lib/components/objects/ObjectBasicInfo.svelte";
  import ObjectHeader from "$lib/components/objects/ObjectHeader.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { back } from "$lib/utils/navigation.js";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import {
    updateObjectInstitution,
    deleteObject,
  } from "$lib/stores/ObjectsUtils.js";
  import {
    updateObjectStatus,
    updateObjectName,
  } from "$lib/stores/ObjectsUtils.js";
  import ManualDirtyGuard from "$lib/components/navigation/ManualDirtyGuard.svelte";
  import PageActionFooter from "$lib/components/common/PageActionFooter.svelte";

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
    componentChanges.set("name", {
      component: "name",
      hasChanges: nameHasChanges,
      saveFunction: saveNameChange,
    });
    componentChanges = new Map(componentChanges);
  }

  async function saveNameChange() {
    if (!nameHasChanges) return;
    const res = await updateObjectName(data.object.id, objectName ?? "");
    if (res?.error) {
      console.error("Failed to update object name:", res.error);
      throw res.error;
    }
    // Reflect saved value locally and reset change state
    data.object.name = objectName ?? "";
    nameHasChanges = false;
    componentChanges.set("name", {
      component: "name",
      hasChanges: false,
      saveFunction: saveNameChange,
    });
    componentChanges = new Map(componentChanges);
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
    componentChanges.set("institution", {
      component: "institution",
      hasChanges: institutionHasChanges,
      saveFunction: saveInstitutionChange,
    });
    // Trigger reactivity for Map consumers
    componentChanges = new Map(componentChanges);
  }

  async function saveInstitutionChange() {
    if (!institutionHasChanges || !selectedInstitutionId) return;
    const res = await updateObjectInstitution(
      data.object.id,
      selectedInstitutionId,
    );
    if (res?.error) {
      console.error("Failed to update object institution:", res.error);
      throw res.error;
    }
    // Reflect saved value locally and reset change state
    data.object.institution_id = selectedInstitutionId;
    institutionHasChanges = false;
    componentChanges.set("institution", {
      component: "institution",
      hasChanges: false,
      saveFunction: saveInstitutionChange,
    });
    componentChanges = new Map(componentChanges);
  }

  // Centralized change management
  let componentChanges = $state(new Map());
  let isSaving = $state(false);

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
    componentChanges = new Map(componentChanges);
    nameHasChanges = false;
    institutionHasChanges = false;
    objectName = data.object.name || "";
    selectedInstitutionId = data.object.institution_id || null;
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
      for (const [componentName, componentData] of componentChanges) {
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
      onClick: saveAllChanges,
    },
  ]);
</script>
<PageActionFooter
  leftButtons={leftActionButtons}
  rightButtons={rightActionButtons}
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
      <div class="col-10">
        <div class="mt-2 mb-3 px-2">
          <ObjectBasicInfo
            bind:objectName
            {selectedInstitutionId}
            institutionItems={institutionItems}
            onNameInput={handleNameInput}
            onInstitutionValueChange={onInstitutionValueChange}
          />
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
            onChangesUpdate={handleComponentChanges}
          />
        </div>
      </div>
    </div>
  </div>
</PageActionFooter>

  <!-- Delete Confirmation Modal -->
  {#snippet header()}
    {t("common.confirm-delete", { fallback: "Confirm Deletion" })}
  {/snippet}

  {#snippet body()}
    <p>
      {t("common.confirm-delete-object", {
        fallback:
          "Are you sure you want to delete this object? This action cannot be undone.",
      })}
    </p>
  {/snippet}

  {#snippet actions()}
    <div class="d-flex justify-content-end gap-2">
      <BaseButton
        type="button"
        class="btn btn-secondary btn-sm"
        text={t("common.cancel", { fallback: "cancel" })}
        onClick={cancelDelete}
        disabled={isDeleting}
      />
      <BaseButton
        type="button"
        class="btn btn-danger btn-sm"
        text={isDeleting
          ? t("common.deleting", { fallback: "Deleting..." })
          : t("common.confirm-and-delete", { fallback: "Confirm and delete" })}
        onClick={confirmDeleteObject}
        disabled={isDeleting}
      />
    </div>
  {/snippet}

  {#if showDeleteModal}
    <BaseModal
      bind:isOpen={showDeleteModal}
      size="md"
      {header}
      {body}
      {actions}
    />
  {/if}

<ManualDirtyGuard
  values={dirtyValues}
  pristineKey={pristineVersion}
  enabled={hasAnyChanges}
  message={dirtyMessage}
/>
