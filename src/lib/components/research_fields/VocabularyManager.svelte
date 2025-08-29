<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import FileUpload from "$lib/components/base/FileUpload.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";

    const { t } = getTranslationStore();

    let {
        value = $bindable(),
        languages = [],
        errors = [],
        structuredErrors = [],
        maxVocabularies = 50,
        activeLanguageCode = "default", // Current active language tab
        selectedType = "free text", // Current selected type from parent form
        class: customClass = "",
    } = $props();

    // Local persistent state to prevent loss during tab changes
    let localVocabularies = $state([]);
    let hasBeenInitialized = $state(false);

    // Initialize local state without creating infinite loops
    function updateBoundValue() {
        if (hasBeenInitialized) {
            value = [...localVocabularies];
        }
    }

    // Initialize only once from external value
    if (!hasBeenInitialized) {
        if (value !== undefined && value !== null && Array.isArray(value)) {
            localVocabularies = [...value];
        } else {
            localVocabularies = [];
            value = [];
        }
        hasBeenInitialized = true;
    }

    // Use local state for display
    const vocabularies = $derived(localVocabularies);

    // Get secondary languages (non-default)
    const defaultLanguage = $derived(
        languages?.find((l) => l.is_default) || languages?.[0] || null,
    );
    const secondaryLanguages = $derived(
        languages?.filter((l) => !l.is_default) || [],
    );

    function addVocabulary() {
        if (localVocabularies.length >= maxVocabularies) return;

        const newVocabulary = {
            option: "",
            description: "",
            mainAssetFile: null,
            otherAssetsFiles: [],
        };

        // Add translation fields for secondary languages
        secondaryLanguages.forEach((lang) => {
            newVocabulary[`option_${lang.id}`] = "";
            newVocabulary[`description_${lang.id}`] = "";
        });

        localVocabularies = [...localVocabularies, newVocabulary];
        updateBoundValue();
    }

    function removeVocabulary(index) {
        if (localVocabularies.length <= 0) return;
        localVocabularies = localVocabularies.filter((_, i) => i !== index);
        updateBoundValue();
    }

    function updateVocabulary(index, field, newValue) {
        const updated = [...localVocabularies];
        updated[index] = { ...updated[index], [field]: newValue };
        localVocabularies = updated;
        updateBoundValue();
    }

    function getFieldErrors(index, fieldName) {
        if (!structuredErrors || !Array.isArray(structuredErrors)) return [];

        return structuredErrors
            .filter((error) => {
                return (
                    typeof error === "object" &&
                    error !== null &&
                    error.path &&
                    Array.isArray(error.path) &&
                    error.path.length >= 3 &&
                    error.path[0] === "vocabularies" &&
                    error.path[1] === index &&
                    error.path[2] === fieldName
                );
            })
            .map((error) => error.message);
    }

    function handleFileUpload(index, fieldName, file) {
        updateVocabulary(index, fieldName, file);
    }

    function handleMultipleFileUpload(index, fieldName, event) {
        const files =
            event.detail.files ||
            (event.detail.file ? [event.detail.file] : []);
        updateVocabulary(index, fieldName, files);
    }
</script>

