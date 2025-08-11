export const translationsOperations = {
  // GET BY TEXT ID
  getByTextId: {
    type: "query",
    name: "Get Translations By Text Id",
    description: "Retrieves all translations for a given text id",
    variables: {
      textId: "ID of the text to get translations for"
    },
    query: `query GetTranslationsByText($textId: String!) {
  result: translations(where: { text_id: { eq: $textId } }) {
    id
    content
    language_id
    text_id
  }
}`
  },
  create: {
    type: "mutation",
    name: "Create Translation",
    description: "Creates a translation for a specific text",
    variables: {
      textId: "ID of the text to translate",
      languageId: "Language ID for the translation",
      content: "Translated content"
    },
    query: `mutation CreateTranslation($textId: String!, $languageId: String!, $content: String!) {
  insertIntoTranslations(
    values: [
      {
        text_id: $textId
        language_id: $languageId
        content: $content
      }
    ]
  ) {
    id
    content
    language_id
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
    language_id
    text_id
  }
}`
  },
  delete: {
    type: "mutation",
    name: "Delete Translation",
    description: "Deletes a translation by its ID",
    variables: {
      translationId: "ID of the translation to delete"
    },
    query: `mutation DeleteTranslation($translationId: String!) {
  deleteFromTranslations(where: { id: { eq: $translationId } }) {
    id
    language_id
    text_id
  }
}`
  }
}; 