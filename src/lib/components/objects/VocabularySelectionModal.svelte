<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseModal from "$lib/components/base/BaseModal.svelte";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import { addVocabulary as addVocabularyAPI } from "$lib/stores/ResearchFieldsUtils.js";

    // Props
    let {
        isOpen = $bindable(false),
        field = null,
        vocabularyFields = $bindable([]),
        currentSelections = $bindable([]), // Array of { fieldId, vocabularyId }
        onSave = null,
        onCancel = null,
        defaultLanguageId = null,
    } = $props();

    const { t } = getTranslationStore();

    // Local state
    let searchQuery = $state("");
    let selectedFieldId = $state("all");
    let isCreating = $state(false);
    let creationError = $state(null);
    let createdVocabularies = $state([]);
    let showCreateForm = $state(false);
    let newConnectionType = $state("");
    let newConnectionTitle = $state("");
    let newConnectionDescription = $state("");
    let newConnectionExternalLink = $state("");
    let expandedDescriptions = $state(new Set());

    // Reset search when modal opens
    $effect(() => {
        if (isOpen) {
            searchQuery = "";
            selectedFieldId = "all";
            creationError = null;
            isCreating = false;
            createdVocabularies = [];
            showCreateForm = false;
            newConnectionType = "";
            newConnectionTitle = "";
            newConnectionDescription = "";
            newConnectionExternalLink = "";
            expandedDescriptions = new Set();
        }
    });

    // Get the currently selected field from vocabularyFields
    const currentField = $derived.by(() => 
        selectedFieldId === "all" ? null : 
        vocabularyFields.find(f => f.id === selectedFieldId) || field
    );

    // Get vocabulary IDs selected for the current field (or all if 'all' selected)
    const selectedIdsForCurrentField = $derived.by(() => 
        selectedFieldId === "all" ? currentSelections.map(sel => sel.vocabularyId) :
        !currentField ? [] :
        currentSelections.filter(sel => sel.fieldId === currentField.id).map(sel => sel.vocabularyId)
    );

    // Filter vocabularies based on search and selected field
    const filteredVocabularies = $derived.by(() => {
        const allVocabs = selectedFieldId === "all" 
            ? vocabularyFields.flatMap(field => 
                (field.vocabularies || []).map(vocab => ({
                    ...vocab,
                    _fieldId: field.id,
                    _fieldName: field.name?.content || "Unknown"
                }))
            )
            : (currentField?.vocabularies || []).map(vocab => ({
                ...vocab,
                _fieldId: currentField.id,
                _fieldName: currentField.name?.content || "Unknown"
            }));

        return searchQuery.trim() 
            ? allVocabs.filter(vocab => vocab.option?.content?.toLowerCase().includes(searchQuery.toLowerCase()))
            : allVocabs;
    });

    const isSelected = (vocabularyId, fieldId) => 
        currentSelections.some(sel => sel.vocabularyId === vocabularyId && sel.fieldId === fieldId);

    const toggleVocabulary = (vocabularyId, fieldId) => {
        currentSelections = isSelected(vocabularyId, fieldId)
            ? currentSelections.filter(sel => !(sel.fieldId === fieldId && sel.vocabularyId === vocabularyId))
            : [...currentSelections, { fieldId, vocabularyId }];
    };

    const handleSave = () => onSave?.({ selections: currentSelections, created: createdVocabularies });
    const handleCancel = () => {
        if (showCreateForm) {
            showCreateForm = false;
        } else {
            onCancel?.();
        }
    };

    const toggleDescription = (vocabId) => {
        const newSet = new Set(expandedDescriptions);
        if (newSet.has(vocabId)) {
            newSet.delete(vocabId);
        } else {
            newSet.add(vocabId);
        }
        expandedDescriptions = newSet;
    };

    const handleAddNewConnection = () => {
        showCreateForm = true;
    };

    async function createNewVocabulary() {
        const optionText = searchQuery.trim();
        if (!optionText) return creationError = t("common.validation.required", { fallback: "Value is required" });
        if (!defaultLanguageId) return creationError = t("objects.research_fields.default_language_required", { fallback: "Default language is required to create a new option." });
        if (selectedFieldId === "all" || !currentField?.id) return creationError = t("objects.connections.select_specific_type", { fallback: "Please select a specific connection type to create a new item." });

        creationError = null;

        isCreating = true;
        try {
            const { result, error } = await addVocabularyAPI(currentField.id, {
                languageId: defaultLanguageId,
                option: optionText,
                description: "",
            });
            if (error) return creationError = typeof error === "string" ? error : error?.message || "Failed to create vocabulary";

            const newId = result?.insertIntoVocabularies?.[0]?.id;
            if (!newId) return creationError = "Failed to obtain new vocabulary ID.";

            const newVocab = {
                id: newId,
                mainAsset: null,
                vocabulariesGenericAssets: [],
                option: { content: optionText },
                description: { content: "" },
            };

            const fieldIndex = vocabularyFields.findIndex(f => f.id === currentField.id);
            if (fieldIndex !== -1) {
                vocabularyFields[fieldIndex] = { 
                    ...vocabularyFields[fieldIndex], 
                    vocabularies: [newVocab, ...(vocabularyFields[fieldIndex].vocabularies || [])] 
                };
                vocabularyFields = [...vocabularyFields];
            }

            createdVocabularies = [...createdVocabularies, newVocab];
            currentSelections = [...currentSelections, { fieldId: currentField.id, vocabularyId: newId }];
        } catch (e) {
            creationError = e?.message || "Unexpected error while creating vocabulary";
        } finally {
            isCreating = false;
        }
    }

    async function handleCreateConnection() {
        if (!newConnectionTitle.trim()) {
            creationError = t("common.validation.required", { fallback: "Title is required" });
            return;
        }
        if (!newConnectionType) {
            creationError = t("objects.connections.select_specific_type", { fallback: "Please select a connection type" });
            return;
        }
        if (!defaultLanguageId) {
            creationError = t("objects.research_fields.default_language_required", { fallback: "Default language is required to create a new option." });
            return;
        }

        creationError = null;
        isCreating = true;

        try {
            const selectedField = vocabularyFields.find(f => f.id === newConnectionType);
            if (!selectedField) {
                creationError = "Selected connection type not found";
                return;
            }

            const { result, error } = await addVocabularyAPI(selectedField.id, {
                languageId: defaultLanguageId,
                option: newConnectionTitle.trim(),
                description: newConnectionDescription.trim(),
            });

            if (error) {
                creationError = typeof error === "string" ? error : error?.message || "Failed to create connection";
                return;
            }

            const newId = result?.insertIntoVocabularies?.[0]?.id;
            if (!newId) {
                creationError = "Failed to obtain new connection ID.";
                return;
            }

            const newVocab = {
                id: newId,
                mainAsset: null,
                vocabulariesGenericAssets: [],
                option: { content: newConnectionTitle.trim() },
                description: { content: newConnectionDescription.trim() },
            };

            const fieldIndex = vocabularyFields.findIndex(f => f.id === selectedField.id);
            if (fieldIndex !== -1) {
                vocabularyFields[fieldIndex] = { 
                    ...vocabularyFields[fieldIndex], 
                    vocabularies: [newVocab, ...(vocabularyFields[fieldIndex].vocabularies || [])] 
                };
                vocabularyFields = [...vocabularyFields];
            }

            createdVocabularies = [...createdVocabularies, newVocab];
            currentSelections = [...currentSelections, { fieldId: selectedField.id, vocabularyId: newId }];

            // Reset form and slide back
            showCreateForm = false;
            newConnectionType = "";
            newConnectionTitle = "";
            newConnectionDescription = "";
            newConnectionExternalLink = "";
        } catch (e) {
            creationError = e?.message || "Unexpected error while creating connection";
        } finally {
            isCreating = false;
        }
    }
