<script>
  import { IconSettings, IconBulb } from "@tabler/icons-svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import ProjectRecoverySnapshotsPanel from "$lib/components/projects/ProjectRecoverySnapshotsPanel.svelte";

  const { t } = getTranslationStore();
  const { data } = $props();
</script>

<!-- Heading section -->
<div class="border-bottom px-4 py-3 d-flex flex-column gap-2 mx-n4 mt-n4 bg-white">
	<div class="d-flex flex-column gap-3">
		<div class="d-flex align-items-center gap-3">
			<div class="bg-gray-200 text-gray-500 rounded-4 d-flex align-items-center justify-content-center flex-shrink-0" style="width: 48px; height: 48px;">
				<IconSettings size={32} />
			</div>
			<h1 class="mb-0 flex-grow-1">{t("menu.recovery-snapshots", { fallback: "Back-ups" })}</h1>
		</div>
		<p class="mb-0" style="font-size: 14px;">{t("recovery-snapshots.page-description", { fallback: "View and manage project snapshots for backup and recovery." })}</p>
	</div>
</div>

<div class="container-fluid py-4">
  <div class="row g-3">
    <div class="col-12 col-lg-8 col-xl-9 min-w-0">
      <div class="rounded-3 ">
        <ProjectRecoverySnapshotsPanel projectId={data.project.id} />
      </div>
    </div>

    <div class="col-12 col-lg-4 col-xl-3">
      <div class="bg-white border rounded-3 p-4 d-flex flex-column">
        <div class="d-flex flex-column gap-1">
          <div class="flex-shrink-0">
            <IconBulb size={16} stroke={2} />
          </div>
          <div>
            <p class="fw-semibold mb-1 text-body">{t("projects.recovery-snapshots.title", { fallback: "Recovery snapshots" })}</p>
            <div class="text-body-secondary fs-7">
              <p class="mb-0">{t("projects.recovery-snapshots.description", { fallback: "Automatic snapshots are captured before the first sync after opening a project in each app session. Automatic snapshots keep the 10 most recent entries. Manual snapshots are always kept until you remove them." })}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>