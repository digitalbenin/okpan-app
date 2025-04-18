export const interfaceTranslationsOperations = {
    list: {
        type: "query",
        name: "List Interface Translations",
        description: "Retrieves all interface translations",
        query: `{
  result: interface_translations {
    id
    locale
    namespace
    key
    value
  }
}`
    },
    getByLocale: {
        type: "query",
        name: "Get Interface Translations By Locale",
        description: "Retrieves interface translations for a specific locale",
        variables: {
            locale: "Language code for the translations"
        },
        query: `query GetInterfaceTranslations($locale: String!) {
  result: interface_translations(where: { locale: { eq: $locale } }) {
    id
    namespace
    key
    value
  }
}`
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
        query: `mutation CreateInterfaceTranslation(
  $locale: String!
  $namespace: String!
  $key: String!
  $value: String!
) {
  insertIntoInterface_translations(
    values: [
      {
        locale: $locale
        namespace: $namespace
        key: $key
        value: $value
      }
    ]
  ) {
    id
    locale
    namespace
    key
    value
  }
}`
    },
    update: {
        type: "mutation",
        name: "Update Interface Translation",
        description: "Updates an existing interface translation",
        variables: {
            id: "ID of the translation to update",
            value: "New translated content (optional)"
        },
        query: `mutation UpdateInterfaceTranslation($id: String!, $value: String) {
  updateInterface_translations(
    set: { value: $value }
    where: { id: { eq: $id } }
  ) {
    id
    value
  }
}`
    },
    delete: {
        type: "mutation",
        name: "Delete Interface Translation",
        description: "Deletes an interface translation",
        variables: {
            id: "ID of the translation to delete"
        },
        query: `mutation DeleteInterfaceTranslation($id: String!) {
  deleteFromInterface_translations(where: { id: { eq: $id } }) {
    id
  }
}`
    },
    import: {
        type: "mutation",
        name: "Import Interface Translations",
        description: "Imports multiple interface translations at once",
        variables: {
            translations: "Array of translations to import"
        },
        query: `mutation ImportInterfaceTranslations(
  $translations: [Interface_translationsInsertInput!]!
) {
  insertIntoInterface_translations(values: $translations) {
    id
    locale
    namespace
    key
    value
  }
}`
    }
}; 