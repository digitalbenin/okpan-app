<script>
    import { Tabs } from "melt/builders";
    import BaseInput from "$lib/components/base/BaseInput.svelte";
    import BaseTextArea from "$lib/components/base/BaseTextArea.svelte";

    let { languages = $bindable([]), projData = $bindable({}) } = $props();

    // Track content
    let titleContent = $state({});
    let descriptionContent = $state({});
    let defaultLangCode = $state("");
    let activeTabsValue = $state("");
    let initialized = $state(false);

    // Ensure titleContent and descriptionContent are initialized for all languages
    $effect(() => {
        languages.forEach((lang) => {
            if (!titleContent[lang.code]) {
                titleContent[lang.code] = "";
            }
            if (!descriptionContent[lang.code]) {
                descriptionContent[lang.code] = "";
            }
        });
    });

    // One-time initialization
    $effect(() => {
        if (!initialized && languages.length > 0) {
            // Set initial default language
            defaultLangCode = languages[0].code;

            // Load data if available
            if (projData.title && projData.description) {
                const defaultLang = projData.languages?.find(
                    (l) => l.is_default === 1,
                )?.language_code;

                if (defaultLang) {
                    defaultLangCode = defaultLang;

                    // Set default language content
                    titleContent[defaultLang] = projData.title.content || "";
                    descriptionContent[defaultLang] =
                        projData.description.content || "";

                    // Set translations
                    if (projData.title.translations) {
                        projData.title.translations.forEach((t) => {
                            titleContent[t.language_code] = t.content || "";
                        });
                    }

                    if (projData.description.translations) {
                        projData.description.translations.forEach((t) => {
                            descriptionContent[t.language_code] =
                                t.content || "";
                        });
                    }
                }
            }

            // Set active tab
            tabs.value = defaultLangCode;

            initialized = true;
        }
    });

    // Update projData when content or default language changes
    $effect(() => {
        if (!initialized || !defaultLangCode || languages.length === 0) return;

        console.log("Updating projData", { titleContent, descriptionContent });

        projData = {
            languages: languages.map((lang) => ({
                language_code: lang.code,
                is_default: lang.code === defaultLangCode ? 1 : 0,
            })),
            title: {
                content: titleContent[defaultLangCode] || "",
                translations: languages
                    .filter((lang) => lang.code !== defaultLangCode)
                    .map((lang) => ({
                        language_code: lang.code,
                        content: titleContent[lang.code] || "",
                    })),
            },
            description: {
                content: descriptionContent[defaultLangCode] || "",
                translations: languages
                    .filter((lang) => lang.code !== defaultLangCode)
                    .map((lang) => ({
                        language_code: lang.code,
                        content: descriptionContent[lang.code] || "",
                    })),
            },
        };
    });

    $inspect("titleContent", titleContent);
    $inspect("descriptionContent", descriptionContent);
    $inspect("languages", languages);

    // Handle default language change
    function updateDefaultLanguage(newDefault) {
        if (newDefault !== defaultLangCode) {
            defaultLangCode = newDefault;
        }
    }

    // Initialize tabs
    const tabs = new Tabs({
        value: activeTabsValue,
    });
</script>

<div class="card border-0">
    <div class="card-body p-0 m-0">
        {#if languages.length > 0}
            <div class="mb-4">
                <!-- Language Tabs -->
                <div {...tabs.triggerList} class="nav nav-tabs gap-4 border-0">
                    {#each languages as lang}
                        <div class="d-flex align-items-center">
                            <div class="d-flex flex-row align-items-center">
                                <div class="form-check">
                                    <input
                                        type="checkbox"
                                        class="form-check-input"
                                        checked={lang.code === defaultLangCode}
                                        onchange={() =>
                                            updateDefaultLanguage(lang.code)}
                                    />
                                </div>
                                <div
                                    class="d-flex flex-column justify-content-baseline align-items-start nav-link m-0 p-0"
                                    style={lang.code === defaultLangCode
                                        ? "margin-top:14px !important"
                                        : ""}
                                >
                                    <button
                                        {...tabs.getTrigger(lang.code)}
                                        class="btn btn-link text-decoration-none p-0 m-0 {tabs.value ===
                                        lang.code
                                            ? 'text-primary'
                                            : 'text-dark'}"
                                    >
                                        {lang.name}
                                    </button>
                                    {#if lang.code === defaultLangCode}
                                        <div
                                            style="font-size: 10px"
                                            class="text-muted"
                                        >
                                            default
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>

                <!-- Tab Content -->
                {#each languages as lang}
                    <div {...tabs.getContent(lang.code)} class="pt-4">
                        <div class="d-flex flex-column gap-4">
                            <BaseInput
                                label="Title"
                                placeholder={`Enter title in ${lang.name}...`}
                                bind:value={titleContent[lang.code]}
                            />

                            <BaseTextArea
                                label="Description"
                                placeholder={`Enter description in ${lang.name}...`}
                                bind:value={descriptionContent[lang.code]}
                                rows={5}
                                maxLength={500}
                            />
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <div class="alert alert-warning">
                No languages selected. Please select at least one language.
            </div>
        {/if}
    </div>
</div>

<style>
    /* Style active tab */
    :global(.nav-link[data-active]) {
        color: var(--bs-primary) !important;
        border-color: var(--bs-border-color) var(--bs-border-color) #fff !important;
        background-color: #fff !important;
    }

    /* Style tabs hover */
    :global(.nav-link:hover) {
        border-color: var(--bs-border-color-translucent);
    }
</style>
