<script>
    import { API_SECTIONS } from "$lib/utils/queries.js";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { addToast } from "$lib/components/base/BaseToast.svelte";
    import { getLogStore } from "$lib/stores/LogStore.svelte.js";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseModal from "$lib/components/base/BaseModal.svelte";

    // Initialize stores
    const translationStore = getTranslationStore();
    const {
        exportTranslations,
        importTranslations,
        createTranslation,
        updateTranslation,
        deleteTranslation,
        deleteNamespace,
        createNamespace,
        t,
    } = translationStore;
    const { error: logError } = getLogStore();

    // State
    let languages = $state([]);
    let interfaceTranslations = $state([]);
    let namespaces = $state([]);
    let currentNamespace = $state("");
    let isLoading = $state(true);
    let newTranslationKey = $state("");
    let newTranslationValues = $state({});
    let newNamespace = $state("");
    let showAddTranslationModal = $state(false);
    let showAddNamespaceModal = $state(false);
    let editingTranslation = $state(null);
    let editedValues = $state({});

    // Get API queries
    const languagesQuery =
        API_SECTIONS.interface_languages.operations.list.query;
    const interfaceTranslationsQuery =
        API_SECTIONS.interface_translations.operations.list.query;

    // Initialize
    $effect(() => {
        const initializeData = async () => {
            isLoading = true;
            try {
                // Initialize store first if needed
                if (!translationStore.translationState.isInitialized) {
                    await translationStore.initialize();
                }

                // Only fetch data if we have languages and translations
                if (translationStore.translationState.languages.length > 0) {
                    languages = translationStore.translationState.languages;

                    // Set up translation value placeholder
                    newTranslationValues = Object.fromEntries(
                        languages.map((lang) => [lang.code, ""]),
                    );

                    // Convert from nested to flat structure only when needed
                    const translations = Object.entries(
                        translationStore.translationState.translations,
                    ).flatMap(([namespace, keys]) =>
                        Object.entries(keys).flatMap(([key, locales]) =>
                            Object.entries(locales).map(([locale, value]) => ({
                                namespace,
                                key,
                                locale,
                                value,
                            })),
                        ),
                    );

                    // Only update if changed to avoid loops
                    if (
                        JSON.stringify(interfaceTranslations) !==
                        JSON.stringify(translations)
                    ) {
                        interfaceTranslations = translations;

                        // Update namespaces
                        const newNamespaces = [
                            ...new Set(
                                interfaceTranslations.map((t) => t.namespace),
                            ),
                        ];
                        if (
                            JSON.stringify(namespaces) !==
                            JSON.stringify(newNamespaces)
                        ) {
                            namespaces = newNamespaces;

                            // Set current namespace if not already set
                            if (namespaces.length && !currentNamespace) {
                                currentNamespace = namespaces[0];
                            }
                        }
                    }
                } else {
                    // If no data yet, this is the first load
                    console.log(
                        "No translation data yet, waiting for initialization",
                    );
                }
            } catch (err) {
                console.error("Error initializing translations:", err);
                addToast({
                    data: {
                        title: t("common.error", { fallback: "Error" }),
                        description: `Failed to initialize translations: ${err.message}`,
                        type: "error",
                    },
                });
                await logError("initialize_translations", err.message);
            } finally {
                isLoading = false;
            }
        };

        // Run initialization
        initializeData();
    });

    // Modal handlers
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

    // Function to set the current namespace
    const setNamespace = (namespace) => {
        currentNamespace = namespace;
    };

    // CRUD operations
    async function addNamespace() {
        if (!newNamespace.trim()) {
            addToast({
                data: {
                    title: t("common.error", { fallback: "Error" }),
                    description: t("translations.error_empty_namespace", {
                        fallback: "Namespace cannot be empty",
                    }),
                    type: "error",
                },
            });
            return;
        }

        try {
            const result = await createNamespace(newNamespace);
            if (!result.success) throw new Error(result.error);

            namespaces = [...namespaces, newNamespace];
            currentNamespace = newNamespace;
            newNamespace = "";
            toggleAddNamespaceModal();
            addToast({
                data: {
                    title: t("common.success", { fallback: "Success" }),
                    description: t("translations.namespace_created", {
                        fallback: "Namespace created",
                    }),
                    type: "success",
                },
            });
        } catch (err) {
            addToast({
                data: {
                    title: t("common.error", { fallback: "Error" }),
                    description: err.message,
                    type: "error",
                },
            });
            await logError("add_namespace", err.message);
        }
    }

    async function addTranslation() {
        if (!newTranslationKey.trim() || !currentNamespace) {
            addToast({
                data: {
                    title: t("common.error", { fallback: "Error" }),
                    description: t("translations.error_invalid_input", {
                        fallback: "Invalid input",
                    }),
                    type: "error",
                },
            });
            return;
        }

        try {
            isLoading = true;
            const result = await createTranslation(
                currentNamespace,
                newTranslationKey,
                newTranslationValues,
            );
            if (!result.success) throw new Error(result.error);

            toggleAddTranslationModal();
            // Refresh translations
            await translationStore.refreshTranslations();
            addToast({
                data: {
                    title: t("common.success", { fallback: "Success" }),
                    description: t("translations.translation_added", {
                        fallback: "Translation added",
                    }),
                    type: "success",
                },
            });
        } catch (err) {
            addToast({
                data: {
                    title: t("common.error", { fallback: "Error" }),
                    description: err.message,
                    type: "error",
                },
            });
            await logError("add_translation", err.message);
        } finally {
            isLoading = false;
        }
    }

    // Edit handlers
    const startEditing = (key) => {
        const translations = interfaceTranslations.filter(
            (t) => t.key === key && t.namespace === currentNamespace,
        );
        editingTranslation = key;
        editedValues = Object.fromEntries(
            translations.map((t) => [t.locale, t.value]),
        );
    };

    async function saveEditing() {
        if (!editingTranslation) return;

        try {
            isLoading = true;
            const result = await updateTranslation(
                currentNamespace,
                editingTranslation,
                editedValues,
            );
            if (!result.success) throw new Error(result.error);

            editingTranslation = null;
            editedValues = {};
            // Refresh translations
            await translationStore.refreshTranslations();
            addToast({
                data: {
                    title: t("common.success", { fallback: "Success" }),
                    description: t("translations.translation_updated", {
                        fallback: "Translation updated",
                    }),
                    type: "success",
                },
            });
        } catch (err) {
            addToast({
                data: {
                    title: t("common.error", { fallback: "Error" }),
                    description: err.message,
                    type: "error",
                },
            });
            await logError("update_translation", err.message);
        } finally {
            isLoading = false;
        }
    }

    const cancelEditing = () => {
        editingTranslation = null;
        editedValues = {};
    };

    // Delete handlers
    async function handleDeleteTranslation(key) {
        if (
            !confirm(
                t("translations.confirm_delete_translation", {
                    fallback: `Delete translation "${key}"?`,
                    key,
                }),
            )
        )
            return;

        try {
            isLoading = true;
            const result = await deleteTranslation(currentNamespace, key);
            if (!result.success) throw new Error(result.error);

            // Refresh translations
            await translationStore.refreshTranslations();
            addToast({
                data: {
                    title: t("common.success", { fallback: "Success" }),
                    description: t("translations.translation_deleted", {
                        fallback: "Translation deleted",
                    }),
                    type: "success",
                },
            });
        } catch (err) {
            addToast({
                data: {
                    title: t("common.error", { fallback: "Error" }),
                    description: err.message,
                    type: "error",
                },
            });
            await logError("delete_translation", err.message);
        } finally {
            isLoading = false;
        }
    }

    async function handleDeleteNamespace(namespace) {
        if (
            !confirm(
                t("translations.confirm_delete_namespace", {
                    fallback: `Delete namespace "${namespace}"?`,
                    namespace,
                }),
            )
        )
            return;

        try {
            isLoading = true;
            const result = await deleteNamespace(namespace);
            if (!result.success) throw new Error(result.error);

            if (currentNamespace === namespace) currentNamespace = "";
            // Refresh translations
            await translationStore.refreshTranslations();
            addToast({
                data: {
                    title: t("common.success", { fallback: "Success" }),
                    description: t("translations.namespace_deleted", {
                        fallback: "Namespace deleted",
                    }),
                    type: "success",
                },
            });
        } catch (err) {
            addToast({
                data: {
                    title: t("common.error", { fallback: "Error" }),
                    description: err.message,
                    type: "error",
                },
            });
            await logError("delete_namespace", err.message);
        } finally {
            isLoading = false;
        }
    }

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

    // Import/Export handlers
    async function handleExportTranslations() {
        try {
            isLoading = true;
            const result = await exportTranslations();
            addToast({
                data: {
                    title: result.success
                        ? t("common.success", { fallback: "Success" })
                        : t("common.error", { fallback: "Error" }),
                    description: result.success
                        ? t("translations.export_success", {
                              fallback: `Exported to ${result.filePath}`,
                              filePath: result.filePath,
                          })
                        : result.message,
                    type: result.success ? "success" : "error",
                },
            });
        } catch (err) {
            addToast({
                data: {
                    title: t("common.error", { fallback: "Error" }),
                    description: err.message,
                    type: "error",
                },
            });
            await logError("export_translations", err.message);
        } finally {
            isLoading = false;
        }
    }

    async function handleImportTranslations() {
        try {
            isLoading = true;
            const result = await importTranslations();
            if (result.success) {
                // Refresh the translation store instead of calling individual fetch functions
                await translationStore.initialize();

                // The effect will automatically update the UI with new data
                addToast({
                    data: {
                        title: t("common.success", { fallback: "Success" }),
                        description: t("translations.import_success", {
                            fallback: `Imported: ${result.stats.imported} new, ${result.stats.updated} updated`,
                            imported: result.stats.imported,
                            updated: result.stats.updated,
                        }),
                        type: "success",
                    },
                });
            } else {
                throw new Error(result.message);
            }
        } catch (err) {
            addToast({
                data: {
                    title: t("common.error", { fallback: "Error" }),
                    description: err.message,
                    type: "error",
                },
            });
            await logError("import_translations", err.message);
        } finally {
            isLoading = false;
        }
    }
