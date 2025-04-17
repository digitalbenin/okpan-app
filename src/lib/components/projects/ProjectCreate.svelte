<script>
    import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte";
    // import { getProjectStore } from "$lib/stores/ProjectStore.svelte.js"; // Removed store usage for creation
    import { executeQuery } from "$lib/stores/GraphqlUtils.js"; // Added GraphqlUtils
    // import { API_SECTIONS } from "$lib/queries/index.js"; // Likely not needed directly
    import BaseSelect from "$lib/components/base/BaseSelect.svelte"; // Corrected path
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

    // Active tab tracking
    let activeTab = $state("Create a new project");

    // Tab IDs
    const tabIds = [
        "Create a new project",
        "Import from URL",
        "Import from file",
    ];

    // Get language options
    let languageOptions = $derived(
        contentLanguageState.languages.map((lang) => ({
            value: lang.code,
            label: `${lang.code} - ${lang.name}`,
        })),
    );

    // Get selected language objects for ProjectData
    let selectedLanguageObjects = $derived(
        selectedLanguages
            ? contentLanguageState.languages.filter((lang) =>
                  selectedLanguages.includes(lang.code),
              )
            : [],
    );

    // Handle creating a new project
    async function handleCreateProject() {
        // Basic validation (Example: check if title exists for default language)
        const defaultLangCode = selectedLanguageObjects.find(
            (l) => l.is_default,
        )?.code;
        if (!projectData?.title?.[defaultLangCode]?.trim()) {
            addToast({
                data: {
                    title: "Validation Error",
                    description:
                        "Project title is required for the default language.",
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
                            (lang) =>
                                !lang.is_default &&
                                projectData.title[lang.code]?.trim(),
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
                                !lang.is_default &&
                                projectData.description?.[lang.code]?.trim(),
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
            const result = await executeQuery(
                "projects",
                "create",
                formattedProject,
            );

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

    // Remove $inspect if not needed for debugging
    // $inspect("projectData", projectData);
</script>

<div class="d-flex flex-column gap-2 p-4">
    <h1 class="fs-4">Create Project</h1>
    <div>
        <!-- Bootstrap 5 Tabs -->
        <ul class="nav mb-4">
            {#each tabIds as id}
                <li class="nav-item">
                    <BaseButton
                        class="nav-link border-bottom text-decoration-none px-3 py-2 {activeTab !==
                        id
                            ? 'text-primary'
                            : ''} {activeTab === id
                            ? 'text-dark border-primary border-2'
                            : ''}"
                        text={id}
                        onClick={() => (activeTab = id)}
                    />
                </li>
            {/each}
        </ul>

        <!-- Tab Content -->
        <div class="tab-content">
            {#if activeTab === "Create a new project"}
                <div class="mt-3">
                    <p>Select one or more languages</p>

                    <div class="row mb-3">
                        <div class="col-md-6">
                            <BaseSelect
                                bind:value={selectedLanguages}
                                options={languageOptions.map(
                                    (opt) => opt.value,
                                )}
                                placeholder="Select languages..."
                                label="Languages"
                                multiple={true}
                            />
                        </div>
                    </div>

                    {#if selectedLanguages?.length}
                        <div class="mt-4">
                            <ProjectData
                                languages={selectedLanguageObjects}
                                bind:projData={projectData}
                            />
                        </div>
                    {/if}
                </div>
            {:else if activeTab === "Import from URL"}
                <ProjectImportUrl />
            {:else if activeTab === "Import from file"}
                <ProjectImportFile />
            {/if}
        </div>
    </div>
    {#if selectedLanguages?.length && projectData?.title?.content}
        <div class="d-flex justify-content-end">
            <BaseButton
                text={isCreating ? "Creating..." : "Create Project"}
                class="btn btn-primary"
                disabled={isCreating}
                onClick={handleCreateProject}
            />
        </div>
    {/if}
</div>
