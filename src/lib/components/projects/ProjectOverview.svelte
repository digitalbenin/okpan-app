<script>
    import { getProjectStore } from "$lib/stores/ProjectStore.svelte";

    const { projectState } = getProjectStore();
</script>

<div class="container-fluid">
    <div class="row p-4 mb-2">
        <h3 class="col-12 display-6">Project Overview</h3>
    </div>
    <div class="row px-4 d-flex flex-row justify-content-between gap-4">
        <div class="card bg-light" style="flex:1">
            <div class="card-body">
                <h5 class="card-title">Instituions</h5>
                <h2 class="card-text">
                    {projectState?.currentProject?.institutionsCount || 0}
                </h2>
            </div>
        </div>
        <div class="card bg-light" style="flex:1">
            <div class="card-body">
                <h5 class="card-title">Objects added</h5>
                <h2 class="card-text">
                    {projectState?.currentProject?.objectsCount || 0}
                </h2>
            </div>
        </div>
        <div class="card bg-light" style="flex:1">
            <div class="card-body">
                <h5 class="card-title">Assets added</h5>
                <h2 class="card-text">
                    {projectState?.currentProject?.assetsCount || 0}
                </h2>
            </div>
        </div>
    </div>
</div>
