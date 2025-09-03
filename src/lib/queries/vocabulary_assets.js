export const vocabularyAssetsOperations = {
  create: {
    type: "mutation",
    name: "Link Assets to Vocabulary",
    description: "Creates links between a vocabulary and multiple generic assets",
    variables: {
      values: "Array of vocabulary-asset link objects with vocabulary_id, generic_asset_id, and order"
    },
    query: `mutation LinkVocabularyAssets($values: [Vocabularies_generic_assetsInsertInput!]!) {
  insertIntoVocabularies_generic_assets(
    values: $values
  ) {
    id
    vocabulary_id
    generic_asset_id
    order
  }
}`
  },
  delete: {
    type: "mutation",
    name: "Unlink Assets from Vocabulary",
    description: "Removes links between a vocabulary and its assets",
    variables: {
      vocabularyId: "ID of the vocabulary to unlink assets from"
    },
    query: `mutation UnlinkVocabularyAssets($vocabularyId: String!) {
  deleteFromVocabularies_generic_assets(where: { vocabulary_id: { eq: $vocabularyId } }) {
    id
    vocabulary_id
    generic_asset_id
  }
}`
  }
};
