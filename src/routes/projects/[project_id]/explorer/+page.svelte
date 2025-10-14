<script>
  import { page } from "$app/state";

  const projectId = $derived(page.data?.project?.id);
  const srcUrl = $derived(`website://index.html${projectId ? `?project_id=${projectId}` : ''}`);
</script>

<div class="explorer-container">
  <iframe src={srcUrl} title="Data Explorer" class="explorer-frame"></iframe>
</div>

<style>
  .explorer-container {
    width: 100%;
    height: 100%;
  }
  .explorer-frame {
    width: 100%;
    height: calc(100vh - 60px);
    border: 0;
    background: transparent;
  }
</style>