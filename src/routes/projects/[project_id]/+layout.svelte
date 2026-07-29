<script>
    import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";
    import { getAssetSyncStore } from "$lib/stores/AssetSyncStore.svelte.js";
    import { watch } from "runed";

    let { children, data } = $props();

    const contentStore = getContentLanguageStore();
    const syncStore = getAssetSyncStore();
    let initializedProjectId = null;

    $effect(() => {
        const projectId = data?.project?.id;
        if (!projectId || projectId === initializedProjectId) return;

        initializedProjectId = projectId;
        window.api.setCurrentProject(projectId).catch((error) => {
            console.warn('Failed to cache project ID:', error);
        });
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