</script>

<div class="container-fluid">
    {#if isLoading}
        <div class="d-flex justify-content-center my-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden"
                    >{t("common.loading", { fallback: "Loading..." })}</span
                >
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
                        <h5 class="m-0">
                            {t("translations.namespaces", {
                                fallback: "Namespaces",
                            })}
                        </h5>
                        <BaseButton
                            text=""
                            icon="plus-circle"
                            onClick={toggleAddNamespaceModal}
                            class="btn btn-link p-0 text-decoration-none"
                        />
                    </div>
                    <div class="py-2">
                        {#each namespaces as namespace}
                            <div class="d-flex align-items-center">
                                <BaseButton
                                    text={namespace}
                                    onClick={() => setNamespace(namespace)}
                                    class="btn btn-link text-start flex-grow-1 text-decoration-none {currentNamespace ===
                                    namespace
                                        ? 'text-primary fw-bold'
                                        : 'text-body'}"
                                />
                                <BaseButton
                                    text=""
                                    icon="x-circle"
                                    onClick={() =>
                                        handleDeleteNamespace(namespace)}
                                    class="btn btn-link text-danger p-1"
                                />
                            </div>
                        {/each}
                        {#if namespaces.length === 0}
                            <div class="px-3 text-muted">
                                {t("translations.no_namespaces", {
                                    fallback: "No namespaces found",
                                })}
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
                    <h1 class="h2">
                        {t("translations.interface_translations", {
                            fallback: "Interface Translations",
                        })}
                    </h1>

                    <!-- Action buttons side by side -->
                    <div class="d-flex gap-2">
                        <BaseButton
                            text={t("translations.export", {
                                fallback: "Export",
                            })}
                            icon="download"
                            iconPosition="left"
                            onClick={handleExportTranslations}
                            disabled={isLoading}
                            class="btn btn-sm btn-outline-secondary"
                        />
                        <BaseButton
                            text={t("translations.import", {
                                fallback: "Import",
                            })}
                            icon="upload"
                            iconPosition="left"
                            onClick={handleImportTranslations}
                            disabled={isLoading}
                            class="btn btn-sm btn-outline-secondary"
                        />
                        {#if currentNamespace}
                            <BaseButton
                                text={t("translations.add_translation", {
                                    fallback: "Add Translation",
                                })}
                                icon="plus-lg"
                                iconPosition="left"
                                onClick={toggleAddTranslationModal}
                                class="btn btn-sm btn-primary"
                            />
                        {/if}
                    </div>
                </div>

                {#if currentNamespace}
                    {#if getTranslationsForCurrentNamespace().length > 0}
                        <div class="table-responsive">
                            <table class="table table-sm table-hover">
                                <thead>
                                    <tr>
                                        <th
                                            >{t("translations.key", {
                                                fallback: "Key",
                                            })}</th
                                        >
                                        {#each languages as language}
                                            <th>
                                                {language.name}
                                                {#if language.code === "en"}
                                                    <span class="text-muted"
                                                        >({t(
                                                            "translations.default",
                                                            {
                                                                fallback:
                                                                    "Default",
                                                            },
                                                        )})</span
                                                    >
                                                {/if}
                                            </th>
                                        {/each}
                                        <th class="text-end"
                                            >{t("translations.actions", {
                                                fallback: "Actions",
                                            })}</th
                                        >
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
                                                            bind:value={
                                                                editedValues[
                                                                    language
                                                                        .code
                                                                ]
                                                            }
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
                                            <td
                                                class="text-end d-flex gap-2 justify-content-end"
                                            >
                                                {#if editingTranslation === item.key}
                                                    <BaseButton
                                                        text=""
                                                        icon="check-lg"
                                                        onClick={saveEditing}
                                                        class="btn btn-sm btn-link text-success p-1"
                                                    />
                                                    <BaseButton
                                                        text=""
                                                        icon="x-lg"
                                                        onClick={cancelEditing}
                                                        class="btn btn-sm btn-link text-secondary p-1"
                                                    />
                                                {:else}
                                                    <BaseButton
                                                        text=""
                                                        icon="pencil"
                                                        onClick={() =>
                                                            startEditing(
                                                                item.key,
                                                            )}
                                                        class="btn btn-sm btn-link text-primary p-1"
                                                    />
                                                    <BaseButton
                                                        text=""
                                                        icon="trash"
                                                        onClick={() =>
                                                            handleDeleteTranslation(
                                                                item.key,
                                                            )}
                                                        class="btn btn-sm btn-link text-danger p-1"
                                                    />
                                                {/if}
                                            </td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    {:else}
                        <div class="alert alert-info">
                            {t("translations.no_translations_for_namespace", {
                                fallback:
                                    "No translations found for this namespace. Add your first translation using the button above.",
                            })}
                        </div>
                    {/if}
                {:else}
                    <div class="alert alert-warning">
                        {t("translations.select_namespace", {
                            fallback:
                                "Please select an existing namespace or create a new one using the + button in the sidebar.",
                        })}
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</div>

<!-- Add Translation Modal -->
<BaseModal bind:isOpen={showAddTranslationModal} size="lg">
    {#snippet header()}
        {t("translations.add_new_translation_to", {
            fallback: 'Add New Translation to "{namespace}"',
            namespace: currentNamespace,
        })}
    {/snippet}

    {#snippet body()}
        <form
            onsubmit={(e) => {
                e.preventDefault();
                addTranslation();
            }}
        >
            <div class="mb-3">
                <label for="newTranslationKey" class="form-label">
                    {t("translations.translation_key", {
                        fallback: "Translation Key",
                    })}
                </label>
                <input
                    type="text"
                    class="form-control"
                    id="newTranslationKey"
                    bind:value={newTranslationKey}
                    placeholder={t("translations.translation_key_placeholder", {
                        fallback: "e.g., welcome.message",
                    })}
                    required
                />
            </div>

            <hr />
            <h6>
                {t("translations.translations", {
                    fallback: "Translations",
                })}
            </h6>

            {#each languages as language}
                <div class="mb-3">
                    <label for="translation-{language.code}" class="form-label">
                        {language.name}
                        {#if language.code === "en"}
                            ({t("translations.default", {
                                fallback: "Default",
                            })})
                        {/if}
                    </label>
                    <input
                        type="text"
                        class="form-control"
                        id="translation-{language.code}"
                        bind:value={newTranslationValues[language.code]}
                        placeholder={t("translations.translation_in_language", {
                            fallback: `Translation in ${language.name}`,
                            language: language.name,
                        })}
                        required
                    />
                </div>
            {/each}
        </form>
    {/snippet}

    {#snippet actions()}
        <div class="d-flex gap-2">
            <BaseButton
                text={t("common.cancel", { fallback: "Cancel" })}
                onClick={toggleAddTranslationModal}
                class="btn btn-secondary"
            />
            <BaseButton
                text={t("translations.add_translation", {
                    fallback: "Add Translation",
                })}
                onClick={addTranslation}
                class="btn btn-primary"
            />
        </div>
    {/snippet}
</BaseModal>

<!-- Add Namespace Modal -->
<BaseModal bind:isOpen={showAddNamespaceModal}>
    {#snippet header()}
        {t("translations.add_new_namespace", {
            fallback: "Add New Namespace",
        })}
    {/snippet}

    {#snippet body()}
        <form
            onsubmit={(e) => {
                e.preventDefault();
                addNamespace();
            }}
        >
            <div class="mb-3">
                <label for="newNamespace" class="form-label">
                    {t("translations.namespace_name", {
                        fallback: "Namespace Name",
                    })}
                </label>
                <input
                    type="text"
                    class="form-control"
                    id="newNamespace"
                    bind:value={newNamespace}
                    placeholder={t("translations.namespace_placeholder", {
                        fallback: "e.g., common, navigation, errors",
                    })}
                    required
                />
            </div>
        </form>
    {/snippet}

    {#snippet actions()}
        <div class="d-flex gap-2">
            <BaseButton
                text={t("common.cancel", { fallback: "Cancel" })}
                onClick={toggleAddNamespaceModal}
                class="btn btn-secondary"
            />
            <BaseButton
                text={t("translations.add_namespace", {
                    fallback: "Add Namespace",
                })}
                onClick={addNamespace}
                class="btn btn-primary"
            />
        </div>
    {/snippet}
</BaseModal>
