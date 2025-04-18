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
        query: `mutation CreateTranslation($textId: String!, $languageCode: String!, $content: String!) {
  insertIntoTranslations(
    values: [
      {
        text_id: $textId
        language_code: $languageCode
        content: $content
      }
    ]
  ) {
    id
    content
    language_code
    text_id
  }
}`
    },
    update: {
        type: "mutation",
        name: "Update Translation",
        description: "Updates an existing translation",
        variables: {
            id: "ID of the translation to update",
            content: "New translated content"
        },
        query: `mutation UpdateTranslation($id: String!, $content: String) {
  updateTranslations(
    set: { content: $content }
    where: { id: { eq: $id } }
  ) {
    id
    content
    language_code
    text_id
  }
}`
    }
}; 