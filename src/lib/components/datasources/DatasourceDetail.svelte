<script>
    import { createEventDispatcher } from "svelte";
    import BaseInput from "$lib/components/base/BaseInput.svelte";
    import BaseTextArea from "$lib/components/base/BaseTextArea.svelte";
    import BaseDate from "$lib/components/base/BaseDate.svelte";
    import { Tabs } from "melt/builders";
    import { epochToYYYYMMDD } from "$lib/utils/dates.js";
    import { page as pageData } from "$app/state";
    let { datasource, onDeleteRequest = () => {} } = $props();

    let projectLanguages = $derived(pageData.data.projectLanguages);

    // --- State variable to track the ID of the datasource processed by the effect ---
    let previousDatasourceId = $state(null);

    // --- RESTORE Internal State ---
    let nameContent = $state({});
    let methodContent = $state({});
    let notesContent = $state({});
    let languageContent = $state("");
    let contactContent = $state("");
    let copyrightContent = $state("");
    let dateString = $state("");

    // --- Keep Tab State ---
    let activeLanguageCode = $state("");
    let defaultLanguageCode = $state("");

    // --- Keep Tabs builder ---
    const tabs = new Tabs({
        value: () => activeLanguageCode,
        onValueChange: (v) => {
            if (v) activeLanguageCode = v;
        },
    });

    // --- RESTORE Effect to sync prop to internal state (with GUARD) ---
    $effect(() => {
        const currentId = datasource?.id;

        if (!currentId || currentId === previousDatasourceId) {
            return; // Exit the effect early
        }

        // --- Existing logic to update internal state based on `datasource` ---
        if (datasource && projectLanguages && projectLanguages.length > 0) {
            // Determine default and active language first
            const defaultLang = projectLanguages.find(
                (lang) => lang.is_default,
            );
            const newDefaultLangCode = defaultLang
                ? defaultLang.code
                : projectLanguages[0].code;
            defaultLanguageCode = newDefaultLangCode; // Update state

            if (
                !activeLanguageCode ||
                !projectLanguages.some((l) => l.code === activeLanguageCode)
            ) {
                activeLanguageCode = newDefaultLangCode;
            }
            tabs.value = activeLanguageCode;

            // Sync non-translatable
            languageContent = datasource.language ?? "";
            contactContent = datasource.contact ?? "";
            copyrightContent = datasource.copyright ?? "";

            // --- Add Logging Here ---
            const rawDateValue = datasource.date;
            const convertedDateString = epochToYYYYMMDD(rawDateValue);
            dateString = convertedDateString;

            let tempName = {};
            let tempMethod = {};
            let tempNotes = {};
            projectLanguages.forEach((lang) => {
                const code = lang.code;
                const isDefault = code === newDefaultLangCode;

                tempName[code] =
                    (isDefault && datasource.name?.content) ||
                    datasource.name?.translations?.find(
                        (t) => t.language?.code === code,
                    )?.content ||
                    "";
                tempMethod[code] =
                    (isDefault && datasource.method?.content) ||
                    datasource.method?.translations?.find(
                        (t) => t.language?.code === code,
                    )?.content ||
                    "";
                tempNotes[code] =
                    (isDefault && datasource.notes?.content) ||
                    datasource.notes?.translations?.find(
                        (t) => t.language?.code === code,
                    )?.content ||
                    "";
            });
            nameContent = tempName;
            methodContent = tempMethod;
            notesContent = tempNotes;
        } else {
            // Reset if datasource is null
            nameContent = {};
            methodContent = {};
            notesContent = {};
            languageContent = "";
            contactContent = "";
            copyrightContent = "";
            dateString = "";
            defaultLanguageCode = "";
            activeLanguageCode = "";
        }
        previousDatasourceId = currentId;
    });

    const dispatch = createEventDispatcher();

    // --- REVERT handleSave to read from internal state ---
    function handleSave() {
        if (!datasource?.id || !defaultLanguageCode || !projectLanguages) {
            return;
        }

        // Convert dateString back to object
        let dateValue = null;
        if (dateString) {
            const parsedDate = new Date(dateString);
            if (!isNaN(parsedDate.getTime())) {
                dateValue = parsedDate;
            }
        }

        // Prepare translations payload from internal state
        const nameTrans = [];
        const methodTrans = [];
        const notesTrans = [];
        projectLanguages.forEach((lang) => {
            const langCode = lang.code;
            if (langCode !== defaultLanguageCode) {
                // Find original ID if it exists in the original datasource prop
                const originalNameTrans = datasource.name?.translations?.find(
                    (t) => t.language?.code === langCode,
                );
                const originalMethodTrans =
                    datasource.method?.translations?.find(
                        (t) => t.language?.code === langCode,
                    );
                const originalNotesTrans = datasource.notes?.translations?.find(
                    (t) => t.language?.code === langCode,
                );

                // Add if content exists in state
                if (nameContent[langCode] !== undefined) {
                    nameTrans.push({
                        id: originalNameTrans?.id, // Pass original ID if exists
                        language_code: langCode, // Use language code for consistency with other components
                        content: nameContent[langCode] || "",
                    });
                }
                if (methodContent[langCode] !== undefined) {
                    methodTrans.push({
                        id: originalMethodTrans?.id,
                        language_code: langCode, // Use language code for consistency with other components
                        content: methodContent[langCode] || "",
                    });
                }
                if (notesContent[langCode] !== undefined) {
                    notesTrans.push({
                        id: originalNotesTrans?.id,
                        language_code: langCode, // Use language code for consistency with other components
                        content: notesContent[langCode] || "",
                    });
                }
            }
        });

        const defaultLang =
            projectLanguages.find((lang) => lang.is_default) ||
            projectLanguages[0];

        const updatedDataPayload = {
            datasourceId: datasource.id,
            language: languageContent, // From state
            contact: contactContent, // From state
            copyright: copyrightContent, // From state
            date: dateValue ? dateValue.toISOString() : null, // From state (via dateString)
            name: nameContent[defaultLanguageCode] || "", // From state
            method: methodContent[defaultLanguageCode] || "", // From state
            notes: notesContent[defaultLanguageCode] || "", // From state
            // Pass original text IDs from the prop
            original_name_id: datasource.name?.id,
            original_method_id: datasource.method?.id,
            original_notes_id: datasource.notes?.id,
            // Always use default language for main text records
            languageId: defaultLang?.id,
            // Pass prepared translations
            nameTranslations: nameTrans.filter((t) => t.content !== undefined),
            methodTranslations: methodTrans.filter(
                (t) => t.content !== undefined,
            ),
            notesTranslations: notesTrans.filter(
                (t) => t.content !== undefined,
            ),
        };

        Object.keys(updatedDataPayload).forEach(
            (key) =>
                updatedDataPayload[key] === undefined &&
                delete updatedDataPayload[key],
        );

        dispatch("save", { id: datasource.id, data: updatedDataPayload });
    }

    function handleDelete() {
        if (!datasource?.id) {
            console.error("Datasource ID is missing, cannot delete.");
            return;
        }
        onDeleteRequest(datasource.id);
    }
