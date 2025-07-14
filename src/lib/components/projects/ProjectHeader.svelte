<script>
  import { page as pageData } from "$app/state";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import {
    updateProject,
    getProject,
    getProjectLanguages,
  } from "$lib/stores/ProjectsUtils.js";
  import { Tabs } from "melt/builders";
  import { goto } from "$app/navigation";

  let project = $derived(pageData.data.project);

  // State for project editing
  let projectLanguages = $state([]);
  let isLoading = $state(false);
  let editTitle = $state({});
  let editDescription = $state({});
  let showModal = $state(false);
  let activeLanguageCode = $state(null);

  // Initialize Melt UI tabs
  const tabs = new Tabs({
    value: activeLanguageCode,
    onValueChange: (value) => {
      activeLanguageCode = value;
    },
  });

  // When activeLanguageCode changes, update the tabs value
  $effect(() => {
    if (activeLanguageCode) {
      tabs.value = activeLanguageCode;
    }
  });

  // Load project languages when the modal opens
  async function prepareEditModal() {
    isLoading = true;

    try {
      // Get available languages for this project directly
      projectLanguages = await getProjectLanguages(project.id);

      // Reset form values
      editTitle = {};
      editDescription = {};

      // Fetch the most recent project data to get latest translations
      const currentProject = await getProject(project.id);

      // Extract and store needed IDs
      const { titleId, descriptionId } = extractProjectIds(currentProject);
      project.title_id = titleId;
      project.description_id = descriptionId;

      // Set initial title and description values for each language
      projectLanguages.forEach((lang) => {
        // Set default values from current content
        if (lang.is_default) {
          editTitle[lang.code] = currentProject.title.content;
          editDescription[lang.code] = currentProject.description.content;
          // Set default active tab
          activeLanguageCode = lang.code;
        } else {
          // Find translations
          const titleTranslation = currentProject.title.translations?.find(
            (t) => t.language?.code === lang.code,
          );
          const descTranslation = currentProject.description.translations?.find(
            (t) => t.language?.code === lang.code,
          );

          editTitle[lang.code] = titleTranslation?.content || "";
          editDescription[lang.code] = descTranslation?.content || "";
        }
      });

      // Show the modal
      showModal = true;
    } catch (error) {
      console.error("Failed to prepare edit modal:", error);
    } finally {
      isLoading = false;
    }
  }

  // Close the modal
  function closeModal() {
    showModal = false;
  }

  // Handle save changes
  async function saveChanges() {
    isLoading = true;

    try {
      // Find default language to ensure we have content for it
      const defaultLang = projectLanguages.find((lang) => lang.is_default);
      if (!defaultLang) {
        throw new Error("No default language found for project");
      }

      // Get the title and description from the default language
      const titleContent = editTitle[defaultLang.code];
      const descContent = editDescription[defaultLang.code];

      // Prepare translation arrays for all non-default languages
      const secondaryLanguages = projectLanguages.filter(
        (lang) => !lang.is_default,
      );

      const titleTranslations = [];
      const descriptionTranslations = [];

      // Helper function to get existing translation ID
      function getExistingTranslationId(fieldName, langCode) {
        if (
          !project ||
          !project[fieldName] ||
          !project[fieldName].translations
        ) {
          return null;
        }

        let translations = project[fieldName].translations;

        // Handle string format translations
        if (typeof translations === "string") {
          try {
            translations = JSON.parse(translations);
          } catch (e) {
            console.warn(`Failed to parse ${fieldName} translations:`, e);
            translations = [];
          }
        }

        // Filter out null/empty values
        translations = translations.filter((t) => t && t.language?.code);

        const translation = translations.find(
          (t) => t.language?.code === langCode,
        );
        return translation ? translation.id : null;
      }

      secondaryLanguages.forEach((lang) => {
        const langCode = lang.code;

        // Prepare title translations
        const titleVal = editTitle[langCode]?.trim() || "";
        const titleExistingTranslationId = getExistingTranslationId(
          "title",
          langCode,
        );
        if (titleVal || titleExistingTranslationId) {
          titleTranslations.push({
            id: titleExistingTranslationId,
            language_code: langCode,
            content: titleVal || null,
          });
        }

        // Prepare description translations
        const descVal = editDescription[langCode]?.trim() || "";
        const descExistingTranslationId = getExistingTranslationId(
          "description",
          langCode,
        );
        if (descVal || descExistingTranslationId) {
          descriptionTranslations.push({
            id: descExistingTranslationId,
            language_code: langCode,
            content: descVal || null,
          });
        }
      });

      // Prepare unified payload for updateProject
      const projectUpdatePayload = {
        title: { content: titleContent },
        description: { content: descContent },
        // Translation arrays
        titleTranslations: titleTranslations.filter(
          (t) => t.content !== undefined,
        ),
        descriptionTranslations: descriptionTranslations.filter(
          (t) => t.content !== undefined,
        ),
      };

      console.log("=== PROJECT UPDATE PAYLOAD ===");
      console.log("Full payload:", projectUpdatePayload);

      // Call the unified updateProject function
      const result = await updateProject(project.id, projectUpdatePayload);

      if (result.error) {
        console.error("Error updating project:", result.error);
        // Handle error appropriately - could show toast or alert
      } else {
        console.log("Project updated successfully");
        // Close modal on success
        closeModal();
      }
    } catch (error) {
      console.error("Failed to save project changes:", error);
    } finally {
      isLoading = false;
    }
  }

  // Function to extract and store IDs from project data
  function extractProjectIds(projectData) {
    // The result object might be in different formats
    let titleId = null;
    let descriptionId = null;

    // Option 1: Direct ID references
    if (projectData.title_id) {
      titleId = projectData.title_id;
    }

    if (projectData.description_id) {
      descriptionId = projectData.description_id;
    }

    // Option 2: Get from title object directly
    if (!titleId && projectData.title) {
      // If title is an object with an ID field
      if (projectData.title.id) {
        titleId = projectData.title.id;
      }
    }

    // Option 3: Get from description object directly
    if (!descriptionId && projectData.description) {
      // If description is an object with an ID field
      if (projectData.description.id) {
        descriptionId = projectData.description.id;
      }
    }

    // Option 4: Get from result.title
    if (!titleId && projectData.result && projectData.result.title) {
      if (projectData.result.title.id) {
        titleId = projectData.result.title.id;
      }
    }

    // Option 5: Get from result.description
    if (
      !descriptionId &&
      projectData.result &&
      projectData.result.description
    ) {
      if (projectData.result.description.id) {
        descriptionId = projectData.result.description.id;
      }
    }
    // Return what we found, even if null (don't create fake IDs)
    return { titleId, descriptionId };
  }
