<script>
  import { IconAdjustmentsCog } from "@tabler/icons-svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import okpanLogo from "../../../assets/okpan_logo.svg";

  const { onSettingsClick } = $props();
  const { t } = getTranslationStore();
</script>

<div class="bg-white border-bottom border-gray-300 px-4 py-2 d-flex align-items-center justify-content-between">
  <div class="d-flex align-items-center gap-2">
    <img src={okpanLogo} alt="Okpan" width="42" height="42" />
    <span class="h2 text-body">Ọkpan</span>
  </div>
  <button
    class="btn btn-outline-secondary d-flex align-items-center gap-2"
    onclick={onSettingsClick}
  >
    <IconAdjustmentsCog size={16} stroke={2} />
    {t("settings.application", { fallback: "App Settings" })}
  </button>
</div>