{#if selectedType === "vocabulary"}
    <div class="vocabulary-manager {customClass}">
        <div class="d-flex justify-content-end align-items-center mb-3">
            {#if vocabularies.length < maxVocabularies}
                <BaseButton
                    type="button"
                    class="btn btn-sm btn-outline-primary"
                    icon="plus"
                    text={t("common.add-vocabulary", {
                        fallback: "Add Vocabulary",
                    })}
                    onClick={addVocabulary}
                />
            {/if}
        </div>

        {#if vocabularies.length === 0}
            <div class="text-center text-muted py-4">
                <i class="bi bi-list-ul mb-2" style="font-size: 2rem;"></i>
                <p class="mb-0">
                    {t("common.no-vocabularies", {
                        fallback: "No vocabulary options added yet",
                    })}
                </p>
                <small>
                    {t("common.vocabulary-help", {
                        fallback:
                            "Add vocabulary options to provide controlled choices for this research field",
                    })}
                </small>
            </div>
        {:else}
            {#each vocabularies as vocab, index}
                <div class="vocabulary-item border rounded p-3 mb-3">
                    <div
                        class="d-flex justify-content-between align-items-start mb-3"
                    >
                        <h6 class="mb-0">
                            {t("common.vocabulary-option", {
                                fallback: "Vocabulary Option",
                            })}
                            {index + 1}
                        </h6>
                        <BaseButton
                            type="button"
                            class="btn btn-sm btn-outline-danger"
                            icon="trash"
                            text=""
                            onClick={() => removeVocabulary(index)}
                        />
                    </div>

                    <!-- Main Fields Row -->
                    <div class="row g-3 mb-3">
                        <!-- Option -->
                        <div class="col-md-6">
                            {#if activeLanguageCode === "default"}
                                <label class="form-label">
                                    {t("common.option", { fallback: "Option" })}
                                    ({defaultLanguage?.code || "default"})
                                    <span class="text-danger">*</span>
                                </label>
                                {#if true}
                                    {@const fieldErrors = getFieldErrors(
                                        index,
                                        "option",
                                    )}
                                    <input
                                        type="text"
                                        class="form-control {fieldErrors.length >
                                        0
                                            ? 'is-invalid'
                                            : ''}"
                                        placeholder={t(
                                            "common.vocabulary-option-placeholder",
                                            {
                                                fallback:
                                                    "Enter vocabulary option...",
                                            },
                                        )}
                                        value={vocab.option || ""}
                                        oninput={(e) =>
                                            updateVocabulary(
                                                index,
                                                "option",
                                                e.target.value,
                                            )}
                                    />
                                    {#if fieldErrors.length > 0}
                                        <div class="invalid-feedback">
                                            {fieldErrors.join(", ")}
                                        </div>
                                    {/if}
                                {/if}
                            {:else}
                                {@const currentLang = languages.find(
                                    (l) => l.id === activeLanguageCode,
                                )}
                                {#if currentLang}
                                    <label class="form-label">
                                        {t("common.option", {
                                            fallback: "Option",
                                        })}
                                        ({currentLang.code})
                                        <span class="text-danger">*</span>
                                    </label>
                                    {@const fieldErrors = getFieldErrors(
                                        index,
                                        `option_${currentLang.id}`,
                                    )}
                                    <input
                                        type="text"
                                        class="form-control {fieldErrors.length >
                                        0
                                            ? 'is-invalid'
                                            : ''}"
                                        placeholder={t(
                                            "common.vocabulary-option-translation-placeholder",
                                            {
                                                fallback: `Option in ${currentLang.name}...`,
                                            },
                                        )}
                                        value={vocab[
                                            `option_${currentLang.id}`
                                        ] || ""}
                                        oninput={(e) =>
                                            updateVocabulary(
                                                index,
                                                `option_${currentLang.id}`,
                                                e.target.value,
                                            )}
                                    />
                                    {#if fieldErrors.length > 0}
                                        <div class="invalid-feedback">
                                            {fieldErrors.join(", ")}
                                        </div>
                                    {/if}
                                {/if}
                            {/if}
                        </div>

                        <!-- Description -->
                        <div class="col-md-6">
                            {#if activeLanguageCode === "default"}
                                <label class="form-label">
                                    {t("common.description", {
                                        fallback: "Description",
                                    })}
                                    ({defaultLanguage?.code || "default"})
                                </label>
                                {#if true}
                                    {@const fieldErrors = getFieldErrors(
                                        index,
                                        "description",
                                    )}
                                    <input
                                        type="text"
                                        class="form-control {fieldErrors.length >
                                        0
                                            ? 'is-invalid'
                                            : ''}"
                                        placeholder={t(
                                            "common.vocabulary-description-placeholder",
                                            {
                                                fallback:
                                                    "Optional description...",
                                            },
                                        )}
                                        value={vocab.description || ""}
                                        oninput={(e) =>
                                            updateVocabulary(
                                                index,
                                                "description",
                                                e.target.value,
                                            )}
                                    />
                                    {#if fieldErrors.length > 0}
                                        <div class="invalid-feedback">
                                            {fieldErrors.join(", ")}
                                        </div>
                                    {/if}
                                {/if}
                            {:else}
                                {@const currentLang = languages.find(
                                    (l) => l.id === activeLanguageCode,
                                )}
                                {#if currentLang}
                                    <label class="form-label">
                                        {t("common.description", {
                                            fallback: "Description",
                                        })}
                                        ({currentLang.code})
                                    </label>
                                    {@const fieldErrors = getFieldErrors(
                                        index,
                                        `description_${currentLang.id}`,
                                    )}
                                    <input
                                        type="text"
                                        class="form-control {fieldErrors.length >
                                        0
                                            ? 'is-invalid'
                                            : ''}"
                                        placeholder={t(
                                            "common.vocabulary-description-translation-placeholder",
                                            {
                                                fallback: `Description in ${currentLang.name}...`,
                                            },
                                        )}
                                        value={vocab[
                                            `description_${currentLang.id}`
                                        ] || ""}
                                        oninput={(e) =>
                                            updateVocabulary(
                                                index,
                                                `description_${currentLang.id}`,
                                                e.target.value,
                                            )}
                                    />
                                    {#if fieldErrors.length > 0}
                                        <div class="invalid-feedback">
                                            {fieldErrors.join(", ")}
                                        </div>
                                    {/if}
                                {/if}
                            {/if}
                        </div>
                    </div>

                    <!-- Asset Upload Row -->
                    <div class="row g-3 mb-3">
                        <!-- Main Asset -->
                        <div class="col-md-6">
                            <FileUpload
                                bind:value={vocab.mainAssetFile}
                                label={t("common.main-asset", {
                                    fallback: "Main Asset",
                                })}
                                placeholder={t("common.upload-main-asset", {
                                    fallback: "Upload main asset file...",
                                })}
                                accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                                errors={getFieldErrors(index, "mainAssetFile")}
                                on:fileSelected={(e) =>
                                    handleFileUpload(
                                        index,
                                        "mainAssetFile",
                                        e.detail.file,
                                    )}
                            />
                        </div>

                        <!-- Other Assets -->
                        <div class="col-md-6">
                            <FileUpload
                                bind:value={vocab.otherAssetsFiles}
                                label={t("common.other-assets", {
                                    fallback: "Other Assets",
                                })}
                                placeholder={t("common.upload-other-assets", {
                                    fallback: "Upload additional assets...",
                                })}
                                accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                                multiple={true}
                                errors={getFieldErrors(
                                    index,
                                    "otherAssetsFiles",
                                )}
                                on:fileSelected={(e) =>
                                    handleMultipleFileUpload(
                                        index,
                                        "otherAssetsFiles",
                                        e,
                                    )}
                            />
                        </div>
                    </div>
                </div>
            {/each}
        {/if}

        <!-- Overall errors 
        {#if errors.length > 0}
            <div class="alert alert-danger">
                {errors.join(", ")}
            </div>
        {/if} -->
    </div>
{/if}

<style>
    .vocabulary-item {
        background-color: #f8f9fa;
        border: 1px solid #dee2e6 !important;
    }

    .translation-section {
        border-top: 1px solid #dee2e6;
        padding-top: 1rem;
        margin-top: 1rem;
    }
</style>
