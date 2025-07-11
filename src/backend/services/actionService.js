// Action service - generates metadata for action logging

// Shared Constants (exported for use in other files)
export const JUNCTION_TABLE_TYPES = ['objects_assets', 'objects_research_fields', 'assets_institutions'];
export const TEXT_REFERENCED_ENTITY_TYPES = ['texts', 'translations'];
export const IGNORED_FIELDS_FOR_CHANGES = ['id', 'created_at', 'updated_at'];
export const UUID_REGEX = /^[a-f0-9-]{36}$/i;
export const ENTITIES_WITH_PROJECT_ID = ['objects', 'institutions', 'assets', 'genericAssets', 'languages', 'research_fields'];
export const ENTITIES_WITH_INDIRECT_PROJECT_ID = ['datasources']; // entities that get project_id via relationships

// Text entity field-specific ID variables for special handling
export const TEXT_FIELD_ID_VARIABLES = ['nameId', 'methodId', 'notesId', 'titleId', 'descriptionId'];

export const VARIABLE_NAME_MAPPINGS = {
    objectId: ['objectId', 'object_id'],
    assetId: ['assetId', 'asset_id'],
    fieldId: ['fieldId', 'field_id'],
    institutionId: ['institutionId', 'institution_id']
};

export const JUNCTION_RELATION_EXTRACTORS = {
    objects_assets: (db, id) => db.query.objects_assets.findFirst({
        where: (e, { eq }) => eq(e.id, id),
        with: { object: { with: { institution: { with: { name: true } } } }, asset: true }
    }),
    objects_research_fields: (db, id) => db.query.objects_research_fields.findFirst({
        where: (e, { eq }) => eq(e.id, id),
        with: { object: { with: { institution: { with: { name: true } } } }, researchField: { with: { name: true } } }
    }),
    assets_institutions: (db, id) => db.query.assets_institutions.findFirst({
        where: (e, { eq }) => eq(e.id, id),
        with: { asset: true, institution: { with: { name: true } } }
    })
};

export const TEXT_PARENT_QUERIES = [
    { table: 'project', fields: ['title_id', 'description_id'] },
    { table: 'institutions', fields: ['name_id', 'description_id', 'country_id', 'location_id'] },
    { table: 'research_fields', fields: ['name_id', 'description_id'] },
    { table: 'datasources', fields: ['name_id', 'method_id', 'notes_id'] },
    { table: 'ontology_fields', fields: ['name_id', 'description_id', 'category_id'] },
    { table: 'vocabularies', fields: ['option_id', 'description_id'] }
];

// Local Constants (specific to action service)
const ACTION_TYPE_MAPPINGS = {
    CREATE: 'add',
    UPDATE: 'edit',
    DELETE: 'delete'
};

const JUNCTION_ACTION_MAPPINGS = {
    CREATE: 'link',
    DELETE: 'unlink',
    UPDATE: 'edit'
};

const ENTITY_NAME_STRATEGIES = {
    project: (e) => e.title?.content || `Project ${e.id.slice(-6)}`,
    institutions: (e) => e.name?.content || `Institution ${e.id.slice(-6)}`,
    objects: (e) => e.id.slice(-6),
    research_fields: (e) => e.name?.content || `Research Field ${e.id.slice(-6)}`,
    assets: (e) => e.filename || `Asset ${e.id.slice(-6)}`,
    genericAssets: (e) => e.filename || `Generic Asset ${e.id.slice(-6)}`,
    datasources: (e) => e.name?.content || `Datasource ${e.id.slice(-6)}`,
    texts: (e) => `"${(e.content || '').substring(0, 30)}${e.content?.length > 30 ? '...' : ''}"`
};

const SECONDARY_ENTITY_CONFIGS = {
    objects_assets: {
        entityKey: 'asset',
        type: 'assets',
        nameExtractor: (asset) => asset.filename || `Asset ${asset.id.slice(-6)}`
    },
    objects_research_fields: {
        entityKey: 'researchField',
        type: 'research_fields',
        nameExtractor: (field) => field.name?.content || `Research Field ${field.id.slice(-6)}`
    },
    assets_institutions: {
        entityKey: 'institution',
        type: 'institutions',
        nameExtractor: (institution) => institution.name?.content || `Institution ${institution.id.slice(-6)}`
    }
};

