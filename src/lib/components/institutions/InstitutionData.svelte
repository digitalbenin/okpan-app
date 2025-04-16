<script>
    import { getContext } from "svelte";
    import BaseInput from "$lib/components/base/BaseInput.svelte";
    import BaseSelect from "$lib/components/base/BaseSelect.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import { Tabs } from "melt/builders";

    // Props: formData is now bindable, managed by parent.
    // errors is bindable for parent to potentially pass validation errors.
    // projectLanguages is needed for tabs/iteration.
    let {
        projectLanguages = $bindable(getContext("projectLanguages") || []),
        formData = $bindable({}), // Parent provides and manages this reactive object
        errors = $bindable({}), // Parent can pass down errors
    } = $props();

    // Log context values for debugging (can be removed later)
    console.log("InstitutionData component loaded (Simple Mode)");
    console.log("Context projectLanguages:", projectLanguages);

    // Initialize tab state directly from parent's default language preference if possible,
    // or just the first language. Relies on formData having the structure.
    let activeLanguageCode = $state(null);

    // Instantiate the Tabs builder
    const tabs = new Tabs({
        value: () => activeLanguageCode,
        onValueChange: (v) => {
            if (v) activeLanguageCode = v;
        },
    });

    // Set default tab based on projectLanguages when component mounts
    $effect(() => {
        if (
            activeLanguageCode === null &&
            projectLanguages &&
            projectLanguages.length > 0
        ) {
            // Find default based on the is_default flag from the parent's languages array
            const defaultLang = projectLanguages.find(
                (lang) => lang.is_default,
            );
            const initialLangCode = defaultLang
                ? defaultLang.language_code
                : projectLanguages[0].language_code;
            activeLanguageCode = initialLangCode;
            tabs.value = initialLangCode;
            console.log(
                "[Effect Init Tab Simple] Set initial activeLanguageCode:",
                initialLangCode,
            );
        }
    });

    // Status options (can remain if BaseSelect needs it)
    const statusOptions = ["in progress", "completed"];

    // Removed functions: initializeFormData, processField, prepareDataForSubmit,
    // getExistingTranslationId, saveInstitution

    // --- Link Management ---
    function addLink() {
        // Ensure formData.links is initialized if it doesn't exist
        if (!Array.isArray(formData.links)) {
            formData.links = [];
        }
        formData.links.push({ url: "", label: "" });
        // Trigger reactivity manually since we are pushing to an array nested in a prop
        formData = formData;
    }

    function removeLink(index) {
        if (formData.links && formData.links[index]) {
            formData.links.splice(index, 1);
            // Trigger reactivity
            formData = formData;
        }
    }
</script>

{#if projectLanguages && projectLanguages.length > 0}
    <div class="mb-4">
        <!-- Language Tabs (Melt UI - Keep as is) -->
        <div {...tabs.triggerList} class="nav nav-tabs mb-3" role="tablist">
            {#each projectLanguages as lang}
                {@const langCode = lang.language_code}
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
                    {lang.language?.name || lang.language_code}
                    {#if lang.is_default}
                        <span class="badge bg-primary ms-1">Default</span>
                    {/if}
                </button>
            {/each}
        </div>

        <!-- Tab Content -->
        {#each projectLanguages as lang}
            {@const langCode = lang.language_code}
            <div {...tabs.getContent(langCode)}>
                <div class="d-flex flex-column gap-3">
                    <!-- Bind inputs directly to the formData prop -->
                    <div class="mb-3">
                        <BaseInput
                            label="Institution Name"
                            bind:value={formData.name[langCode]}
                            error={lang.is_default ? errors.name : null}
                            required={lang.is_default}
                            placeholder={`Enter name in ${lang.language?.name || langCode}...`}
                        />
                    </div>

                    <div class="mb-3">
                        <BaseInput
                            label="Country"
                            bind:value={formData.country[langCode]}
                            placeholder={`Enter country in ${lang.language?.name || langCode}...`}
                        />
                    </div>

                    <div class="mb-3">
                        <BaseInput
                            label="Location"
                            bind:value={formData.location[langCode]}
                            placeholder={`Enter location in ${lang.language?.name || langCode}...`}
                        />
                    </div>
                </div>
            </div>
        {/each}
    </div>

    <!-- Non-translatable fields -->
    <div class="mt-4 mb-3">
        <BaseSelect
            label="Status"
            options={statusOptions}
            bind:value={formData.status}
        />
    </div>

    <!-- Links Editor -->
    <div class="mt-4 mb-3 border-top pt-3">
        <h5>Links</h5>
        {#if formData.links && formData.links.length > 0}
            {#each formData.links as link, index (index)}
                <div class="row g-2 align-items-center mb-2">
                    <div class="col">
                        <BaseInput
                            label="URL"
                            bind:value={link.url}
                            placeholder="https://example.com"
                            required={true}
                        />
                    </div>
                    <div class="col">
                        <BaseInput
                            label="Label"
                            bind:value={link.label}
                            placeholder="Website Label"
                            required={true}
                        />
                    </div>
                    <div class="col-auto">
                        <BaseButton
                            text="Remove"
                            type="button"
                            class="btn btn-sm btn-outline-danger mt-4"
                            onClick={() => removeLink(index)}
                        />
                    </div>
                </div>
            {/each}
        {/if}
        <BaseButton
            text="Add Link"
            type="button"
            class="btn btn-sm btn-secondary"
            onClick={addLink}
        />
    </div>

    <!-- Remove Save button - Parent handles save -->
    <!-- <div class="controls"> ... </div> -->
{:else}
    <div class="alert alert-warning">
        No languages available. Please add languages to your project first.
    </div>
{/if}

<style>
    /* Remove old custom tab styles if they specifically targeted the old structure */

    /* Style Melt UI tabs using data attributes */
    [data-melt-tabs-trigger] {
        background: none;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 0.25rem 0.25rem 0 0;
        cursor: pointer;
        border-bottom: 1px solid transparent; /* Add transparent bottom border */
        margin-bottom: -1px; /* Overlap the main border */
    }

    /* Style the active/selected tab */
    [data-melt-tabs-trigger][data-state="active"] {
        border: 1px solid #dee2e6;
        border-bottom-color: white;
        background-color: white;
        /* Ensure active tab text matches Bootstrap's active link style */
        color: var(--bs-nav-tabs-link-active-color, #495057);
    }

    [data-melt-tabs-trigger]:not([data-state="active"]) {
        color: var(
            --bs-nav-link-color,
            #0d6efd
        ); /* Default Bootstrap link color */
    }

    [data-melt-tabs-trigger]:hover:not([data-state="active"]) {
        border-color: var(--bs-border-color-translucent, #dee2e6);
        color: var(
            --bs-nav-link-hover-color,
            #0a58ca
        ); /* Default Bootstrap link hover color */
    }

    [data-melt-tabs-content] {
        padding: 1rem 0;
        /* Melt UI hides non-active content automatically, no need for display:none */
    }

    /* Keep nav-tabs styling for the container */
    .nav-tabs {
        display: flex;
        border-bottom: 1px solid #dee2e6;
        gap: 0.5rem;
        margin-bottom: 1rem;
    }
</style>
