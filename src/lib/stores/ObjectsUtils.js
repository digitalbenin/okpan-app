import { API_SECTIONS } from "$lib/utils/queries.js";
import { getValidationStore } from "$lib/stores/ValidationStore.svelte.js";
import { addToast } from "$lib/components/base/BaseToast.svelte";
import { getLogStore } from "$lib/stores/LogStore.svelte.js";


const { error: logError } = getLogStore();

// Get validation store
const { getSchema, validate } = getValidationStore();


const assetsList = API_SECTIONS.objects.operations.objectsList.query;


export const getObjects = async (projectId, institutionId) => {
    try {
        // projectState.isLoading = true;

        const response = await window.api.executeGraphQL(assetsList, {
            projectId, institutionId
        });

        if (!response.success) {
            throw new Error(response.errors?.[0]?.message || "Failed to fetch assets");
        }

        // projectState.currentProject = response?.data?.projectById;
        // projectState.isLoading = false;
        return response.data.objects;

    } catch (error) {
        // projectState.error = error;
        // projectState.isLoading = false;
        addToast({
            data: {
                title: "Error",
                description: `Failed to fetch assets: ${error.message}`,
                type: "error"
            }
        });
        await logError("setProject", error.message);
        throw error;
    } finally {
        // projectState.isLoading = false;
    }
};