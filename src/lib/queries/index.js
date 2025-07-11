// Import all query operations
import { actionsOperations } from './actions.js';
import { assetsOperations } from './assets.js';
import { datasourcesOperations } from './datasources.js';
import { entitySearchOperations } from './entitySearch.js';
import { genericAssetsOperations } from './genericAssets.js';
import { institutionsOperations } from './institutions.js';
import { interfaceLanguagesOperations } from './interface_languages.js';
import { interfaceTranslationsOperations } from './interface_translations.js';
import { languagesOperations } from './languages.js';
import { logsOperations } from './logs.js';
import { objectsOperations } from './objects.js';
import { ontologyFieldsOperations } from './ontology_fields.js';
import { projectsOperations } from './projects.js';
import { researchFieldsOperations } from './research_fields.js';
import { schemaOperations } from './schema.js';
import { settingsOperations } from './settings.js';
import { templatesOperations } from './templates.js';
import { translationsOperations } from './translations.js';

// Export API sections organized by entity type
export const API_SECTIONS = {
    actions: {
        name: "Actions",
        operations: actionsOperations
    },
    assets: {
        name: "Assets",
        operations: assetsOperations
    },
    datasources: {
        name: "Datasources",
        operations: datasourcesOperations
    },
    entitySearch: {
        name: "Entity Search",
        operations: entitySearchOperations
    },
    genericAssets: {
        name: "Generic Assets",
        operations: genericAssetsOperations
    },
    institutions: {
        name: "Institutions",
        operations: institutionsOperations
    },
    interface_languages: {
        name: "Interface Languages",
        operations: interfaceLanguagesOperations
    },
    interface_translations: {
        name: "Interface Translations",
        operations: interfaceTranslationsOperations
    },
    languages: {
        name: "Content Languages",
        operations: languagesOperations
    },
    logs: {
        name: "Logs",
        operations: logsOperations
    },
    objects: {
        name: "Objects",
        operations: objectsOperations
    },
    ontology_fields: {
        name: "Ontology Fields",
        operations: ontologyFieldsOperations
    },
    projects: {
        name: "Projects",
        operations: projectsOperations
    },
    research_fields: {
        name: "Research Fields",
        operations: researchFieldsOperations
    },
    schema: {
        name: "GraphQL Schema",
        operations: schemaOperations
    },
    settings: {
        name: "Project Settings",
        operations: settingsOperations
    },
    templates: {
        name: "Templates",
        operations: templatesOperations
    },
    translations: {
        name: "Translations",
        operations: translationsOperations
    }
}; 