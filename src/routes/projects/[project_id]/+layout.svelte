<script>
    import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";
    import { getAssetSyncStore } from "$lib/stores/AssetSyncStore.svelte.js";
    import { watch } from "runed";

    let { children, data } = $props();

    const contentStore = getContentLanguageStore();
    const syncStore = getAssetSyncStore();

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
