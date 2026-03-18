import { promises as fs } from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';
import { GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql';
import * as dbSchema from '../schema.js';

const normalizeFormats = (value) => {
    if (!value) return {};
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return {};
        }
    }
    if (typeof value === 'object') {
        return value;
    }
    return {};
};

const resolveFilePath = (filePath) => {
    if (!filePath || typeof filePath !== 'string') return null;
    const trimmed = filePath.trim();
    if (!trimmed) return null;
    return path.isAbsolute(trimmed) ? trimmed : path.join(process.cwd(), trimmed);
};

async function removeAssetFilesFromDisk(assetRow) {
    const fileErrors = [];
    const files = new Set();

    const mainPath = resolveFilePath(assetRow.path);
    if (mainPath) files.add(mainPath);

    const formats = normalizeFormats(assetRow.formats);
    Object.values(formats || {}).forEach((formatPath) => {
        const resolved = resolveFilePath(formatPath);
        if (resolved) files.add(resolved);
    });

    for (const filePath of files) {
        try {
            await fs.unlink(filePath);
        } catch (error) {
            if (error?.code === 'ENOENT') continue;
            fileErrors.push({
                path: filePath,
                error: error?.message || 'Unknown error'
            });
        }
    }

    return fileErrors;
}

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