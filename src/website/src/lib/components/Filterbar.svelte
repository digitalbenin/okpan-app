<script>
	let {
		value,
		onInput,
		resCount,
		onFiltersClick,
		institutionChips = [],
		vocabularyChips = [],
		textChips = [],
		hasActiveFilters = false,
		onRemoveInstitution,
		onRemoveVocabulary,
		onRemoveTextFilter,
		onClearAllAdvancedFilters
	} = $props();
</script>

<div class="row">
	<div class="mt-3 d-flex justify-content-between align-items-center">
		<div class="position-relative pe-3">
			<span class="position-absolute top-50 start-0 translate-middle-y ps-3 pe-none">
				<i class="bi bi-search"></i>
			</span>
			<input
				type="search"
				class="form-control ps-5 border-0"
				style="min-width: 200px"
				placeholder="Search..."
				{value}
				oninput={onInput}
			/>
		</div>
		<div class="d-flex flex-row gap-3">
			<!--<div class="ms-2 d-flex align-items-center">
				<span class="pe-2 text-nowrap">Sort by</span>
				<select class="form-select border-0 outline-0">
					<option selected>Sort by...</option>
					<option value="1">Name</option>
					<option value="2">Date</option>
				</select>
			</div> -->
			<div class="ms-2">
				<button class="btn btn-link text-dark text-decoration-none" onclick={onFiltersClick}>
					Filters
					<i class="bi bi-filter"></i>
				</button>
			</div>
		</div>
	</div>
</div>
<div class="row">
	<div class="my-3 d-flex justify-content-between align-items-center">
		<div class="d-flex align-items-center gap-3 text-nowrap">
			<span>{resCount} results</span>
		</div>
		<div class="d-flex align-items-center justify-content-end flex-wrap gap-1">
			{#if hasActiveFilters}
				{#each institutionChips as chip (chip.id)}
					<span class="badge bg-secondary text-white d-flex align-items-center">
						{chip.label}
						<button
							type="button"
							class="btn btn-link btn-sm text-white text-decoration-none ms-2 p-0"
							aria-label="Remove filter"
							onclick={() => onRemoveInstitution?.(chip.id)}
						>
							<i class="bi bi-x"></i>
						</button>
					</span>
				{/each}

				{#each vocabularyChips as chip (`${chip.fieldId}:${chip.vocabId}`)}
					<span class="badge bg-secondary text-white d-inline-flex align-items-center ps-3">
						{chip.label}
						<button
							type="button"
							class="btn btn-link btn-sm text-white text-decoration-none ms-2 p-0"
							aria-label="Remove filter"
							onclick={() => onRemoveVocabulary?.(chip.fieldId, chip.vocabId)}
						>
							<i class="bi bi-x"></i>
						</button>
					</span>
				{/each}

				{#each textChips as chip (chip.key)}
					<span class="badge bg-secondary text-white d-inline-flex align-items-center ps-3">
						{chip.label}
						<button
							type="button"
							class="btn btn-link btn-sm text-white text-decoration-none ms-2 p-0"
							aria-label="Remove filter"
							onclick={() => onRemoveTextFilter?.(chip.key)}
						>
							<i class="bi bi-x"></i>
						</button>
					</span>
				{/each}

				<button
					type="button"
					class="btn btn-link p-0 ms-2 text-dark"
					onclick={onClearAllAdvancedFilters}
				>
					Clear all
				</button>
			{/if}
		</div>
	</div>
</div>
