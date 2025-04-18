export const interfaceLanguagesOperations = {
    list: {
        type: "query",
        name: "List Interface Languages",
        description: "Lists all supported interface languages",
        query: `{
  result: interface_languages {
    id
    code
    name
  }
}`
    },
    create: {
        type: "mutation",
        name: "Create Interface Language",
        description: "Creates a new interface language",
        variables: {
            code: "Language code (e.g., 'en', 'es')",
            name: "Language name (e.g., 'English', 'Spanish')"
        },
        query: `mutation CreateInterfaceLanguage($code: String!, $name: String!) {
  insertIntoInterface_languages(values: [{ code: $code, name: $name }]) {
    id
    code
    name
  }
}`
    },
    delete: {
        type: "mutation",
        name: "Delete Interface Language",
        description: "Deletes an interface language by its code",
        variables: {
            code: "Language code to delete"
        },
        query: `mutation DeleteInterfaceLanguage($code: String!) {
  deleteFromInterface_languages(where: { code: { eq: $code } }) {
    code
    name
  }
}`
    }
}; 