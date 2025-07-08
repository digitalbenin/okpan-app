<script>
  import { Tabs } from "bits-ui";
  import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte";
  // import { getProjectStore } from "$lib/stores/ProjectStore.svelte.js"; // Removed store usage for creation
  import { executeQuery } from "$lib/stores/GraphqlUtils.js"; // Added GraphqlUtils
  // import { API_SECTIONS } from "$lib/queries/index.js"; // Likely not needed directly
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte"; // Corrected path
  import ProjectData from "./ProjectData.svelte";
  import ProjectImportUrl from "./ProjectImportUrl.svelte";
  import ProjectImportFile from "./ProjectImportFile.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte"; // Corrected path
  import { addToast } from "$lib/components/base/BaseToast.svelte";

  // Get the store but don't use $inspect
  let { contentLanguageState } = getContentLanguageStore();
  // let { createProject, projectState } = getProjectStore(); // Removed store state
  let selectedLanguages = $state([]);
  let projectData = $state({});
  let isCreating = $state(false);

  // Tab IDs
  const tabIds = [
    "Create a new project",
    "Import from URL",
    "Import from file",
  ];

  // Active tab tracking
  let activeTab = $state(tabIds[0]);

  // Get language options
  let languageOptions = $derived(
    contentLanguageState.languages.map((lang) => ({
      value: lang.code,
      label: lang.name,
    }))
  );

  // Get selected language objects for ProjectData
  let selectedLanguageObjects = $derived(
    selectedLanguages
      ? contentLanguageState.languages.filter((lang) =>
          selectedLanguages.includes(lang.code)
        )
      : []
  );

  // Handle creating a new project
  async function handleCreateProject() {
    // Basic validation (Example: check if title exists for default language)
    const defaultLangCode = selectedLanguageObjects.find(
      (l) => l.is_default
    )?.code;
    if (!projectData?.title?.[defaultLangCode]?.trim()) {
      addToast({
        data: {
          title: "Validation Error",
          description: "Project title is required for the default language.",
          type: "error",
        },
      });
      return; // Stop creation
    }

    try {
      isCreating = true;

      // Prepare the payload (ensure it matches the expected GQL input type)
      // This structure assumes the GQL mutation expects nested objects for translatable fields
      const formattedProject = {
        languages: selectedLanguageObjects.map((lang) => lang.code), // Send array of codes
        title: {
          content: projectData.title[defaultLangCode] || "",
          translations: selectedLanguageObjects
            .filter(
              (lang) => !lang.is_default && projectData.title[lang.code]?.trim()
            )
            .map((lang) => ({
              language_code: lang.code,
              content: projectData.title[lang.code].trim(),
            })),
        },
        description: {
          content: projectData.description?.[defaultLangCode] || "",
          translations: selectedLanguageObjects
            .filter(
              (lang) =>
                !lang.is_default && projectData.description?.[lang.code]?.trim()
            )
            .map((lang) => ({
              language_code: lang.code,
              content: projectData.description[lang.code].trim(),
            })),
        },
        // Add other fields expected by the mutation if any
      };

      console.log("Creating project with payload:", formattedProject);

      // Use executeQuery for creation
      const result = await executeQuery("projects", "create", formattedProject);

      console.log("Project creation result:", result);

      // Reset form after successful creation
      selectedLanguages = [];
      projectData = {};
      activeTab = "Create a new project"; // Optionally reset tab

      // Show success message
      addToast({
        data: {
          title: "Success",
          description: "Project created successfully!",
          type: "success",
        },
      });

      // TODO: Optionally redirect or update UI based on 'result'
      // e.g., if result contains the new project ID
    } catch (error) {
      console.error("Failed to create project:", error);
      addToast({
        data: {
          title: "Error",
          description: `Failed to create project: ${error.message}`,
          type: "error",
        },
      });
    } finally {
      isCreating = false;
    }
  }
</script>

<Tabs.Root bind:value={activeTab}>
  <Tabs.List>
    <ul class="nav nav-underline border-bottom mb-3">
      {#each tabIds as id}
        <Tabs.Trigger forceMount value={id}>
          {#snippet child({ props })}
            <li {...props} class="nav-item">
              <div class="nav-link" class:active={activeTab === id}>
                {id}
              </div>
            </li>
          {/snippet}
        </Tabs.Trigger>
      {/each}
    </ul>
  </Tabs.List>

  <!-- Tab Content -->
  <div class="tab-content">
    {#each tabIds as id}
      <Tabs.Content value={id}>
        {#if activeTab === "Create a new project"}
          <p>Select one or more languages</p>

          <div class="row mb-2">
            <div class="col-md-6">
              <BaseSelect
                bind:value={selectedLanguages}
                items={languageOptions}
                placeholder="Select languages"
                type="multiple"
                portalProps={{ disabled: true }}
              />
            </div>
          </div>

          {#if selectedLanguages?.length}
            <div>
              <ProjectData
                languages={selectedLanguageObjects}
                bind:projData={projectData}
              />
            </div>
          {/if}
          <div class="d-flex justify-content-end">
            <BaseButton
              text={isCreating ? "Creating..." : "Create Project"}
              class="btn btn-primary"
              disabled={isCreating ||
                !(selectedLanguages?.length && projectData?.title?.content)}
              onClick={handleCreateProject}
            />
          </div>
        {:else if activeTab === "Import from URL"}
          <ProjectImportUrl />
        {:else if activeTab === "Import from file"}
          <ProjectImportFile />
        {/if}
      </Tabs.Content>
    {/each}
  </div>
</Tabs.Root>
