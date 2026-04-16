<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

    let {
        selectedStatus = $bindable("all"),
        completedCount = 0,
        inProgressCount = 0,
        onChange = null,
    } = $props();

    const { t } = getTranslationStore();

    const statusOptions = [
        { value: "all" },
        { value: "completed" },
        { value: "in progress" },
    ];

    function getStatusLabel(value) {
        if (value === "all") {
            return t("filters.all", { fallback: "All" });
        }
        if (value === "completed") {
            return t("common.completed", { fallback: "Completed" });
        }
        return t("common.in-progress", { fallback: "In progress" });
    }

    function countByStatus(value) {
        if (value === "all") return completedCount + inProgressCount;
        if (value === "completed") return completedCount;
        if (value === "in progress") return inProgressCount;
        return 0;
    }

    function notify(val) {
        const next = val ?? selectedStatus;
        if (typeof onChange === "function") {
            try {
                onChange(next);
            } catch (e) {
                console.error("Error in onStatusChanged:", e);
            }
        }
    }
</script>

<div class="filter-group mb-3">
    <p class="filter-label fw-semibold mb-2 d-block">{t("common.status", { fallback: "Status" })}</p>
    <div class="format-options d-flex gap-3">
        {#each statusOptions as status}
            <label
                class="format-option d-inline-flex align-items-center gap-2 px-3 py-2 border rounded-2 {countByStatus(
                    status.value,
                ) === 0
                    ? 'opacity-50 pe-none'
                    : 'cursor-pointer'} {selectedStatus === status.value
                    ? 'border border-primary'
                    : ''}"
            >
                <input
                    type="radio"
                    class="form-check-input"
                    bind:group={selectedStatus}
                    value={status.value}
                    disabled={countByStatus(status.value) === 0}
                    onchange={(e) =>
                        notify(e.currentTarget?.value ?? e.target?.value)}
                />
                    <span class="format-label">{getStatusLabel(status.value)}</span>
                {#if status.value === "all"}
                    <span
                        class="badge rounded {selectedStatus === status.value
                            ? 'bg-primary text-white'
                            : 'bg-light text-body'}"
                        >{completedCount + inProgressCount}</span
                    >
                {:else if status.value === "completed"}
                    <span
                        class="badge rounded {selectedStatus === status.value
                            ? 'bg-primary text-white'
                            : 'bg-light text-body'}">{completedCount}</span
                    >
                {:else if status.value === "in progress"}
                    <span
                        class="badge rounded {selectedStatus === status.value
                            ? 'bg-primary text-white'
                            : 'bg-light text-body'}">{inProgressCount}</span
                    >
                {/if}
            </label>
        {/each}
    </div>
</div>
