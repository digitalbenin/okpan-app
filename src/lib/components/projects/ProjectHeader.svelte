<script>
    import { getProjectStore } from "$lib/stores/ProjectStore.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";

    const { projectState } = getProjectStore();
</script>

<div
    class="d-flex flex-row align-items-center justify-content-between p-4"
    style="height:60px"
>
    <h6 class="col-4">{projectState.currentProject.title.content}</h6>
    <div
        class="d-flex flex-row justify-content-center align-items-center gap-1"
    >
        <BaseButton class="btn btn-sm btn-primary" text="Data Editor" />
        <BaseButton class="btn btn-sm btn-primary" text="Data Explorer" />
    </div>

    <div
        class="col-4 d-flex flex-row justify-content-end align-items-center gap-1"
    >
        <BaseButton
            class="btn btn-sm bg-black text-white"
            icon="table"
            text="Data Structure"
        />
        <BaseButton
            class="btn btn-sm bg-black text-white"
            icon="download"
            text="Export"
        />
        <BaseButton
            class="btn btn-sm bg-black text-white"
            icon="gear"
            text="Settings"
        />
        <BaseButton
            class="btn btn-sm bg-black text-white"
            icon="question-circle"
            text="Help"
        />
    </div>
</div>
