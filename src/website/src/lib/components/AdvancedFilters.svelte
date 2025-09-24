<script>
	import { fly, fade } from 'svelte/transition';

	let { advancedFilters, onClose, researchFields = [] } = $props();

	let activeView = $state('main');
	let selectedField = $state(null);

	function showDetail(field) {
		selectedField = field;
		activeView = 'detail';
	}

	function showMain() {
		activeView = 'main';
	}
</script>

<!-- Backdrop -->
<div
	class="position-fixed top-0 start-0 w-100 h-100"
	onkeydown={onClose}
	role="button"
	tabindex="0"
	style="background-color: rgba(0, 0, 0, 0.5); z-index: 1040;"
	onclick={onClose}
	transition:fade={{ duration: 150 }}
></div>

<!-- Side Menu -->
<div
	class="position-fixed top-0 end-0 vh-100 bg-white shadow d-flex flex-column"
	style="width: 450px; max-width: 100vw; z-index: 1050;"
	transition:fly={{ x: 350, duration: 300 }}
	role="dialog"
	aria-modal="true"
	aria-labelledby="filters-title"
>
	<div class="d-flex justify-content-between align-items-center p-3 border-bottom">
		<h5 class="m-0" id="filters-title">Filters</h5>
		<button type="button" class="btn-close" onclick={onClose} aria-label="Close"></button>
	</div>

	<div class="flex-grow-1 overflow-auto position-relative">
		{#if activeView === 'main'}
			<div
				class="w-100 position-absolute"
				out:fly={{ x: -200, duration: 300 }}
				in:fly={{ x: -200, duration: 300, delay: 300 }}
			>
				<div
					class="p-3 d-flex justify-content-between align-items-center border-bottom"
					role="button"
					tabindex="0"
					onclick={() => showDetail({ name: 'Institutions', type: 'institutions' })}
					onkeydown={() => showDetail({ name: 'Institutions', type: 'institutions' })}
				>
					<p class="m-0">Institutions</p>
					<i class="bi bi-chevron-right"></i>
				</div>

				{#each researchFields as field}
					{#if field.type === 'vocabulary'}
						<div
							class="p-3 d-flex justify-content-between align-items-center border-bottom"
							role="button"
							tabindex="0"
							onclick={() => showDetail(field)}
							onkeydown={() => showDetail(field)}
						>
							<p class="m-0">{field.name}</p>
							<i class="bi bi-chevron-right"></i>
						</div>
					{/if}
				{/each}
			</div>
		{:else if selectedField}
			<div
				class="w-100 position-absolute"
				in:fly={{ x: 200, duration: 300 }}
				out:fly={{ x: 200, duration: 300 }}
				onoutroend={() => (selectedField = null)}
			>
				<div class="d-flex justify-content-between align-items-center p-3 border-bottom">
					<button
						type="button"
						class="btn btn-link p-0 text-decoration-none text-body"
						onclick={showMain}
					>
						<i class="bi bi-chevron-left me-2"></i>{selectedField.name}
					</button>
					<button type="button" class="btn btn-link p-0">Select all</button>
				</div>
				<div class="p-3">
					<p>Checkboxes for {selectedField.name} will go here.</p>
				</div>
			</div>
		{/if}
	</div>
</div>
