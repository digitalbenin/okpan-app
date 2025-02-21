import { integer, text, blob, sqliteTable } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Project table
export const project = sqliteTable('project', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title'),
    description: text('description'),
    exports: text('exports') // JSON stored as text
});

// Project relations
export const projectRelations = relations(project, ({ many }) => ({
    institutions: many(institutions),
    researchFields: many(research_fields),
    settings: many(settings)
}));

// Institutions table
export const institutions = sqliteTable('institutions', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name'),
    description: text('description'),
    country: text('country'),
    location: text('location'),
    lon: integer('lon'),
    lat: integer('lat'),
    website: text('website'),
    links: text('links'), // JSON stored as text
    project_id: integer('project_id').references(() => project.id),
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
    assetsInstitutions: many(assets_institutions)
}));

// Research Fields table
export const research_fields = sqliteTable('research_fields', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name'),
    type: text('type'),
    description: text('description'),
    project_id: integer('project_id').references(() => project.id)
});

// Research Fields relations
export const researchFieldsRelations = relations(research_fields, ({ one, many }) => ({
    project: one(project, {
        fields: [research_fields.project_id],
        references: [project.id]
    }),
    vocabularies: many(vocabularies),
    objectsResearchFields: many(objects_research_fields)
}));

// Settings table
export const settings = sqliteTable('settings', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    username: integer('username'),
    password: integer('password'),
    db_name: integer('db_name'),
    sync_url: integer('sync_url'),
    sig_server: integer('sig_server'),
    project_id: integer('project_id').references(() => project.id)
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
    id: integer('id').primaryKey({ autoIncrement: true }),
    filename: text('filename'),
    path: text('path'),
    type: text('type'),
    properties: text('properties'), // JSON stored as text
    institution_id: integer('institution_id').references(() => institutions.id)
});

// Assets relations
export const assetsRelations = relations(assets, ({ one, many }) => ({
    institution: one(institutions, {
        fields: [assets.institution_id],
        references: [institutions.id]
    }),
    assetsInstitutions: many(assets_institutions),
    objectsAssets: many(objects_assets)
}));

// Objects table
export const objects = sqliteTable('objects', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    status: text('status'),
    institution_id: integer('institution_id').references(() => institutions.id)
});

// Objects relations
export const objectsRelations = relations(objects, ({ one, many }) => ({
    institution: one(institutions, {
        fields: [objects.institution_id],
        references: [institutions.id]
    }),
    objectsResearchFields: many(objects_research_fields),
    objectsOntologyFields: many(objects_ontology_fields),
    objectsAssets: many(objects_assets)
}));

// Datasources table
export const datasources = sqliteTable('datasources', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name'),
    institution_id: integer('institution_id').references(() => institutions.id),
    language: text('language'),
    copyright: text('copyright'),
    method: text('method'),
    contact: text('contact'),
    notes: text('notes'),
    date: integer('date') // SQLite stores timestamps as integers
});

// Datasources relations
export const datasourcesRelations = relations(datasources, ({ one, many }) => ({
    institution: one(institutions, {
        fields: [datasources.institution_id],
        references: [institutions.id]
    }),
    templates: many(templates),
    objectsOntologyFields: many(objects_ontology_fields)
}));

// Assets Institutions junction table
export const assets_institutions = sqliteTable('assets_institutions', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    asset_id: integer('asset_id').references(() => assets.id),
    institution_id: integer('institution_id').references(() => institutions.id),
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
    id: integer('id').primaryKey({ autoIncrement: true }),
    option: text('option'),
    description: text('description'),
    main_asset: text('main_asset'),
    other_assets: text('other_assets'), // JSON stored as text
    field_id: integer('field_id').references(() => research_fields.id)
});

// Vocabularies relations
export const vocabulariesRelations = relations(vocabularies, ({ one }) => ({
    researchField: one(research_fields, {
        fields: [vocabularies.field_id],
        references: [research_fields.id]
    })
}));

// Objects Research Fields junction table
export const objects_research_fields = sqliteTable('objects_research_fields', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    object_id: integer('object_id').references(() => objects.id),
    field_id: integer('field_id').references(() => research_fields.id),
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
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name'),
    description: text('description'),
    category: text('category'),
    embeddings: text('embeddings')
});

// Ontology Fields relations
export const ontologyFieldsRelations = relations(ontology_fields, ({ many }) => ({
    objectsOntologyFields: many(objects_ontology_fields)
}));

// Objects Ontology Fields table
export const objects_ontology_fields = sqliteTable('objects_ontology_fields', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    label: text('label'),
    value: text('value'),
    object_id: integer('object_id').references(() => objects.id),
    field_id: integer('field_id').references(() => ontology_fields.id),
    datasources_id: integer('datasources_id').references(() => datasources.id),
    primary: integer('primary') // SQLite uses INTEGER for boolean
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
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name'),
    description: text('description'),
    institutions: text('institutions'),
    config: text('config'), // JSON stored as text
    datasource_id: integer('datasource_id').references(() => datasources.id),
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
    id: integer('id').primaryKey({ autoIncrement: true }),
    filename: text('filename'),
    data: text('data'), // JSON stored as text
    template_id: integer('template_id').references(() => templates.id)
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
    id: integer('id').primaryKey({ autoIncrement: true }),
    asset_id: integer('asset_id').references(() => assets.id),
    object_id: integer('object_id').references(() => objects.id),
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
