<script>
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { epochToDate } from "$lib/utils/dates.js";

    let { asset } = $props();
    const { t } = getTranslationStore();

    const formattedDate = $derived(epochToDate(asset?.created_at));
    const fileSize = $derived(asset?.size != null ? `${(asset.size / 1024 / 1024).toFixed(1)} MB` : "N/A");
    const fileType = $derived(asset?.type?.toUpperCase() || t("common.file").toUpperCase());
</script>

<div class="mb-4">
    {#if asset.type === "image"}
        <BaseImage
            {asset}
            preferredFormat="md"
            alt={asset.filename}
            class="w-100 rounded"
            objectFit="contain"
            style="max-height: 500px; background-color: #f8f9fa;"
        />
    {:else}
        <div class="w-100 d-flex flex-column align-items-center justify-content-center rounded bg-light text-muted border" style="height: 400px;">
            <i class="bi bi-file-earmark" style="font-size: 4rem;"></i>
            <span class="mt-2 fw-medium">{fileType}</span>
            <span class="mt-1 small">{asset.filename}</span>
        </div>
    {/if}
</div>

<div class="row mb-4">
    <div class="col-6">
        <div class="text-muted small">{t("common.size").toUpperCase()}</div>
        <div>{fileSize}</div>
    </div>
    <div class="col-6">
        <div class="text-muted small">{t("common.import-date").toUpperCase()}</div>
        <div>{formattedDate}</div>
    </div>
</div>