</script>

{#snippet header()}
    {#if showCreateForm}
        {t("objects.connections.add_new_connection", {
            fallback: "Add new connection",
        })}
    {:else}
        {t("objects.connections.add_connection", {
            fallback: "Add connection",
        })}
    {/if}
{/snippet}

{#snippet body()}
    <div class="position-relative" style="overflow: hidden; height: 60vh;">
        <!-- Main list view -->
        <div class="w-100 h-100" style="transition: transform 0.3s ease-in-out; {showCreateForm ? 'transform: translateX(-100%); position: absolute; top: 0; left: 0;' : ''}">
            <!-- Fixed header section -->
            <div class="flex-shrink-0">
                <!-- Search Bar and Connection Type Filter in a row -->
                <div class="d-flex gap-3 m-2">
                    <!-- Connection Type Filter -->
                    <div style="min-width: 200px;">
                        <select 
                            class="form-select"
                            bind:value={selectedFieldId}
                        >
                            <option value="all">
                                {t("objects.connections.all_types", { fallback: "All connection type" })}
                            </option>
                            {#each vocabularyFields as vocabField}
                                <option value={vocabField.id}>
                                    {vocabField.name?.content || "Unnamed field"}
                                </option>
                            {/each}
                        </select>
                    </div>

                    <!-- Search Bar -->
                    <div class="flex-grow-1">
                        <div class="position-relative">
                            <input
                                type="text"
                                class="form-control"
                                placeholder={t("common.search", {
                                    fallback: "Search",
                                })}
                                bind:value={searchQuery}
                            />
                            <div class="position-absolute top-50 end-0 translate-middle-y pe-3">
                                <i class="bi bi-search text-muted"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="d-flex justify-content-end mb-3 px-2">
                    <BaseButton
                        class="btn btn-link btn-sm text-primary-dark text-decoration-none"
                        icon="plus-circle-fill"
                        text={t("objects.connections.add_new_connection", { fallback: "Add new connection" })}
                        onClick={handleAddNewConnection}
                    />
                </div>
            </div>

            <!-- Vocabulary List - scrollable -->
            <div class="vocabulary-list" style="overflow-y: auto; height: calc(100% - 120px);">
                {#each filteredVocabularies as vocab (`${vocab._fieldId}_${vocab.id}`)}
                    <div class="border-bottom">
                        <div class="d-flex align-items-center p-3">
                            <!-- Checkbox -->
                            <div class="me-3">
                                <input
                                    type="checkbox"
                                    class="form-check-input"
                                    checked={isSelected(vocab.id, vocab._fieldId)}
                                    onchange={() => toggleVocabulary(vocab.id, vocab._fieldId)}
                                    style="width: 20px; height: 20px; cursor: pointer;"
                                />
                            </div>

                            <!-- Main Asset Image -->
                            <div class="me-3">
                                <BaseImage
                                    asset={vocab.mainAsset}
                                    preferredFormat="sm"
                                    alt={vocab.option?.content || "Vocabulary option"}
                                    width={48}
                                    height={48}
                                    class="rounded"
                                    ratio="1/1"
                                    compact={true}
                                />
                            </div>

                            <!-- Vocabulary content -->
                            <div class="flex-grow-1">
                                <div class="fw-medium">
                                    {vocab.option?.content || "Unnamed option"}
                                </div>
                                <small class="text-muted">
                                    {vocab._fieldName}
                                </small>
                            </div>

                            <!-- Expand/Collapse button for description -->
                            {#if vocab.description?.content}
                                <button
                                    type="button"
                                    class="btn btn-sm btn-link text-decoration-none p-0"
                                    onclick={() => toggleDescription(vocab.id)}
                                    aria-label={expandedDescriptions.has(vocab.id) ? "Collapse" : "Expand"}
                                >
                                    <i class="bi {expandedDescriptions.has(vocab.id) ? 'bi-dash-circle' : 'bi-info-circle'}"></i>
                                </button>
                            {/if}
                        </div>

                        <!-- Expandable description -->
                        {#if vocab.description?.content && expandedDescriptions.has(vocab.id)}
                            <div class="pb-3 text-muted small" style="margin-left: 116px; padding-right: 1rem;">
                                {vocab.description.content}
                            </div>
                        {/if}
                    </div>
                {/each}

                {#if filteredVocabularies.length === 0}
                    <div class="text-center py-4 text-muted">
                        {#if searchQuery.trim()}
                            <div class="mb-2 ps-3 d-flex justify-content-start">
                                {t("common.no_results", { fallback: "No results found" })}
                            </div>
                            <BaseButton
                                class="btn btn-link text-dark text-decoration-none"
                                icon="plus-circle"
                                text={`Create "${searchQuery.trim()}"`}
                                onClick={createNewVocabulary}
                                disabled={!defaultLanguageId || isCreating || selectedFieldId === "all"}
                            />
                            {#if selectedFieldId === "all"}
                                <div class="small mt-2">{t("objects.connections.select_specific_type", { fallback: "Please select a specific connection type to create a new item." })}</div>
                            {/if}
                            {#if !defaultLanguageId}
                                <div class="small mt-2">{t("objects.research_fields.default_language_required", { fallback: "Default language is required to create a new option." })}</div>
                            {/if}
                            {#if creationError}
                                <div class="text-danger small mt-2">{creationError}</div>
                            {/if}
                        {:else}
                            {t("objects.research_fields.no_vocabularies", { fallback: "No vocabulary options available" })}
                        {/if}
                    </div>
                {/if}
            </div>
        </div>

        <!-- Create new connection form -->
        <div class="w-100 p-2" style="transition: transform 0.3s ease-in-out; position: absolute; top: 0; left: 0; {showCreateForm ? 'transform: translateX(0);' : 'transform: translateX(100%);'}">
            <div class="mb-3">
                <label for="connection-type" class="form-label">
                    {t("objects.connections.connection_type", { fallback: "Connection type" })}
                    <span class="text-danger">*</span>
                </label>
                <select 
                    id="connection-type"
                    class="form-select"
                    bind:value={newConnectionType}
                >
                    <option value="">
                        {t("objects.connections.select_connection_type", { fallback: "Select connection type" })}
                    </option>
                    {#each vocabularyFields as vocabField}
                        <option value={vocabField.id}>
                            {vocabField.name?.content || "Unnamed field"}
                        </option>
                    {/each}
                </select>
            </div>

            <div class="mb-3">
                <label for="connection-title" class="form-label">
                    {t("common.title", { fallback: "Title" })}
                    <span class="text-danger">*</span>
                </label>
                <input
                    id="connection-title"
                    type="text"
                    class="form-control"
                    placeholder={t("objects.connections.title_placeholder", { fallback: "Title of the interview" })}
                    bind:value={newConnectionTitle}
                />
            </div>

            <div class="mb-3">
                <label for="connection-description" class="form-label">
                    {t("common.description", { fallback: "Description" })}
                </label>
                <textarea
                    id="connection-description"
                    class="form-control"
                    rows="3"
                    placeholder={t("common.content", { fallback: "Content" })}
                    bind:value={newConnectionDescription}
                ></textarea>
            </div>

            <div class="mb-3">
                <label for="connection-link" class="form-label">
                    {t("objects.connections.external_link", { fallback: "External link" })}
                </label>
                <input
                    id="connection-link"
                    type="text"
                    class="form-control"
                    placeholder={t("objects.connections.title_placeholder", { fallback: "Title of the interview" })}
                    bind:value={newConnectionExternalLink}
                />
            </div>

            <p class="text-muted small">
                {t("objects.connections.add_media_note", { fallback: "NOTE: You can add media and other details later from the connections section." })}
            </p>

            {#if creationError}
                <div class="alert alert-danger small mt-2 pb-2">{creationError}</div>
            {/if}
        </div>
    </div>
{/snippet}

{#snippet actions()}
    <div class="d-flex justify-content-end gap-2">
        <BaseButton
            class="btn btn-secondary"
            text={t("common.cancel", { fallback: "Cancel" })}
            onClick={handleCancel}
        />
        {#if showCreateForm}
            <BaseButton
                class="btn btn-success"
                text={t("objects.connections.create_connection", { fallback: "Create connection" })}
                onClick={handleCreateConnection}
                disabled={isCreating}
                loading={isCreating}
            />
        {:else}
            <BaseButton
                class="btn btn-success"
                text={t("common.save", { fallback: "Save" })}
                onClick={handleSave}
            />
        {/if}
    </div>
{/snippet}

<BaseModal bind:isOpen size="lg" {header} {body} {actions} />
