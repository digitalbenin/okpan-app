<script>
  import { onMount } from "svelte";
  import { createProject } from "$lib/api/ProjectsApi.js";
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { addToast } from "$lib/components/base/BaseToast.svelte";
  import { goto } from "$app/navigation";

  let selectPortalEl = $state(null);

  onMount(() => {
    const el = document.createElement("div");
    el.style.cssText = "position: fixed; top: 0; left: 0; z-index: 1056;";
    document.body.appendChild(el);
    selectPortalEl = el;
    return () => el.remove();
  });

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

  // New states for Step 2
  let currentStep = $state(1);
  let isShared = $state(false);
  let usePassword = $state(true);
  let password = $state("");

  const { onCreated } = $props();

  // No tabs: keep only "Create a new project"

  // Load world languages from IPC on mount
  onMount(async () => {
    try {
      isLoadingLanguages = true;
      const resp = await window.api.getLanguages();
      if (resp?.success && Array.isArray(resp.result)) {
        worldLanguages = resp.result;
        const english = resp.result.find((l) => l.code === "en");
        if (english) selectedLanguage = "en";
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

      // Prepare payload for ProjectsUtils.createProject
      const formattedProject = {
        title: projectData?.title?.content || "",
        description: projectData?.description?.content || "",
        defaultLanguage: {
          code: defaultLangCode,
          name: selectedLanguageObject?.name || defaultLangCode,
        },
        isShared,
        password: (isShared && usePassword) ? password : null
      };


      // Use store method for creation
      const result = await createProject(formattedProject);


      // Extract newly created project ID from store result
      const projectId = result?.id ?? null;

      // Callback to parent (runes style)
      if (projectId && typeof onCreated === "function") {
        onCreated({ projectId });
      }

      // Reset form after successful creation
      selectedLanguage = "";
      projectData = { title: { content: "" }, description: { content: "" } };
      currentStep = 1;
      isShared = false;
      usePassword = true;
      password = "";
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
  <!-- Step Tracker -->
  <div class="d-flex align-items-center mb-5 mt-2 ms-2">
    <div class="d-flex align-items-center me-5" style="opacity: {currentStep === 1 ? '1' : '0.7' };">
      <div 
        class="d-flex align-items-center justify-content-center rounded text-white me-3" 
        style="width: 32px; height: 32px; background-color: {currentStep === 1 ? '#0f8a65' : '#a8d5c2'};"
      >
        1
      </div>
      <span class="fs-6 {currentStep === 1 ? 'text-dark' : 'text-muted'}">Project details</span>
    </div>
    
    <div class="d-flex align-items-center" style="opacity: {currentStep === 2 ? '1' : '0.7'};">
       <div 
        class="d-flex align-items-center justify-content-center rounded text-white me-3" 
        style="width: 32px; height: 32px; background-color: {currentStep === 2 ? '#0f8a65' : '#a8d5c2'};"
      >
        2
      </div>
      <span class="fs-6 {currentStep === 2 ? 'text-dark' : 'text-muted'}">Sharing and security</span>
    </div>
  </div>

  {#if currentStep === 1}
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
      <p class="form-label">Default language *</p>
      {#if isLoadingLanguages}
        <div class="alert alert-info">Loading languages…</div>
      {:else if languagesError}
        <div class="alert alert-danger">{languagesError}</div>
      {/if}

      {#if selectPortalEl}
        <BaseSelect
          bind:value={selectedLanguage}
          items={languageOptions}
          placeholder="Select a language"
          searchable={true}
          searchPlaceholder="Search languages..."
          portalProps={{ to: selectPortalEl }}
        />
      {/if}
    </div>

    <div class="d-flex justify-content-end">
      <BaseButton
        text="Next"
        class="btn btn-primary"
        disabled={!(selectedLanguage && projectData?.title?.content?.trim())}
        onClick={() => { currentStep = 2; }}
      />
    </div>
  {:else if currentStep === 2}
    <div class="mb-4">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div class="d-flex align-items-center gap-2">
          <span class="fs-6 text-dark">Do you want to make a collaborative project?</span>
         <!-- <i class="bi bi-info-circle-fill text-dark fs-5" title="People with this password will be able to search for, join and automatically synchronize data with this project."></i> -->
        </div>
        <div class="btn-group border rounded" role="group">
          <button type="button" class="btn {isShared ? 'btn-success text-white' : 'btn-light text-muted'}" style="{isShared ? 'background-color: #0f8a65; border-color: #0f8a65; width: 60px;' : 'background-color: white; border: none; width: 60px;'}" onclick={() => isShared = true}>Yes</button>
          <button type="button" class="btn {!isShared ? 'btn-success text-white' : 'btn-light text-muted'}" style="{!isShared ? 'background-color: #0f8a65; border-color: #0f8a65; width: 60px;' : 'background-color: white; border: none; width: 60px;'}" onclick={() => isShared = false}>No</button>
        </div>
      </div>

      {#if isShared}
        <div class="d-flex justify-content-between align-items-center mb-4">
          <div class="d-flex align-items-center gap-2">
            <span class="fs-6 text-dark">Use password</span>
          </div>
          <div class="btn-group border rounded" role="group">
            <button type="button" class="btn {usePassword ? 'btn-success text-white' : 'btn-light text-muted'}" style="{usePassword ? 'background-color: #0f8a65; border-color: #0f8a65; width: 60px;' : 'background-color: white; border: none; width: 60px;'}" onclick={() => usePassword = true}>Yes</button>
            <button type="button" class="btn {!usePassword ? 'btn-success text-white' : 'btn-light text-muted'}" style="{!usePassword ? 'background-color: #0f8a65; border-color: #0f8a65; width: 60px;' : 'background-color: white; border: none; width: 60px;'}" onclick={() => usePassword = false}>No</button>
          </div>
        </div>
      {/if}

      {#if isShared && usePassword}
        <div class="mb-4">
          <p class="form-label fs-6 text-dark">Password</p>
          <div class="input-group">
            <input
              type="password"
              class="form-control fs-6 px-3 py-2"
              placeholder="Enter password"
              bind:value={password}
            />
          </div>
        </div>
      {/if}
    </div>

    <div class="d-flex justify-content-end gap-3 mt-5">
      <BaseButton
        text="Back"
        class="btn btn-outline-secondary px-4 py-2 bg-white text-dark"
        onClick={() => { currentStep = 1; }}
      />
      <BaseButton
        text={isCreating ? "Creating..." : "Create"}
        class="btn btn-primary px-4 py-2"
        style="background-color: #0f8a65; border-color: #0f8a65;"
        disabled={isCreating || (isShared && usePassword && !password)}
        onClick={handleCreateProject}
      />
    </div>
  {/if}
</div>
