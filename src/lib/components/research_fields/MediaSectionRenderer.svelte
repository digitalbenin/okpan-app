<script>
    import { IconPlus } from "@tabler/icons-svelte";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { MEDIA_EXTENSIONS } from "$lib/utils/media.js";
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

    async function pickAndImport(type) {
        const labelMap = {
            image: t("common.images", { fallback: "Images" }),
            video: t("common.videos", { fallback: "Videos" }),
            audio: t("common.audio", { fallback: "Audio" }),
        };
        const exts = MEDIA_EXTENSIONS[type] || [];
        try {
            const result = await window.api.openFileDialog({
                properties: ["openFile", "multiSelections"],
                filters: [{ name: labelMap[type] || type, extensions: exts }],
            });
            if (result?.canceled || !result.filePaths?.length) return;
            await importPaths(result.filePaths, type);
        } catch (e) {
            console.error("Failed to pick files", e);
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
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span>
                        {t(
                            `common.${section.type === "image" ? "images" : section.type === "video" ? "videos" : "audio"}`,
                            { fallback: section.type.charAt(0).toUpperCase() + section.type.slice(1) + "s" }
                        )}
                    </span>
                    {#if (value[section.key] || []).length > 0}
                        <button
                            type="button"
                            class="btn btn-sm btn-outline-dark d-flex align-items-center gap-1"
                            onclick={() => pickAndImport(section.type)}
                        >
                            <IconPlus size={14} />
                            {t(
                                `common.add-${section.type}`,
                                { fallback: "Add " + section.type }
                            )}
                        </button>
                    {/if}
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
