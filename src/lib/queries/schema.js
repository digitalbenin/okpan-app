export const schemaOperations = [
    {
        type: "schema",
        name: "Introspection Query",
        description: "Retrieves the GraphQL schema structure",
        query: `{\n  __schema {\n    types {\n      name\n      fields {\n        name\n        type {\n          name\n          kind\n        }\n      }\n    }\n    mutationType {\n      fields {\n        name\n        args {\n          name\n          type {\n            name\n            kind\n          }\n        }\n      }\n    }\n  }\n}`
    }
];
