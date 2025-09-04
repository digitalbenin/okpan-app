<script>
    let { asset = null, isOpen = false, onClose = null } = $props();

    let videoElement;

    function handleClose() {
        // Pause video if it's playing
        if (videoElement) {
            videoElement.pause();
        }

        if (onClose) {
            onClose();
        }
    }

    function handleBackdropClick(e) {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    }

    function handleKeydown(e) {
        if (e.key === "Escape") {
            handleClose();
        }
    }

    $effect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            document.addEventListener("keydown", handleKeydown);
        } else {
            document.body.style.overflow = "";
            document.removeEventListener("keydown", handleKeydown);
        }

        return () => {
            document.body.style.overflow = "";
            document.removeEventListener("keydown", handleKeydown);
        };
    });
</script>

{#if isOpen && asset}
    <div
        class="modal-backdrop position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
        style="z-index: 1050; background-color: rgba(0, 0, 0, 0.8);"
        on:click={handleBackdropClick}
        role="dialog"
        aria-modal="true"
    >
        <div
            class="modal-content bg-white rounded shadow-lg position-relative m-3"
            style="max-width: 90vw; max-height: 90vh; width:fit-content;"
        >
            <!-- Close Button -->
            <button
                type="button"
                class="btn btn-sm btn-light position-absolute rounded-circle"
                style="top: 10px; right: 10px; z-index: 1051; width: 32px; height: 32px;"
                on:click={handleClose}
                title="Close"
            >
                <i class="bi bi-x" style="font-size: 16px;"></i>
            </button>

            <!-- Content -->
            <div class="modal-body p-0">
                {#if asset.type === "image" || asset.path?.match(/\.(jpg|jpeg|png|gif|webp|avif)$/i)}
                    <img
                        src="media://{asset.path}"
                        alt={asset.filename || asset.name}
                        class="img-fluid rounded"
                        style="max-width: 90vw; max-height: 80vh; object-fit: contain;"
                    />
                {:else if asset.type === "video" || asset.path?.match(/\.(mp4|webm|mov|avi|mkv)$/i)}
                    <video
                        bind:this={videoElement}
                        src="media://{asset.path}"
                        controls
                        class="rounded"
                        style="max-width: 90vw; max-height: 80vh;"
                        preload="metadata"
                    >
                        Your browser does not support the video tag.
                    </video>
                {:else}
                    <div class="p-4 text-center">
                        <i
                            class="bi bi-file-earmark text-muted"
                            style="font-size: 48px;"
                        ></i>
                        <p class="mt-2 text-muted">
                            Preview not available for this file type
                        </p>
                    </div>
                {/if}
            </div>

            <!-- Footer with filename -->
            <div class="modal-footer bg-light rounded-bottom p-3">
                <div
                    class="d-flex align-items-center justify-content-center w-100"
                >
                    <span class="text-dark fw-medium"
                        >{asset.filename || asset.name || "Unknown file"}</span
                    >
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-backdrop {
        backdrop-filter: blur(2px);
    }

    .modal-content {
        animation: modalFadeIn 0.2s ease-out;
    }

    @keyframes modalFadeIn {
        from {
            opacity: 0;
            transform: scale(0.95);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }

    .modal-body img,
    .modal-body video {
        display: block;
        margin: 0 auto;
    }

    .btn:focus {
        box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
    }
</style>
