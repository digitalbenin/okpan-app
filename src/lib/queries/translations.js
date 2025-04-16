export const translationsOperations = {
    create: {
        type: "mutation",
        name: "Create Translation",
        description: "Creates a translation for a specific text",
        variables: {
            textId: "ID of the text to translate",
            languageCode: "Language code for the translation",
            content: "Translated content"
        },
        query: `mutation CreateTranslation($textId: String!, $languageCode: String!, $content: String!) {\n  insertIntoTranslations(values: [{\n    text_id: $textId,\n    language_code: $languageCode,\n    content: $content\n  }]) {\n    id\n    content\n    language_code\n    text_id\n  }\n}`
    },
    update: {
        type: "mutation",
        name: "Update Translation",
        description: "Updates an existing translation",
        variables: {
            id: "ID of the translation to update",
            content: "New translated content"
        },
        query: `mutation UpdateTranslation($id: String!, $content: String) {\n  updateTranslations(\n    set: { content: $content }\n    where: { id: { eq: $id } }\n  ) {\n    id\n    content\n    language_code\n    text_id\n  }\n}`
    }
}; 