import { browser } from '$app/environment';
import { error } from '@sveltejs/kit';
import { getAssetById } from '$lib/api/AssetsApi.js';
import { getObjectById } from '$lib/api/ObjectsApi.js';
import { getDisplayFields } from '$lib/api/DisplayFieldsApi.js';

export async function load({ params, depends }) {
    if (!browser) return;

    depends('app:assets');

    const { project_id, institution_id, asset_id } = params;

    try {
        // Get the asset details
        const assetResult = await getAssetById(asset_id);

        if (!assetResult?.result?.[0]) {
            throw error(404, 'Asset not found');
        }

        const asset = assetResult.result[0];

        // Verify the asset belongs to the correct institution
        if (asset.institution_id !== institution_id) {
            throw error(403, 'Asset does not belong to this institution');
        }

        // Load display fields configuration for the project
        const displayFieldsResult = await getDisplayFields({ projectId: project_id });
        const displayFields = displayFieldsResult?.result || [];

        // Fetch linked objects with their ontology fields
        let linkedObjects = [];
        if (asset.objectsAssets && asset.objectsAssets.length > 0) {
            const objectPromises = asset.objectsAssets.map(async (objectAsset) => {
                try {
                    const objectResult = await getObjectById(objectAsset.object_id);
                    if (objectResult?.result && !objectResult.error) {
                        return {
                            ...objectAsset,
                            object: objectResult.result
                        };
                    }
                } catch (err) {
                    console.error(`Error fetching object ${objectAsset.object_id}:`, err);
                }
                return null;
            });

            const resolvedObjects = await Promise.all(objectPromises);
            linkedObjects = resolvedObjects.filter(obj => obj !== null);
        }

        return {
            asset,
            linkedObjects,
            displayFields,
            project_id,
            institution_id
        };
    } catch (err) {
        console.error('Error loading asset for edit:', err);
        throw error(500, 'Failed to load asset data');
    }
}