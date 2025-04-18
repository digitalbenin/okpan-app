export const schemaOperations = [
    {
        type: "schema",
        name: "Introspection Query",
        description: "Retrieves the GraphQL schema structure",
        query: `{
  __schema {
    types {
      name
      fields {
        name
        type {
          name
          kind
        }
      }
    }
    mutationType {
      fields {
        name
        args {
          name
          type {
            name
            kind
          }
        }
      }
    }
  }
}`
    }
];
