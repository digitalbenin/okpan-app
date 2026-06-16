<script>
    import { IconInfoCircle } from "@tabler/icons-svelte";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import MediaUploadZone from "$lib/components/research_fields/MediaUploadZone.svelte";

    const { t } = getTranslationStore();

    let {
        value = { images: [], videos: [], audio: [] },
        onChange = () => {},
        visibleFields = {},
        project = null,
    } = $props();

    const mediaSections = $derived([
        { type: "image", key: "images", visible: visibleFields.images },
        { type: "video", key: "videos", visible: visibleFields.videos },
        { type: "audio", key: "audio", visible: visibleFields.audios },
    ]);

    async function importPaths(paths, type) {
        if (!project?.id) return;
        try {
            const importResult = await window.api.importAssets({
                path: paths,
                projectId: project.id,
                isGenericAsset: true,
            });
            if (!importResult?.createdAssets) return;
            const key = type === "image" ? "images" : type === "video" ? "videos" : "audio";
            const updated = {
                ...value,
                [key]: [...(value[key] || []), ...importResult.createdAssets],
            };
            onChange(updated);
        } catch (e) {
            console.error("Failed to import asset", e);
        }
    }

    function handleRemove(type, asset) {
        const key = type === "image" ? "images" : type === "video" ? "videos" : "audio";
        const updated = {
            ...value,
            [key]: (value[key] || []).filter((a) => a.id !== asset.id),
        };
        onChange(updated);
    }
</script>

<div class="d-flex flex-column gap-3">
    {#each mediaSections as section}
        {#if section.visible}
            <div>
                <div class="d-flex align-items-center gap-1 mb-1 text-body-secondary">
                    {t(
                        `common.${section.type === "image" ? "images" : section.type === "video" ? "videos" : "audio"}`,
                        { fallback: section.type.charAt(0).toUpperCase() + section.type.slice(1) + "s" }
                    )}
                    <!--<IconInfoCircle size={12} />-->
                </div>
                <MediaUploadZone
                    type={section.type}
                    assets={value[section.key] || []}
                    onAdd={(paths) => importPaths(paths, section.type)}
                    onRemove={(asset) => handleRemove(section.type, asset)}
                />
            </div>
        {/if}
    {/each}
</div>
