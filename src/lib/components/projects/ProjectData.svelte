<script>
    import { Tabs } from "melt/builders";
    import BaseInput from "$lib/components/base/BaseInput.svelte";
    import BaseTextArea from "$lib/components/base/BaseTextArea.svelte";
    import { page as pageData } from "$app/state";

    // Get data from context if available
    let projectFromContext = pageData.data.project;
    let projectLanguagesFromContext = pageData.data.projectLanguages;

    let {
        languages = $bindable(projectLanguagesFromContext || []),
        projData = $bindable(projectFromContext || {}),
    } = $props();

    // Track content
    let titleContent = $state({});
    let descriptionContent = $state({});
    let defaultLangCode = $state("");
    let activeTabsValue = $state("");
    let initialized = $state(false);

    // Ensure titleContent and descriptionContent are initialized for all languages
    $effect(() => {
        if (languages && languages.length > 0) {
            languages.forEach((lang) => {
                // Use language_code if available (from context) or fall back to code
                const langCode = lang.language_code || lang.code;
                // If language has a language object (from context), use that code
                const code = lang.language?.code || langCode;

                if (!titleContent[code]) {
                    titleContent[code] = "";
                }
                if (!descriptionContent[code]) {
                    descriptionContent[code] = "";
                }
            });
        }
    });

    // One-time initialization
    $effect(() => {
        if (!initialized && languages && languages.length > 0) {
            // Determine if we're using context format or direct format
            const isContextFormat = !!languages[0].language_code;

            // Set initial default language
            if (isContextFormat) {
                // From context: find default language
                const defaultLang = languages.find((l) => l.is_default);
                defaultLangCode = defaultLang
                    ? defaultLang.language_code
                    : languages[0].language_code;
            } else {
                // Direct format
                defaultLangCode = languages[0].code;
            }

            // Load data if available
            if (projData.title && projData.description) {
                let defaultLang;

                if (projData.languages) {
                    defaultLang = projData.languages.find(
                        (l) => l.is_default === 1,
                    )?.language_code;
                }

                if (!defaultLang && isContextFormat) {
                    // Try to get default from context languages
                    defaultLang = languages.find(
                        (l) => l.is_default,
                    )?.language_code;
                }

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
        if (
            !initialized ||
            !defaultLangCode ||
            !languages ||
            languages.length === 0
        )
            return;

        // Determine if we're using context format or direct format
        const isContextFormat = !!languages[0].language_code;

        console.log("Updating projData", { titleContent, descriptionContent });

        projData = {
            languages: languages.map((lang) => {
                const langCode = isContextFormat
                    ? lang.language_code
                    : lang.code;
                return {
                    language_code: langCode,
                    is_default: langCode === defaultLangCode ? 1 : 0,
                };
            }),
            title: {
                content: titleContent[defaultLangCode] || "",
                translations: languages
                    .filter((lang) => {
                        const langCode = isContextFormat
                            ? lang.language_code
                            : lang.code;
                        return langCode !== defaultLangCode;
                    })
                    .map((lang) => {
                        const langCode = isContextFormat
                            ? lang.language_code
                            : lang.code;
                        return {
                            language_code: langCode,
                            content: titleContent[langCode] || "",
                        };
                    }),
            },
            description: {
                content: descriptionContent[defaultLangCode] || "",
                translations: languages
                    .filter((lang) => {
                        const langCode = isContextFormat
                            ? lang.language_code
                            : lang.code;
                        return langCode !== defaultLangCode;
                    })
                    .map((lang) => {
                        const langCode = isContextFormat
                            ? lang.language_code
                            : lang.code;
                        return {
                            language_code: langCode,
                            content: descriptionContent[langCode] || "",
                        };
                    }),
            },
        };
    });

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
        {#if languages && languages.length > 0}
            <div class="mb-4">
                <!-- Language Tabs -->
                <div {...tabs.triggerList} class="nav nav-tabs gap-4 border-0">
                    {#each languages as lang}
                        <!-- Handle both direct languages and context format -->
                        {@const langCode = lang.language_code || lang.code}
                        {@const langName =
                            lang.language?.name || lang.name || langCode}

                        <div class="d-flex align-items-center">
                            <div class="d-flex flex-row align-items-center">
                                <div class="form-check">
                                    <input
                                        type="checkbox"
                                        class="form-check-input"
                                        checked={langCode === defaultLangCode}
                                        onchange={() =>
                                            updateDefaultLanguage(langCode)}
                                    />
                                </div>
                                <div
                                    class="d-flex flex-column justify-content-baseline align-items-start nav-link m-0 p-0"
                                    style={langCode === defaultLangCode
                                        ? "margin-top:14px !important"
                                        : ""}
                                >
                                    <button
                                        {...tabs.getTrigger(langCode)}
                                        class="btn btn-link text-decoration-none p-0 m-0 {tabs.value ===
                                        langCode
                                            ? 'text-primary'
                                            : 'text-dark'}"
                                    >
                                        {langName}
                                    </button>
                                    {#if langCode === defaultLangCode}
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
                    <!-- Handle both direct languages and context format -->
                    {@const langCode = lang.language_code || lang.code}
                    {@const langName =
                        lang.language?.name || lang.name || langCode}

                    <div {...tabs.getContent(langCode)} class="pt-4">
                        <div class="d-flex flex-column gap-4">
                            <BaseInput
                                label="Title"
                                placeholder={`Enter title in ${langName}...`}
                                bind:value={titleContent[langCode]}
                            />

                            <BaseTextArea
                                label="Description"
                                placeholder={`Enter description in ${langName}...`}
                                bind:value={descriptionContent[langCode]}
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
