/**
 * Custom GraphQL resolver factories for assetsBulkDelete related database queries and mutations.
 *
 * @namespace db.customQueries.assetsBulkDelete
 */
import { inArray } from 'drizzle-orm';
import { GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql';
import * as dbSchema from '../schema.js';
import { removeAssetFilesFromDisk } from '../../backend/utils/fsUtils.js';

export const createAssetsBulkDeleteMutation = (db, drizzleResult) => {
    const AssetFileRemovalError = new GraphQLObjectType({
        name: 'AssetFileRemovalError',
        fields: () => ({
            asset_id: { type: GraphQLString },
            path: { type: GraphQLString },
            error: { type: GraphQLString }
        })
    });

    const AssetsBulkDeletePayload = new GraphQLObjectType({
        name: 'AssetsBulkDeletePayload',
        fields: () => ({
            deletedIds: { type: new GraphQLList(GraphQLString) },
            missingIds: { type: new GraphQLList(GraphQLString) },
            fileErrors: { type: new GraphQLList(AssetFileRemovalError) }
        })
    });

    // Register custom types for reuse
    drizzleResult.schema._typeMap.AssetFileRemovalError = AssetFileRemovalError;
    drizzleResult.schema._typeMap.AssetsBulkDeletePayload = AssetsBulkDeletePayload;

    return {
        name: 'deleteAssetsBulk',
        type: AssetsBulkDeletePayload,
        args: [
            {
                name: 'ids',
                type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))),
                description: 'IDs of the assets to delete'
            }
        ],
        resolve: async (source, args) => {
            const requestedIds = Array.isArray(args.ids)
                ? args.ids.filter((id) => typeof id === 'string' && id.trim())
                : [];

            if (!requestedIds.length) {
                throw new Error('At least one asset id is required');
            }

            const assetsToDelete = await db
                .select({
                    id: dbSchema.assets.id,
                    path: dbSchema.assets.path,
                    formats: dbSchema.assets.formats
                })
                .from(dbSchema.assets)
                .where(inArray(dbSchema.assets.id, requestedIds))
                .execute();

            const foundIdsSet = new Set(assetsToDelete.map((asset) => asset.id));
            const missingIds = requestedIds.filter((id) => !foundIdsSet.has(id));

            if (!assetsToDelete.length) {
                return { deletedIds: [], missingIds, fileErrors: [] };
            }

            const deletedRows = await db
                .delete(dbSchema.assets)
                .where(inArray(dbSchema.assets.id, Array.from(foundIdsSet)))
                .returning({ id: dbSchema.assets.id })
                .execute();

            const deletedIds = deletedRows.map((row) => row.id);
            const fileErrors = [];

            for (const asset of assetsToDelete) {
                const assetFileErrors = await removeAssetFilesFromDisk(asset);
                assetFileErrors.forEach((fileError) => {
                    fileErrors.push({
                        asset_id: asset.id,
                        ...fileError
                    });
                });
            }

            return { deletedIds, missingIds, fileErrors };
        }
    };
};

