<script>
  import { getContext } from "svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";

  let project = getContext("project");
</script>

<div
  class="d-flex align-items-center justify-content-between px-3 py-2 border-bottom"
>
  <div>
    <h6 class="m-0">
      <a href="/projects/{project.id}"> {project.title.content}</a>
    </h6>
  </div>
  <div class="d-flex gap-1">
    <BaseButton class="btn btn-sm btn-primary" text="Data Editor" />
    <BaseButton class="btn btn-sm btn-primary" text="Data Explorer" />
  </div>

  <div class="d-flex gap-1">
    <BaseButton
      class="btn btn-sm btn-dark"
      icon="table"
      text="Data Structure"
    />
    <BaseButton class="btn btn-sm btn-dark" icon="download" text="Export" />
    <BaseButton class="btn btn-sm btn-dark" icon="gear" text="Settings" />
    <BaseButton
      class="btn btn-sm btn-dark"
      icon="question-circle"
      text="Help"
    />
  </div>
</div>
