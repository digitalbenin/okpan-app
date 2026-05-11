export const ACTIVITY_GROUP_WINDOW_MS = 5000;

export const IGNORED_ACTIVITY_TABLES = new Set([
    'project_activity',
    'settings',
    'website_settings',
    'object_display_fields'
]);

export const OBJECT_ACTIVITY_JUNCTION_TABLES = new Set([
    'objects_assets',
    'objects_ontology_fields',
    'objects_research_fields',
    'objects_datasources'
]);

export const TEXT_OWNER_DEFINITIONS = [
    {
        tableName: 'institutions',
        fields: ['name_id', 'description_id', 'country_id', 'location_id'],
        entityType: 'institutions',
        messageKey: 'activity.institutions-updated'
    },
    {
        tableName: 'research_fields',
        fields: ['name_id', 'description_id'],
        entityType: 'research_fields',
        messageKey: 'activity.research-fields-updated'
    },
    {
        tableName: 'ontology_fields',
        fields: ['name_id', 'description_id', 'category_id'],
        entityType: 'connections',
        messageKey: 'activity.connections-updated'
    },
    {
        tableName: 'vocabularies',
        fields: ['option_id', 'description_id'],
        entityType: 'vocabularies',
        messageKey: 'activity.vocabularies-updated'
    }
];

export const ACTIVITY_FEED_DEFINITIONS = [
    {
        id: 'institution-media-added',
        tables: ['assets_institutions'],
        ops: ['INSERT'],
        resolver: 'institutionMedia',
        actionType: 'add',
        entityType: 'institutions',
        messageKey: 'activity.institution-media-added'
    },
    {
        id: 'institution-media-updated',
        tables: ['assets_institutions'],
        ops: ['UPDATE'],
        resolver: 'institutionMedia',
        actionType: 'update',
        entityType: 'institutions',
        messageKey: 'activity.institution-media-updated'
    },
    {
        id: 'institution-media-removed',
        tables: ['assets_institutions'],
        ops: ['DELETE'],
        resolver: 'institutionMedia',
        actionType: 'remove',
        entityType: 'institutions',
        messageKey: 'activity.institution-media-removed'
    },
    {
        id: 'objects-created',
        tables: ['objects'],
        ops: ['INSERT'],
        resolver: 'object',
        actionType: 'create',
        entityType: 'objects',
        messageKey: 'activity.objects-created'
    },
    {
        id: 'objects-updated',
        tables: ['objects'],
        ops: ['UPDATE'],
        resolver: 'object',
        actionType: 'update',
        entityType: 'objects',
        messageKey: 'activity.objects-updated'
    },
    {
        id: 'objects-deleted',
        tables: ['objects'],
        ops: ['DELETE'],
        resolver: 'object',
        actionType: 'delete',
        entityType: 'objects',
        messageKey: 'activity.objects-deleted'
    },
    {
        id: 'object-junction-updated',
        tables: ['objects_assets', 'objects_ontology_fields', 'objects_research_fields', 'objects_datasources'],
        ops: ['INSERT', 'UPDATE', 'DELETE'],
        resolver: 'objectLink',
        actionType: 'update',
        entityType: 'objects',
        messageKey: 'activity.objects-updated',
        skipIfObjectCreatedInBatch: true
    },
    {
        id: 'institutions-created',
        tables: ['institutions'],
        ops: ['INSERT'],
        resolver: 'directEntity',
        actionType: 'create',
        entityType: 'institutions',
        messageKey: 'activity.institutions-created'
    },
    {
        id: 'institutions-updated',
        tables: ['institutions'],
        ops: ['UPDATE'],
        resolver: 'directEntity',
        actionType: 'update',
        entityType: 'institutions',
        messageKey: 'activity.institutions-updated'
    },
    {
        id: 'institutions-deleted',
        tables: ['institutions'],
        ops: ['DELETE'],
        resolver: 'directEntity',
        actionType: 'delete',
        entityType: 'institutions',
        messageKey: 'activity.institutions-deleted'
    },
    {
        id: 'research-fields-created',
        tables: ['research_fields'],
        ops: ['INSERT'],
        resolver: 'directEntity',
        actionType: 'create',
        entityType: 'research_fields',
        messageKey: 'activity.research-fields-created'
    },
    {
        id: 'research-fields-updated',
        tables: ['research_fields'],
        ops: ['UPDATE'],
        resolver: 'directEntity',
        actionType: 'update',
        entityType: 'research_fields',
        messageKey: 'activity.research-fields-updated'
    },
    {
        id: 'research-fields-deleted',
        tables: ['research_fields'],
        ops: ['DELETE'],
        resolver: 'directEntity',
        actionType: 'delete',
        entityType: 'research_fields',
        messageKey: 'activity.research-fields-deleted'
    },
    {
        id: 'vocabularies-created',
        tables: ['vocabularies'],
        ops: ['INSERT'],
        resolver: 'directEntity',
        actionType: 'create',
        entityType: 'vocabularies',
        messageKey: 'activity.vocabularies-created'
    },
    {
        id: 'vocabularies-updated',
        tables: ['vocabularies', 'vocabularies_generic_assets'],
        ops: ['UPDATE', 'INSERT', 'DELETE'],
        resolver: 'directEntity',
        actionType: 'update',
        entityType: 'vocabularies',
        messageKey: 'activity.vocabularies-updated'
    },
    {
        id: 'vocabularies-deleted',
        tables: ['vocabularies'],
        ops: ['DELETE'],
        resolver: 'directEntity',
        actionType: 'delete',
        entityType: 'vocabularies',
        messageKey: 'activity.vocabularies-deleted'
    },
    {
        id: 'connections-created',
        tables: ['ontology_fields'],
        ops: ['INSERT'],
        resolver: 'directEntity',
        actionType: 'create',
        entityType: 'connections',
        messageKey: 'activity.connections-created'
    },
    {
        id: 'connections-updated',
        tables: ['ontology_fields'],
        ops: ['UPDATE'],
        resolver: 'directEntity',
        actionType: 'update',
        entityType: 'connections',
        messageKey: 'activity.connections-updated'
    },
    {
        id: 'connections-deleted',
        tables: ['ontology_fields'],
        ops: ['DELETE'],
        resolver: 'directEntity',
        actionType: 'delete',
        entityType: 'connections',
        messageKey: 'activity.connections-deleted'
    },
    {
        id: 'texts-updated',
        tables: ['texts'],
        ops: ['INSERT', 'UPDATE', 'DELETE'],
        resolver: 'textOwner',
        actionType: 'update',
        entityType: 'text_owner'
    },
    {
        id: 'translations-updated',
        tables: ['translations'],
        ops: ['INSERT', 'UPDATE', 'DELETE'],
        resolver: 'textOwner',
        actionType: 'update',
        entityType: 'text_owner'
    }
];

