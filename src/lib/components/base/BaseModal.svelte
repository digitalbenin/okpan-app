<script>
    import BaseButton from "./BaseButton.svelte";

    let {
        isOpen = $bindable(),
        header = $bindable(),
        body = $bindable(),
        actions = $bindable(),
        size = "md", // sm, md, lg, xl
    } = $props();

    function closeModal() {
        isOpen = false;
    }

    // Close modal on escape key press
    function handleKeydown(event) {
        if (event.key === "Escape" && isOpen) {
            closeModal();
        }
    }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
    <div
        class="modal-backdrop fade show"
        onclick={closeModal}
        onkeydown={handleKeydown}
        aria-hidden="true"
    ></div>
    <div
        class="modal fade show"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        style="display: block;"
    >
        <div class="modal-dialog modal-{size}" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <div class="modal-title h5">
                        {@render header()}
                    </div>
                    <BaseButton
                        icon="x"
                        onClick={closeModal}
                        class="btn-close"
                    />
                </div>

                <div class="modal-body">
                    {@render body()}
                </div>

                <div class="modal-footer">
                    {@render actions()}
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .modal {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 1055;
        width: 100%;
        height: 100%;
        overflow-x: hidden;
        overflow-y: auto;
        outline: 0;
    }

    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 1050;
    }

    /* Remove custom margin as Bootstrap handles it */
    :global(.modal-dialog) {
        margin: 1.75rem auto;
        max-width: 500px;
    }
</style>
