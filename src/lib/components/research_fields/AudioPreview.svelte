<script>
    let {
        asset,
        size = 200,
        showRemoveButton = false,
        onRemove = null,
    } = $props();

    let audioElement;
    let isPlaying = $state(false);
    let currentTime = $state(0);
    let duration = $state(0);
    let isLoaded = $state(false);

    function togglePlay(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (!audioElement) {
            console.log("No audio element available");
            return;
        }

        console.log("Audio src:", audioElement.src);
        console.log("Asset path:", asset?.path);

        if (isPlaying) {
            audioElement.pause();
        } else {
            audioElement.play().catch((error) => {
                console.error("Error playing audio:", error);
            });
        }
    }

    function handleTimeUpdate() {
        if (audioElement) {
            currentTime = audioElement.currentTime;
        }
    }

    function handleLoadedMetadata() {
        if (audioElement) {
            duration = audioElement.duration;
            isLoaded = true;
        }
    }

    function handlePlay() {
        isPlaying = true;
    }

    function handlePause() {
        isPlaying = false;
    }

    function handleError(e) {
        console.error("Audio error:", e);
        console.error("Audio element error:", audioElement?.error);
        isPlaying = false;
        isLoaded = false;
    }

    function handleSeek(e) {
        e.preventDefault();
        e.stopPropagation();

        if (!audioElement || !duration) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const newTime = percentage * duration;

        audioElement.currentTime = newTime;
    }

    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    }

    function handleRemove(e) {
        e.stopPropagation();
        if (onRemove) {
            onRemove();
        }
    }
</script>

<div
    class="border border-secondary border-opacity-50 bg-light rounded position-relative"
    style="width: {size}px; height: {size}px;"
>
    <!-- Remove Button -->
    {#if showRemoveButton}
        <button
            type="button"
            class="btn btn-sm btn-danger rounded-circle position-absolute d-flex align-items-center justify-content-center shadow-sm"
            style="width: 20px; height: 20px; padding: 0; top: -8px; right: -8px; z-index: 10;"
            on:click={handleRemove}
            title="Remove audio"
        >
            <i class="bi bi-x" style="font-size: 10px;"></i>
        </button>
    {/if}

    <!-- Audio Header with filename -->
    <div
        class="audio-header px-2 py-1 d-flex align-items-center gap-2 bg-secondary-subtle"
    >
        <i class="bi bi-volume-up text-muted" style="font-size: 14px;"></i>
        <span
            class="text-dark fw-medium flex-grow-1 text-truncate lh-sm"
            style="font-size: 12px;"
            title={asset?.filename || asset?.name || "audio file"}
        >
            {asset?.filename || asset?.name || "audio file"}
        </span>
    </div>

    <!-- Audio Controls -->
    <div class="audio-controls p-2 mt-2">
        <!-- Play button and duration row -->
        <div class="d-flex align-items-center justify-content-between mb-2">
            <!-- Play/Pause Button -->
            <button
                class="btn btn-sm btn-link p-0 d-flex align-items-center justify-content-center border-0"
                on:click={togglePlay}
                disabled={!isLoaded}
                style="width: 20px; height: 20px;"
            >
                {#if isPlaying}
                    <i
                        class="bi bi-pause-circle text-dark"
                        style="font-size: 20px;"
                    ></i>
                {:else}
                    <i
                        class="bi bi-play-circle text-dark"
                        style="font-size: 20px;"
                    ></i>
                {/if}
            </button>

            <!-- Duration -->
            <span
                class="text-muted text-end"
                style="font-size: 11px; min-width: 35px;"
            >
                {formatTime(duration)}
            </span>
        </div>

        <!-- Progress Bar row -->
        <div
            class="bg-secondary bg-opacity-25 rounded-pill position-relative mt-3 user-select-none"
            style="height: 4px; cursor: pointer;"
            on:click={handleSeek}
            role="button"
            tabindex="0"
        >
            <div
                class="bg-secondary rounded-pill h-100 transition-all"
                style="width: {duration
                    ? (currentTime / duration) * 100
                    : 0}%; transition: width 0.1s ease;"
            ></div>
            <!-- Progress handle -->
            <div
                class="bg-secondary rounded-circle position-absolute opacity-0 transition-opacity"
                style="width: 12px; height: 12px; top: -4px; left: {duration
                    ? (currentTime / duration) * 100
                    : 0}%; transform: translateX(-50%);"
            ></div>
        </div>
    </div>

    <!-- Hidden Audio Element -->
    <audio
        bind:this={audioElement}
        src={asset?.path ? `media://${asset.path}` : ""}
        on:timeupdate={handleTimeUpdate}
        on:loadedmetadata={handleLoadedMetadata}
        on:play={handlePlay}
        on:pause={handlePause}
        on:error={handleError}
        preload="metadata"
    ></audio>
</div>

<style>
    /* Custom hover effects that complement Bootstrap */
    .bg-secondary.bg-opacity-25:hover .opacity-0 {
        opacity: 1 !important;
    }

    .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>
