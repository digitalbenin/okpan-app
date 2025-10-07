<script>
  import { onMount } from "svelte";
  import { executeQuery } from "$lib/stores/GraphqlUtils.js"; // Added GraphqlUtils
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte"; // Corrected path
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte"; // Corrected path
  import { addToast } from "$lib/components/base/BaseToast.svelte";

  // let { createProject, projectState } = getProjectStore(); // Removed store state
  let selectedLanguage = $state("");
  let projectData = $state({
    title: { content: "" },
    description: { content: "" },
  });
  let isCreating = $state(false);
  let worldLanguages = $state([]);
  let isLoadingLanguages = $state(false);
  let languagesError = $state(null);

  const { onCreated } = $props();

  // No tabs: keep only "Create a new project"

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
    })),
  );

  // Selected language object from world languages
  let selectedLanguageObject = $derived(
    selectedLanguage
      ? worldLanguages.find((lang) => lang.code === selectedLanguage)
      : null,
  );

  // Display label for placeholders (default to English)
  let langDisplayLabel = $derived(
    selectedLanguageObject
      ? `- ${selectedLanguageObject.name || selectedLanguageObject.native || selectedLanguageObject.englishName || selectedLanguageObject.code} (${selectedLanguageObject.code})`
      : "",
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
        languageName: defaultLangObj?.name || defaultLangCode,
      };

      console.log("Creating project with payload:", formattedProject);

      // Use executeQuery for creation
      const result = await executeQuery("projects", "create", formattedProject);

      console.log("Project creation result:", result);

      // Try to extract newly created project ID
      const projectId =
        result?.insertIntoProject?.[0]?.id ??
        result?.updateProject?.[0]?.id ??
        result?.projectId ??
        null;

      // Callback to parent (runes style)
      if (projectId && typeof onCreated === "function") {
        onCreated({ projectId });
      }

      // Reset form after successful creation
      selectedLanguage = "";
      projectData = {};
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

<div>
  <div class="mb-3">
    <p class="form-label">Project title *</p>
    <BaseInput
      bind:value={projectData.title.content}
      placeholder={`Enter title ${langDisplayLabel}`}
    />
  </div>

  <div class="mb-3">
    <p class="form-label">Description</p>
    <textarea
      class="form-control"
      rows="4"
      bind:value={projectData.description.content}
      placeholder={`Enter description ${langDisplayLabel}`}
    ></textarea>
  </div>

  <div class="mb-3">
    <p class="form-label">Default language</p>
    {#if isLoadingLanguages}
      <div class="alert alert-info">Loading languages…</div>
    {:else if languagesError}
      <div class="alert alert-danger">{languagesError}</div>
    {/if}

    <BaseSelect
      bind:value={selectedLanguage}
      items={languageOptions}
      placeholder="Select a language"
      searchable={true}
      searchPlaceholder="Search languages..."
      portalProps={{ disabled: true }}
    />
  </div>

  <div class="d-flex justify-content-end">
    <BaseButton
      text={isCreating ? "Creating..." : "Create Project"}
      class="btn btn-primary"
      disabled={isCreating ||
        !(selectedLanguage && projectData?.title?.content?.trim())}
      onClick={handleCreateProject}
    />
  </div>
</div>
