<script>
    import BaseInput from "$lib/components/base/BaseInput.svelte";
    import BaseTextArea from "$lib/components/base/BaseTextArea.svelte";
    import LanguageSelector from "$lib/components/form/LanguageSelector.svelte";
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
    let activeLanguageCode = $state("default");
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
                    titleContent[defaultLang] = projData.title?.content || "";
                    descriptionContent[defaultLang] =
                        projData.description?.content || "";

                    // Set translations
                    if (projData.title?.translations) {
                        projData.title.translations.forEach((t) => {
                            titleContent[t.language_code] = t.content || "";
                        });
                    }

                    if (projData.description?.translations) {
                        projData.description.translations.forEach((t) => {
                            descriptionContent[t.language_code] =
                                t.content || "";
                        });
                    }
                }
            }

            // Set active language to default
            activeLanguageCode = "default";

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

    // Prepare languages for selector
    const selectorLanguages = $derived(
        languages?.map((lang) => ({
            id: lang.language_code || lang.code,
            code: lang.language_code || lang.code,
            name: lang.language?.name || lang.name || lang.code,
            is_default: (lang.language_code || lang.code) === defaultLangCode,
        })) || []
    );

    // Map activeLanguageCode to actual language code
    const currentLangCode = $derived.by(() => {
        if (activeLanguageCode === "default") return defaultLangCode;
        return activeLanguageCode;
    });
</script>

<div class="card border-0">
    <div class="card-body p-0 m-0">
        {#if languages && languages.length > 0}
            <div class="mb-4">
                <!-- Language Selector -->
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div class="d-flex gap-3 align-items-center">
                        {#each languages as lang}
                            {@const langCode = lang.language_code || lang.code}
                            {@const langName = lang.language?.name || lang.name || langCode}
                            
                            <div class="form-check">
                                <input
                                    type="checkbox"
                                    class="form-check-input"
                                    id="default-{langCode}"
                                    checked={langCode === defaultLangCode}
                                    onchange={() => updateDefaultLanguage(langCode)}
                                />
                                <label class="form-check-label" for="default-{langCode}">
                                    {langName}
                                    {#if langCode === defaultLangCode}
                                        <span class="badge bg-secondary ms-1 small">Default</span>
                                    {/if}
                                </label>
                            </div>
                        {/each}
                    </div>
                    
                    <LanguageSelector 
                        languages={selectorLanguages} 
                        bind:activeLanguageCode 
                    />
                </div>

                <!-- Content Fields -->
                <div class="d-flex flex-column gap-4">
                    <BaseInput
                        label="Title"
                        placeholder={`Enter title...`}
                        bind:value={titleContent[currentLangCode]}
                    />

                    <BaseTextArea
                        label="Description"
                        placeholder={`Enter description...`}
                        bind:value={descriptionContent[currentLangCode]}
                        rows={5}
                        maxLength={500}
                    />
                </div>
            </div>
        {:else}
            <div class="alert alert-warning">
                No languages selected. Please select at least one language.
            </div>
        {/if}
    </div>
</div>
