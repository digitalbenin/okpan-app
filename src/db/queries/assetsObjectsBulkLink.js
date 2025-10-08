import { and, eq } from 'drizzle-orm';
import { GraphQLObjectType, GraphQLList, GraphQLNonNull, GraphQLString, GraphQLInputObjectType } from 'graphql';
import * as dbSchema from '../schema';

// Creates a custom mutation to bulk link assets to objects
export const createAssetsObjectsBulkLinkMutation = (db, drizzleResult) => {
    // Define input type: an asset with a list of object IDs (ids are enough)
    const AssetObjectsLinkInput = new GraphQLInputObjectType({
        name: 'AssetObjectsLinkInput',
        fields: () => ({
            asset_id: { type: new GraphQLNonNull(GraphQLString) },
            object_ids: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))) }
        })
    });

    // Success item type
    const LinkSuccessItem = new GraphQLObjectType({
        name: 'LinkSuccessItem',
        fields: () => ({
            asset_id: { type: GraphQLString },
            object_id: { type: GraphQLString }
        })
    });

    // Skipped duplicate item type
    const LinkSkippedItem = new GraphQLObjectType({
        name: 'LinkSkippedItem',
        fields: () => ({
            asset_id: { type: GraphQLString },
            object_id: { type: GraphQLString }
        })
    });

    // Error item type
    const LinkErrorItem = new GraphQLObjectType({
        name: 'LinkErrorItem',
        fields: () => ({
            asset_id: { type: GraphQLString },
            object_id: { type: GraphQLString },
            error: { type: GraphQLString }
        })
    });

    // Payload type
    const AssetsObjectsBulkLinkPayload = new GraphQLObjectType({
        name: 'AssetsObjectsBulkLinkPayload',
        fields: () => ({
            successes: { type: new GraphQLList(LinkSuccessItem) },
            skippedDuplicates: { type: new GraphQLList(LinkSkippedItem) },
            errors: { type: new GraphQLList(LinkErrorItem) }
        })
    });

    // Register types in the schema map for consistency
    drizzleResult.schema._typeMap.AssetObjectsLinkInput = AssetObjectsLinkInput;
    drizzleResult.schema._typeMap.LinkSuccessItem = LinkSuccessItem;
    drizzleResult.schema._typeMap.LinkSkippedItem = LinkSkippedItem;
    drizzleResult.schema._typeMap.LinkErrorItem = LinkErrorItem;
    drizzleResult.schema._typeMap.AssetsObjectsBulkLinkPayload = AssetsObjectsBulkLinkPayload;

    return {
        name: 'linkAssetsToObjectsBulk',
        type: AssetsObjectsBulkLinkPayload,
        args: [
            {
                name: 'links',
                type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(AssetObjectsLinkInput))),
                description: 'List of assets to link, each with a list of object IDs'
            }
        ],
        resolve: async (source, args) => {
            const successes = [];
            const skippedDuplicates = [];
            const errors = [];

            const links = Array.isArray(args.links) ? args.links : [];

            for (const link of links) {
                const assetId = link?.asset_id;
                const objectIds = Array.isArray(link?.object_ids) ? link.object_ids : [];

                if (!assetId || objectIds.length === 0) {
                    errors.push({ asset_id: assetId || '', object_id: '', error: 'Invalid asset_id or empty object_ids' });
                    continue;
                }

                for (const objectIdRaw of objectIds) {
                    const objectId = String(objectIdRaw);
                    try {
                        // Check for existing link to avoid unique constraint errors
                        const existing = await db.query.objects_assets.findFirst({
                            where: and(
                                eq(dbSchema.objects_assets.asset_id, assetId),
                                eq(dbSchema.objects_assets.object_id, objectId)
                            ),
                            columns: { id: true }
                        });

                        if (existing) {
                            skippedDuplicates.push({ asset_id: assetId, object_id: objectId });
                            continue;
                        }

                        await db.insert(dbSchema.objects_assets)
                            .values({ asset_id: assetId, object_id: objectId })
                            .execute();

                        successes.push({ asset_id: assetId, object_id: objectId });
                    } catch (e) {
                        const msg = e?.message || 'Unknown error';
                        // If the DB throws on unique constraint, treat as skipped duplicate
                        if (/UNIQUE|already\s*linked|exists|duplicate|constraint/i.test(msg)) {
                            skippedDuplicates.push({ asset_id: assetId, object_id: objectId });
                            continue;
                        }
                        errors.push({ asset_id: assetId, object_id: objectId, error: msg });
                    }
                }
            }

            return { successes, skippedDuplicates, errors };
        }
    };
};