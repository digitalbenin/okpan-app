/**
 * Custom GraphQL resolver factories for assetDelete related database queries and mutations.
 *
 * @namespace db.customQueries.assetDelete
 */
import { eq } from 'drizzle-orm';
import { GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql';
import * as dbSchema from '../schema.js';
import { removeAssetFilesFromDisk } from '../../backend/utils/fsUtils.js';

function ensureDeleteTypes(drizzleResult) {
    if (!drizzleResult.schema._typeMap.AssetDeleteFileError) {
        drizzleResult.schema._typeMap.AssetDeleteFileError = new GraphQLObjectType({
            name: 'AssetDeleteFileError',
            fields: () => ({
                path: { type: GraphQLString },
                error: { type: GraphQLString }
            })
        });
    }

    if (!drizzleResult.schema._typeMap.AssetDeletePayload) {
        drizzleResult.schema._typeMap.AssetDeletePayload = new GraphQLObjectType({
            name: 'AssetDeletePayload',
            fields: () => ({
                id: { type: GraphQLString },
                filename: { type: GraphQLString },
                path: { type: GraphQLString },
                fileErrors: { type: new GraphQLList(drizzleResult.schema._typeMap.AssetDeleteFileError) }
            })
        });
    }

    if (!drizzleResult.schema._typeMap.GenericAssetDeletePayload) {
        drizzleResult.schema._typeMap.GenericAssetDeletePayload = new GraphQLObjectType({
            name: 'GenericAssetDeletePayload',
            fields: () => ({
                id: { type: GraphQLString },
                filename: { type: GraphQLString },
                path: { type: GraphQLString },
                fileErrors: { type: new GraphQLList(drizzleResult.schema._typeMap.AssetDeleteFileError) }
            })
        });
    }
}

export const createAssetDeleteMutation = (db, drizzleResult) => {
    ensureDeleteTypes(drizzleResult);

    return {
        name: 'deleteAssetCascade',
        type: drizzleResult.schema._typeMap.AssetDeletePayload,
        args: [
            {
                name: 'assetId',
                type: new GraphQLNonNull(GraphQLString),
                description: 'ID of the asset to delete'
            }
        ],
        resolve: async (_source, args) => {
            const assetId = typeof args.assetId === 'string' ? args.assetId.trim() : '';
            if (!assetId) {
                throw new Error('assetId is required');
            }

            const assetRows = await db
                .select({
                    id: dbSchema.assets.id,
                    filename: dbSchema.assets.filename,
                    path: dbSchema.assets.path,
                    formats: dbSchema.assets.formats,
                })
                .from(dbSchema.assets)
                .where(eq(dbSchema.assets.id, assetId))
                .limit(1)
                .execute();

            const assetRow = assetRows[0];
            if (!assetRow) {
                return null;
            }

            await db.delete(dbSchema.assets).where(eq(dbSchema.assets.id, assetId)).execute();
            const fileErrors = await removeAssetFilesFromDisk(assetRow);

            return {
                id: assetRow.id,
                filename: assetRow.filename,
                path: assetRow.path,
                fileErrors,
            };
        }
    };
};

export const createGenericAssetDeleteMutation = (db, drizzleResult) => {
    ensureDeleteTypes(drizzleResult);

    return {
        name: 'deleteGenericAssetCascade',
        type: drizzleResult.schema._typeMap.GenericAssetDeletePayload,
        args: [
            {
                name: 'assetId',
                type: new GraphQLNonNull(GraphQLString),
                description: 'ID of the generic asset to delete'
            }
        ],
        resolve: async (_source, args) => {
            const assetId = typeof args.assetId === 'string' ? args.assetId.trim() : '';
            if (!assetId) {
                throw new Error('assetId is required');
            }

            const assetRows = await db
                .select({
                    id: dbSchema.genericAssets.id,
                    filename: dbSchema.genericAssets.filename,
                    path: dbSchema.genericAssets.path,
                    formats: dbSchema.genericAssets.formats,
                })
                .from(dbSchema.genericAssets)
                .where(eq(dbSchema.genericAssets.id, assetId))
                .limit(1)
                .execute();

            const assetRow = assetRows[0];
            if (!assetRow) {
                return null;
            }

            await db.delete(dbSchema.genericAssets).where(eq(dbSchema.genericAssets.id, assetId)).execute();
            const fileErrors = await removeAssetFilesFromDisk(assetRow);

            return {
                id: assetRow.id,
                filename: assetRow.filename,
                path: assetRow.path,
                fileErrors,
            };
        }
    };
};
