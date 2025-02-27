<script>
    // Using Svelte 5 runes syntax
    import { API_SECTIONS } from "$lib/utils/queries.js";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

    // Get the translation store for import/export functionality
    const { exportTranslations, importTranslations } = getTranslationStore();

    // State variables using $state
    let languages = $state([]);
    let interfaceTranslations = $state([]);
    let namespaces = $state([]);
    let currentNamespace = $state("");
    let isLoading = $state(true);
    let error = $state(null);
    let importExportMessage = $state(null);

    // Form data for adding new translations
    let newTranslationKey = $state("");
    let newTranslationValues = $state({});
    let newNamespace = $state("");

    // Modal states
    let showAddTranslationModal = $state(false);
    let showAddNamespaceModal = $state(false);

    // Editing state
    let editingTranslation = $state(null);
    let editedValues = $state({});

    // Get queries from API_SECTIONS
    const languagesQuery = API_SECTIONS.languages.operations.find(
        (op) => op.name === "List Languages",
    ).query;
    const interfaceTranslationsQuery =
        API_SECTIONS.interface_translations.operations.find(
            (op) => op.name === "List Interface Translations",
        ).query;
    const createInterfaceTranslationQuery =
        API_SECTIONS.interface_translations.operations.find(
            (op) => op.name === "Create Interface Translation",
        ).query;
    const updateInterfaceTranslationQuery =
        API_SECTIONS.interface_translations.operations.find(
            (op) => op.name === "Update Interface Translation",
        ).query;
    const deleteInterfaceTranslationQuery =
        API_SECTIONS.interface_translations.operations.find(
            (op) => op.name === "Delete Interface Translation",
        ).query;

    // Fetch all languages
    async function fetchLanguages() {
        try {
            const result = await window.api.executeGraphQL(languagesQuery);

            if (!result.success || result.errors) {
                throw new Error(
                    result.errors
                        ? result.errors[0].message
                        : "Failed to fetch languages",
                );
            }

            languages = result.data.languages;

            // Initialize newTranslationValues with empty strings for each language
            const values = {};
            languages.forEach((lang) => {
                values[lang.code] = "";
            });
            newTranslationValues = values;
        } catch (err) {
            error = `Failed to fetch languages: ${err.message}`;
        }
    }

    // Fetch all interface translations
    async function fetchInterfaceTranslations() {
        try {
            isLoading = true;
            console.log("Fetching interface translations...");

            const result = await window.api.executeGraphQL(
                interfaceTranslationsQuery,
            );

            console.log("Interface translations result:", result);

            if (!result.success || result.errors) {
                throw new Error(
                    result.errors
                        ? result.errors[0].message
                        : "Failed to fetch translations",
                );
            }

            // Make sure we have data before trying to use it
            if (!result.data || !result.data.interface_translations) {
                console.error(
                    "No interface_translations data in response:",
                    result,
                );
                throw new Error("No translation data received from server");
            }

            interfaceTranslations = result.data.interface_translations;
            console.log(
                "Updated interfaceTranslations:",
                interfaceTranslations,
            );

            // Extract unique namespaces
            const uniqueNamespaces = [
                ...new Set(
                    result.data.interface_translations.map((t) => t.namespace),
                ),
            ];
            console.log("Unique namespaces:", uniqueNamespaces);
            namespaces = uniqueNamespaces;

            // Set default namespace if available
            if (namespaces.length > 0 && !currentNamespace) {
                currentNamespace = namespaces[0];
                console.log("Set current namespace to:", currentNamespace);
            }
        } catch (err) {
            console.error("Error in fetchInterfaceTranslations:", err);
            error = `Failed to fetch translations: ${err.message}`;
        } finally {
            isLoading = false;
        }
    }

    // Toggle modals
    function toggleAddNamespaceModal() {
        showAddNamespaceModal = !showAddNamespaceModal;
        if (!showAddNamespaceModal) {
            newNamespace = "";
        }
    }

    function toggleAddTranslationModal() {
        showAddTranslationModal = !showAddTranslationModal;
        if (!showAddTranslationModal) {
            newTranslationKey = "";
            const resetValues = {};
            languages.forEach((lang) => {
                resetValues[lang.code] = "";
            });
            newTranslationValues = resetValues;
        }
    }

    // Add a new namespace
    async function addNamespace() {
        if (!newNamespace.trim()) {
            error = "Namespace cannot be empty";
            return;
        }

        // Check if namespace already exists
        if (namespaces.includes(newNamespace)) {
            error = "Namespace already exists";
            return;
        }

        // Add namespace to the list
        namespaces = [...namespaces, newNamespace];
        currentNamespace = newNamespace;
        newNamespace = "";
        error = null;
        toggleAddNamespaceModal();
    }

    // Add a new translation
    async function addTranslation() {
        console.log("addTranslation function called");

        if (!newTranslationKey.trim()) {
            error = "Translation key cannot be empty";
            return;
        }

        if (!currentNamespace) {
            error = "Please select or create a namespace first";
            return;
        }

        // Check if any translation value is empty
        const emptyLanguages = languages.filter(
            (lang) => !newTranslationValues[lang.code]?.trim(),
        );

        if (emptyLanguages.length > 0) {
            error = `Please provide translations for: ${emptyLanguages.map((l) => l.name).join(", ")}`;
            return;
        }

        try {
            error = null;
            isLoading = true;

            console.log("Adding translation:", {
                key: newTranslationKey,
                namespace: currentNamespace,
                values: JSON.stringify(newTranslationValues),
            });

            // Create mutations for each language
            const mutations = [];
            for (const lang of languages) {
                console.log(
                    `Creating translation for language: ${lang.code}, value: "${newTranslationValues[lang.code]}"`,
                );
                try {
                    // Log the exact query and variables being sent
                    console.log(
                        "GraphQL query:",
                        createInterfaceTranslationQuery,
                    );
                    console.log("Variables:", {
                        locale: lang.code,
                        namespace: currentNamespace,
                        key: newTranslationKey,
                        value: newTranslationValues[lang.code],
                    });

                    const result = await window.api.executeGraphQL(
                        createInterfaceTranslationQuery,
                        {
                            locale: lang.code,
                            namespace: currentNamespace,
                            key: newTranslationKey,
                            value: newTranslationValues[lang.code],
                        },
                    );
                    console.log(`Result for ${lang.code}:`, result);
                    mutations.push(result);
                } catch (err) {
                    console.error(
                        `Error creating translation for ${lang.code}:`,
                        err,
                    );
                    throw err;
                }
            }

            // Check for errors
            const errors = mutations.filter(
                (result) => !result.success || result.errors,
            );
            if (errors.length > 0) {
                console.error("Errors in mutations:", errors);
                throw new Error(
                    errors[0].errors
                        ? errors[0].errors[0].message
                        : "Failed to add translation",
                );
            }

            console.log("All translations added successfully");

            // Reset form
            newTranslationKey = "";
            const resetValues = {};
            languages.forEach((lang) => {
                resetValues[lang.code] = "";
            });
            newTranslationValues = resetValues;

            // Close modal first
            toggleAddTranslationModal();

            // Then refresh translations
            console.log("Refreshing translations after add");
            await fetchInterfaceTranslations();

            console.log("Add translation process completed");
        } catch (err) {
            console.error("Error in addTranslation:", err);
            error = `Failed to add translation: ${err.message}`;
        } finally {
            isLoading = false;
        }
    }

    // Start editing a translation
    function startEditing(key) {
        // Find all translations for this key in the current namespace
        const keyTranslations = interfaceTranslations.filter(
            (t) => t.key === key && t.namespace === currentNamespace,
        );

        console.log("Starting to edit key:", key);
        console.log("Found translations:", keyTranslations);

        editingTranslation = key;

        // Initialize edited values with current values
        const values = {};
        keyTranslations.forEach((t) => {
            values[t.locale] = t.value;
        });

        console.log("Initial edited values:", values);
        editedValues = values;
    }

    // Save edited translation
    async function saveEditing() {
        if (!editingTranslation) return;

        try {
            isLoading = true;
            error = null;

            // Find all translations for this key in the current namespace
            const keyTranslations = interfaceTranslations.filter(
                (t) =>
                    t.key === editingTranslation &&
                    t.namespace === currentNamespace,
            );

            console.log(
                "Saving edited translations for key:",
                editingTranslation,
            );
            console.log("Current namespace:", currentNamespace);
            console.log("Found translations to update:", keyTranslations);
            console.log("Edited values:", JSON.stringify(editedValues));

            // Get all language codes that have edited values
            const editedLanguages = Object.keys(editedValues);
            console.log("Languages with edited values:", editedLanguages);

            // Update existing translations and create new ones
            const mutations = [];

            // First, handle existing translations
            for (const translation of keyTranslations) {
                const newValue = editedValues[translation.locale];

                // Skip if value hasn't changed
                if (newValue === translation.value) {
                    console.log(
                        `Skipping update for ${translation.locale} - value unchanged`,
                    );
                    continue;
                }

                console.log(`Updating translation for ${translation.locale}:`, {
                    id: translation.id,
                    oldValue: translation.value,
                    newValue: newValue,
                });

                try {
                    const result = await window.api.executeGraphQL(
                        updateInterfaceTranslationQuery,
                        {
                            id: translation.id,
                            value: newValue || translation.value,
                        },
                    );
                    console.log(
                        `Update result for ${translation.locale}:`,
                        result,
                    );
                    mutations.push(result);
                } catch (err) {
                    console.error(
                        `Error updating translation for ${translation.locale}:`,
                        err,
                    );
                    throw err;
                }
            }

            // Now, create new translations for languages that don't have one yet
            const existingLocales = keyTranslations.map((t) => t.locale);
            console.log("Existing locales:", existingLocales);

            for (const lang of languages) {
                // Skip if this language already has a translation
                if (existingLocales.includes(lang.code)) {
                    continue;
                }

                // Skip if no value was provided for this language
                if (!editedValues[lang.code]) {
                    console.log(`No value provided for ${lang.code}, skipping`);
                    continue;
                }

                console.log(`Creating new translation for ${lang.code}:`, {
                    locale: lang.code,
                    namespace: currentNamespace,
                    key: editingTranslation,
                    value: editedValues[lang.code],
                });

                try {
                    const result = await window.api.executeGraphQL(
                        createInterfaceTranslationQuery,
                        {
                            locale: lang.code,
                            namespace: currentNamespace,
                            key: editingTranslation,
                            value: editedValues[lang.code],
                        },
                    );
                    console.log(`Creation result for ${lang.code}:`, result);
                    mutations.push(result);
                } catch (err) {
                    console.error(
                        `Error creating translation for ${lang.code}:`,
                        err,
                    );
                    throw err;
                }
            }

            // Check for errors
            const errors = mutations.filter(
                (result) => !result.success || result.errors,
            );
            if (errors.length > 0) {
                console.error("Errors in update/create mutations:", errors);
                throw new Error(
                    errors[0].errors
                        ? errors[0].errors[0].message
                        : "Failed to update translation",
                );
            }

            console.log("All translations updated successfully");

            // Reset editing state
            editingTranslation = null;
            editedValues = {};

            // Refresh translations
            await fetchInterfaceTranslations();
        } catch (err) {
            console.error("Error in saveEditing:", err);
            error = `Failed to update translation: ${err.message}`;
        } finally {
            isLoading = false;
        }
    }

    // Cancel editing
    function cancelEditing() {
        editingTranslation = null;
        editedValues = {};
    }

    // Delete a translation
    async function deleteTranslation(key) {
        if (
            !confirm(
                `Are you sure you want to delete the translation key "${key}" and all its translations?`,
            )
        ) {
            return;
        }

        try {
            isLoading = true;
            error = null;

            // Find all translations for this key in the current namespace
            const keyTranslations = interfaceTranslations.filter(
                (t) => t.key === key && t.namespace === currentNamespace,
            );

            // Delete each translation
            const mutations = keyTranslations.map((translation) => {
                return window.api.executeGraphQL(
                    deleteInterfaceTranslationQuery,
                    {
                        id: translation.id,
                    },
                );
            });

            const results = await Promise.all(mutations);

            // Check for errors
            const errors = results.filter(
                (result) => !result.success || result.errors,
            );
            if (errors.length > 0) {
                throw new Error(
                    errors[0].errors
                        ? errors[0].errors[0].message
                        : "Failed to delete translation",
                );
            }

            // Refresh translations
            await fetchInterfaceTranslations();
        } catch (err) {
            error = `Failed to delete translation: ${err.message}`;
        } finally {
            isLoading = false;
        }
    }

    // Get translations for the current namespace
    function getTranslationsForCurrentNamespace() {
        if (!currentNamespace) return [];

        // Get all unique keys for the current namespace
        const keys = [
            ...new Set(
                interfaceTranslations
                    .filter((t) => t.namespace === currentNamespace)
                    .map((t) => t.key),
            ),
        ];

        // For each key, get all translations
        return keys.map((key) => {
            const keyTranslations = interfaceTranslations.filter(
                (t) => t.key === key && t.namespace === currentNamespace,
            );

            // Create an object with translations for each language
            const translations = {};
            keyTranslations.forEach((t) => {
                translations[t.locale] = t.value;
            });

            return {
                key,
                translations,
            };
        });
    }

    // Set namespace function
    function setNamespace(namespace) {
        currentNamespace = namespace;
    }

    // Clear error function
    function clearError() {
        error = null;
    }

    // Handle export translations
    async function handleExportTranslations() {
        try {
            isLoading = true;
            importExportMessage = null;

            const result = await exportTranslations();

            if (result.success) {
                importExportMessage = {
                    type: "success",
                    text: `Translations exported successfully to ${result.filePath}`,
                };
            } else {
                importExportMessage = {
                    type: "danger",
                    text: result.message || "Export failed",
                };
            }
        } catch (err) {
            importExportMessage = {
                type: "danger",
                text: `Export failed: ${err.message}`,
            };
        } finally {
            isLoading = false;
        }
    }

    // Handle import translations
    async function handleImportTranslations() {
        try {
            isLoading = true;
            importExportMessage = null;

            const result = await importTranslations();

            if (result.success) {
                importExportMessage = {
                    type: "success",
                    text: `Translations imported successfully: ${result.stats.imported} new, ${result.stats.updated} updated, ${result.stats.errors} errors`,
                };

                // Refresh the UI data
                await fetchLanguages();
                await fetchInterfaceTranslations();
            } else {
                importExportMessage = {
                    type: "danger",
                    text: result.message || "Import failed",
                };
            }
        } catch (err) {
            importExportMessage = {
                type: "danger",
                text: `Import failed: ${err.message}`,
            };
        } finally {
            isLoading = false;
        }
    }

    // Clear import/export message
    function clearImportExportMessage() {
        importExportMessage = null;
    }

    // Initialize data using $effect
    $effect(() => {
        async function loadData() {
            await fetchLanguages();
            await fetchInterfaceTranslations();
        }
        loadData();
    });