const ENTITY_RELATIONSHIPS = {
    texts: {
        type: 'referenced',
        async findParents(textId, db) {
            for (const { table, fields } of TEXT_PARENT_QUERIES) {
                // Add with clauses for metadata generation
                const withClause = table === 'project' ? { title: true } :
                    table === 'vocabularies' ? { option: true } :
                        { name: true };

                for (const field of fields) {
                    const found = await db.query[table].findFirst({
                        where: (entity, { eq }) => eq(entity[field], textId),
                        with: withClause
                    });
                    if (found) {
                        return { type: table, id: found.id, entity: found, field };
                    }
                }
            }
            return null;
        }
    },

    translations: {
        type: 'translation',
        async findContext(translationId, db) {
            const translation = await db.query.translations.findFirst({
                where: (entity, { eq }) => eq(entity.id, translationId),
                with: { text: true, language: true }
            });
            if (!translation) return null;
            const textParent = await ENTITY_RELATIONSHIPS.texts.findParents(translation.text_id, db);
            return { translation, textParent, language: translation.language };
        }
    },

    objects_assets: {
        type: 'junction',
        async extractRelations(junctionId, db) {
            return await db.query.objects_assets.findFirst({
                where: (entity, { eq }) => eq(entity.id, junctionId),
                with: { object: { with: { institution: { with: { name: true } } } }, asset: true }
            });
        }
    },

    objects_research_fields: {
        type: 'junction',
        async extractRelations(junctionId, db) {
            return await db.query.objects_research_fields.findFirst({
                where: (entity, { eq }) => eq(entity.id, junctionId),
                with: { object: { with: { institution: { with: { name: true } } } }, researchField: { with: { name: true } } }
            });
        }
    },

    assets_institutions: {
        type: 'junction',
        async extractRelations(junctionId, db) {
            return await db.query.assets_institutions.findFirst({
                where: (entity, { eq }) => eq(entity.id, junctionId),
                with: { asset: true, institution: { with: { name: true } } }
            });
        }
    }
};

const ENTITY_HIERARCHIES = {
    project: async (id, db) => ({ type: 'project', id, entity: await db.query.project.findFirst({ where: (e, { eq }) => eq(e.id, id), with: { title: true } }) }),
    institutions: async (id, db) => ({ type: 'institutions', id, entity: await db.query.institutions.findFirst({ where: (e, { eq }) => eq(e.id, id), with: { name: true } }) }),
    objects: async (id, db) => ({ type: 'objects', id, entity: await db.query.objects.findFirst({ where: (e, { eq }) => eq(e.id, id) }) }),
    research_fields: async (id, db) => ({ type: 'research_fields', id, entity: await db.query.research_fields.findFirst({ where: (e, { eq }) => eq(e.id, id), with: { name: true } }) }),
    assets: async (id, db) => ({ type: 'assets', id, entity: await db.query.assets.findFirst({ where: (e, { eq }) => eq(e.id, id) }) }),
    genericAssets: async (id, db) => ({ type: 'genericAssets', id, entity: await db.query.genericAssets.findFirst({ where: (e, { eq }) => eq(e.id, id) }) }),
    datasources: async (id, db) => ({ type: 'datasources', id, entity: await db.query.datasources.findFirst({ where: (e, { eq }) => eq(e.id, id), with: { name: true } }) }),
    texts: async (id, db) => ({ type: 'texts', id, entity: await db.query.texts.findFirst({ where: (e, { eq }) => eq(e.id, id) }) })
};

const getEntityName = (type, entity) => {
    return ENTITY_NAME_STRATEGIES[type]?.(entity) || `${type} ${entity.id.slice(-6)}`;
};

const mapActionType = (actionType, entityType) => {
    if (JUNCTION_TABLE_TYPES.includes(entityType)) {
        return JUNCTION_ACTION_MAPPINGS[actionType] || 'edit';
    }
    if (TEXT_REFERENCED_ENTITY_TYPES.includes(entityType)) return 'edit';
    return ACTION_TYPE_MAPPINGS[actionType] || 'edit';
};

