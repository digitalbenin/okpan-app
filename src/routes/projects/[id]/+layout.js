import { getProjectStore } from "$lib/stores/ProjectStore.svelte";

const { setProject } = getProjectStore();

export const load = async ({ params }) => {
    await setProject(params.id);
};