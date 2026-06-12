<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";

    const { t } = getTranslationStore();

    let {
        deleteVocabOpen = $bindable(false),
        onConfirmDeleteVocab = () => {},
    } = $props();
</script>

<BaseAlertDialog bind:open={deleteVocabOpen}>
    {#snippet title()}
        {t("common.delete-connection", { fallback: "Delete connection" })}
    {/snippet}
    {#snippet description()}
        {t("common.delete-connection-confirmation", { fallback: "Are you sure you want to delete this connection? This action cannot be undone." })}
    {/snippet}
    {#snippet footer()}
        <BaseButton class="btn btn-secondary" onClick={() => deleteVocabOpen = false} text={t("common.cancel", { fallback: "Cancel" })} />
        <BaseButton class="btn btn-danger ms-2" onClick={onConfirmDeleteVocab} text={t("common.delete", { fallback: "Delete" })} />
    {/snippet}
</BaseAlertDialog>