</script>

<div class="p-2 datasource-detail-form">
    <h5 id="datasource-detail-title" class="mb-4">Edit information</h5>

    <!-- Language Tabs -->
    {#if projectLanguages && projectLanguages.length > 0}
        <div {...tabs.triggerList} class="nav nav-tabs mb-3" role="tablist">
            {#each projectLanguages as lang}
                {@const langCode = lang.code}
                <button
                    {...tabs.getTrigger(langCode)}
                    type="button"
                    class="nav-link {lang.is_default ? 'fw-bold' : ''}"
                    role="tab"
                    aria-selected={activeLanguageCode === langCode}
                    data-active={activeLanguageCode === langCode
                        ? ""
                        : undefined}
                >
                    {lang.name || lang.code}
                    {#if lang.is_default}<span
                            class="badge bg-secondary ms-1 small">Default</span
                        >{/if}
                </button>
            {/each}
        </div>

        <!-- Tab Content -->
        {#each projectLanguages as lang}
            {@const langCode = lang.code}
            {@const langName = lang.name || lang.code}
            <div {...tabs.getContent(langCode)} class="pt-2">
                <div class="d-flex flex-column gap-3">
                    <!-- REVERT Binding to internal state -->
                    <BaseInput
                        label="Title of the import"
                        bind:value={nameContent[langCode]}
                        placeholder={`Enter title in ${langName}...`}
                    />
                    <BaseInput
                        label="Method of transfer *"
                        bind:value={methodContent[langCode]}
                        placeholder={`Enter transfer method in ${langName}...`}
                    />
                    <BaseTextArea
                        label="Notes"
                        bind:value={notesContent[langCode]}
                        placeholder={`Enter notes in ${langName}...`}
                        rows={4}
                        maxLength={500}
                    />
                </div>
            </div>
        {/each}

        <hr class="my-4" />
    {/if}

    <!-- Non-Translatable Fields - REVERT Binding to internal state -->
    <div class="d-flex flex-column gap-3">
        <!-- Date of transfer -->
        <BaseDate label="Date of transfer *" bind:value={dateString} />
        <!-- Language -->
        <BaseInput
            label="Original Language *"
            bind:value={languageContent}
            placeholder="Language code (e.g., en)"
        />
        <!-- Contact -->
        <BaseInput
            label="Contact person/department"
            bind:value={contactContent}
            placeholder="Contact person/department"
        />
        <!-- Copyright -->
        <BaseInput
            label="Copyright"
            bind:value={copyrightContent}
            placeholder="Copyright information"
        />
    </div>
</div>

<!-- Buttons remain the same -->
<div class="d-flex justify-content-end gap-2 mt-4 p-2">
    <button type="button" class="btn btn-danger" onclick={handleDelete}
        >Delete</button
    >
    <button type="button" class="btn btn-success" onclick={handleSave}
        >Save Changes</button
    >
</div>

<style>
    /* Style Melt UI tabs using data attributes */
    [data-melt-tabs-trigger] {
        background: none;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 0.25rem 0.25rem 0 0;
        cursor: pointer;
        border-bottom: 1px solid transparent;
        margin-bottom: -1px;
    }
    [data-melt-tabs-trigger][data-state="active"] {
        border: 1px solid #dee2e6;
        border-bottom-color: white;
        background-color: white;
        color: var(--bs-nav-tabs-link-active-color, #495057);
    }
    [data-melt-tabs-trigger]:not([data-state="active"]) {
        color: var(--bs-nav-link-color, #0d6efd);
    }
    [data-melt-tabs-trigger]:hover:not([data-state="active"]) {
        border-color: var(--bs-border-color-translucent, #dee2e6);
        color: var(--bs-nav-link-hover-color, #0a58ca);
    }
    .nav-tabs {
        border-bottom: 1px solid #dee2e6;
    }
    .datasource-detail-form :global(label.form-label) {
        font-weight: bold;
    }
</style>
