<script>
    import BaseInput from "$lib/components/base/BaseInput.svelte";
    import BaseTextArea from "$lib/components/base/BaseTextArea.svelte";

    let { datasource } = $props();

    // Change derived to state for editing and use bind:value
    let nameContent = $state(datasource?.name?.content ?? "");
    let methodContent = $state(datasource?.method?.content ?? "");
    let contactContent = $state(datasource?.contact ?? "");
    let notesContent = $state(datasource?.notes?.content ?? "");
    let languageContent = $state(datasource?.language ?? "");
    let dateValue = $state(datasource?.date); // Use raw date value initially
    // TODO: Consider how to handle date input/parsing if needed for saving
</script>

<div class="p-2">
    <h5 id="datasource-detail-title" class="mb-4">Edit information</h5>

    <!-- Name (Title) -->
    <div class="mb-3">
        <BaseInput
            label="Title of the import"
            bind:value={nameContent}
            placeholder="Datasource name"
        />
    </div>

    <!-- Date of transfer -->
    <div class="mb-3">
        <!-- Note: Inputting raw timestamp might be confusing. Consider a date picker later -->
        <BaseInput
            label="Date of transfer *"
            type="text"
            bind:value={dateValue}
            placeholder="Timestamp"
        />
    </div>

    <!-- Language -->
    <div class="mb-3">
        <BaseInput
            label="Language *"
            bind:value={languageContent}
            placeholder="Language code"
        />
    </div>

    <!-- Method of transfer -->
    <div class="mb-3">
        <BaseInput
            label="Method of transfer *"
            bind:value={methodContent}
            placeholder="Transfer method"
        />
    </div>

    <!-- Contact -->
    <div class="mb-3">
        <BaseInput
            label="Name of the person/department/contact of the institution"
            bind:value={contactContent}
            placeholder="Contact person/department"
        />
    </div>

    <!-- Notes -->
    <div class="mb-3">
        <BaseTextArea
            label="Notes"
            bind:value={notesContent}
            placeholder="Notes about this data transfer"
            rows={4}
        />
    </div>
</div>

<style>
    /* Add any specific styles if needed */
</style>
