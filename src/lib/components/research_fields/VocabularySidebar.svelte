<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import BasePagination from "$lib/components/base/BasePagination.svelte";
    import { getObjectIdentifier } from "$lib/api/ObjectsApi.js";

    let {
        initialValues = {},
        linkedObjects = [],
        linkedObjectsTotalCount = 0,
        linkedObjectsPage = 1,
        linkedObjectsPageSize = 20,
        project = null,
    } = $props();

    const { t } = getTranslationStore();

    let currentPage = $state(linkedObjectsPage);
    const currentUrl = $derived($page.url);

    $effect(() => {
        currentPage = linkedObjectsPage;
    });

    $effect(() => {
        if (currentPage !== linkedObjectsPage) {
            const url = new URL(currentUrl);
            url.searchParams.set("loPage", String(currentPage));
            goto(url, { keepFocus: true, noScroll: true });
        }
    });

    const formatDate = (ts) => {
        if (!ts) return "—";
        try { return new Date(ts).toISOString().slice(0, 10); } catch { return "—"; }
    };

    const formatRelative = (ts) => {
        if (!ts) return "—";
        const days = Math.floor((Date.now() - new Date(ts).getTime()) / (1000 * 60 * 60 * 24));
        if (days <= 0) return t("common.today", { fallback: "Today" });
        if (days === 1) return t("common.yesterday", { fallback: "Yesterday" });
        if (days < 7) return `${days} ${t("common.days-ago", { fallback: "days ago" })}`;
        if (days < 30) return `${Math.floor(days / 7)} ${t("common.weeks-ago", { fallback: "weeks ago" })}`;
        return `${Math.floor(days / 30)} ${t("common.months-ago", { fallback: "months ago" })}`;
    };

    const getDisplayName = (obj) =>
        obj?.name?.content?.trim() || (typeof obj?.name === "string" ? obj.name.trim() : null) || getObjectIdentifier(obj);

    const getThumb = (obj) => obj?.objectsAssets?.[0]?.asset || null;
</script>

<div class="mb-3 p-2">
    <p class="text-uppercase fs-7 mb-2">{t("common.activity", { fallback: "Recent activity" })}</p>
    <div class="small text-body-secondary d-flex flex-column gap-1">
        <div>
            <span class="text-body">{t("common.created-at", { fallback: "Created at" })}:</span>
            {formatDate(initialValues?.created_at)}
        </div>
        <div>
            <span class="text-body">{t("common.updated-at", { fallback: "Updated at" })}:</span>
            {formatRelative(initialValues?.updated_at)}
        </div>
    </div>
</div>

{#if linkedObjectsTotalCount > 0}
    <div class="mb-3 p-2">
        <div class="d-flex align-items-center justify-content-between mb-2">
            <p class="text-uppercase fs-7 mb-0">
                {linkedObjectsTotalCount} {t("common.linked-objects", { fallback: "linked objects" })}
            </p>
        </div>
        <div class="d-flex flex-column">
            {#each linkedObjects as obj (obj.id)}
                <a
                    href={`/projects/${project.id}/institutions/${obj.institution_id}/objects/${obj.id}`}
                    class="d-flex align-items-center gap-2 py-2 border-top text-decoration-none text-body min-w-0"
                >
                    <div class="flex-shrink-0 rounded overflow-hidden" style="width: 51px; height: 52px;">
                        <BaseImage
                            asset={getThumb(obj)}
                            preferredFormat="sm"
                            alt={getDisplayName(obj)}
                            width={51}
                            height={52}
                            ratio="1/1"
                            objectFit="cover"
                            compact={true}
                        />
                    </div>
                    <div class="overflow-hidden min-w-0">
                        <div class="fw-semibold text-truncate">{getDisplayName(obj)}</div>
                        <div class="small text-truncate">{obj?.institution?.name?.content || ""}</div>
                    </div>
                </a>
            {/each}
        </div>
        {#if linkedObjectsTotalCount > linkedObjectsPageSize}
            <div class="d-flex justify-content-center mt-2">
                <BasePagination bind:page={currentPage} pageSize={linkedObjectsPageSize} count={linkedObjectsTotalCount} />
            </div>
        {/if}
    </div>
{/if}
