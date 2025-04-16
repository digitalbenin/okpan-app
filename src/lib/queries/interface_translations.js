export const interfaceTranslationsOperations = {
    list: {
        type: "query",
        name: "List Interface Translations",
        description: "Retrieves all interface translations",
        query: `{\n  result: interface_translations {\n    id\n    locale\n    namespace\n    key\n    value\n  }\n}`
    },
    getByLocale: {
        type: "query",
        name: "Get Interface Translations By Locale",
        description: "Retrieves interface translations for a specific locale",
        variables: {
            locale: "Language code for the translations"
        },
        query: `query GetInterfaceTranslations($locale: String!) {\n  result:interface_translations(where: { locale: { eq: $locale } }) {\n    id\n    namespace\n    key\n    value\n  }\n}`
    },
    create: {
        type: "mutation",
        name: "Create Interface Translation",
        description: "Creates a new interface translation",
        variables: {
            locale: "Language code for the translation",
            namespace: "Namespace for grouping translations",
            key: "Translation key",
            value: "Translated content"
        },
        query: `mutation CreateInterfaceTranslation($locale: String!, $namespace: String!, $key: String!, $value: String!) {\n  insertIntoInterface_translations(values: [{\n    locale: $locale,\n    namespace: $namespace,\n    key: $key,\n    value: $value\n  }]) {\n    id\n    locale\n    namespace\n    key\n    value\n  }\n}`
    },
    update: {
        type: "mutation",
        name: "Update Interface Translation",
        description: "Updates an existing interface translation",
        variables: {
            id: "ID of the translation to update",
            value: "New translated content (optional)"
        },
        query: `mutation UpdateInterfaceTranslation($id: String!, $value: String) {\n  updateInterface_translations(\n    set: { value: $value }\n    where: { id: { eq: $id } }\n  ) {\n    id\n    value\n  }\n}`
    },
    delete: {
        type: "mutation",
        name: "Delete Interface Translation",
        description: "Deletes an interface translation",
        variables: {
            id: "ID of the translation to delete"
        },
        query: `mutation DeleteInterfaceTranslation($id: String!) {\n  deleteFromInterface_translations(where: { id: { eq: $id } }) {\n    id\n  }\n}`
    },
    import: {
        type: "mutation",
        name: "Import Interface Translations",
        description: "Imports multiple interface translations at once",
        variables: {
            translations: "Array of translations to import"
        },
        query: `mutation ImportInterfaceTranslations($translations: [Interface_translationsInsertInput!]!) {\n  insertIntoInterface_translations(values: $translations) {\n    id\n    locale\n    namespace\n    key\n    value\n  }\n}`
    }
}; 