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
    class="position-relative"
    style="width: {size}px; height: {size}px;"
>
    <!-- Remove Button -->
    {#if showRemoveButton}
        <button
            type="button"
            class="btn btn-sm btn-danger rounded-circle position-absolute d-flex align-items-center justify-content-center shadow-sm"
            style="width: 20px; height: 20px; padding: 0; top: -8px; left: -8px; z-index: 10;"
            onclick={handleRemove}
            title="Remove audio"
            aria-label="Remove audio"
        >
            <i class="bi bi-x" style="font-size: 10px;"></i>
        </button>
    {/if}

    <!-- Audio Preview (Square) -->
    <div
        class="bg-light rounded overflow-hidden d-flex flex-column align-items-center justify-content-center p-2 w-100 h-100"
    >
        <i class="bi bi-music-note-beamed text-muted mb-2" style="font-size: 1.5rem;"></i>
        
        <!-- Audio Controls -->
        <div class="w-100">
            <!-- Play button and duration row -->
            <div class="d-flex align-items-center justify-content-between mb-2">
                <!-- Play/Pause Button -->
                <button
                    class="btn btn-sm btn-link p-0 d-flex align-items-center justify-content-center border-0"
                    onclick={togglePlay}
                    disabled={!isLoaded}
                    style="width: 20px; height: 20px;"
                    aria-label={isPlaying ? "Pause" : "Play"}
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
                class="bg-secondary bg-opacity-25 rounded-pill position-relative user-select-none"
                style="height: 4px; cursor: pointer;"
                onclick={handleSeek}
                onkeydown={(e) => e.key === "Enter" && handleSeek(e)}
                role="button"
                tabindex="0"
                aria-label="Seek audio position"
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
    </div>

    <!-- Hidden Audio Element -->
    <audio
        bind:this={audioElement}
        src={asset?.path ? `media://${asset.path}` : ""}
        ontimeupdate={handleTimeUpdate}
        onloadedmetadata={handleLoadedMetadata}
        onplay={handlePlay}
        onpause={handlePause}
        onerror={handleError}
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
