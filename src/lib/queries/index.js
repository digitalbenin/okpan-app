// Import all query operations
import { interfaceLanguagesOperations } from './interface_languages.js';
import { languagesOperations } from './languages.js';
import { projectsOperations } from './projects.js';
import { institutionsOperations } from './institutions.js';
import { objectsOperations } from './objects.js';
import { translationsOperations } from './translations.js';
import { interfaceTranslationsOperations } from './interface_translations.js';
import { logsOperations } from './logs.js';
import { assetsOperations } from './assets.js';
import { researchFieldsOperations } from './research_fields.js';
import { ontologyFieldsOperations } from './ontology_fields.js';
import { schemaOperations } from './schema.js';
import { settingsOperations } from './settings.js';
import { datasourcesOperations } from './datasources.js';
import { entitySearchOperations } from './entitySearch.js';
import { actionsOperations } from './actions.js';
import { templatesOperations } from './templates.js';
import { genericAssetsOperations } from './genericAssets.js';

// Export API sections organized by entity type
export const API_SECTIONS = {
    interface_languages: {
        name: "Interface Languages",
        operations: interfaceLanguagesOperations
    },
    languages: {
        name: "Content Languages",
        operations: languagesOperations
    },
    projects: {
        name: "Projects",
        operations: projectsOperations
    },
    institutions: {
        name: "Institutions",
        operations: institutionsOperations
    },
    objects: {
        name: "Objects",
        operations: objectsOperations
    },
    datasources: {
        name: "Datasources",
        operations: datasourcesOperations
    },
    templates: {
        name: "Templates",
        operations: templatesOperations
    },
    translations: {
        name: "Translations",
        operations: translationsOperations
    },
    interface_translations: {
        name: "Interface Translations",
        operations: interfaceTranslationsOperations
    },
    logs: {
        name: "Logs",
        operations: logsOperations
    },
    assets: {
        name: "Assets",
        operations: assetsOperations
    },
    genericAssets: {
        name: "Generic Assets",
        operations: genericAssetsOperations
    },
    research_fields: {
        name: "Research Fields",
        operations: researchFieldsOperations
    },
    ontology_fields: {
        name: "Ontology Fields",
        operations: ontologyFieldsOperations
    },
    settings: {
        name: "Project Settings",
        operations: settingsOperations
    },
    entity_search: {
        name: "Entity Search",
        operations: entitySearchOperations
    },
    actions: {
        name: "Actions",
        operations: actionsOperations
    },
    schema: {
        name: "GraphQL Schema",
        operations: schemaOperations // Note: schema operations is an array
    }
};

export default API_SECTIONS; 