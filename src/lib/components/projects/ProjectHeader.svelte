<script>
  import { page as pageData } from "$app/state";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import { updateProject, getProject, getProjectLanguages } from "$lib/api/ProjectsApi.js";
  import { goto } from "$app/navigation";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let project = $derived(pageData.data.project);

  const { t } = getTranslationStore();

  let projectLanguages = $state([]);
  let isLoading = $state(false);
  let editTitle = $state({});
  let editDescription = $state({});
  let showModal = $state(false);
  let activeLanguageCode = $state(null);

  const extractProjectIds = (projectData) => ({
    titleId: projectData.title_id || projectData.title?.id || projectData.result?.title?.id || null,
    descriptionId: projectData.description_id || projectData.description?.id || projectData.result?.description?.id || null,
  });

  const getExistingTranslationId = (fieldName, langCode) => {
    if (!project?.[fieldName]?.translations) return null;
    let translations = project[fieldName].translations;
    if (typeof translations === "string") {
      try { translations = JSON.parse(translations); } catch { translations = []; }
    }
    return translations.filter((tr) => tr?.language?.code).find((tr) => tr.language.code === langCode)?.id ?? null;
  };

  async function prepareEditModal() {
    isLoading = true;
    try {
      projectLanguages = await getProjectLanguages(project.id);
      editTitle = {};
      editDescription = {};

      const currentProject = await getProject(project.id);
      const { titleId, descriptionId } = extractProjectIds(currentProject);
      project.title_id = titleId;
      project.description_id = descriptionId;

      for (const lang of projectLanguages) {
        const isDefault = lang.is_default;
        editTitle[lang.code] = isDefault
          ? currentProject.title?.content || ""
          : currentProject.title.translations?.find((tr) => tr.language?.code === lang.code)?.content || "";
        editDescription[lang.code] = isDefault
          ? currentProject.description?.content || ""
          : currentProject.description.translations?.find((tr) => tr.language?.code === lang.code)?.content || "";
        if (isDefault) activeLanguageCode = lang.code;
      }

      showModal = true;
    } catch (error) {
      console.error("Failed to prepare edit modal:", error);
    } finally {
      isLoading = false;
    }
  }

  function closeModal() {
    showModal = false;
  }

  async function saveChanges() {
    isLoading = true;
    try {
      const defaultLang = projectLanguages.find((lang) => lang.is_default);
      if (!defaultLang) throw new Error("No default language found for project");

      const titleTranslations = [];
      const descriptionTranslations = [];

      for (const lang of projectLanguages.filter((l) => !l.is_default)) {
        const titleVal = editTitle[lang.code]?.trim() || "";
        const descVal = editDescription[lang.code]?.trim() || "";
        const titleExistingId = getExistingTranslationId("title", lang.code);
        const descExistingId = getExistingTranslationId("description", lang.code);

        if (titleVal || titleExistingId) titleTranslations.push({ id: titleExistingId, language_code: lang.code, content: titleVal || null });
        if (descVal || descExistingId) descriptionTranslations.push({ id: descExistingId, language_code: lang.code, content: descVal || null });
      }

      const { error } = await updateProject(project.id, {
        title: { content: editTitle[defaultLang.code] },
        description: { content: editDescription[defaultLang.code] },
        titleTranslations: titleTranslations.filter((tr) => tr.content !== undefined),
        descriptionTranslations: descriptionTranslations.filter((tr) => tr.content !== undefined),
      });

      if (error) {
        console.error("Error updating project:", error);
      } else {
        closeModal();
      }
    } catch (error) {
      console.error("Failed to save project changes:", error);
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="d-flex align-items-center justify-content-between px-3 py-2 mb-4 mt-2">
  <div class="d-flex align-items-center gap-2">
    <BaseButton
      icon="pencil-square"
      onClick={prepareEditModal}
      class="btn btn-sm btn-link text-dark p-0 text-decoration-none"
      text=""
      title={t("projects.edit-project", { fallback: "Edit project" })}
    />
    <h6 class="m-0">
      <a class="text-decoration-none text-dark" href="/projects/{project.id}">
        {project.title?.content || "Connecting..."}
      </a>
    </h6>
  </div>

  <div class="d-flex gap-1">
    <BaseButton
      class="btn btn-sm btn-dark"
      icon="table"
      text={t("common.data-structure", { fallback: "Data Structure" })}
      onClick={() => goto(`/projects/${project.id}/data-structure`)}
    />
  </div>
</div>

{#if showModal}
  {#snippet modalHeader()}
    {t("projects.edit-modal.title", { fallback: "Edit Project Details" })}
  {/snippet}

  {#snippet modalBody()}
    {#if isLoading}
      <div class="d-flex justify-content-center py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">{t("common.loading", { fallback: "Loading..." })}</span>
        </div>
      </div>
    {:else if projectLanguages.length}
      <ul class="nav nav-tabs mb-3">
        {#each projectLanguages as lang}
          <li class="nav-item">
            <button
              class="nav-link"
              class:active={activeLanguageCode === lang.code}
              onclick={() => activeLanguageCode = lang.code}
            >
              {lang.name || lang.code}
              {#if lang.is_default}
                <span class="badge bg-primary ms-1">{t("common.default", { fallback: "Default" })}</span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>

      {#each projectLanguages as lang}
        {#if activeLanguageCode === lang.code}
          <div class="mb-3">
            <label for="title-{lang.code}" class="form-label">
              {t("projects.edit-modal.title-label", { fallback: "Title" })}
            </label>
            <input
              type="text"
              class="form-control"
              id="title-{lang.code}"
              bind:value={editTitle[lang.code]}
              placeholder={t("projects.edit-modal.title-placeholder", { fallback: "Project title" })}
              required={lang.is_default}
            />
          </div>
          <div class="mb-3">
            <label for="description-{lang.code}" class="form-label">
              {t("projects.edit-modal.description-label", { fallback: "Description" })}
            </label>
            <textarea
              class="form-control"
              id="description-{lang.code}"
              bind:value={editDescription[lang.code]}
              rows="3"
              placeholder={t("projects.edit-modal.description-placeholder", { fallback: "Project description" })}
              required={lang.is_default}
            ></textarea>
          </div>
        {/if}
      {/each}
    {/if}
  {/snippet}

  {#snippet modalActions()}
    <div class="d-flex justify-content-end gap-2">
      <BaseButton
        text={t("common.cancel", { fallback: "Cancel" })}
        onClick={closeModal}
        class="btn btn-secondary"
      />
      <BaseButton
        text={isLoading ? t("common.saving", { fallback: "Saving..." }) : t("common.save-changes", { fallback: "Save Changes" })}
        onClick={saveChanges}
        class="btn btn-primary"
        disabled={isLoading}
      />
    </div>
  {/snippet}

  <BaseModal bind:isOpen={showModal} size="lg" header={modalHeader} body={modalBody} actions={modalActions} />
{/if}
