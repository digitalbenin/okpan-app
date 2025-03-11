import { integer, text, blob, sqliteTable } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

// Common fields configuration for all tables
const commonFields = {
    id: text('id').primaryKey().notNull().$defaultFn(() => crypto.randomUUID()),
    created_at: integer('created_at', { mode: 'timestamp_ms' })
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    updated_at: integer('updated_at', { mode: 'timestamp_ms' })
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`)
        .$onUpdateFn(() => new Date())
};

// Translation Schema

// Languages table
export const languages = sqliteTable('languages', {
    ...commonFields,
    code: text('code').notNull().unique(), // e.g., 'en', 'es', 'fr'
    name: text('name').notNull(), // e.g., 'English', 'Spanish', 'French'
    is_default: integer('is_default').notNull().default(0)
});


// Texts table - stores original texts
export const texts = sqliteTable('texts', {
    ...commonFields,
    content: text('content').notNull(),
    context: text('context').notNull(), // e.g., 'project.title', 'institutions.name'
    original_language: text('original_language')
        .notNull()
        .references(() => languages.code)
});

// Translations table - stores translated content
export const translations = sqliteTable('translations', {
    ...commonFields,
    text_id: text('text_id')
        .notNull()
        .references(() => texts.id),
    language_code: text('language_code')
        .notNull()
        .references(() => languages.code),
    content: text('content').notNull()
});

// Translation Relations
export const textsRelations = relations(texts, ({ one, many }) => ({
    originalLanguage: one(languages, {
        fields: [texts.original_language],
        references: [languages.code]
    }),
    translations: many(translations)
}));

export const translationsRelations = relations(translations, ({ one }) => ({
    text: one(texts, {
        fields: [translations.text_id],
        references: [texts.id]
    }),
    language: one(languages, {
        fields: [translations.language_code],
        references: [languages.code]
    })
}));


export const interface_languages = sqliteTable('interface_languages', {
    ...commonFields,
    code: text('code').notNull().unique(), // e.g., 'en', 'es', 'fr'
    name: text('name').notNull() // e.g., 'English', 'Spanish', 'French'
});




// Interface Translations table - stores UI translations
export const interface_translations = sqliteTable('interface_translations', {
    ...commonFields,
    locale: text('locale')
        .notNull()
        .references(() => interface_languages.code),
    namespace: text('namespace').notNull(), // e.g., 'common', 'navigation', 'errors'
    key: text('key').notNull(), // e.g., 'welcome', 'submit', 'cancel'
    value: text('value').notNull(), // The translated text
});

// Create a unique constraint on locale, namespace, and key
// This ensures we don't have duplicate translations for the same key in the same locale and namespace
export const interfaceTranslationsIndex = sqliteTable('interface_translations_idx', {
    id: text('id').primaryKey().notNull().$defaultFn(() => crypto.randomUUID()),
    locale_namespace_key: text('locale_namespace_key').notNull().unique()
});

// Interface Translations relations
export const interfaceTranslationsRelations = relations(interface_translations, ({ one }) => ({
    interfaceLanguage: one(interface_languages, {
        fields: [interface_translations.locale],
        references: [interface_languages.code]
    })
}));

// Project table
export const project = sqliteTable('project', {
    ...commonFields,
    title_id: text('title_id').references(() => texts.id),
    description_id: text('description_id').references(() => texts.id),
    exports: text('exports', { mode: 'json' })
});

// Project relations
export const projectRelations = relations(project, ({ many, one }) => ({
    institutions: many(institutions),
    objects: many(objects),
    researchFields: many(research_fields),
    settings: many(settings),
    assets: many(assets),
    title: one(texts, {
        fields: [project.title_id],
        references: [texts.id]
    }),
    description: one(texts, {
        fields: [project.description_id],
        references: [texts.id]
    })
}));

// Institutions table
export const institutions = sqliteTable('institutions', {
    ...commonFields,
    name_id: text('name_id').references(() => texts.id),
    description_id: text('description_id').references(() => texts.id),
    country_id: text('country_id').references(() => texts.id),
    location_id: text('location_id').references(() => texts.id),
    lon: integer('lon'),
    lat: integer('lat'),
    website: text('website'),
    links_id: text('links_id').references(() => texts.id),
    project_id: text('project_id').references(() => project.id),
    logo: text('logo')
});

// Institutions relations
export const institutionsRelations = relations(institutions, ({ one, many }) => ({
    project: one(project, {
        fields: [institutions.project_id],
        references: [project.id]
    }),
    assets: many(assets),
    objects: many(objects),
    datasources: many(datasources),
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
    }),
    links: one(texts, {
        fields: [institutions.links_id],
        references: [texts.id]
    })
}));

// Research Fields table
export const research_fields = sqliteTable('research_fields', {
    ...commonFields,
    name_id: text('name_id').references(() => texts.id),
    type: text('type'),
    description_id: text('description_id').references(() => texts.id),
    project_id: text('project_id').references(() => project.id)
});

// Research Fields relations
export const researchFieldsRelations = relations(research_fields, ({ one, many }) => ({
    project: one(project, {
        fields: [research_fields.project_id],
        references: [project.id]
    }),
    vocabularies: many(vocabularies),
    objectsResearchFields: many(objects_research_fields),
    name: one(texts, {
        fields: [research_fields.name_id],
        references: [texts.id]
    }),
    description: one(texts, {
        fields: [research_fields.description_id],
        references: [texts.id]
    })
}));

// Settings table
export const settings = sqliteTable('settings', {
    ...commonFields,
    username: integer('username'),
    password: integer('password'),
    db_name: integer('db_name'),
    sync_url: integer('sync_url'),
    sig_server: integer('sig_server'),
    project_id: text('project_id').references(() => project.id)
});

// Settings relations
export const settingsRelations = relations(settings, ({ one }) => ({
    project: one(project, {
        fields: [settings.project_id],
        references: [project.id]
    })
}));

// Assets table
export const assets = sqliteTable('assets', {
    ...commonFields,
    filename: text('filename'),
    path: text('path'),
    type: text('type'),
    formats: text('formats', { mode: 'json' }),
    properties: text('properties', { mode: 'json' }),
    institution_id: text('institution_id').references(() => institutions.id),
    project_id: text('project_id').references(() => project.id)
});

// Assets relations
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
    objectsAssets: many(objects_assets)
}));

// Objects table
export const objects = sqliteTable('objects', {
    ...commonFields,
    status: text('status'),
    institution_id: text('institution_id').references(() => institutions.id),
    project_id: text('project_id').references(() => project.id)
});

// Objects relations
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
    objectsAssets: many(objects_assets)
}));

// Datasources table
export const datasources = sqliteTable('datasources', {
    ...commonFields,
    name_id: text('name_id').references(() => texts.id),
    institution_id: text('institution_id').references(() => institutions.id),
    language: text('language'),
    copyright: text('copyright'),
    method_id: text('method_id').references(() => texts.id),
    contact: text('contact'),
    notes_id: text('notes_id').references(() => texts.id),
    date: integer('date')
});

// Datasources relations
export const datasourcesRelations = relations(datasources, ({ one, many }) => ({
    institution: one(institutions, {
        fields: [datasources.institution_id],
        references: [institutions.id]
    }),
    templates: many(templates),
    objectsOntologyFields: many(objects_ontology_fields),
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

// Assets Institutions junction table
export const assets_institutions = sqliteTable('assets_institutions', {
    ...commonFields,
    asset_id: text('asset_id').references(() => assets.id),
    institution_id: text('institution_id').references(() => institutions.id),
    rule: text('rule')
});

// Assets Institutions relations
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

// Vocabularies table
export const vocabularies = sqliteTable('vocabularies', {
    ...commonFields,
    option_id: text('option_id').references(() => texts.id),
    description_id: text('description_id').references(() => texts.id),
    main_asset: text('main_asset'),
    other_assets: text('other_assets', { mode: 'json' }),
    field_id: text('field_id').references(() => research_fields.id)
});

// Vocabularies relations
export const vocabulariesRelations = relations(vocabularies, ({ one }) => ({
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
    })
}));

// Objects Research Fields junction table
export const objects_research_fields = sqliteTable('objects_research_fields', {
    ...commonFields,
    object_id: text('object_id').references(() => objects.id),
    field_id: text('field_id').references(() => research_fields.id),
    value: text('value')
});

// Objects Research Fields relations
export const objectsResearchFieldsRelations = relations(objects_research_fields, ({ one }) => ({
    object: one(objects, {
        fields: [objects_research_fields.object_id],
        references: [objects.id]
    }),
    researchField: one(research_fields, {
        fields: [objects_research_fields.field_id],
        references: [research_fields.id]
    })
}));

// Ontology Fields table
export const ontology_fields = sqliteTable('ontology_fields', {
    ...commonFields,
    name_id: text('name_id').references(() => texts.id),
    description_id: text('description_id').references(() => texts.id),
    category_id: text('category_id').references(() => texts.id),
    embeddings: text('embeddings')
});

// Ontology Fields relations
export const ontologyFieldsRelations = relations(ontology_fields, ({ many, one }) => ({
    objectsOntologyFields: many(objects_ontology_fields),
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

// Objects Ontology Fields table
export const objects_ontology_fields = sqliteTable('objects_ontology_fields', {
    ...commonFields,
    label: text('label'),
    value: text('value'),
    object_id: text('object_id').references(() => objects.id),
    field_id: text('field_id').references(() => ontology_fields.id),
    datasources_id: text('datasources_id').references(() => datasources.id),
    primary: integer('primary')
});

// Objects Ontology Fields relations
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

// Templates table
export const templates = sqliteTable('templates', {
    ...commonFields,
    name: text('name'),
    description: text('description'),
    institutions: text('institutions', { mode: 'json' }),
    config: text('config', { mode: 'json' }),
    datasource_id: text('datasource_id').references(() => datasources.id),
    asset_map_rule: text('asset_map_rule')
});

// Templates relations
export const templatesRelations = relations(templates, ({ one, many }) => ({
    datasource: one(datasources, {
        fields: [templates.datasource_id],
        references: [datasources.id]
    }),
    imports: many(import_table)
}));

// Import table
export const import_table = sqliteTable('import', {
    ...commonFields,
    filename: text('filename'),
    data: text('data', { mode: 'json' }),
    template_id: text('template_id').references(() => templates.id)
});

// Import relations
export const importRelations = relations(import_table, ({ one }) => ({
    template: one(templates, {
        fields: [import_table.template_id],
        references: [templates.id]
    })
}));

// Objects Assets junction table
export const objects_assets = sqliteTable('objects_assets', {
    ...commonFields,
    asset_id: text('asset_id').references(() => assets.id),
    object_id: text('object_id').references(() => objects.id),
    order: integer('order')
});

// Objects Assets relations
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

// Logs table - stores application logs
export const logs = sqliteTable('logs', {
    ...commonFields,
    level: text('level').notNull().default('error'), // e.g., 'error', 'warn', 'info', 'debug'
    action: text('action').notNull(), // The action that triggered the log
    message: text('message').notNull(), // The log message
}); 
