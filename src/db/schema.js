/**
 * Drizzle ORM schema \u2014 defines all SQLite tables and their relations.
 * Tables are grouped by domain: Translations, Project, Institutions, Objects,
 * Ontology fields, Research fields & vocabularies, Assets, Imports & datasources,
 * Website, Project activity, Sync, and App settings.
 *
 * @namespace db.schema
 * @memberOf db
 */
import { integer, real, text, blob, sqliteTable, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

const commonFields = {
    id: text('id').primaryKey().notNull().$defaultFn(() => crypto.randomUUID()),
    created_at: integer('created_at', { mode: 'timestamp_ms' })
        .notNull()
        .$defaultFn(() => new Date()),
    updated_at: integer('updated_at', { mode: 'timestamp_ms' })
        .notNull()
        .$defaultFn(() => new Date())
        .$onUpdateFn(() => new Date())
};

// ─── Translations ─────────────────────────────────────────────────────────────

/**
 * Per-project languages (formerly project_languages).
 * @constant
 * @memberof db.schema
 */
export const languages = sqliteTable('languages', {
    ...commonFields,
    project_id: text('project_id')
        .notNull()
        .references(() => project.id),
    code: text('code').notNull(), // e.g., 'en', 'es', 'fr'
    name: text('name').notNull(), // e.g., 'English', 'Spanish', 'French'
    is_default: integer('is_default').notNull().default(0)
});

export const languagesRelations = relations(languages, ({ one, many }) => ({
    project: one(project, {
        fields: [languages.project_id],
        references: [project.id]
    }),
    textsAsOriginal: many(texts),
    translations: many(translations)
}));

/**
 * Multi-language text entries.
 * @constant
 * @memberof db.schema
 */
export const texts = sqliteTable('texts', {
    ...commonFields,
    content: text('content').notNull(),
    context: text('context').notNull(), // e.g., 'project.title', 'institutions.name'
    original_language_id: text('original_language_id')
        .notNull()
        .references(() => languages.id)
});

export const textsRelations = relations(texts, ({ one, many }) => ({
    originalLanguage: one(languages, {
        fields: [texts.original_language_id],
        references: [languages.id]
    }),
    translations: many(translations)
}));

/**
 * Translations of text entries into a specific language.
 * @constant
 * @memberof db.schema
 */
export const translations = sqliteTable('translations', {
    ...commonFields,
    text_id: text('text_id')
        .notNull()
        .references(() => texts.id),
    language_id: text('language_id')
        .notNull()
        .references(() => languages.id),
    content: text('content').notNull()
});

export const translationsRelations = relations(translations, ({ one }) => ({
    text: one(texts, {
        fields: [translations.text_id],
        references: [texts.id]
    }),
    language: one(languages, {
        fields: [translations.language_id],
        references: [languages.id]
    })
}));

// ─── Interface translations ───────────────────────────────────────────────────

/**
 * Supported interface (UI) languages.
 * @constant
 * @memberof db.schema
 */
export const interface_languages = sqliteTable('interface_languages', {
    ...commonFields,
    code: text('code').notNull().unique(), // e.g., 'en', 'es', 'fr'
    name: text('name').notNull() // e.g., 'English', 'Spanish', 'French'
});

/**
 * Translated strings for the application interface.
 * @constant
 * @memberof db.schema
 */
export const interface_translations = sqliteTable('interface_translations', {
    ...commonFields,
    locale: text('locale')
        .notNull()
        .references(() => interface_languages.code),
    namespace: text('namespace').notNull(), // e.g., 'common', 'navigation', 'errors'
    key: text('key').notNull(), // e.g., 'welcome', 'submit', 'cancel'
    value: text('value').notNull(),
});

export const interfaceTranslationsRelations = relations(interface_translations, ({ one }) => ({
    interfaceLanguage: one(interface_languages, {
        fields: [interface_translations.locale],
        references: [interface_languages.code]
    })
}));

/**
 * Auxiliary table enforcing a unique constraint on (locale, namespace, key).
 * @constant
 * @memberof db.schema
 */
export const interfaceTranslationsIndex = sqliteTable('interface_translations_idx', {
    id: text('id').primaryKey().notNull().$defaultFn(() => crypto.randomUUID()),
    locale_namespace_key: text('locale_namespace_key').notNull().unique()
});

// ─── Project ──────────────────────────────────────────────────────────────────

/**
 * Core project record.
 * @constant
 * @memberof db.schema
 */
export const project = sqliteTable('project', {
    ...commonFields,
    title_id: text('title_id').references(() => texts.id),
    description_id: text('description_id').references(() => texts.id),
    exports: text('exports', { mode: 'json' }),
    password: text('password'),
    is_shared: integer('is_shared').notNull().default(0), // 0=Private, 1=Shared
    created_app_version: text('created_app_version')
});

export const projectRelations = relations(project, ({ many, one }) => ({
    institutions: many(institutions),
    objects: many(objects),
    researchFields: many(research_fields),
    ontologyFields: many(ontology_fields),
    projectActivities: many(project_activity),
    settings: one(settings),
    assets: many(assets),
    genericAssets: many(genericAssets),
    languages: many(languages),
    objectDisplayFields: many(object_display_fields),
    websiteSettings: many(websiteSettings),
    title: one(texts, {
        fields: [project.title_id],
        references: [texts.id]
    }),
    description: one(texts, {
        fields: [project.description_id],
        references: [texts.id]
    })
}));

// ─── Institutions ─────────────────────────────────────────────────────────────

/**
 * Institutions (museums, libraries, etc.) belonging to a project.
 * @constant
 * @memberof db.schema
 */
export const institutions = sqliteTable('institutions', {
    ...commonFields,
    name_id: text('name_id').notNull().references(() => texts.id),
    description_id: text('description_id').references(() => texts.id),
    country_id: text('country_id').references(() => texts.id),
    location_id: text('location_id').references(() => texts.id),
    lon: integer('lon'),
    lat: integer('lat'),
    website: text('website'),
    links: text('links', { mode: 'json' }),
    project_id: text('project_id').references(() => project.id),
    status: text('status'),
    logo: text('logo')
}, (table) => ({
    projectIdx: index('idx_institutions_project_id').on(table.project_id)
}));

export const institutionsRelations = relations(institutions, ({ one, many }) => ({
    project: one(project, {
        fields: [institutions.project_id],
        references: [project.id]
    }),
    assets: many(assets),
    objects: many(objects),
    datasources: many(datasources),
    templates: many(templates),
    assetsInstitutions: many(assets_institutions),
    name: one(texts, {
        fields: [institutions.name_id],
        references: [texts.id]
    }),
    description: one(texts, {
        fields: [institutions.description_id],
        references: [texts.id]
    }),
    country: one(texts, {
        fields: [institutions.country_id],
        references: [texts.id]
    }),
    location: one(texts, {
        fields: [institutions.location_id],
        references: [texts.id]
    })
}));

/**
 * Per-project P2P and sync settings.
 * @constant
 * @memberof db.schema
 */
export const settings = sqliteTable('settings', {
    ...commonFields,
    username: text('username'),
    password: text('password'),
    //db_name: text('db_name'),
    sync_url: text('sync_url'),
    sig_server: text('sig_server'),
    project_id: text('project_id').references(() => project.id),
});

export const settingsRelations = relations(settings, ({ one }) => ({
    project: one(project, {
        fields: [settings.project_id],
        references: [project.id]
    })
}));

// ─── Objects ──────────────────────────────────────────────────────────────────

/**
 * Museum/collection objects belonging to an institution.
 * @constant
 * @memberof db.schema
 */
export const objects = sqliteTable('objects', {
    ...commonFields,
    status: text('status').default('in progress'),
    name: text('name'),
    institution_id: text('institution_id').references(() => institutions.id, { onDelete: 'cascade' }),
    project_id: text('project_id').references(() => project.id)
}, (table) => ({
    projectIdx: index('idx_objects_project_id').on(table.project_id),
    institutionIdx: index('idx_objects_institution_id').on(table.institution_id),
    statusIdx: index('idx_objects_status').on(table.status),
    projectInstitutionIdx: index('idx_objects_project_institution').on(table.project_id, table.institution_id)
}));

export const objectsRelations = relations(objects, ({ one, many }) => ({
    institution: one(institutions, {
        fields: [objects.institution_id],
        references: [institutions.id]
    }),
    project: one(project, {
        fields: [objects.project_id],
        references: [project.id]
    }),
    objectsResearchFields: many(objects_research_fields),
    objectsOntologyFields: many(objects_ontology_fields),
    objectsAssets: many(objects_assets),
    objectsDatasources: many(objects_datasources)
}));

/**
 * Configures which fields are shown in object list views.
 * @constant
 * @memberof db.schema
 */
export const object_display_fields = sqliteTable('object_display_fields', {
    ...commonFields,
    project_id: text('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
    ontology_field_id: text('ontology_field_id').references(() => ontology_fields.id, { onDelete: 'cascade' }),
    research_field_id: text('research_field_id').references(() => research_fields.id, { onDelete: 'cascade' }),
    property_name: text('property_name') // 'created_at', 'updated_at', 'status'
});

export const objectDisplayFieldsRelations = relations(object_display_fields, ({ one }) => ({
    project: one(project, {
        fields: [object_display_fields.project_id],
        references: [project.id]
    }),
    ontologyField: one(ontology_fields, {
        fields: [object_display_fields.ontology_field_id],
        references: [ontology_fields.id]
    }),
    researchField: one(research_fields, {
        fields: [object_display_fields.research_field_id],
        references: [research_fields.id]
    })
}));

// ─── Ontology fields ──────────────────────────────────────────────────────────

/**
 * Ontology fields defining structured metadata for objects.
 * @constant
 * @memberof db.schema
 */
export const ontology_fields = sqliteTable('ontology_fields', {
    ...commonFields,
    name_id: text('name_id').references(() => texts.id),
    description_id: text('description_id').references(() => texts.id),
    category_id: text('category_id').references(() => texts.id),
    embeddings: text('embeddings'),
    onwebsite: integer('onwebsite').default(1),
    project_id: text('project_id').notNull().references(() => project.id, { onDelete: 'cascade' })
});

export const ontologyFieldsRelations = relations(ontology_fields, ({ many, one }) => ({
    objectsOntologyFields: many(objects_ontology_fields),
    objectDisplayFields: many(object_display_fields),
    project: one(project, {
        fields: [ontology_fields.project_id],
        references: [project.id]
    }),
    name: one(texts, {
        fields: [ontology_fields.name_id],
        references: [texts.id]
    }),
    description: one(texts, {
        fields: [ontology_fields.description_id],
        references: [texts.id]
    }),
    category: one(texts, {
        fields: [ontology_fields.category_id],
        references: [texts.id]
    })
}));

/**
 * Ontology field values assigned to objects.
 * @constant
 * @memberof db.schema
 */
export const objects_ontology_fields = sqliteTable('objects_ontology_fields', {
    ...commonFields,
    label: text('label'),
    value: text('value'),
    object_id: text('object_id').references(() => objects.id, { onDelete: 'cascade' }),
    field_id: text('field_id').references(() => ontology_fields.id),
    datasources_id: text('datasources_id').references(() => datasources.id),
    primary: integer('primary'),
    default_description: integer('default_description')
}, (table) => ({
    objectIdx: index('idx_objects_ontology_fields_object_id').on(table.object_id),
    fieldIdx: index('idx_objects_ontology_fields_field_id').on(table.field_id),
    objectFieldIdx: index('idx_objects_ontology_fields_object_field').on(table.object_id, table.field_id)
}));

export const objectsOntologyFieldsRelations = relations(objects_ontology_fields, ({ one }) => ({
    object: one(objects, {
        fields: [objects_ontology_fields.object_id],
        references: [objects.id]
    }),
    ontologyField: one(ontology_fields, {
        fields: [objects_ontology_fields.field_id],
        references: [ontology_fields.id]
    }),
    datasource: one(datasources, {
        fields: [objects_ontology_fields.datasources_id],
        references: [datasources.id]
    })
}));

// ─── Research fields & vocabularies ───────────────────────────────────────────

/**
 * Research fields with optional controlled vocabularies.
 * @constant
 * @memberof db.schema
 */
export const research_fields = sqliteTable('research_fields', {
    ...commonFields,
    name_id: text('name_id').notNull().references(() => texts.id),
    type: text('type'),
    description_id: text('description_id').references(() => texts.id),
    project_id: text('project_id').references(() => project.id),
    private: integer('private').notNull().default(0), // false by default
    onwebsite: integer('onwebsite').notNull().default(1), // true by default
    fields_config: text('fields_config', { mode: 'json' })
}, (table) => ({
    projectIdx: index('idx_research_fields_project_id').on(table.project_id),
    typeIdx: index('idx_research_fields_type').on(table.type)
}));

export const researchFieldsRelations = relations(research_fields, ({ one, many }) => ({
    project: one(project, {
        fields: [research_fields.project_id],
        references: [project.id]
    }),
    vocabularies: many(vocabularies),
    objectsResearchFields: many(objects_research_fields),
    objectDisplayFields: many(object_display_fields),
    name: one(texts, {
        fields: [research_fields.name_id],
        references: [texts.id]
    }),
    description: one(texts, {
        fields: [research_fields.description_id],
        references: [texts.id]
    })
}));

/**
 * Controlled vocabulary options for research fields.
 * @constant
 * @memberof db.schema
 */
export const vocabularies = sqliteTable('vocabularies', {
    ...commonFields,
    option_id: text('option_id').references(() => texts.id),
    description_id: text('description_id').references(() => texts.id),
    main_asset_id: text('main_asset_id').references(() => genericAssets.id),
    external_link: text('external_link'),
    field_id: text('field_id').references(() => research_fields.id, { onDelete: 'cascade' })
}, (table) => ({
    fieldIdx: index('idx_vocabularies_field_id').on(table.field_id)
}));

export const vocabulariesRelations = relations(vocabularies, ({ one, many }) => ({
    researchField: one(research_fields, {
        fields: [vocabularies.field_id],
        references: [research_fields.id]
    }),
    option: one(texts, {
        fields: [vocabularies.option_id],
        references: [texts.id]
    }),
    description: one(texts, {
        fields: [vocabularies.description_id],
        references: [texts.id]
    }),
    mainAsset: one(genericAssets, {
        fields: [vocabularies.main_asset_id],
        references: [genericAssets.id]
    }),
    vocabulariesGenericAssets: many(vocabularies_generic_assets),
    objectsResearchFields: many(objects_research_fields)
}));

/**
 * Junction table linking vocabulary entries to generic assets.
 * @constant
 * @memberof db.schema
 */
export const vocabularies_generic_assets = sqliteTable('vocabularies_generic_assets', {
    ...commonFields,
    vocabulary_id: text('vocabulary_id').references(() => vocabularies.id, { onDelete: 'cascade' }),
    generic_asset_id: text('generic_asset_id').references(() => genericAssets.id, { onDelete: 'cascade' }),
    order: integer('order') // Optional: for ordering assets within a vocabulary
});

export const vocabulariesGenericAssetsRelations = relations(vocabularies_generic_assets, ({ one }) => ({
    vocabulary: one(vocabularies, {
        fields: [vocabularies_generic_assets.vocabulary_id],
        references: [vocabularies.id]
    }),
    genericAsset: one(genericAssets, {
        fields: [vocabularies_generic_assets.generic_asset_id],
        references: [genericAssets.id]
    })
}));

/**
 * Research field values assigned to objects.
 * @constant
 * @memberof db.schema
 */
export const objects_research_fields = sqliteTable('objects_research_fields', {
    ...commonFields,
    object_id: text('object_id').references(() => objects.id, { onDelete: 'cascade' }),
    field_id: text('field_id').references(() => research_fields.id, { onDelete: 'cascade' }),
    vocabulary_id: text('vocabulary_id').references(() => vocabularies.id, { onDelete: 'cascade' }),
    value: text('value')
}, (table) => ({
    objectIdx: index('idx_objects_research_fields_object_id').on(table.object_id),
    fieldIdx: index('idx_objects_research_fields_field_id').on(table.field_id),
    vocabularyIdx: index('idx_objects_research_fields_vocabulary_id').on(table.vocabulary_id),
    objectFieldIdx: index('idx_objects_research_fields_object_field').on(table.object_id, table.field_id),
    objectFieldVocabularyUnique: uniqueIndex('objects_research_fields_object_field_vocabulary_unique').on(table.object_id, table.field_id, table.vocabulary_id)
}));

export const objectsResearchFieldsRelations = relations(objects_research_fields, ({ one }) => ({
    object: one(objects, {
        fields: [objects_research_fields.object_id],
        references: [objects.id]
    }),
    researchField: one(research_fields, {
        fields: [objects_research_fields.field_id],
        references: [research_fields.id]
    }),
    vocabulary: one(vocabularies, {
        fields: [objects_research_fields.vocabulary_id],
        references: [vocabularies.id]
    })
}));

// ─── Assets ───────────────────────────────────────────────────────────────────

/**
 * Media assets linked to an institution and project, with P2P torrent metadata.
 * @constant
 * @memberof db.schema
 */
export const assets = sqliteTable('assets', {
    ...commonFields,
    filename: text('filename'),
    path: text('path'),
    type: text('type'),
    formats: text('formats', { mode: 'json' }),
    properties: text('properties', { mode: 'json' }),
    institution_id: text('institution_id').references(() => institutions.id, { onDelete: 'cascade' }),
    project_id: text('project_id').references(() => project.id),
    // P2P torrent metadata — synced via Yjs to all peers
    torrent_info_hash: text('torrent_info_hash'),
    torrent_name: text('torrent_name'),
    torrent_length: integer('torrent_length'),
    torrent_piece_length: integer('torrent_piece_length'),
    asset_content_mime: text('asset_content_mime'),
    asset_content_ext: text('asset_content_ext'),
    asset_content_sha256: text('asset_content_sha256')
});

export const assetsRelations = relations(assets, ({ one, many }) => ({
    institution: one(institutions, {
        fields: [assets.institution_id],
        references: [institutions.id]
    }),
    project: one(project, {
        fields: [assets.project_id],
        references: [project.id]
    }),
    assetsInstitutions: many(assets_institutions),
    objectsAssets: many(objects_assets),
    localState: one(asset_local_state, {
        fields: [assets.id],
        references: [asset_local_state.asset_id]
    })
}));

/**
 * Project-level assets not tied to a specific institution (e.g. vocabulary images).
 * @constant
 * @memberof db.schema
 */
export const genericAssets = sqliteTable('generic_assets', {
    ...commonFields,
    filename: text('filename'),
    path: text('path'),
    type: text('type'),
    formats: text('formats', { mode: 'json' }),
    properties: text('properties', { mode: 'json' }),
    project_id: text('project_id').references(() => project.id),
    // P2P torrent metadata — synced via Yjs to all peers
    torrent_info_hash: text('torrent_info_hash'),
    torrent_name: text('torrent_name'),
    torrent_length: integer('torrent_length'),
    torrent_piece_length: integer('torrent_piece_length'),
    asset_content_mime: text('asset_content_mime'),
    asset_content_ext: text('asset_content_ext'),
    asset_content_sha256: text('asset_content_sha256')
});

export const genericAssetsRelations = relations(genericAssets, ({ one, many }) => ({
    project: one(project, {
        fields: [genericAssets.project_id],
        references: [project.id]
    }),
    // This allows querying from a genericAsset to all vocabularies where it is the main_asset_id
    vocabulariesAsMain: many(vocabularies),
    // This allows querying from a genericAsset to all vocabularies through the junction table
    vocabulariesGenericAssets: many(vocabularies_generic_assets),
    localState: one(generic_asset_local_state, {
        fields: [genericAssets.id],
        references: [generic_asset_local_state.generic_asset_id]
    })
}));

/**
 * Junction table linking assets to institutions with an access rule.
 * @constant
 * @memberof db.schema
 */
export const assets_institutions = sqliteTable('assets_institutions', {
    ...commonFields,
    asset_id: text('asset_id').references(() => assets.id, { onDelete: 'cascade' }),
    institution_id: text('institution_id').references(() => institutions.id, { onDelete: 'cascade' }),
    rule: text('rule')
});

export const assetsInstitutionsRelations = relations(assets_institutions, ({ one }) => ({
    asset: one(assets, {
        fields: [assets_institutions.asset_id],
        references: [assets.id]
    }),
    institution: one(institutions, {
        fields: [assets_institutions.institution_id],
        references: [institutions.id]
    })
}));

/**
 * Junction table linking assets to objects (ordered).
 * @constant
 * @memberof db.schema
 */
export const objects_assets = sqliteTable('objects_assets', {
    ...commonFields,
    asset_id: text('asset_id').references(() => assets.id, { onDelete: 'cascade' }),
    object_id: text('object_id').references(() => objects.id, { onDelete: 'cascade' }),
    order: integer('order')
}, (table) => ({
    objectAssetUnique: uniqueIndex('objects_assets_object_asset_unique').on(table.object_id, table.asset_id),
    objectIdx: index('idx_objects_assets_object_id').on(table.object_id),
    assetIdx: index('idx_objects_assets_asset_id').on(table.asset_id)
}));

export const objectsAssetsRelations = relations(objects_assets, ({ one }) => ({
    object: one(objects, {
        fields: [objects_assets.object_id],
        references: [objects.id]
    }),
    asset: one(assets, {
        fields: [objects_assets.asset_id],
        references: [assets.id]
    })
}));

/**
 * Machine-local download and seed state for institution assets (not synced via Yjs).
 * @constant
 * @memberof db.schema
 */
export const asset_local_state = sqliteTable('asset_local_state', {
    asset_id: text('asset_id').primaryKey().notNull().references(() => assets.id, { onDelete: 'cascade' }),
    sync_status: text('sync_status').default('missing'), // missing|downloading|available|seeding|error
    sync_error: text('sync_error'),
    retry_count: integer('retry_count').notNull().default(0),
    last_attempt_at: integer('last_attempt_at'),   // Unix ms
    last_success_at: integer('last_success_at'),   // Unix ms
    download_progress: real('download_progress').default(0) // 0-100
});

export const assetLocalStateRelations = relations(asset_local_state, ({ one }) => ({
    asset: one(assets, {
        fields: [asset_local_state.asset_id],
        references: [assets.id]
    })
}));

/**
 * Machine-local download and seed state for generic assets (not synced via Yjs).
 * @constant
 * @memberof db.schema
 */
export const generic_asset_local_state = sqliteTable('generic_asset_local_state', {
    generic_asset_id: text('generic_asset_id').primaryKey().notNull().references(() => genericAssets.id, { onDelete: 'cascade' }),
    sync_status: text('sync_status').default('missing'),
    sync_error: text('sync_error'),
    retry_count: integer('retry_count').notNull().default(0),
    last_attempt_at: integer('last_attempt_at'),
    last_success_at: integer('last_success_at'),
    download_progress: real('download_progress').default(0)
});

export const genericAssetLocalStateRelations = relations(generic_asset_local_state, ({ one }) => ({
    genericAsset: one(genericAssets, {
        fields: [generic_asset_local_state.generic_asset_id],
        references: [genericAssets.id]
    })
}));

// ─── Imports & datasources ────────────────────────────────────────────────────

/**
 * Raw import data before it is mapped to datasources.
 * @constant
 * @memberof db.schema
 */
export const imports = sqliteTable('imports', {
    ...commonFields,
    filename: text('filename'),
    data: text('data', { mode: 'json' })
});

export const importsRelations = relations(imports, ({ many }) => ({
    datasources: many(datasources)
}));

/**
 * Documented sources of object data.
 * @constant
 * @memberof db.schema
 */
export const datasources = sqliteTable('datasources', {
    ...commonFields,
    name_id: text('name_id').references(() => texts.id),
    institution_id: text('institution_id').references(() => institutions.id, { onDelete: 'cascade' }),
    import_id: text('import_id').references(() => imports.id, { onDelete: 'set null' }),
    source: text('source'),
    language: text('language'),
    copyright: text('copyright'),
    method_id: text('method_id').references(() => texts.id),
    contact: text('contact'),
    notes_id: text('notes_id').references(() => texts.id),
    date: integer('date', { mode: 'timestamp_ms' })
});

export const datasourcesRelations = relations(datasources, ({ one, many }) => ({
    institution: one(institutions, {
        fields: [datasources.institution_id],
        references: [institutions.id]
    }),
    import: one(imports, {
        fields: [datasources.import_id],
        references: [imports.id]
    }),
    objectsOntologyFields: many(objects_ontology_fields),
    objectsDatasources: many(objects_datasources),
    name: one(texts, {
        fields: [datasources.name_id],
        references: [texts.id]
    }),
    method: one(texts, {
        fields: [datasources.method_id],
        references: [texts.id]
    }),
    notes: one(texts, {
        fields: [datasources.notes_id],
        references: [texts.id]
    })
}));

/**
 * Import templates mapping source fields to schema fields.
 * @constant
 * @memberof db.schema
 */
export const templates = sqliteTable('templates', {
    ...commonFields,
    name: text('name'),
    mapping: text('mapping', { mode: 'json' }),
    project_id: text('project_id').references(() => project.id, { onDelete: 'cascade' }),
    institution_id: text('institution_id').references(() => institutions.id, { onDelete: 'set null' }),
    asset_map_rule: text('asset_map_rule')
});

export const templatesRelations = relations(templates, ({ one, many }) => ({
    project: one(project, {
        fields: [templates.project_id],
        references: [project.id]
    }),
    institution: one(institutions, {
        fields: [templates.institution_id],
        references: [institutions.id]
    }),
    objectsDatasources: many(objects_datasources)
}));

/**
 * Junction table tracking which datasources contributed to an object and which template was used.
 * @constant
 * @memberof db.schema
 */
export const objects_datasources = sqliteTable('objects_datasources', {
    ...commonFields,
    object_id: text('object_id').references(() => objects.id, { onDelete: 'cascade' }),
    datasource_id: text('datasource_id').references(() => datasources.id, { onDelete: 'cascade' }),
    template_id: text('template_id').references(() => templates.id, { onDelete: 'set null' })
}, (table) => ({
    objectIdx: index('idx_objects_datasources_object_id').on(table.object_id),
    datasourceIdx: index('idx_objects_datasources_datasource_id').on(table.datasource_id),
    templateIdx: index('idx_objects_datasources_template_id').on(table.template_id),
    objectDatasourceUnique: uniqueIndex('objects_datasources_object_datasource_unique').on(table.object_id, table.datasource_id)
}));

export const objectsDatasourcesRelations = relations(objects_datasources, ({ one }) => ({
    object: one(objects, {
        fields: [objects_datasources.object_id],
        references: [objects.id]
    }),
    datasource: one(datasources, {
        fields: [objects_datasources.datasource_id],
        references: [datasources.id]
    }),
    template: one(templates, {
        fields: [objects_datasources.template_id],
        references: [templates.id]
    })
}));

// ─── Website ──────────────────────────────────────────────────────────────────

/**
 * Website export configuration per project.
 * @constant
 * @memberof db.schema
 */
export const websiteSettings = sqliteTable('website_settings', {
    ...commonFields,
    title_id: text('title_id').references(() => texts.id),
    short_description_id: text('short_description_id').references(() => texts.id),
    about_id: text('about_id').references(() => texts.id),
    authors: text('authors'),
    logo_id: text('logo_id').references(() => genericAssets.id),
    subfolder_path: text('subfolder_path'),
    show_unmapped: integer('show_unmapped').notNull().default(0), // false by default
    project_id: text('project_id').references(() => project.id).unique()
});

export const websiteSettingsRelations = relations(websiteSettings, ({ one }) => ({
    project: one(project, {
        fields: [websiteSettings.project_id],
        references: [project.id]
    }),
    title: one(texts, {
        fields: [websiteSettings.title_id],
        references: [texts.id]
    }),
    shortDescription: one(texts, {
        fields: [websiteSettings.short_description_id],
        references: [texts.id]
    }),
    about: one(texts, {
        fields: [websiteSettings.about_id],
        references: [texts.id]
    }),
    logo: one(genericAssets, {
        fields: [websiteSettings.logo_id],
        references: [genericAssets.id]
    })
}));

// ─── Project activity ─────────────────────────────────────────────────────────

/**
 * Audit log of user and sync actions within a project.
 * @constant
 * @memberof db.schema
 */
export const project_activity = sqliteTable('project_activity', {
    ...commonFields,
    project_id: text('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
    source_key: text('source_key').notNull(),
    bundle_id: text('bundle_id'),
    sync_kind: text('sync_kind').notNull().default('user'),
    actor_client_id: text('actor_client_id'),
    actor_username: text('actor_username'),
    action_type: text('action_type').notNull(),
    entity_type: text('entity_type').notNull(),
    entity_id: text('entity_id'),
    institution_id: text('institution_id').references(() => institutions.id, { onDelete: 'set null' }),
    institution_name: text('institution_name'),
    message_key: text('message_key').notNull(),
    item_count: integer('item_count').notNull().default(1),
    summary_params: text('summary_params', { mode: 'json' })
}, (table) => ({
    projectUpdatedIdx: index('idx_project_activity_project_updated').on(table.project_id, table.updated_at, table.id),
    sourceIdx: index('idx_project_activity_source').on(table.project_id, table.source_key),
    bundleIdx: index('idx_project_activity_bundle').on(table.project_id, table.bundle_id),
    feedGroupingIdx: index('idx_project_activity_feed_grouping').on(
        table.project_id,
        table.actor_client_id,
        table.message_key,
        table.entity_type,
        table.institution_id,
        table.updated_at
    )
}));

export const projectActivityRelations = relations(project_activity, ({ one }) => ({
    project: one(project, {
        fields: [project_activity.project_id],
        references: [project.id]
    }),
    institution: one(institutions, {
        fields: [project_activity.institution_id],
        references: [institutions.id]
    })
}));

// ─── Sync ─────────────────────────────────────────────────────────────────────
// These tables support deterministic ingestion, updates transport, and snapshotting.

/**
 * Canonical change log written by SQLite triggers.
 * @constant
 * @memberof db.schema
 */
export const change_log = sqliteTable(
    'change_log',
    {
        ...commonFields,
        project_id: text('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
        table_name: text('table_name').notNull(), // e.g., 'objects', 'institutions'
        op: text('op').notNull(), // 'INSERT' | 'UPDATE' | 'DELETE'
        row_id: text('row_id').notNull(),
        client_id: text('client_id'),
        origin: text('origin').default('local'), // 'local' | 'remote'
        new_row: text('new_row', { mode: 'json' }),
        old_row: text('old_row', { mode: 'json' })
    },
    (table) => ({
        // Deterministic ingestion ordering per project
        changeLogOrderIdx: index('change_log_order_idx').on(table.project_id, table.created_at, table.id)
    })
);

/**
 * Append-only stream of Yjs update bytes derived from the change log.
 * @constant
 * @memberof db.schema
 */
export const yjs_updates = sqliteTable('yjs_updates', {
    ...commonFields,
    project_id: text('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
    from_change_id: text('from_change_id').references(() => change_log.id, { onDelete: 'set null' }),
    to_change_id: text('to_change_id').references(() => change_log.id, { onDelete: 'set null' }),
    update_bytes: blob('update_bytes').notNull()
});

/**
 * Periodic full-state Yjs snapshots with a precise change-log watermark.
 * @constant
 * @memberof db.schema
 */
export const yjs_snapshots = sqliteTable('yjs_snapshots', {
    ...commonFields,
    project_id: text('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
    last_change_id: text('last_change_id').references(() => change_log.id, { onDelete: 'set null' }),
    snapshot_bytes: blob('snapshot_bytes').notNull(),
    state_vector: blob('state_vector')
});

/**
 * Tracks the last processed change-log watermark per project.
 * @constant
 * @memberof db.schema
 */
export const ingestion_state = sqliteTable('ingestion_state', {
    ...commonFields,
    project_id: text('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }).unique(),
    last_processed_change_id: text('last_processed_change_id').references(() => change_log.id, { onDelete: 'set null' })
});

// ─── App settings ─────────────────────────────────────────────────────────────

/**
 * Application-wide singleton settings; always a single row with id = 1.
 * @constant
 * @memberof db.schema
 */
export const globalSettings = sqliteTable('global_settings', {
    id: integer('id').primaryKey().notNull().default(1),
    client_id: text('client_id').notNull().unique(),
    username: text('username'),
    interface_language: text('interface_language'),
    app_version: text('app_version'),
    initialized_at: integer('initialized_at', { mode: 'timestamp_ms' })
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`)
});

/**
 * Application log entries (errors, warnings, info).
 * @constant
 * @memberof db.schema
 */
export const logs = sqliteTable('logs', {
    ...commonFields,
    level: text('level').notNull().default('error'), // e.g., 'error', 'warn', 'info', 'debug'
    action: text('action').notNull(),
    message: text('message').notNull(),
});


