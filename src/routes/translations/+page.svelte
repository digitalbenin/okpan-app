<script>
    // Using Svelte 5 runes syntax
    import { API_SECTIONS } from "$lib/utils/queries.js";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

    // Get the translation store for import/export functionality
    const {
        exportTranslations,
        importTranslations,
        createTranslation,
        updateTranslation,
        deleteTranslation,
        deleteNamespace,
        createNamespace,
    } = getTranslationStore();

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

    // Fetch all languages
    const fetchLanguages = async () => {
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
            newTranslationValues = Object.fromEntries(
                languages.map((lang) => [lang.code, ""]),
            );
        } catch (err) {
            error = `Failed to fetch languages: ${err.message}`;
        }
    };

    // Fetch all interface translations
    const fetchInterfaceTranslations = async () => {
        try {
            isLoading = true;

            const result = await window.api.executeGraphQL(
                interfaceTranslationsQuery,
            );

            if (!result.success || result.errors) {
                throw new Error(
                    result.errors
                        ? result.errors[0].message
                        : "Failed to fetch translations",
                );
            }

            if (!result.data?.interface_translations) {
                throw new Error("No translation data received from server");
            }

            interfaceTranslations = result.data.interface_translations;

            // Extract unique namespaces
            namespaces = [
                ...new Set(
                    result.data.interface_translations.map((t) => t.namespace),
                ),
            ];

            // Set default namespace if available
            if (namespaces.length > 0 && !currentNamespace) {
                currentNamespace = namespaces[0];
            }
        } catch (err) {
            error = `Failed to fetch translations: ${err.message}`;
        } finally {
            isLoading = false;
        }
    };

    // Toggle modals
    const toggleAddNamespaceModal = () => {
        showAddNamespaceModal = !showAddNamespaceModal;
        if (!showAddNamespaceModal) newNamespace = "";
    };

    const toggleAddTranslationModal = () => {
        showAddTranslationModal = !showAddTranslationModal;
        if (!showAddTranslationModal) {
            newTranslationKey = "";
            newTranslationValues = Object.fromEntries(
                languages.map((lang) => [lang.code, ""]),
            );
        }
    };

    // Add a new namespace
    const addNamespace = async () => {
        if (!newNamespace.trim()) {
            error = "Namespace cannot be empty";
            return;
        }

        if (namespaces.includes(newNamespace)) {
            error = "Namespace already exists";
            return;
        }

        try {
            const result = await createNamespace(newNamespace);

            if (!result.success) {
                error = result.error;
                return;
            }

            namespaces = [...namespaces, newNamespace];
            currentNamespace = newNamespace;
            newNamespace = "";
            error = null;
            toggleAddNamespaceModal();
        } catch (err) {
            error = `Failed to create namespace: ${err.message}`;
        }
    };

    // Add a new translation
    const addTranslation = async () => {
        if (!newTranslationKey.trim()) {
            error = "Translation key cannot be empty";
            return;
        }

        if (!currentNamespace) {
            error = "Please select or create a namespace first";
            return;
        }

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

            // Use the store method to create the translation
            const result = await createTranslation(
                currentNamespace,
                newTranslationKey,
                newTranslationValues,
            );

            if (!result.success) {
                throw new Error(result.error || "Failed to add translation");
            }

            // Reset form and close modal
            newTranslationKey = "";
            newTranslationValues = Object.fromEntries(
                languages.map((lang) => [lang.code, ""]),
            );
            toggleAddTranslationModal();

            // Refresh translations
            await fetchInterfaceTranslations();
        } catch (err) {
            error = `Failed to add translation: ${err.message}`;
        } finally {
            isLoading = false;
        }
    };

    // Start editing a translation
    const startEditing = (key) => {
        const keyTranslations = interfaceTranslations.filter(
            (t) => t.key === key && t.namespace === currentNamespace,
        );
        editingTranslation = key;
        editedValues = Object.fromEntries(
            keyTranslations.map((t) => [t.locale, t.value]),
        );
    };

    // Save edited translation
    const saveEditing = async () => {
        if (!editingTranslation) return;

        try {
            isLoading = true;
            error = null;

            // Use the store method to update the translation
            const result = await updateTranslation(
                currentNamespace,
                editingTranslation,
                editedValues,
            );

            if (!result.success) {
                throw new Error(result.error || "Failed to update translation");
            }

            // Reset editing state
            editingTranslation = null;
            editedValues = {};

            // Refresh translations
            await fetchInterfaceTranslations();
        } catch (err) {
            error = `Failed to update translation: ${err.message}`;
        } finally {
            isLoading = false;
        }
    };

    const cancelEditing = () => {
        editingTranslation = null;
        editedValues = {};
    };

    // Delete a translation
    const handleDeleteTranslation = async (key) => {
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

            const result = await deleteTranslation(currentNamespace, key);

            if (!result.success) {
                throw new Error(result.error || "Failed to delete translation");
            }

            // Refresh translations
            await fetchInterfaceTranslations();
        } catch (err) {
            error = `Failed to delete translation: ${err.message}`;
        } finally {
            isLoading = false;
        }
    };

    // Delete a namespace
    const handleDeleteNamespace = async (namespace) => {
        if (
            !confirm(
                `Are you sure you want to delete the namespace "${namespace}" and all its translations?`,
            )
        ) {
            return;
        }

        try {
            isLoading = true;
            error = null;

            const result = await deleteNamespace(namespace);

            if (!result.success) {
                throw new Error(result.error || "Failed to delete namespace");
            }

            // Reset current namespace if it was deleted
            if (currentNamespace === namespace) {
                currentNamespace = "";
            }

            // Refresh translations
            await fetchInterfaceTranslations();
        } catch (err) {
            error = `Failed to delete namespace: ${err.message}`;
        } finally {
            isLoading = false;
        }
    };

    // Helper functions
    const getTranslationsForCurrentNamespace = () => {
        if (!currentNamespace) return [];

        const keys = [
            ...new Set(
                interfaceTranslations
                    .filter((t) => t.namespace === currentNamespace)
                    .map((t) => t.key),
            ),
        ];

        return keys.map((key) => ({
            key,
            translations: Object.fromEntries(
                interfaceTranslations
                    .filter(
                        (t) =>
                            t.key === key && t.namespace === currentNamespace,
                    )
                    .map((t) => [t.locale, t.value]),
            ),
        }));
    };

    const setNamespace = (namespace) => {
        currentNamespace = namespace;
    };

    const clearError = () => {
        error = null;
    };

    // Import/Export functions
    const handleExportTranslations = async () => {
        try {
            isLoading = true;
            importExportMessage = null;
            const result = await exportTranslations();
            importExportMessage = {
                type: result.success ? "success" : "danger",
                text: result.success
                    ? `Translations exported successfully to ${result.filePath}`
                    : result.message || "Export failed",
            };
        } catch (err) {
            importExportMessage = {
                type: "danger",
                text: `Export failed: ${err.message}`,
            };
        } finally {
            isLoading = false;
        }
    };

    const handleImportTranslations = async () => {
        try {
            isLoading = true;
            importExportMessage = null;
            const result = await importTranslations();

            if (result.success) {
                importExportMessage = {
                    type: "success",
                    text: `Translations imported successfully: ${result.stats.imported} new, ${result.stats.updated} updated, ${result.stats.errors} errors`,
                };
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
    };

    const clearImportExportMessage = () => {
        importExportMessage = null;
    };

    // Initialize data
    $effect(() => {
        fetchLanguages();
        fetchInterfaceTranslations();
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
            <!-- Sidebar for namespaces - removed bg-light -->
            <div class="col-md-3 col-lg-2 d-md-block sidebar p-0">
                <div class="position-sticky">
                    <div
                        class="d-flex justify-content-start align-items-start gap-2 p-3"
                    >
                        <h5 class="m-0">Namespaces</h5>
                        <button
                            class="btn btn-link p-0 text-decoration-none"
                            onclick={toggleAddNamespaceModal}
                        >
                            <i class="bi bi-plus-circle"></i>
                        </button>
                    </div>
                    <div class="py-2">
                        {#each namespaces as namespace}
                            <div class="d-flex align-items-center">
                                <button
                                    class="btn btn-link text-start flex-grow-1 text-decoration-none {currentNamespace ===
                                    namespace
                                        ? 'text-primary fw-bold'
                                        : 'text-body'}"
                                    onclick={() => setNamespace(namespace)}
                                >
                                    {namespace}
                                </button>
                                <button
                                    class="btn btn-link text-danger p-1"
                                    onclick={() =>
                                        handleDeleteNamespace(namespace)}
                                    title="Delete namespace"
                                >
                                    <i class="bi bi-x-circle"></i>
                                </button>
                            </div>
                        {/each}
                        {#if namespaces.length === 0}
                            <div class="px-3 text-muted">
                                No namespaces found
                            </div>
                        {/if}
                    </div>
                </div>
            </div>

            <!-- Main content -->
            <div class="col-md-9 col-lg-10 ms-sm-auto px-md-4">
                <div
                    class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3"
                >
                    <h1 class="h2">Interface Translations</h1>

                    <!-- Action buttons side by side -->
                    <div class="d-flex gap-2">
                        <button
                            class="btn btn-sm btn-outline-secondary"
                            onclick={handleExportTranslations}
                            disabled={isLoading}
                        >
                            <i class="bi bi-download me-1"></i> Export
                        </button>
                        <button
                            class="btn btn-sm btn-outline-secondary"
                            onclick={handleImportTranslations}
                            disabled={isLoading}
                        >
                            <i class="bi bi-upload me-1"></i> Import
                        </button>
                        {#if currentNamespace}
                            <button
                                class="btn btn-sm btn-primary"
                                onclick={toggleAddTranslationModal}
                            >
                                <i class="bi bi-plus-lg me-1"></i> Add Translation
                            </button>
                        {/if}
                    </div>
                </div>

                {#if currentNamespace}
                    {#if getTranslationsForCurrentNamespace().length > 0}
                        <div class="table-responsive">
                            <table class="table table-sm table-hover">
                                <thead>
                                    <tr>
                                        <th>Key</th>
                                        {#each languages as language}
                                            <th>
                                                {language.name}
                                                {#if language.is_default}
                                                    <span class="text-muted"
                                                        >(Default)</span
                                                    >
                                                {/if}
                                            </th>
                                        {/each}
                                        <th class="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each getTranslationsForCurrentNamespace() as item}
                                        <tr class="align-middle">
                                            <td class="fw-medium">
                                                {item.key}
                                            </td>
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
                                                        class="btn btn-sm btn-link text-success p-1"
                                                        onclick={saveEditing}
                                                    >
                                                        <i
                                                            class="bi bi-check-lg"
                                                        ></i>
                                                    </button>
                                                    <button
                                                        class="btn btn-sm btn-link text-secondary p-1"
                                                        onclick={cancelEditing}
                                                    >
                                                        <i class="bi bi-x-lg"
                                                        ></i>
                                                    </button>
                                                {:else}
                                                    <button
                                                        class="btn btn-sm btn-link text-primary p-1"
                                                        onclick={() =>
                                                            startEditing(
                                                                item.key,
                                                            )}
                                                    >
                                                        <i class="bi bi-pencil"
                                                        ></i>
                                                    </button>
                                                    <button
                                                        class="btn btn-sm btn-link text-danger p-1"
                                                        onclick={() =>
                                                            handleDeleteTranslation(
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
                        using the + button in the sidebar.
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
                            class="btn btn-sm btn-outline-secondary"
                            onclick={toggleAddTranslationModal}>Cancel</button
                        >
                        <button type="submit" class="btn btn-sm btn-primary"
                            >Add Translation</button
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
                            class="btn btn-sm btn-outline-secondary"
                            onclick={toggleAddNamespaceModal}>Cancel</button
                        >
                        <button type="submit" class="btn btn-sm btn-primary"
                            >Add Namespace</button
                        >
                    </div>
                </form>
            </div>
        </div>
    </div>
    <div class="modal-backdrop fade show"></div>
{/if}
