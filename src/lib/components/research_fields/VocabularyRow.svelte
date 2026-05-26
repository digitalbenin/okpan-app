<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import VocabularyMediaManager from "$lib/components/research_fields/VocabularyMediaManager.svelte";

    const translationStore = getTranslationStore();
    const t = $derived(translationStore.t);

    let {
        vocab,
        index,
        isLast = false,
        activeLanguageCode = "default",
        languages = [],
        getFieldErrors = () => [],
        onUpdate,
        onRemove,
        onMediaChange,
    } = $props();
</script>

<div class="row g-0 border border-top-0 {isLast ? 'rounded-bottom' : ''}">
    <!-- Option Column -->
    <div class="col-4 p-3">
        <div class="d-flex align-items-center justify-content-start gap-2">
            <div class="flex-grow-1">
                {#if activeLanguageCode === "default"}
                    {@const fieldErrors = getFieldErrors("option")}
                    <input
                        type="text"
                        class="form-control {fieldErrors.length > 0 ? 'is-invalid' : ''}"
                        placeholder={t("common.vocabulary-option-placeholder", { fallback: "Enter vocabulary option..." })}
                        value={vocab.option || ""}
                        oninput={(e) => onUpdate("option", e.target.value)}
                    />
                    {#if fieldErrors.length > 0}
                        <div class="invalid-feedback">{fieldErrors.join(", ")}</div>
                    {/if}
                {:else}
                    {@const currentLang = languages.find((l) => l.id === activeLanguageCode)}
                    {#if currentLang}
                        {@const fieldErrors = getFieldErrors(`option_${currentLang.id}`)}
                        <input
                            type="text"
                            class="form-control {fieldErrors.length > 0 ? 'is-invalid' : ''}"
                            placeholder={t("common.vocabulary-option-translation-placeholder", { fallback: `Option in ${currentLang.name}...` })}
                            value={vocab[`option_${currentLang.id}`] || ""}
                            oninput={(e) => onUpdate(`option_${currentLang.id}`, e.target.value)}
                        />
                        {#if fieldErrors.length > 0}
                            <div class="invalid-feedback">{fieldErrors.join(", ")}</div>
                        {/if}
                    {/if}
                {/if}
            </div>
            <BaseButton
                type="button"
                class="btn btn-sm btn-outline-danger"
                icon="trash"
                text=""
                title="Delete vocabulary option"
                onClick={onRemove}
            />
        </div>
    </div>

    <!-- Description Column -->
    <div class="col-4 p-3">
        {#if activeLanguageCode === "default"}
            {@const fieldErrors = getFieldErrors("description")}
            <textarea
                class="form-control {fieldErrors.length > 0 ? 'is-invalid' : ''}"
                rows="5"
                placeholder={t("common.vocabulary-description-placeholder", { fallback: "Optional description..." })}
                value={vocab.description || ""}
                oninput={(e) => onUpdate("description", e.target.value)}
            ></textarea>
            {#if fieldErrors.length > 0}
                <div class="invalid-feedback">{fieldErrors.join(", ")}</div>
            {/if}
            <div class="mt-2">
                <label for="external-link-{index}" class="form-label small text-muted mb-1">
                    {t("common.external-link", { fallback: "External Link" })}
                </label>
                <input
                    id="external-link-{index}"
                    type="url"
                    class="form-control form-control-sm"
                    placeholder={t("common.external-link-placeholder", { fallback: "https://..." })}
                    value={vocab.externalLink || ""}
                    oninput={(e) => onUpdate("externalLink", e.target.value)}
                />
            </div>
        {:else}
            {@const currentLang = languages.find((l) => l.id === activeLanguageCode)}
            {#if currentLang}
                {@const fieldErrors = getFieldErrors(`description_${currentLang.id}`)}
                <textarea
                    class="form-control {fieldErrors.length > 0 ? 'is-invalid' : ''}"
                    rows="3"
                    placeholder={t("common.vocabulary-description-translation-placeholder", { fallback: `Description in ${currentLang.name}...` })}
                    value={vocab[`description_${currentLang.id}`] || ""}
                    oninput={(e) => onUpdate(`description_${currentLang.id}`, e.target.value)}
                ></textarea>
                {#if fieldErrors.length > 0}
                    <div class="invalid-feedback">{fieldErrors.join(", ")}</div>
                {/if}
            {/if}
        {/if}
    </div>

    <!-- Media Column -->
    <div class="col-4 p-3">
        <VocabularyMediaManager
            bind:mainAsset={vocab.mainAssetFile}
            bind:otherAssets={vocab.otherAssetsFiles}
            maxImages={10}
            maxOtherMedia={10}
            onChange={onMediaChange}
        />
    </div>
</div>
