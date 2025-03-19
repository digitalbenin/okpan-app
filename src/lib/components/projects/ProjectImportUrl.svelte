<script>
    import BaseInput from "$lib/components/base/BaseInput.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import { addToast } from "$lib/components/base/BaseToast.svelte";

    // URL import state
    let importUrl = $state("");
    let isImporting = $state(false);

    // Handle importing project from URL
    async function handleImportProject() {
        if (!importUrl) {
            addToast({
                data: {
                    title: "Error",
                    description: "Please enter a valid URL",
                    type: "error",
                },
            });
            return;
        }

        try {
            isImporting = true;

            // Here you would add the actual logic to import from URL
            // For now, just a placeholder that shows a success message

            // Example of how it might work:
            // await importProjectFromUrl(importUrl);

            addToast({
                data: {
                    title: "Success",
                    description: "Project imported successfully!",
                    type: "success",
                },
            });

            // Reset the form
            importUrl = "";
        } catch (error) {
            console.error("Failed to import project:", error);
            addToast({
                data: {
                    title: "Error",
                    description: `Failed to import project: ${error.message}`,
                    type: "error",
                },
            });
        } finally {
            isImporting = false;
        }
    }
</script>

<div class="mt-3">
    <p>Insert the sync url</p>

    <div class="mb-3">
        <BaseInput bind:value={importUrl} placeholder="Enter URL..." />
    </div>

    <div>
        <BaseButton
            text={isImporting ? "Importing..." : "Import project"}
            class="btn btn-primary"
            disabled={isImporting || !importUrl}
            onClick={handleImportProject}
        />
    </div>
</div>
