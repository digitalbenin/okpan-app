import { browser } from '$app/environment';
import {
    getObjectById,
} from "$lib/stores/ObjectsUtils.js";

export const load = async ({ params, depends }) => {
    if (!browser) return;

    const objectId = params.object_id;
    const object = await getObjectById(objectId);
    depends("custom:object");
    return {
        object: object.result,
    }
};



