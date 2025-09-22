import { json } from '@sveltejs/kit';

// Helper to convert sql.js output to a more usable format
function getResults(stmt) {
	const results = [];
	while (stmt.step()) {
		results.push(stmt.getAsObject());
	}
	return results;
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, locals }) {
	const db = locals.db;
	if (!db) {
		return json({ error: 'Database not available' }, { status: 500 });
	}

	// --- Parse Query Parameters ---
	const ontologyQuery = url.searchParams.get('q')?.trim() || null;
	const institutionIds = url.searchParams.get('institution_ids')?.split(',') || [];
	const status = url.searchParams.get('status') || null;
	const limit = parseInt(url.searchParams.get('limit') || '25', 10);
	const page = parseInt(url.searchParams.get('page') || '0', 10);
	const offset = page * limit;
	const projectId = url.searchParams.get('project_id');

	// --- Build SQL Query ---
	const params = [];
	let whereClauses = [];

	if (projectId) {
		whereClauses.push('o.project_id = ?');
		params.push(projectId);
	}

	if (institutionIds.length > 0 && institutionIds[0]) {
		const placeholders = institutionIds.map(() => '?').join(',');
		whereClauses.push(`o.institution_id IN (${placeholders})`);
		params.push(...institutionIds);
	}

	if (status) {
		whereClauses.push('o.status = ?');
		params.push(status);
	}

	if (ontologyQuery) {
		whereClauses.push(`
            EXISTS (
                SELECT 1 FROM objects_ontology_fields oof
                WHERE oof.object_id = o.id
                AND LOWER(oof.value) LIKE ?
            )
        `);
		params.push(`%${ontologyQuery.toLowerCase()}%`);
	}

	const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

	const ontologyFieldsQuery = `(
        SELECT json_group_array(json_object(
            'id', oof.id,
            'value', oof.value,
            'field_id', oof.field_id
        ))
        FROM objects_ontology_fields oof
        WHERE oof.object_id = o.id
    )`;

	const researchFieldsQuery = `(
        SELECT json_group_array(json_object(
            'id', orf.id,
            'value', orf.value,
            'field_id', orf.field_id,
            'vocabulary_id', orf.vocabulary_id
        ))
        FROM objects_research_fields orf
        WHERE orf.object_id = o.id
    )`;

	const assetsQuery = `(
        SELECT json_group_array(json_object(
            'order', oa."order",
            'asset_id', oa.asset_id,
            'asset_filename', a.filename,
            'asset_path', a.path
        ))
        FROM objects_assets oa
        JOIN assets a ON oa.asset_id = a.id
        WHERE oa.object_id = o.id
    )`;

	const mainQuerySql = `
        SELECT
            o.id,
            o.created_at,
            o.updated_at,
            o.status,
            o.institution_id,
            o.project_id,
            ${assetsQuery} as objects_assets_json,
            ${ontologyFieldsQuery} as objects_ontology_fields_json,
            ${researchFieldsQuery} as objects_research_fields_json
        FROM objects o
        ${whereSql}
        ORDER BY o.created_at DESC
        LIMIT ?
        OFFSET ?
    `;

	const mainQueryParams = [...params, limit, offset];

	const countQuerySql = `SELECT COUNT(DISTINCT o.id) as totalCount FROM objects o ${whereSql}`;
	const countQueryParams = [...params];

	try {
		// Execute count query
		const countStmt = db.prepare(countQuerySql);
		countStmt.bind(countQueryParams);
		const countResult = getResults(countStmt);
		const totalCount = countResult[0]?.totalCount || 0;
		countStmt.free();

		// Execute main query
		const mainStmt = db.prepare(mainQuerySql);
		mainStmt.bind(mainQueryParams);
		let items = getResults(mainStmt);
		mainStmt.free();

		// sql.js returns JSON as strings, so we need to parse them.
		items = items.map((item) => ({
			...item,
			objects_assets_json: item.objects_assets_json ? JSON.parse(item.objects_assets_json) : [],
			objects_ontology_fields_json: item.objects_ontology_fields_json
				? JSON.parse(item.objects_ontology_fields_json)
				: [],
			objects_research_fields_json: item.objects_research_fields_json
				? JSON.parse(item.objects_research_fields_json)
				: []
		}));

		return json({
			items,
			totalCount,
			page,
			pageSize: limit
		});
	} catch (e) {
		console.error(e);
		return json({ error: 'Failed to execute search', details: e.message }, { status: 500 });
	}
}