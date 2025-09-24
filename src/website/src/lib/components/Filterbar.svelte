<script>
	let { value, onInput, resCount, onFiltersClick } = $props();
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
			<div class="ms-2 d-flex align-items-center">
				<span class="pe-2 text-nowrap">Sort by</span>
				<select class="form-select border-0 outline-0">
					<option selected>Sort by...</option>
					<option value="1">Name</option>
					<option value="2">Date</option>
				</select>
			</div>
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
		<div class="text-nowrap">
			{resCount} results
		</div>
	</div>
</div>