export const ACTIVITY_MESSAGE_FALLBACKS = {
    'activity.institution-media-added': '{{actor}} added {{count}} media to {{institutionName}}',
    'activity.institution-media-updated': '{{actor}} edited {{count}} media links for {{institutionName}}',
    'activity.institution-media-removed': '{{actor}} removed {{count}} media from {{institutionName}}',
    'activity.objects-created': '{{actor}} created {{count}} objects in {{institutionName}}',
    'activity.objects-updated': '{{actor}} edited {{count}} objects in {{institutionName}}',
    'activity.objects-deleted': '{{actor}} deleted {{count}} objects from {{institutionName}}',
    'activity.institutions-created': '{{actor}} created {{count}} institutions',
    'activity.institutions-updated': '{{actor}} edited {{count}} institutions',
    'activity.institutions-deleted': '{{actor}} deleted {{count}} institutions',
    'activity.research-fields-created': '{{actor}} created {{count}} research fields',
    'activity.research-fields-updated': '{{actor}} edited {{count}} research fields',
    'activity.research-fields-deleted': '{{actor}} deleted {{count}} research fields',
    'activity.vocabularies-created': '{{actor}} created {{count}} vocabularies',
    'activity.vocabularies-updated': '{{actor}} edited {{count}} vocabularies',
    'activity.vocabularies-deleted': '{{actor}} deleted {{count}} vocabularies',
    'activity.connections-created': '{{actor}} created {{count}} connections',
    'activity.connections-updated': '{{actor}} edited {{count}} connections',
    'activity.connections-deleted': '{{actor}} deleted {{count}} connections',
    'activity.unknown-institution': 'an institution',
    'activity.empty': 'No activity yet.'
};

export function findActivityFeedDefinition(tableName, op) {
    return ACTIVITY_FEED_DEFINITIONS.find((definition) => (
        definition.tables.includes(tableName) && definition.ops.includes(op)
    )) || null;
}

export function formatActivityMessageFallback(messageKey, params = {}) {
    const template = ACTIVITY_MESSAGE_FALLBACKS[messageKey];

    if (!template) {
        return '';
    }

    return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
        const value = params[key];
        return value === null || value === undefined ? '' : String(value);
    });
}