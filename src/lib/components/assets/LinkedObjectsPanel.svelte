<script>
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { getObjectImageUrl } from "$lib/utils/media.js";

    let { linkedObjects = [], onLink = () => {}, onUnlink = () => {} } = $props();
    const { t } = getTranslationStore();

    const getDisplayName = (obj) => {
        const name = obj?.name?.content?.trim() || (typeof obj?.name === "string" && obj.name.trim());
        return name || obj?.objectsOntologyFields?.find((f) => f.primary)?.value || obj?.id;
    };
</script>

<h5 class="mb-3">{t("common.linked-objects")}</h5>

{#if linkedObjects?.length > 0}
    {#each linkedObjects as objectAsset}
        <div class="d-flex flex-column align-items-start gap-2 mb-3 p-2 border rounded">
            <div class="d-flex flex-row gap-2">
                <BaseImage
                    src={getObjectImageUrl(objectAsset.object, 'sm', false)}
                    alt={getDisplayName(objectAsset.object)}
                    class="rounded"
                    style="width: 68px; height: 68px; object-fit: cover;"
                    objectFit="cover"
                    compact={true}
                />
                <div class="d-flex flex-column">
                    <span class="fw-medium mb-2">{getDisplayName(objectAsset.object)}</span>
                    <button class="btn btn-sm px-0 btn-link text-danger text-decoration-none" onclick={() => onUnlink(objectAsset.object_id)}>
                        <i class="bi bi-dash-circle"></i> {t("common.unlink-media")}
                    </button>
                </div>
            </div>
        </div>
    {/each}
{/if}

<button class="btn btn-outline-primary w-100" onclick={onLink}>
    <i class="bi bi-plus-circle me-2"></i> {t("common.link-to-object")}
</button>
