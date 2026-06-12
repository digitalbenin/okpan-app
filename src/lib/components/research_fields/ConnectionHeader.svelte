<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import BaseBreadcrumb from "$lib/components/base/BaseBreadcrumb.svelte";
    import { IconChartCircles, IconPencil, IconEye, IconEyeOff, IconDownload } from "@tabler/icons-svelte";

    const { t } = getTranslationStore();

    let {
        projectId,
        researchField,
        isExporting = false,
        onExport = () => {},
    } = $props();

    let connectionTypeName = $derived(researchField?.name?.content || t("common.untitled", { fallback: "Untitled" }));
    let connectionDescription = $derived(researchField?.description?.content || "");
    let isPublished = $derived(researchField?.onwebsite === 1);

    let breadcrumbItems = $derived([
        { label: t("project.connection-types", { fallback: "Connection types" }), href: `/projects/${projectId}/connections` },
        { label: connectionTypeName }
    ]);
</script>

<div class="bg-white border-bottom px-4 py-3">
    <div class="d-flex justify-content-between align-items-start">
        <div class="d-flex flex-column gap-0">
            <BaseBreadcrumb items={breadcrumbItems} icon={IconChartCircles} />
            <div>
                <h2 class="mb-1">{connectionTypeName}</h2>
                {#if connectionDescription}
                    <p class="text-muted mb-0 text-nowrap text-truncate" style="max-width: 800px;">{connectionDescription}</p>
                {/if}
            </div>
            <div class="d-flex align-items-center gap-1 mt-3">
                {#if isPublished}
                    <IconEye size={16} class="text-secondary flex-shrink-0" />
                    <span class="small text-secondary">{t("connections.visible-on-website", { fallback: "Visible on website" })}</span>
                {:else}
                    <IconEyeOff size={16} class="text-secondary flex-shrink-0" />
                    <span class="small text-secondary">{t("connections.not-visible", { fallback: "Not visible" })}</span>
                {/if}
            </div>
        </div>
        <div class="d-flex align-items-start gap-2">
            <a href="/projects/{projectId}/connections/{researchField.id}/edit" class="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1">
                <IconPencil size={14} />
                {t("common.edit-connection-type", { fallback: "Edit connection type" })}
            </a>
            <button
                type="button"
                class="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                disabled={isExporting}
                onclick={onExport}
            >
                {#if isExporting}
                    <div class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></div>
                {:else}
                    <IconDownload size={14} />
                {/if}
                {t("common.export", { fallback: "Export" })}
            </button>
        </div>
    </div>
</div>
