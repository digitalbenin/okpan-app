<script>
    import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";
    import { getAssetSyncStore } from "$lib/stores/AssetSyncStore.svelte.js";
    import { watch } from "runed";
    import { onDestroy } from "svelte";

    let { children, data } = $props();

    const contentStore = getContentLanguageStore();
    const syncStore = getAssetSyncStore();
    let initializedProjectId = null;
    let runtimeOperation = Promise.resolve();

    $effect(() => {
        const projectId = data?.project?.id;
        if (!projectId || projectId === initializedProjectId) return;

        const previousProjectId = initializedProjectId;
        initializedProjectId = projectId;
        runtimeOperation = runtimeOperation.then(async () => {
            if (previousProjectId) {
                await window.api.clearCurrentProject();
            }

            await window.api.setCurrentProject(projectId);
        }).catch((error) => {
            console.warn('Failed to update project runtime:', error);
        });
    });

    onDestroy(() => {
        void runtimeOperation.finally(() => window.api.clearCurrentProject());
    });

    watch(() => data?.languages, (languages) => {
        if (languages) {
            contentStore.initialize({
                languages: data.allLanguages || languages,
                projectLanguages: languages,
                locale: languages?.find(l => l.is_default)?.code || 'en',
            });
        }
    });

    watch(() => data?.assetLocalStates, (assetLocalStates) => {
        if (assetLocalStates) {
            syncStore.initialize(assetLocalStates);
        }
    });
</script>

{@render children()}
