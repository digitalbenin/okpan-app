<script>
    import { getLogStore } from "$lib/stores/LogStore.svelte.js";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { addToast as originalAddToast } from "$lib/components/base/BaseToast.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import { onMount } from "svelte";

    // Get the translation store for i18n
    const { t } = getTranslationStore();

    // Get the log store for log management
    const {
        logState,
        initialize,
        fetchLogs,
        clearLogs,
        getLogLevels,
        error: logError,
        warn: logWarn,
        info: logInfo,
    } = getLogStore();

    // Safe wrapper for addToast to ensure all required properties are present
    const addToast = (data) => {
        // Ensure data has all required properties with defaults
        const safeData = {
            title: data.title || "Notification",
            description: data.description || "",
            type: data.type || "info", // Default to info if type is missing
            ...data,
        };

        // Only use types that are supported by the BaseToast component
        if (!["success", "error", "warning", "info"].includes(safeData.type)) {
            // Map common Bootstrap types to BaseToast types
            if (safeData.type === "danger") safeData.type = "error";
            else safeData.type = "info"; // Default fallback
        }

        return originalAddToast(safeData);
    };

    // Helper function to handle errors - logs the error and shows a toast
    const handleError = async (errorMessage, action, details = {}) => {
        // Log the error to the system logs
        await logError(action, errorMessage);

        // Show toast notification
        addToast({
            title: "Error",
            description: errorMessage,
            type: "error",
        });

        console.error(`[${action}] ${errorMessage}`, details);
    };

    // Format date for display
    const formatDate = (timestamp) => {
        if (!timestamp) return "";
        const date = new Date(timestamp);
        return new Intl.DateTimeFormat("en-US", {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        }).format(date);
    };

    // Get color class based on log level
    const getLevelClass = (level) => {
        switch (level) {
            case "error":
                return "text-danger";
            case "warn":
                return "text-warning";
            case "info":
                return "text-info";
            case "debug":
                return "text-secondary";
            default:
                return "";
        }
    };

    // Handle pagination
    const goToPage = async (page) => {
        try {
            if (page < 1 || page > logState.pagination.totalPages) return;
            await fetchLogs(page, logState.pagination.pageSize);

            // Log successful page navigation
            await logInfo("logs.pagination", `Navigated to page ${page}`);
        } catch (err) {
            await handleError(
                `Failed to navigate to page ${page}: ${err.message}`,
                "logs.pagination",
                err,
            );
        }
    };

    // Handle clearing logs
    const handleClearLogs = async () => {
        try {
            const result = await clearLogs({});

            if (result.success) {
                addToast({
                    title: "Success",
                    description: t("logs.clearSuccess", {
                        fallback: "Logs cleared successfully",
                    }),
                    type: "success",
                });

                // Log successful clear operation
                await logInfo("logs.clear", "Logs cleared successfully");
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            await handleError(
                `Failed to clear logs: ${err.message}`,
                "logs.clear",
                err,
            );
        }
    };

    // Initialize on mount
    onMount(async () => {
        try {
            if (!logState.isInitialized) {
                await initialize();
                await logInfo("logs.initialize", "Log page initialized");
            }
        } catch (err) {
            await handleError(
                `Failed to initialize logs: ${err.message}`,
                "logs.initialize",
                err,
            );
        }
    });
</script>

<div class="container-fluid py-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <h1 class="h3 mb-0">{t("logs.title", { fallback: "System Logs" })}</h1>
        <div>
            <BaseButton
                text={t("logs.clearLogs", { fallback: "Clear Logs" })}
                icon="trash"
                onClick={handleClearLogs}
                class="btn btn-outline-danger"
            />
        </div>
    </div>

    {#if logState.isLoading}
        <div class="d-flex justify-content-center my-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden"
                    >{t("common.loading", { fallback: "Loading..." })}</span
                >
            </div>
        </div>
    {:else if logState.error}
        <div class="alert alert-danger">
            {logState.error}
            <BaseButton
                text={t("common.retry", { fallback: "Retry" })}
                onClick={() => fetchLogs()}
                class="btn btn-sm btn-outline-danger ms-2"
            />
        </div>
    {:else if logState.logs.length === 0}
        <div class="alert alert-info">
            {t("logs.noLogs", {
                fallback: "No logs found.",
            })}
        </div>
    {:else}
        <div class="table-responsive">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>{t("logs.timestamp", { fallback: "Timestamp" })}</th
                        >
                        <th>{t("logs.level", { fallback: "Level" })}</th>
                        <th>{t("logs.action", { fallback: "Action" })}</th>
                        <th>{t("logs.message", { fallback: "Message" })}</th>
                    </tr>
                </thead>
                <tbody>
                    {#each logState.logs as log}
                        <tr>
                            <td class="text-nowrap"
                                >{formatDate(log.created_at)}</td
                            >
                            <td>
                                <span class={getLevelClass(log.level)}>
                                    {log.level.toUpperCase()}
                                </span>
                            </td>
                            <td>{log.action}</td>
                            <td>{log.message}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>

        <!-- Pagination -->
        {#if logState.pagination.totalPages > 1}
            <nav
                aria-label="Log pagination"
                class="d-flex justify-content-between align-items-center mt-3"
            >
                <div>
                    <span class="text-muted">
                        {t("common.showing", { fallback: "Showing" })}
                        {(logState.pagination.page - 1) *
                            logState.pagination.pageSize +
                            1}
                        -
                        {Math.min(
                            logState.pagination.page *
                                logState.pagination.pageSize,
                            logState.pagination.totalLogs,
                        )}
                        {t("common.of", { fallback: "of" })}
                        {logState.pagination.totalLogs}
                    </span>
                </div>
                <ul class="pagination mb-0">
                    <li
                        class="page-item {logState.pagination.page === 1
                            ? 'disabled'
                            : ''}"
                    >
                        <BaseButton
                            class="page-link"
                            onClick={() => goToPage(1)}
                            icon="chevron-double-left"
                            disabled={logState.pagination.page === 1}
                        />
                    </li>
                    <li
                        class="page-item {logState.pagination.page === 1
                            ? 'disabled'
                            : ''}"
                    >
                        <BaseButton
                            class="page-link"
                            onClick={() =>
                                goToPage(logState.pagination.page - 1)}
                            icon="chevron-left"
                            disabled={logState.pagination.page === 1}
                        />
                    </li>

                    {#each Array.from( { length: Math.min(5, logState.pagination.totalPages) }, (_, i) => {
                            const start = Math.max(1, logState.pagination.page - 2);
                            const end = Math.min(logState.pagination.totalPages, start + 4);
                            const adjustedStart = Math.max(1, end - 4);
                            return adjustedStart + i;
                        }, ).filter((p) => p <= logState.pagination.totalPages) as page}
                        <li
                            class="page-item {page === logState.pagination.page
                                ? 'active'
                                : ''}"
                        >
                            <BaseButton
                                class="page-link"
                                onClick={() => goToPage(page)}
                                text={String(page)}
                            />
                        </li>
                    {/each}

                    <li
                        class="page-item {logState.pagination.page ===
                        logState.pagination.totalPages
                            ? 'disabled'
                            : ''}"
                    >
                        <BaseButton
                            class="page-link"
                            onClick={() =>
                                goToPage(logState.pagination.page + 1)}
                            icon="chevron-right"
                            disabled={logState.pagination.page ===
                                logState.pagination.totalPages}
                        />
                    </li>
                    <li
                        class="page-item {logState.pagination.page ===
                        logState.pagination.totalPages
                            ? 'disabled'
                            : ''}"
                    >
                        <BaseButton
                            class="page-link"
                            onClick={() =>
                                goToPage(logState.pagination.totalPages)}
                            icon="chevron-double-right"
                            disabled={logState.pagination.page ===
                                logState.pagination.totalPages}
                        />
                    </li>
                </ul>
            </nav>
        {/if}
    {/if}
</div>

<style>
    /* Add any specific styles here */
    .table th {
        position: sticky;
        top: 0;
        background-color: var(--bs-body-bg);
        z-index: 1;
    }
</style>
