import { promises as fs } from 'fs';
import path from 'path';
import { inArray } from 'drizzle-orm';
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
                const files = new Set();

                const mainPath = resolveFilePath(asset.path);
                if (mainPath) files.add(mainPath);

                const formats = normalizeFormats(asset.formats);
                Object.values(formats || {}).forEach((formatPath) => {
                    const resolved = resolveFilePath(formatPath);
                    if (resolved) files.add(resolved);
                });

                for (const filePath of files) {
                    try {
                        await fs.unlink(filePath);
                    } catch (error) {
                        if (error?.code === 'ENOENT') continue; // already gone
                        fileErrors.push({
                            asset_id: asset.id,
                            path: filePath,
                            error: error?.message || 'Unknown error'
                        });
                    }
                }
            }

            return { deletedIds, missingIds, fileErrors };
        }
    };
};
