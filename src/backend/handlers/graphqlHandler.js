/**
 * IPC handler for GraphQL query execution.
 * @namespace backend.handlers.graphqlHandler
 * @memberof backend.handlers
 */
import fs from 'fs';
import path from 'path';
import { GraphQLSchema, graphql, printSchema } from 'graphql';
import { createGraphQLSchema } from '../../db/graphqlDefs.js';

const createReachableSchema = (sourceSchema) => new GraphQLSchema({
    description: sourceSchema.description,
    query: sourceSchema.getQueryType(),
    mutation: sourceSchema.getMutationType(),
    subscription: sourceSchema.getSubscriptionType(),
    directives: sourceSchema.getDirectives(),
    astNode: sourceSchema.astNode,
    extensionASTNodes: sourceSchema.extensionASTNodes,
    extensions: sourceSchema.extensions
});

/**
 * Execute a GraphQL query against the provided schema and resolvers.
 * @function handleGraphQL
 * @memberof backend.handlers.graphqlHandler
 * @param {Electron.IpcMainInvokeEvent} _event - IPC event.
 * @param {Object} payload - Query payload with `query` and optional `variables`.
 * @param {Object} context - Execution context.
 * @returns {Promise.<{success: boolean, data: (Object|undefined), errors: (Array.<Object>|undefined), error: (string|undefined)}>}
 */
export const handleGraphQL = async (_event, { query, variables }, { schema, resolvers, db }) => {
    try {
        const result = await graphql({
            schema,
            source: query,
            rootValue: resolvers,
            variableValues: variables,
            contextValue: { db }
        });

        if (result.errors) {
            console.error('GraphQL errors:', result.errors);
            return { success: false, errors: result.errors };
        }

        return { success: true, data: result.data };
    } catch (error) {
        console.error('Error executing GraphQL:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Export the active GraphQL schema as SDL.
 * When `outputPath` is provided, the SDL is also written to disk.
 *
 * @function handleExportGraphQLSchema
 * @memberof backend.handlers.graphqlHandler
 * @param {Electron.IpcMainInvokeEvent} _event - IPC event.
 * @param {Object} [payload] - Optional export payload.
 * @param {string} [payload.outputPath] - Optional target path for writing the SDL file.
 * @param {'docs'|'full'} [payload.mode] - Export mode (`docs` for reachable schema, `full` for full schema).
 * @param {number} [payload.relationsDepthLimit] - Maximum relation depth when generating docs schema.
 * @param {Object} context - GraphQL context.
 * @param {GraphQLSchema} context.schema - GraphQL schema instance.
 * @param {Object} [context.db] - Optional database instance used to build docs schema.
 * @returns {Promise.<{success: boolean, data: ({schema: string, outputPath: (string|undefined)}|undefined), error: (string|undefined)}>}
 */
export const handleExportGraphQLSchema = async (_event, payload = {}, { schema, db }) => {
    try {
        const exportMode = payload?.mode === 'full' ? 'full' : 'docs';
        const relationsDepthLimit = Number.isInteger(payload?.relationsDepthLimit) ? payload.relationsDepthLimit : 0;
        const exportSchema = exportMode === 'full' || !db
            ? schema
            : createReachableSchema(createGraphQLSchema(db, { relationsDepthLimit }).schema);
        const sdl = printSchema(exportSchema);
        const requestedPath = typeof payload?.outputPath === 'string' ? payload.outputPath.trim() : '';

        if (!requestedPath) {
            return { success: true, data: { schema: sdl } };
        }

        const resolvedPath = path.resolve(requestedPath);
        fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
        fs.writeFileSync(resolvedPath, sdl);

        return {
            success: true,
            data: {
                schema: sdl,
                outputPath: resolvedPath
            }
        };
    } catch (error) {
        console.error('Error exporting GraphQL schema:', error);
        return { success: false, error: error.message };
    }
};
