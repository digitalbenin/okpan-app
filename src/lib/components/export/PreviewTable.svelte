<script>
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import BasePagination from "$lib/components/base/BasePagination.svelte";

    let {
        objects = [],
        // Make these bindable so changes propagate to the parent component
        deselectedObjectIds = $bindable(new Set()), // bindable from parent
        page = $bindable(1), // bindable from parent
        pageSize,
        count,
    } = $props();

    // Debug: watch page value directly

    // Toggle single row selection (we track deselections globally)
    function toggleObjectSelection(objectId) {
        if (!deselectedObjectIds.has(objectId)) {
            deselectedObjectIds.add(objectId);
        } else {
            deselectedObjectIds.delete(objectId);
        }
        // Reassign to trigger reactivity and propagate via bindable prop
        deselectedObjectIds = new Set(deselectedObjectIds);
    }

    // Toggle selection for current page
    function toggleAllObjects() {
        const pageIds = objects.map((o) => o.id);
        const allSelectedOnPage = pageIds.every(
            (id) => !deselectedObjectIds.has(id),
        );
        if (allSelectedOnPage) {
            pageIds.forEach((id) => deselectedObjectIds.add(id));
        } else {
            pageIds.forEach((id) => deselectedObjectIds.delete(id));
        }
        // Reassign to trigger reactivity and propagate via bindable prop
        deselectedObjectIds = new Set(deselectedObjectIds);
    }

    // Helpers previously in page
    function formatDate(value) {
        const d = new Date(+value);
        if (Number.isNaN(d.getTime())) return "";
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    }

    function getFirstImageAsset(object) {
        const list = object?.objectsAssets || [];
        const first =
            list.find(
                (oa) => oa?.asset?.type === "image" || oa?.type === "image",
            ) || list[0];
        const asset = first?.asset ?? first;
        return asset || null;
    }

    function getObjectPreviewUrl(object) {
        const asset = getFirstImageAsset(object);
        if (!asset) return null;
        try {
            let formats = asset.formats;
            if (typeof formats === "string") {
                try {
                    formats = JSON.parse(formats);
                } catch {
                    // ignore
                }
            }
            if (formats && formats.sm) return `media://${formats.sm}`;
            if (formats && (formats.md || formats.lg || formats.original)) {
                const fallback =
                    formats.sm || formats.md || formats.lg || formats.original;
                if (fallback) return `media://${fallback}`;
            }
            const p = Array.isArray(asset.path) ? asset.path[0] : asset.path;
            return p ? `media://${p}` : null;
        } catch (e) {
            const p = Array.isArray(asset.path) ? asset.path[0] : asset.path;
            return p ? `media://${p}` : null;
        }
    }

    // Prefer object's name for display; fallback to primary identifier or numeric id
    function getPrimaryIdentifier(obj) {
        const field = obj?.objectsOntologyFields?.find((f) => f.primary);
        return field?.value ?? null;
    }

    function getObjectDisplayName(obj) {
        const name =
            (obj?.name?.content && String(obj.name.content).trim()) ||
            (typeof obj?.name === "string" && String(obj.name).trim());
        return name || getPrimaryIdentifier(obj) || obj?.id;
    }
</script>

<div class="table-container overflow-auto border border-light-subtle rounded-3">
    <table class="objects-table w-100 border-collapse">
        <thead>
            <tr>
                <th class="checkbox-column" style="width: 40px;">
                    <input
                        type="checkbox"
                        checked={objects.length > 0 &&
                            objects.every(
                                (o) => !deselectedObjectIds.has(o.id),
                            )}
                        indeterminate={objects.some(
                            (o) => !deselectedObjectIds.has(o.id),
                        ) && objects.some((o) => deselectedObjectIds.has(o.id))}
                        onclick={toggleAllObjects}
                    />
                </th>
                <th class="image-column" style="width: 60px;"></th>
                <th class="id-column" style="width: 140px;">Object ID</th>
                <th class="date-column" style="width: 140px;">Date modified</th>
            </tr>
        </thead>
        <tbody>
            {#each objects as object (object.id)}
                <tr>
                    <td class="checkbox-column">
                        <input
                            type="checkbox"
                            checked={!deselectedObjectIds.has(object.id)}
                            onclick={() => toggleObjectSelection(object.id)}
                        />
                    </td>
                    <td class="image-column">
                        <BaseImage
                            src={getObjectPreviewUrl(object)}
                            alt={getObjectDisplayName(object)}
                            width={48}
                            height={48}
                            class="rounded"
                        />
                    </td>
                    <td class="id-column">
                        <span>
                            {getObjectDisplayName(object)}
                        </span>
                    </td>
                    <td class="date-column">{formatDate(object.updated_at)}</td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>

<div class="pagination-container mt-3">
    <BasePagination bind:page {pageSize} {count} size="sm" />
</div>

<style>
    .objects-table th,
    .objects-table td {
        border-bottom: 1px solid #f0f0f0;
        padding: 10px 12px;
    }
</style>
