<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseModal from "$lib/components/base/BaseModal.svelte";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import { IconInfoCircle, IconCirclePlus, IconSearch } from "@tabler/icons-svelte";
    import { watch } from "runed";
    import { addVocabulary as addVocabularyAPI } from "$lib/api/ResearchFieldsApi.js";
    import { getTemplateColorClasses } from "$lib/constants/connectionTemplates.js";

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
    // Reset state whenever the modal opens
    watch(() => isOpen, (open) => {
        if (!open) return;
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
    });

    // Get the currently selected field from vocabularyFields
    const currentField = $derived.by(() => 
        selectedFieldId === "all" ? null : 
        vocabularyFields.find(f => f.id === selectedFieldId) || field
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

    /** Truncate description to 300 chars for tooltip display. */
    const truncateDescription = (desc) => {
        if (!desc) return "";
        return desc.length > 300 ? desc.slice(0, 300) + "…" : desc;
    };

    const handleAddNewConnection = () => {
        showCreateForm = true;
    };

    // Shared helper: call the API, then update vocabularyFields and selections in one place
    const addAndSelectVocabulary = async (fieldId, option, description = "", externalLink = "") => {
        const { result, error } = await addVocabularyAPI(fieldId, {
            languageId: defaultLanguageId,
            option: option.trim(),
            description: description.trim(),
            externalLink: externalLink.trim() || undefined,
        });

        if (error) return { error: typeof error === "string" ? error : error?.message || "Failed to create vocabulary" };

        const newId = result?.insertIntoVocabularies?.[0]?.id;
        if (!newId) return { error: "Failed to obtain new vocabulary ID." };

        const newVocab = {
            id: newId,
            mainAsset: null,
            vocabulariesGenericAssets: [],
            option: { content: option.trim() },
            description: { content: description.trim() },
        };

        const fieldIndex = vocabularyFields.findIndex(f => f.id === fieldId);
        if (fieldIndex !== -1) {
            vocabularyFields[fieldIndex] = {
                ...vocabularyFields[fieldIndex],
                vocabularies: [newVocab, ...(vocabularyFields[fieldIndex].vocabularies || [])]
            };
            vocabularyFields = [...vocabularyFields];
        }

        createdVocabularies = [...createdVocabularies, newVocab];
        currentSelections = [...currentSelections, { fieldId, vocabularyId: newId }];

        return {};
    };

    async function createNewVocabulary() {
        const optionText = searchQuery.trim();
        if (!optionText) { creationError = t("common.validation.value-required", { fallback: "Value is required" }); return; }
        if (!defaultLanguageId) { creationError = t("objects.research_fields.default_language_required", { fallback: "Default language is required to create a new option." }); return; }
        if (selectedFieldId === "all" || !currentField?.id) { creationError = t("objects.connections.select_specific_type", { fallback: "Please select a specific connection type to create a new item." }); return; }

        creationError = null;
        isCreating = true;
        try {
            const { error } = await addAndSelectVocabulary(currentField.id, optionText);
            if (error) creationError = error;
        } catch (e) {
            creationError = e?.message || "Unexpected error while creating vocabulary";
        } finally {
            isCreating = false;
        }
    }

    async function handleCreateConnection() {
        if (!newConnectionTitle.trim()) { creationError = t("common.validation.title-required", { fallback: "Title is required" }); return; }
        if (!newConnectionType) { creationError = t("objects.connections.select_specific_type", { fallback: "Please select a connection type" }); return; }
        if (!defaultLanguageId) { creationError = t("objects.research_fields.default_language_required", { fallback: "Default language is required to create a new option." }); return; }

        creationError = null;
        isCreating = true;
        try {
            const { error } = await addAndSelectVocabulary(newConnectionType, newConnectionTitle, newConnectionDescription, newConnectionExternalLink);
            if (error) { creationError = error; return; }

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
                                {t("objects.connections.all_types", { fallback: "All connection types" })}
                            </option>
                            {#each vocabularyFields as vocabField}
                                <option value={vocabField.id}>
                                    {vocabField.name?.content || t("common.unnamed-field", { fallback: "Unnamed field" })}
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
                                <IconSearch size={16}  />
                            </div>
                        </div>
                    </div>
                </div>

                <div class="d-flex justify-content-end mb-3 px-2">
                    <BaseButton
                        class="btn btn-link btn-sm text-primary text-decoration-none"
                        IconComponent={IconCirclePlus}
                        text={t("objects.connections.add_new_connection", { fallback: "Add new connection" })}
                        onClick={handleAddNewConnection}
                    />
                </div>
            </div>

            <!-- Vocabulary List - scrollable -->
            <div class="vocabulary-list" style="overflow-y: auto; height: calc(100% - 120px);">
                {#each filteredVocabularies as vocab (`${vocab._fieldId}_${vocab.id}`)}
                    {@const fieldFor = vocabularyFields.find(f => f.id === vocab._fieldId)}
                    {@const templateId = fieldFor?.fields_config?.templateId || null}
                    {@const colorClasses = getTemplateColorClasses(templateId)}
                    {@const descText = truncateDescription(vocab.description?.content)}
                    <div class="border-bottom">
                        <div class="d-flex align-items-center p-3 gap-3">
                            <!-- Checkbox -->
                            <div>
                                <input
                                    type="checkbox"
                                    class="form-check-input"
                                    checked={isSelected(vocab.id, vocab._fieldId)}
                                    onchange={() => toggleVocabulary(vocab.id, vocab._fieldId)}
                                    style="width: 20px; height: 20px; cursor: pointer;"
                                />
                            </div>

                            <!-- Vocabulary content -->
                            <div class="flex-grow-1" style="min-width: 0;">
                                <div class="fw-medium text-truncate">
                                    {vocab.option?.content || t("common.unnamed", { fallback: "Unnamed" })}
                                </div>
                                <small class="text-uppercase fw-normal fs-8 {colorClasses.text}" style="letter-spacing: 0.24px;">
                                    {vocab._fieldName}
                                </small>
                            </div>

                            <!-- Main Asset Image -->
                            <div class="flex-shrink-0">
                                <BaseImage
                                    asset={vocab.mainAsset}
                                    preferredFormat="sm"
                                    alt={vocab.option?.content || t("common.unnamed", { fallback: "Unnamed" })}
                                    width={48}
                                    height={48}
                                    class="rounded-circle"
                                    ratio="1/1"
                                    compact={true}
                                    style="background-color:#E9EEF1"
                                />
                            </div>

                            <!-- Description info tooltip -->
                            
                                <span class="position-relative d-inline-flex align-items-center text-body-dark desc-tooltip"
                                    class:opacity-25={!descText}
                                >
                                    <IconInfoCircle size={16}  />
                                    {#if descText}
                                        <span class="position-absolute top-0 end-100 me-2 text-bg-dark py-1 px-2 rounded fs-7" style="max-width: 260px; white-space: normal; z-index: 1060; display: none; pointer-events: none;">
                                            {descText}
                                        </span>
                                    {/if}
                                </span>
                            
                        </div>
                    </div>
                {/each}

                {#if filteredVocabularies.length === 0}
                    <div class="text-center py-4 text-muted">
                        {#if searchQuery.trim()}
                            <div class="mb-2 ps-3 d-flex justify-content-start">
                                {t("common.no-results", { fallback: "No results found" })}
                            </div>
                            <BaseButton
                                class="btn btn-link text-dark text-decoration-none"
                                IconComponent={IconCirclePlus}
                                text={t("objects.connections.create-option", {
                                    fallback: 'Create "{{value}}"',
                                    value: searchQuery.trim(),
                                })}
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
                            {vocabField.name?.content || t("common.unnamed-field", { fallback: "Unnamed field" })}
                        </option>
                    {/each}
                </select>
            </div>

            <div class="mb-3">
                <label for="connection-title" class="form-label">
                    {t("common.name", { fallback: "Name" })}
                    <span class="text-danger">*</span>
                </label>
                <input
                    id="connection-title"
                    type="text"
                    class="form-control"
                    placeholder={t("objects.connections.title_placeholder", { fallback: "Connection title" })}
                    bind:value={newConnectionTitle}
                />
            </div>

          <!--  <div class="mb-3">
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
                    placeholder={t("objects.connections.external_link_placeholder", { fallback: "https://example.com" })}
                    bind:value={newConnectionExternalLink}
                />
            </div>

            <p class="text-muted small">
                {t("objects.connections.add_media_note", { fallback: "NOTE: You can add media and other details later from the connections section." })}
            </p>
-->
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

<style>
  .desc-tooltip:hover > span {
    display: block !important;
  }
</style>
