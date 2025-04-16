import { interfaceLanguagesOperations } from './interface_languages';
import { languagesOperations } from './languages';
import { projectsOperations } from './projects';
import { institutionsOperations } from './institutions';
import { objectsOperations } from './objects';
import { translationsOperations } from './translations';
import { interfaceTranslationsOperations } from './interface_translations';
import { logsOperations } from './logs';
import { assetsOperations } from './assets';
import { researchFieldsOperations } from './research_fields';
import { ontologyFieldsOperations } from './ontology_fields';
import { schemaOperations } from './schema';
import { settingsOperations } from './settings';
import { datasourcesOperations } from './datasources';

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
    research_fields: {
        name: "Research Fields",
        operations: researchFieldsOperations
    },
    ontology_fields: {
        name: "Ontology Fields",
        operations: ontologyFieldsOperations
    },
    schema: {
        name: "GraphQL Schema",
        operations: schemaOperations // Note: schema operations is an array
    },
    settings: {
        name: "Project Settings",
        operations: settingsOperations
    }
};

export default API_SECTIONS; 