</script>

<div
  class="d-flex align-items-center justify-content-between px-3 py-2 mb-4 mt-2"
>
  <div class="d-flex align-items-center gap-2">
    <BaseButton
      icon="pencil-square"
      onClick={prepareEditModal}
      class="btn btn-sm btn-link text-dark p-0 text-decoration-none"
      text=""
      title="Edit project"
    />
    <h6 class="m-0">
      <a class="text-decoration-none text-dark" href="/projects/{project.id}">
        {project.title.content}</a
      >
    </h6>
  </div>
  <!--
  <div class="d-flex gap-1">
    <BaseButton class="btn btn-sm btn-primary" text="Data Editor" />
    <BaseButton class="btn btn-sm btn-primary" text="Data Explorer" />
  </div>
  -->

  <div class="d-flex gap-1">
    <BaseButton
      class="btn btn-sm btn-dark"
      icon="table"
      text="Data Structure"
      onClick={() => {
        goto(`/projects/${project.id}/data-structure`);
      }}
    />
    <!--
    <BaseButton class="btn btn-sm btn-dark" icon="download" text="Export" />
    <BaseButton class="btn btn-sm btn-dark" icon="gear" text="Settings" />
    <BaseButton
      class="btn btn-sm btn-dark"
      icon="question-circle"
      text="Help"
    />
    -->
  </div>
</div>

<!-- Edit Project Modal -->
<div
  class="modal fade {showModal ? 'show' : ''}"
  tabindex="-1"
  role="dialog"
  style="display: {showModal ? 'block' : 'none'};"
  aria-labelledby="editProjectModalTitle"
  aria-hidden={!showModal}
>
  <div class="modal-dialog modal-dialog-centered modal-lg">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="editProjectModalTitle">
          Edit Project Details
        </h5>
        <BaseButton text="" icon="x" onClick={closeModal} class="btn-close" />
      </div>

      <div class="modal-body">
        {#if isLoading}
          <div class="d-flex justify-content-center py-4">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </div>
        {:else if projectLanguages.length}
          <div {...tabs.triggerList}>
            {#each projectLanguages as lang}
              <button
                class="nav-link {lang.is_default ? 'fw-bold' : ''}"
                {...tabs.getTrigger(lang.code)}
                class:active={activeLanguageCode === lang.code}
              >
                {lang.name || lang.code}
                {#if lang.is_default}
                  <span class="badge bg-primary ms-1">Default</span>
                {/if}
              </button>
            {/each}
          </div>

          {#each projectLanguages as lang}
            <div {...tabs.getContent(lang.code)}>
              <div class="mb-3">
                <label for="title-{lang.code}" class="form-label">Title</label>
                <input
                  type="text"
                  class="form-control"
                  id="title-{lang.code}"
                  bind:value={editTitle[lang.code]}
                  placeholder="Project title"
                  required={lang.is_default}
                />
              </div>

              <div class="mb-3">
                <label for="description-{lang.code}" class="form-label"
                  >Description</label
                >
                <textarea
                  class="form-control"
                  id="description-{lang.code}"
                  bind:value={editDescription[lang.code]}
                  rows="3"
                  placeholder="Project description"
                  required={lang.is_default}
                ></textarea>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <div class="modal-footer">
        <BaseButton
          text="Cancel"
          onClick={closeModal}
          class="btn btn-secondary"
        />
        <BaseButton
          text={isLoading ? "Saving..." : "Save Changes"}
          onClick={saveChanges}
          class="btn btn-primary"
          disabled={isLoading}
        />
      </div>
    </div>
  </div>
</div>

<!-- Modal backdrop -->
{#if showModal}
  <div class="modal-backdrop fade show"></div>
{/if}

<style>
  /* Style for the Melt UI tabs */
  [data-melt-tabs-trigger-list] {
    display: flex;
    border-bottom: 1px solid #dee2e6;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  [data-melt-tabs-trigger] {
    background: none;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem 0.25rem 0 0;
    cursor: pointer;
  }

  [data-melt-tabs-trigger][data-active] {
    border: 1px solid #dee2e6;
    border-bottom-color: white;
    margin-bottom: -1px;
    background-color: white;
  }

  [data-melt-tabs-content] {
    padding: 1rem 0;
  }
</style>
