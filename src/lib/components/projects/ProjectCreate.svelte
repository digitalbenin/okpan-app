<script>
    import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte";
    import { getProjectStore } from "$lib/stores/ProjectStore.svelte.js";
    import { API_SECTIONS } from "$lib/utils/queries.js";
    import BaseSelect from "$lib/components/base/BaseSelect.svelte";
    import ProjectData from "./ProjectData.svelte";
    import ProjectImportUrl from "./ProjectImportUrl.svelte";
    import ProjectImportFile from "./ProjectImportFile.svelte";
    import BaseButton from "../base/BaseButton.svelte";
    import { addToast } from "$lib/components/base/BaseToast.svelte";

    // Get the store but don't use $inspect
    let { contentLanguageState } = getContentLanguageStore();
    let { createProject, projectState } = getProjectStore();
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
        try {
            isCreating = true;

            // Simple, clean object with no circular references
            const formattedProject = {
                languages: [...projectData.languages], // Create a copy to avoid references
                title: {
                    content: projectData.title.content,
                    translations: projectData.title.translations
                        ? [...projectData.title.translations]
                        : [], // Create a copy
                },
                description: {
                    content: projectData.description.content,
                    translations: projectData.description.translations
                        ? [...projectData.description.translations]
                        : [], // Create a copy
                },
            };

            // Call the store's createProject method
            await createProject(formattedProject);

            // Reset form after successful creation
            selectedLanguages = [];
            projectData = {};

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
            // Error is already shown by the store
        } finally {
            isCreating = false;
        }
    }

    $inspect("projectData", projectData);
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
                disabled={isCreating || projectState.isLoading}
                onClick={handleCreateProject}
            />
        </div>
    {/if}
</div>
