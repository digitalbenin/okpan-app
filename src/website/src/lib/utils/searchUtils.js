import { getDb, getResults, parseJsonFields, getParamsWithout } from '$lib/utils/dbUtils.js';

/**
 * Performs a comprehensive search for objects in the client-side database,
 * including paginated results, total count, and faceted search counts.
 * This function is designed to mirror the capabilities of the backend search query.
 *
 * @param {object} options - The search parameters.
 * @param {string} [options.q] - Full-text search query.
 * @param {string|string[]} [options.institution_ids] - IDs of institutions to filter by.
 * @param {number} [options.pageSize=25] - The number of items to return per page.
 * @param {number} [options.page=0] - The page number for pagination.
 * @param {string} [options.project_id] - The ID of the project to scope the search to.
 * @param {string[]} [options.ontologyFieldIds] - Optional list of ontology field IDs to search in.
 * @param {Array<Object>} [options.researchFieldFilters] - Optional list of research field filters.
 * @param {Array<{kind:'ontology', fieldId:string, query:string}>} [options.textFieldFilters] - Optional list of specific ontology text field filters.
 * @param {string} [options.orderBy] - Field to order by.
 * @param {string} [options.direction] - Sort direction (asc/desc).
 * @returns {Promise<{
 *   items: any[],
 *   totalCount: number,
 *   page: number,
 *   pageSize: number,
 *   facets: {
 *     institution_ids: any[],
 *     ontology_fields: any[],
 *     research_fields: any[]
 *   }
 * }>} - The search results, including items, counts, and facets.
 */