export const generateActionMetadata = async (actionType, entityType, entityId, db, preExecutionData = null) => {
    try {
        const mappedActionType = mapActionType(actionType, entityType);

        // Handle relationships
        const relationship = ENTITY_RELATIONSHIPS[entityType];
        if (relationship) {
            if (relationship.type === 'referenced') {
                const parent = await relationship.findParents(entityId, db);
                if (parent) {
                    return JSON.stringify({
                        referenced_id: parent.id,
                        referenced_type: parent.type,
                        referenced_name: getEntityName(parent.type, parent.entity),
                        action_type: mappedActionType
                    });
                }
            } else if (relationship.type === 'translation') {
                const context = await relationship.findContext(entityId, db);
                if (context?.textParent) {
                    return JSON.stringify({
                        referenced_id: context.textParent.id,
                        referenced_type: context.textParent.type,
                        referenced_name: getEntityName(context.textParent.type, context.textParent.entity),
                        action_type: mappedActionType
                    });
                }
            } else if (relationship.type === 'junction') {
                const relations = preExecutionData || await relationship.extractRelations(entityId, db);

                if (relations) {
                    const metadata = {
                        referenced_id: relations.object_id,
                        referenced_type: 'objects',
                        referenced_name: relations.object_id.slice(-6),
                        action_type: mappedActionType
                    };

                    // Add secondary entity info using constants
                    const config = SECONDARY_ENTITY_CONFIGS[entityType];
                    if (config && relations[config.entityKey]) {
                        const secondaryEntity = relations[config.entityKey];
                        Object.assign(metadata, {
                            secondary_entity_id: secondaryEntity.id,
                            secondary_entity_type: config.type,
                            secondary_entity_name: config.nameExtractor(secondaryEntity)
                        });
                    }

                    return JSON.stringify(metadata);
                }
            }
        }

        // Handle regular entities
        const hierarchyFn = ENTITY_HIERARCHIES[entityType];
        if (hierarchyFn) {
            const entityData = await hierarchyFn(entityId, db);
            return JSON.stringify({
                referenced_id: entityId,
                referenced_type: entityType,
                referenced_name: getEntityName(entityType, entityData.entity),
                action_type: mappedActionType
            });
        }

        return null;
    } catch (error) {
        console.error('Error generating action metadata:', error);
        return null;
    }
};



// Extract primary entity from child action metadata
export const getPrimaryEntityFromActions = (actionRows) => {
    const entityCounts = {};

    for (const action of actionRows) {
        if (action.metadata && typeof action.metadata === 'string') {
            try {
                const metadata = JSON.parse(action.metadata);
                if (metadata.referenced_id && metadata.referenced_type) {
                    const key = `${metadata.referenced_type}:${metadata.referenced_id}`;
                    entityCounts[key] = (entityCounts[key] || 0) + 1;
                }
            } catch (error) {
                // Skip actions with invalid metadata
                continue;
            }
        }
    }

    const [mostCommon] = Object.entries(entityCounts)
        .sort(([, a], [, b]) => b - a)[0] || [];

    if (mostCommon) {
        const [type, id] = mostCommon.split(':');
        return { entityType: type, entityId: id };
    }

    // Fallback: if no metadata available, use the first non-junction, non-text entity directly
    const fallbackAction = actionRows.find(action =>
        action.entity_type && action.entity_id &&
        !JUNCTION_TABLE_TYPES.includes(action.entity_type) &&
        !TEXT_REFERENCED_ENTITY_TYPES.includes(action.entity_type)
    );

    if (fallbackAction) {
        return {
            entityType: fallbackAction.entity_type,
            entityId: fallbackAction.entity_id
        };
    }

    return null;
};

export const getParentActionType = (actionRows, primaryEntityId) => {
    const primaryActions = actionRows.filter(action =>
        action.entity_id === primaryEntityId
    );

    if (primaryActions.some(a => a.action_type === 'CREATE')) return 'CREATE';
    if (primaryActions.some(a => a.action_type === 'DELETE')) return 'DELETE';
    return 'UPDATE';
};

