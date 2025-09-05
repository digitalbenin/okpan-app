<script>
  import BaseBadgeStatus from "$lib/components/base/BaseBadgeStatus.svelte";
  import ObjectResearchFields from "$lib/components/objects/ObjectResearchFields.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { back } from "$lib/utils/navigation.js";
  import { page } from "$app/stores";

  const { data } = $props();
  const { t } = getTranslationStore();
  $inspect(data.object);

  // Get project ID and languages from page params and parent data
  const projectId = $derived($page.params.project_id);
  const languages = $derived($page.data.languages || []);

  const objectId = $derived.by(() => {
    return (
      data.object.objectsOntologyFields?.find((f) => f.primary)?.value ||
      "Identifier not set"
    );
  });

  // Centralized change management
  let componentChanges = $state(new Map());
  let isSaving = $state(false);

  // Derived state for overall changes
  const hasAnyChanges = $derived(
    Array.from(componentChanges.values()).some((comp) => comp.hasChanges),
  );

  // Handle changes from child components
  function handleComponentChanges(changeData) {
    componentChanges.set(changeData.component, changeData);
    // Trigger reactivity
    componentChanges = new Map(componentChanges);
  }

  // Save all changes from all components
  async function saveAllChanges() {
    if (!hasAnyChanges) return;

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

      // Clear component changes
      componentChanges.clear();
      componentChanges = new Map(componentChanges);
    } catch (error) {
      console.error("Error saving changes:", error);
    } finally {
      isSaving = false;
    }
  }
</script>

<div class="d-flex flex-column min-vh-100">
  <div class="flex-grow-1">
    <div class="container-fluid pb-4">
      <div class="row mb-2">
        <div class="col-12">
          <div class="d-flex align-items-start gap-3 mt-3">
            <div>
              <button
                class="btn btn-lg btn-light rounded-circle aspect-ratio-1x1"
                aria-label="back"
                onclick={back}><i class="bi bi-arrow-left"></i></button
              >
            </div>
            <div>
              <div class="text-black-50">{data.institution.name.content}</div>
              <h1>
                {objectId}
                <span class="badgeWrapper fs-6">
                  <BaseBadgeStatus status={data.object.status} />
                </span>
              </h1>
            </div>

            <div class="ms-auto">
              <i class="bi bi-three-dots-vertical"></i>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Research Fields Section -->
    <div class="container-fluid">
      <div class="row">
        <div class="col-12">
          <ObjectResearchFields
            object={data.object}
            researchFields={data.researchFields}
            {languages}
            {projectId}
            onChangesUpdate={handleComponentChanges}
          />
        </div>
      </div>
    </div>
  </div>

  <!-- Sticky bottom bar for saving all changes -->
  <div
    class="position-sticky bottom-0 bg-white border-top p-3 mt-auto"
    style="z-index: 10;"
  >
    <div class="container-fluid">
      <div class="row">
        <div class="col-12 d-flex justify-content-end gap-2">
          <BaseButton
            type="button"
            class="btn btn-sm btn-success"
            text={t("common.confirm", { fallback: "Confirm" })}
            disabled={!hasAnyChanges || isSaving}
            onClick={saveAllChanges}
          />
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .badgeWrapper {
    font-family: var(--bs-body-font-family) !important;
    vertical-align: text-top;
  }
</style>