export async function searchObjects(options = {}) {
  const db = await getDb();
  if (!db) {
    throw new Error('Client DB not initialized. Initialize once in root +layout.js before using search.');
  }

  // 1. Process and normalize input options
  const ontologyQuery = (options.q ?? '').trim() || null;
  let institutionIds = options.institution_ids ?? [];
  if (typeof institutionIds === 'string') {
    institutionIds = institutionIds.split(',').filter(Boolean);
  }
  // status filter removed
  // Prefer pageSize; accept legacy "limit" for backward compatibility
  const pageSize = Number.isFinite(options.pageSize)
    ? options.pageSize
    : Number.isFinite(options.limit)
    ? options.limit
    : 25;
  const page = Number.isFinite(options.page) ? options.page : 1;
  const offset = (page > 0 ? page - 1 : 0) * pageSize;
  const projectId = options.project_id ?? null;
  const ontologyFieldIds = options.ontologyFieldIds ?? [];
  const researchFieldFilters = options.researchFieldFilters ?? [];
  const textFieldFilters = options.textFieldFilters ?? [];
  const orderBy = options.orderBy ?? 'created_at';
  const direction = options.direction === 'asc' ? 'ASC' : 'DESC';

  // 2. Build base WHERE clauses and parameters
  const params = [];
  const whereClauses = [];

  if (projectId) {
    whereClauses.push('o.project_id = ? /*project*/');
    params.push(projectId);
  }
  if (institutionIds.length > 0) {
    const placeholders = institutionIds.map(() => '?').join(',');
    whereClauses.push(`o.institution_id IN (${placeholders}) /*institution*/`);
    params.push(...institutionIds);
  }
  // status filter removed
  if (ontologyQuery) {
    const searchConditions = [];
    const searchParams = [];

    // Ontology fields search (existing)
    const ontologyFieldPlaceholders = ontologyFieldIds.map(() => '?').join(',');
    searchConditions.push(`
      EXISTS (
        SELECT 1 FROM objects_ontology_fields oof
        WHERE oof.object_id = o.id
        ${ontologyFieldIds.length > 0 ? `AND oof.field_id IN (${ontologyFieldPlaceholders})` : ''}
        AND LOWER(oof.value) LIKE ?
      )
    `);
    if (ontologyFieldIds.length > 0) {
      searchParams.push(...ontologyFieldIds);
    }
    searchParams.push(`%${ontologyQuery.toLowerCase()}%`);

    // Research fields search
    searchConditions.push(`
      EXISTS (
        SELECT 1 FROM objects_research_fields orf
        JOIN research_fields rf ON orf.field_id = rf.id
        JOIN texts t_rf ON rf.name_id = t_rf.id
        WHERE orf.object_id = o.id
        AND (LOWER(orf.value) LIKE ? OR LOWER(t_rf.content) LIKE ?)
      )
    `);
    searchParams.push(`%${ontologyQuery.toLowerCase()}%`, `%${ontologyQuery.toLowerCase()}%`);

    // Institution name search
    searchConditions.push(`
      EXISTS (
        SELECT 1 FROM institutions i
        JOIN texts t_i ON i.name_id = t_i.id
        WHERE i.id = o.institution_id
        AND LOWER(t_i.content) LIKE ?
      )
    `);
    searchParams.push(`%${ontologyQuery.toLowerCase()}%`);

    whereClauses.push(`(${searchConditions.join(' OR ')}) /*ontologyQuery*/`);
    params.push(...searchParams);
  }

  // Specific text filters targeting ontology fields
  if (textFieldFilters.length > 0) {
    const textFieldConditions = [];
    for (const tf of textFieldFilters) {
      if (!tf || tf.kind !== 'ontology') continue;
      if (!tf.fieldId || !tf.query) continue;
      textFieldConditions.push(`
        EXISTS (
          SELECT 1 FROM objects_ontology_fields oof
          WHERE oof.object_id = o.id
          AND oof.field_id = ?
          AND LOWER(oof.value) LIKE ?
        )
      `);
      params.push(String(tf.fieldId), `%${String(tf.query).toLowerCase()}%`);
    }
    if (textFieldConditions.length > 0) {
      whereClauses.push(`(${textFieldConditions.join(' AND ')}) /*ontologyQuery*/`);
    }
  }

  if (researchFieldFilters.length > 0) {
    const researchFieldConditions = [];
    for (const filter of researchFieldFilters) {
      const fieldConditions = [];
      if (filter.query && filter.query.trim()) {
        fieldConditions.push(`
                    EXISTS (
                        SELECT 1 FROM objects_research_fields orf
                        WHERE orf.object_id = o.id
                        AND orf.field_id = ?
                        AND LOWER(orf.value) LIKE ?
                    )
                `);
        params.push(filter.fieldId, `%${filter.query.trim().toLowerCase()}%`);
      }
      if (filter.vocabularyIds && filter.vocabularyIds.length > 0) {
        const vocabPlaceholders = filter.vocabularyIds.map(() => '?').join(',');
        fieldConditions.push(`
                    EXISTS (
                        SELECT 1 FROM objects_research_fields orf
                        WHERE orf.object_id = o.id
                        AND orf.field_id = ?
                        AND orf.vocabulary_id IN (${vocabPlaceholders})
                    )
                `);
        params.push(filter.fieldId, ...filter.vocabularyIds);
      }
      if (fieldConditions.length > 0) {
        researchFieldConditions.push(`(${fieldConditions.join(' OR ')})`);
      }
    }
    if (researchFieldConditions.length > 0) {
      whereClauses.push(`(${researchFieldConditions.join(' AND ')}) /*research*/`);
    }
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // 3. Define reusable JSON aggregation subqueries
  const subqueries = {
    assets: `(
      SELECT json_group_array(json_object('order', oa."order", 'asset_id', oa.asset_id, 'asset_filename', a.filename, 'asset_path', a.path))
      FROM objects_assets oa JOIN assets a ON oa.asset_id = a.id
      WHERE oa.object_id = o.id
    )`,
    ontology: `(
      SELECT json_group_array(json_object('id', oof.id, 'value', oof.value, 'field_id', oof.field_id))
      FROM objects_ontology_fields oof
      WHERE oof.object_id = o.id
    )`,
    research: `(
      SELECT json_group_array(json_object('id', orf.id, 'value', orf.value, 'field_id', orf.field_id, 'vocabulary_id', orf.vocabulary_id))
      FROM objects_research_fields orf
      WHERE orf.object_id = o.id
    )`
  };

  // 4. Main query for fetching paginated items
  const mainQuerySql = `
    SELECT
      o.id, o.created_at, o.updated_at, o.status, o.institution_id, o.project_id,
      ${subqueries.assets} as objects_assets_json,
      ${subqueries.ontology} as objects_ontology_fields_json,
      ${subqueries.research} as objects_research_fields_json
    FROM objects o
    ${whereSql}
    ORDER BY o.${orderBy} ${direction}
    LIMIT ? OFFSET ?
  `;
  const mainQueryParams = [...params, pageSize, offset];
  const mainStmt = db.prepare(mainQuerySql);
  mainStmt.bind(mainQueryParams);
  let items = getResults(mainStmt); // getResults also frees the statement
  items = parseJsonFields(items);

  // 5. Count query for total results
  const countQuerySql = `SELECT COUNT(DISTINCT o.id) as totalCount FROM objects o ${whereSql}`;
  const countStmt = db.prepare(countQuerySql);
  countStmt.bind(params);
  const totalCount = getResults(countStmt)[0]?.totalCount || 0;

  // 6. Facet queries
  const facets = {};

  // 6a. Institution Facet
  const institutionParams = getParamsWithout(whereClauses, params, '/*institution*/');
  const institutionWhereClauses = whereClauses.filter((c) => !c.includes('/*institution*/'));
  if (projectId) {
    institutionWhereClauses.push('(i.project_id = ? OR i.project_id IS NULL)');
    institutionParams.push(projectId);
  }
  const institutionWhere = institutionWhereClauses.length > 0 ? `WHERE ${institutionWhereClauses.join(' AND ')}` : '';
  const institutionFacetSql = `
     SELECT 
       o.institution_id, 
       txt.content as name,
       COUNT(DISTINCT o.id) as count
     FROM objects o
     JOIN institutions i ON o.institution_id = i.id
     LEFT JOIN texts txt ON i.name_id = txt.id
     ${institutionWhere}
     GROUP BY o.institution_id, name
     ORDER BY count DESC
   `;
  const institutionStmt = db.prepare(institutionFacetSql);
  institutionStmt.bind(institutionParams);
  facets.institution_ids = getResults(institutionStmt);

  // status facet removed

  // 6c. Ontology Fields Facet
  const ontologyParams = getParamsWithout(whereClauses, params, '/*ontologyQuery*/');
  const ontologyWhereClauses = whereClauses.filter((c) => !c.includes('/*ontologyQuery*/'));
  if (projectId) {
    ontologyWhereClauses.push('(of.project_id = ? OR of.project_id IS NULL)');
    ontologyParams.push(projectId);
  }
  const ontologyWhere = ontologyWhereClauses.length > 0 ? `WHERE ${ontologyWhereClauses.join(' AND ')}` : '';
  const ontologyFacetSql = `
     SELECT oof.field_id, oof.value, COUNT(DISTINCT o.id) as count
     FROM objects o
     JOIN objects_ontology_fields oof ON o.id = oof.object_id
     JOIN ontology_fields of ON oof.field_id = of.id
     ${ontologyWhere}
     GROUP BY oof.field_id, oof.value
     HAVING count > 0
     ORDER BY count DESC
     LIMIT 50
   `;
  const ontologyStmt = db.prepare(ontologyFacetSql);
  ontologyStmt.bind(ontologyParams);
  facets.ontology_fields = getResults(ontologyStmt);

  // 6d. Research Fields Facet (by vocabulary)
  const researchParams = getParamsWithout(whereClauses, params, '/*research*/');
  const researchWhereClauses = whereClauses.filter((c) => !c.includes('/*research*/'));
  if (projectId) {
    researchWhereClauses.push('(rf.project_id = ? OR rf.project_id IS NULL)');
    researchParams.push(projectId);
  }
  const researchWhere = researchWhereClauses.length > 0 ? `WHERE ${researchWhereClauses.join(' AND ')}` : '';
  const researchFacetSql = `
    SELECT 
      v.field_id as field_id,
      orf.vocabulary_id as vocabulary_id,
      txt.content as name,
      COUNT(DISTINCT o.id) as count
    FROM objects o
    JOIN objects_research_fields orf ON orf.object_id = o.id
    JOIN vocabularies v ON orf.vocabulary_id = v.id
    JOIN research_fields rf ON v.field_id = rf.id
    LEFT JOIN texts txt ON v.option_id = txt.id
    ${researchWhere}
    GROUP BY v.field_id, orf.vocabulary_id, name
    HAVING count > 0
    ORDER BY count DESC
  `;
  const researchStmt = db.prepare(researchFacetSql);
  researchStmt.bind(researchParams);
  facets.research_fields = getResults(researchStmt);

  // 7. Return final structured response
  return { items, totalCount, page, pageSize, facets };
}