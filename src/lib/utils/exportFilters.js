/**
 * Extracts a display label from a research field's name property.
 * Field names may be plain strings, rich objects with a content property,
 * or objects containing a translations array.
 */
export function resolveFieldLabel(field) {
	const name = field?.name;
	if (typeof name === 'string') return name;
	return (
		name?.content ??
		(Array.isArray(name?.translations) && name.translations[0]?.content) ??
		String(field?.id ?? '')
	);
}

/**
 * Maps vocabulary-type connection fields to the select-option shape
 * expected by ConnectionFilters.
 */
export function resolveConnectionFieldOptions(fields, t) {
	if (!Array.isArray(fields)) return [];
	return fields.map((field) => ({
		value: field.id,
		label: resolveFieldLabel(field),
		group: field?.project?.title?.content ?? t('common.connections'),
		vocabOptions: Array.isArray(field?.vocabularies)
			? field.vocabularies.map((v) => ({ value: v.id, label: v?.option?.content ?? v.id }))
			: []
	}));
}

/**
 * Maps free-text research fields to the select-option shape
 * expected by ResearchFieldFilters.
 */
export function resolveFreeTextFieldOptions(fields, t) {
	if (!Array.isArray(fields)) return [];
	return fields.map((field) => ({
		value: field.id,
		label: resolveFieldLabel(field),
		group: field?.project?.title?.content ?? t('filters.research-fields')
	}));
}

/**
 * Removes vocabulary IDs that are not part of the allowed options for
 * each connection field, keeping export payloads valid.
 */
export function sanitizeConnectionFilters(filters, connectionFieldOptions) {
	if (!Array.isArray(filters) || filters.length === 0) return [];
	return filters.map((filter) => {
		const allowed = (
			connectionFieldOptions.find((opt) => opt.value === filter.fieldId)?.vocabOptions ?? []
		).map((opt) => opt.value);
		const vocabularyIds = (
			Array.isArray(filter.vocabularyIds) ? filter.vocabularyIds : []
		).filter((id) => allowed.includes(id));
		return { fieldId: filter.fieldId, vocabularyIds };
	});
}

/**
 * Removes free-text filters with empty or whitespace-only queries.
 */
export function sanitizeFreeTextFilters(filters) {
	if (!Array.isArray(filters) || filters.length === 0) return [];
	return filters
		.filter((filter) => filter.query?.trim())
		.map((filter) => ({ fieldId: filter.fieldId, query: filter.query.trim() }));
}

/**
 * Builds the serializable filters object used by export APIs.
 * Uses `project_id` key as expected by the export endpoints.
 */
export function buildFiltersPayload({
	projectId,
	selectedStatus,
	selectedInstitutions,
	connectionFilters,
	freeTextFilters,
	connectionFieldOptions
}) {
	const filters = {
		project_id: projectId,
		...(selectedStatus !== 'all' && { status: selectedStatus }),
		...(selectedInstitutions.length > 0 && { institutionIds: [...selectedInstitutions] })
	};

	const researchFieldFilters = [
		...sanitizeConnectionFilters(connectionFilters, connectionFieldOptions),
		...sanitizeFreeTextFilters(freeTextFilters)
	];

	if (researchFieldFilters.length > 0) {
		filters.researchFieldFilters = researchFieldFilters;
	}

	return filters;
}

/**
 * Builds the serializable params for searchObjects.
 * Uses `projectId` (camelCase) and a 0-based page index as expected by the search API.
 */
export function buildObjectSearchParams({
	projectId,
	currentPage,
	pageSize,
	selectedStatus,
	selectedInstitutions,
	connectionFilters,
	freeTextFilters,
	connectionFieldOptions
}) {
	const params = {
		projectId,
		page: currentPage - 1,
		pageSize,
		...(selectedStatus !== 'all' && { status: selectedStatus }),
		...(selectedInstitutions.length > 0 && { institutionIds: [...selectedInstitutions] })
	};

	const researchFieldFilters = [
		...sanitizeConnectionFilters(connectionFilters, connectionFieldOptions),
		...sanitizeFreeTextFilters(freeTextFilters)
	];

	if (researchFieldFilters.length > 0) {
		params.researchFieldFilters = researchFieldFilters;
	}

	return params;
}
