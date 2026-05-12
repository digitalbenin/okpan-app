export const ACTIVITY_GROUP_WINDOW_MS = 5000;

export const IGNORED_ACTIVITY_TABLES = new Set([
    'project_activity',
    'ontology_fields',
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
        tableName: 'websiteSettings',
        fields: ['title_id', 'about_id'],
        entityType: 'website_settings',
        messageKey: 'activity.website-settings-updated'
    },
    {
        tableName: 'project',
        fields: ['title_id', 'description_id'],
        entityType: 'project_settings',
        messageKey: 'activity.project-settings-updated'
    },
    {
        tableName: 'institutions',
        fields: ['name_id', 'description_id', 'country_id', 'location_id'],
        entityType: 'institutions',
        messageKey: 'activity.institutions-updated'
    },
    {
        tableName: 'research_fields',
        fields: ['name_id', 'description_id'],
        entityType: 'research_fields'
    },
    {
        tableName: 'vocabularies',
        fields: ['option_id', 'description_id'],
        entityType: 'connections',
        messageKey: 'activity.connections-updated'
    },
    {
        tableName: 'datasources',
        fields: ['name_id', 'method_id', 'notes_id'],
        entityType: 'datasources',
        messageKey: 'activity.datasources-updated',
        institutionField: 'institution_id'
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
        id: 'datasources-created',
        tables: ['datasources'],
        ops: ['INSERT'],
        resolver: 'institutionEntity',
        actionType: 'create',
        entityType: 'datasources',
        messageKey: 'activity.datasources-created'
    },
    {
        id: 'datasources-updated',
        tables: ['datasources'],
        ops: ['UPDATE'],
        resolver: 'institutionEntity',
        actionType: 'update',
        entityType: 'datasources',
        messageKey: 'activity.datasources-updated'
    },
    {
        id: 'datasources-deleted',
        tables: ['datasources'],
        ops: ['DELETE'],
        resolver: 'institutionEntity',
        actionType: 'delete',
        entityType: 'datasources',
        messageKey: 'activity.datasources-deleted'
    },
    {
        id: 'templates-created',
        tables: ['templates'],
        ops: ['INSERT'],
        resolver: 'institutionEntity',
        actionType: 'create',
        entityType: 'templates',
        messageKey: 'activity.templates-created'
    },
    {
        id: 'templates-updated',
        tables: ['templates'],
        ops: ['UPDATE'],
        resolver: 'institutionEntity',
        actionType: 'update',
        entityType: 'templates',
        messageKey: 'activity.templates-updated'
    },
    {
        id: 'templates-deleted',
        tables: ['templates'],
        ops: ['DELETE'],
        resolver: 'institutionEntity',
        actionType: 'delete',
        entityType: 'templates',
        messageKey: 'activity.templates-deleted'
    },
    {
        id: 'assets-created',
        tables: ['assets'],
        ops: ['INSERT'],
        resolver: 'institutionEntity',
        actionType: 'create',
        entityType: 'assets',
        messageKey: 'activity.assets-created'
    },
    {
        id: 'assets-updated',
        tables: ['assets'],
        ops: ['UPDATE'],
        resolver: 'institutionEntity',
        actionType: 'update',
        entityType: 'assets',
        messageKey: 'activity.assets-updated'
    },
    {
        id: 'assets-deleted',
        tables: ['assets'],
        ops: ['DELETE'],
        resolver: 'institutionEntity',
        actionType: 'delete',
        entityType: 'assets',
        messageKey: 'activity.assets-deleted'
    },
    {
        id: 'research-fields-created',
        tables: ['research_fields'],
        ops: ['INSERT'],
        resolver: 'researchField',
        actionType: 'create',
        entityType: 'research_fields',
        messageKey: 'activity.research-fields-created'
    },
    {
        id: 'research-fields-updated',
        tables: ['research_fields'],
        ops: ['UPDATE'],
        resolver: 'researchField',
        actionType: 'update',
        entityType: 'research_fields',
        messageKey: 'activity.research-fields-updated'
    },
    {
        id: 'research-fields-deleted',
        tables: ['research_fields'],
        ops: ['DELETE'],
        resolver: 'researchField',
        actionType: 'delete',
        entityType: 'research_fields',
        messageKey: 'activity.research-fields-deleted'
    },
    {
        id: 'connections-created',
        tables: ['vocabularies'],
        ops: ['INSERT'],
        resolver: 'directEntity',
        actionType: 'create',
        entityType: 'connections',
        messageKey: 'activity.connections-created'
    },
    {
        id: 'connections-updated',
        tables: ['vocabularies', 'vocabularies_generic_assets'],
        ops: ['UPDATE', 'INSERT', 'DELETE'],
        resolver: 'directEntity',
        actionType: 'update',
        entityType: 'connections',
        messageKey: 'activity.connections-updated'
    },
    {
        id: 'connections-deleted',
        tables: ['vocabularies'],
        ops: ['DELETE'],
        resolver: 'directEntity',
        actionType: 'delete',
        entityType: 'connections',
        messageKey: 'activity.connections-deleted'
    },
    {
        id: 'project-updated',
        tables: ['project'],
        ops: ['UPDATE'],
        resolver: 'directEntity',
        actionType: 'update',
        entityType: 'project_settings',
        messageKey: 'activity.project-settings-updated'
    },
    {
        id: 'settings-updated',
        tables: ['settings'],
        ops: ['INSERT', 'UPDATE'],
        resolver: 'directEntity',
        actionType: 'update',
        entityType: 'project_settings',
        messageKey: 'activity.project-settings-updated'
    },
    {
        id: 'website-settings-updated',
        tables: ['website_settings'],
        ops: ['INSERT', 'UPDATE'],
        resolver: 'directEntity',
        actionType: 'update',
        entityType: 'website_settings',
        messageKey: 'activity.website-settings-updated'
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

export const INSTITUTIONLESS_ACTIVITY_MESSAGE_KEYS = {
    'activity.datasources-created': 'activity.datasources-created-generic',
    'activity.datasources-updated': 'activity.datasources-updated-generic',
    'activity.datasources-deleted': 'activity.datasources-deleted-generic',
    'activity.templates-created': 'activity.templates-created-generic',
    'activity.templates-updated': 'activity.templates-updated-generic',
    'activity.templates-deleted': 'activity.templates-deleted-generic',
    'activity.assets-created': 'activity.assets-created-generic',
    'activity.assets-updated': 'activity.assets-updated-generic',
    'activity.assets-deleted': 'activity.assets-deleted-generic'
};

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
    'activity.datasources-created': '{{actor}} created {{count}} datasources for {{institutionName}}',
    'activity.datasources-updated': '{{actor}} edited {{count}} datasources for {{institutionName}}',
    'activity.datasources-deleted': '{{actor}} deleted {{count}} datasources for {{institutionName}}',
    'activity.datasources-created-generic': '{{actor}} created {{count}} datasources',
    'activity.datasources-updated-generic': '{{actor}} edited {{count}} datasources',
    'activity.datasources-deleted-generic': '{{actor}} deleted {{count}} datasources',
    'activity.templates-created': '{{actor}} created {{count}} templates for {{institutionName}}',
    'activity.templates-updated': '{{actor}} edited {{count}} templates for {{institutionName}}',
    'activity.templates-deleted': '{{actor}} deleted {{count}} templates for {{institutionName}}',
    'activity.templates-created-generic': '{{actor}} created {{count}} templates',
    'activity.templates-updated-generic': '{{actor}} edited {{count}} templates',
    'activity.templates-deleted-generic': '{{actor}} deleted {{count}} templates',
    'activity.assets-created': '{{actor}} uploaded {{count}} assets for {{institutionName}}',
    'activity.assets-updated': '{{actor}} edited {{count}} assets for {{institutionName}}',
    'activity.assets-deleted': '{{actor}} deleted {{count}} assets from {{institutionName}}',
    'activity.assets-created-generic': '{{actor}} uploaded {{count}} assets',
    'activity.assets-updated-generic': '{{actor}} edited {{count}} assets',
    'activity.assets-deleted-generic': '{{actor}} deleted {{count}} assets',
    'activity.research-fields-created': '{{actor}} created {{count}} research fields',
    'activity.research-fields-updated': '{{actor}} edited {{count}} research fields',
    'activity.research-fields-deleted': '{{actor}} deleted {{count}} research fields',
    'activity.connections-created': '{{actor}} created {{count}} connections',
    'activity.connections-updated': '{{actor}} edited {{count}} connections',
    'activity.connections-deleted': '{{actor}} deleted {{count}} connections',
    'activity.connection-types-created': '{{actor}} created {{count}} connection types',
    'activity.connection-types-updated': '{{actor}} edited {{count}} connection types',
    'activity.connection-types-deleted': '{{actor}} deleted {{count}} connection types',
    'activity.project-settings-updated': '{{actor}} edited project settings',
    'activity.website-settings-updated': '{{actor}} edited website settings',
    'activity.unknown-institution': 'an institution',
    'activity.empty': 'No activity yet.'
};

export function findActivityFeedDefinition(tableName, op) {
    return ACTIVITY_FEED_DEFINITIONS.find((definition) => (
        definition.tables.includes(tableName) && definition.ops.includes(op)
    )) || null;
}

export function resolveActivityMessageKey(messageKey, { omitInstitution = false } = {}) {
    if (!omitInstitution) {
        return messageKey;
    }

    return INSTITUTIONLESS_ACTIVITY_MESSAGE_KEYS[messageKey] || messageKey;
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