</script>

<div class="container-fluid">
    {#if error}
        <div
            class="alert alert-danger alert-dismissible fade show mt-3"
            role="alert"
        >
            {error}
            <button type="button" class="btn-close" onclick={clearError}
            ></button>
        </div>
    {/if}

    {#if importExportMessage}
        <div
            class="alert alert-{importExportMessage.type} alert-dismissible fade show mt-3"
            role="alert"
        >
            {importExportMessage.text}
            <button
                type="button"
                class="btn-close"
                onclick={clearImportExportMessage}
            ></button>
        </div>
    {/if}

    {#if isLoading}
        <div class="d-flex justify-content-center my-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    {:else}
        <div class="row">
            <!-- Sidebar for namespaces -->
            <div class="col-md-3 col-lg-2 d-md-block bg-light sidebar p-0">
                <div class="position-sticky">
                    <div
                        class="d-flex justify-content-between align-items-center p-3 border-bottom"
                    >
                        <h5 class="m-0">Namespaces</h5>
                        <button
                            class="btn btn-sm btn-primary"
                            onclick={toggleAddNamespaceModal}
                        >
                            <i class="bi bi-plus"></i>
                        </button>
                    </div>
                    <div class="list-group list-group-flush">
                        {#each namespaces as namespace}
                            <button
                                class="list-group-item list-group-item-action {currentNamespace ===
                                namespace
                                    ? 'active'
                                    : ''}"
                                onclick={() => setNamespace(namespace)}
                            >
                                {namespace}
                            </button>
                        {/each}
                        {#if namespaces.length === 0}
                            <div class="list-group-item text-muted">
                                No namespaces found
                            </div>
                        {/if}
                    </div>

                    <!-- Import/Export buttons -->
                    <div class="p-3 border-top">
                        <div class="d-grid gap-2">
                            <button
                                class="btn btn-sm btn-outline-primary"
                                onclick={handleExportTranslations}
                                disabled={isLoading}
                            >
                                <i class="bi bi-download me-1"></i> Export Translations
                            </button>
                            <button
                                class="btn btn-sm btn-outline-secondary"
                                onclick={handleImportTranslations}
                                disabled={isLoading}
                            >
                                <i class="bi bi-upload me-1"></i> Import Translations
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Main content -->
            <div class="col-md-9 col-lg-10 ms-sm-auto px-md-4">
                <div
                    class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom"
                >
                    <h1 class="h2">Interface Translations</h1>
                    {#if currentNamespace}
                        <button
                            class="btn btn-primary"
                            onclick={toggleAddTranslationModal}
                        >
                            <i class="bi bi-plus-lg me-1"></i> Add Translation
                        </button>
                    {/if}
                </div>

                {#if currentNamespace}
                    <h2 class="h4 mb-3">
                        Translations for "{currentNamespace}"
                    </h2>

                    {#if getTranslationsForCurrentNamespace().length > 0}
                        <div class="table-responsive">
                            <table class="table table-striped table-hover">
                                <thead>
                                    <tr>
                                        <th>Key</th>
                                        {#each languages as language}
                                            <th
                                                >{language.name}
                                                {language.is_default
                                                    ? "(Default)"
                                                    : ""}</th
                                            >
                                        {/each}
                                        <th class="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each getTranslationsForCurrentNamespace() as item}
                                        <tr>
                                            <td>{item.key}</td>
                                            {#each languages as language}
                                                <td>
                                                    {#if editingTranslation === item.key}
                                                        <input
                                                            type="text"
                                                            class="form-control form-control-sm"
                                                            bind:value={editedValues[
                                                                language.code
                                                            ]}
                                                            placeholder={item
                                                                .translations[
                                                                language.code
                                                            ] || ""}
                                                        />
                                                    {:else}
                                                        {item.translations[
                                                            language.code
                                                        ] || ""}
                                                    {/if}
                                                </td>
                                            {/each}
                                            <td class="text-end">
                                                {#if editingTranslation === item.key}
                                                    <button
                                                        class="btn btn-sm btn-success me-1"
                                                        onclick={saveEditing}
                                                    >
                                                        <i class="bi bi-check"
                                                        ></i>
                                                    </button>
                                                    <button
                                                        class="btn btn-sm btn-secondary"
                                                        onclick={cancelEditing}
                                                    >
                                                        <i class="bi bi-x"></i>
                                                    </button>
                                                {:else}
                                                    <button
                                                        class="btn btn-sm btn-primary me-1"
                                                        onclick={() =>
                                                            startEditing(
                                                                item.key,
                                                            )}
                                                    >
                                                        <i class="bi bi-pencil"
                                                        ></i>
                                                    </button>
                                                    <button
                                                        class="btn btn-sm btn-danger"
                                                        onclick={() =>
                                                            deleteTranslation(
                                                                item.key,
                                                            )}
                                                    >
                                                        <i class="bi bi-trash"
                                                        ></i>
                                                    </button>
                                                {/if}
                                            </td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    {:else}
                        <div class="alert alert-info">
                            No translations found for this namespace. Add your
                            first translation using the button above.
                        </div>
                    {/if}
                {:else}
                    <div class="alert alert-warning">
                        Please select an existing namespace or create a new one
                        using the button in the sidebar.
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</div>

<!-- Add Translation Modal -->
{#if showAddTranslationModal}
    <div class="modal fade show" style="display: block;" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        Add New Translation to "{currentNamespace}"
                    </h5>
                    <button
                        type="button"
                        class="btn-close"
                        onclick={toggleAddTranslationModal}
                    ></button>
                </div>
                <form
                    onsubmit={(e) => {
                        e.preventDefault();
                        console.log("Form submitted");
                        addTranslation();
                    }}
                >
                    <div class="modal-body">
                        <div class="mb-3">
                            <label for="newTranslationKey" class="form-label"
                                >Translation Key</label
                            >
                            <input
                                type="text"
                                class="form-control"
                                id="newTranslationKey"
                                bind:value={newTranslationKey}
                                placeholder="e.g., welcome.message"
                                required
                            />
                        </div>

                        <hr />
                        <h6>Translations</h6>

                        {#each languages as language}
                            <div class="mb-3">
                                <label
                                    for="translation-{language.code}"
                                    class="form-label"
                                >
                                    {language.name}
                                    {language.is_default ? "(Default)" : ""}
                                </label>
                                <input
                                    type="text"
                                    class="form-control"
                                    id="translation-{language.code}"
                                    bind:value={newTranslationValues[
                                        language.code
                                    ]}
                                    placeholder={`Translation in ${language.name}`}
                                    required
                                />
                            </div>
                        {/each}
                    </div>
                    <div class="modal-footer">
                        <button
                            type="button"
                            class="btn btn-secondary"
                            onclick={toggleAddTranslationModal}>Cancel</button
                        >
                        <button type="submit" class="btn btn-primary"
                            >Add Translation</button
                        >
                        <button
                            type="button"
                            class="btn btn-primary d-none"
                            id="directAddButton"
                            onclick={addTranslation}>Direct Add</button
                        >
                    </div>
                </form>
            </div>
        </div>
    </div>
    <div class="modal-backdrop fade show"></div>
{/if}

<!-- Add Namespace Modal -->
{#if showAddNamespaceModal}
    <div class="modal fade show" style="display: block;" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Add New Namespace</h5>
                    <button
                        type="button"
                        class="btn-close"
                        onclick={toggleAddNamespaceModal}
                    ></button>
                </div>
                <form
                    onsubmit={(e) => {
                        e.preventDefault();
                        addNamespace();
                    }}
                >
                    <div class="modal-body">
                        <div class="mb-3">
                            <label for="newNamespace" class="form-label"
                                >Namespace Name</label
                            >
                            <input
                                type="text"
                                class="form-control"
                                id="newNamespace"
                                bind:value={newNamespace}
                                placeholder="e.g., common, navigation, errors"
                                required
                            />
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button
                            type="button"
                            class="btn btn-secondary"
                            onclick={toggleAddNamespaceModal}>Cancel</button
                        >
                        <button type="submit" class="btn btn-primary"
                            >Add Namespace</button
                        >
                    </div>
                </form>
            </div>
        </div>
    </div>
    <div class="modal-backdrop fade show"></div>
{/if}
