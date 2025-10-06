<script>
  import { Tabs } from "bits-ui";
  import { onMount } from "svelte";
  // import { getProjectStore } from "$lib/stores/ProjectStore.svelte.js"; // Removed store usage for creation
  import { executeQuery } from "$lib/stores/GraphqlUtils.js"; // Added GraphqlUtils
  // import { API_SECTIONS } from "$lib/queries/index.js"; // Likely not needed directly
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte"; // Corrected path
  import ProjectData from "./ProjectData.svelte";
  import ProjectImportUrl from "./ProjectImportUrl.svelte";
  import ProjectImportFile from "./ProjectImportFile.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte"; // Corrected path
  import { addToast } from "$lib/components/base/BaseToast.svelte";
  import { createEventDispatcher } from "svelte";

  // let { createProject, projectState } = getProjectStore(); // Removed store state
  let selectedLanguage = $state("");
  let projectData = $state({});
  let isCreating = $state(false);
  let worldLanguages = $state([]);
  let isLoadingLanguages = $state(false);
  let languagesError = $state(null);

  const dispatch = createEventDispatcher();

  // Tab IDs
  const tabIds = [
    "Create a new project",
    "Import from URL",
    "Import from file",
  ];

  // Active tab tracking
  let activeTab = $state(tabIds[0]);

  // Load world languages from IPC on mount
  onMount(async () => {
    try {
      isLoadingLanguages = true;
      const resp = await window.api.getLanguages();
      if (resp?.success && Array.isArray(resp.result)) {
        worldLanguages = resp.result;
      } else {
        languagesError = resp?.error || "Failed to load languages";
        worldLanguages = [];
      }
    } catch (e) {
      console.error("Error loading world languages:", e);
      languagesError = e?.message || "Error loading languages";
    } finally {
      isLoadingLanguages = false;
    }
  });

  // Build select options from world languages
  let languageOptions = $derived(
    worldLanguages.map((lang) => ({
      value: lang.code,
      label: lang.name || lang.native || lang.englishName || lang.code,
    }))
  );

  // Selected language object from world languages
  let selectedLanguageObject = $derived(
    selectedLanguage
      ? worldLanguages.find((lang) => lang.code === selectedLanguage)
      : null
  );

  // Handle creating a new project
  async function handleCreateProject() {
    // Basic validation (Example: check if title exists for default language)
    const defaultLangCode = selectedLanguageObject?.code;
    if (!projectData?.title?.content?.trim()) {
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

      // Prepare minimal payload for simplified project creation
      const defaultLangObj = selectedLanguageObject;
      const formattedProject = {
        title: projectData?.title?.content || "",
        description: projectData?.description?.content || "",
        languageCode: defaultLangCode,
        languageName: defaultLangObj?.name || defaultLangCode
      };

      console.log("Creating project with payload:", formattedProject);

      // Use executeQuery for creation
      const result = await executeQuery("projects", "create", formattedProject);

      console.log("Project creation result:", result);

      // Try to extract newly created project ID
      const projectId = result?.insertIntoProject?.[0]?.id
        ?? result?.updateProject?.[0]?.id
        ?? result?.projectId
        ?? null;

      // Notify parent about creation so it can close modal and redirect
      if (projectId) {
        dispatch("created", { projectId });
      }

      // Reset form after successful creation
      selectedLanguage = "";
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
          <p>Select a default language</p>

          {#if isLoadingLanguages}
            <div class="alert alert-info">Loading languages…</div>
          {:else if languagesError}
            <div class="alert alert-danger">{languagesError}</div>
          {/if}

          <div class="row mb-2">
            <div class="col-md-6">
              <BaseSelect
                bind:value={selectedLanguage}
                items={languageOptions}
                placeholder="Select a language"
                portalProps={{ disabled: true }}
              />
            </div>
          </div>

          {#if selectedLanguage}
            <div>
              <ProjectData
                languages={[selectedLanguageObject].filter(Boolean)}
                bind:projData={projectData}
              />
            </div>
          {/if}
          <div class="d-flex justify-content-end">
            <BaseButton
              text={isCreating ? "Creating..." : "Create Project"}
              class="btn btn-primary"
              disabled={isCreating ||
                !(selectedLanguage && projectData?.title?.content?.trim())}
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
