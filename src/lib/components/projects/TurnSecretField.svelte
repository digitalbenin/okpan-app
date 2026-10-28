<script>
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseTooltip from "$lib/components/base/BaseTooltip.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let {
    value = $bindable(""),
    disabled = false,
  } = $props();

  const { t } = getTranslationStore();
  const inputId = `turn-secret-${crypto.randomUUID()}`;
</script>

<div>
  <div class="d-flex align-items-center gap-2 mb-2">
    <label class="form-label mb-0" for={inputId}>
      {t("turn-secret.label", { fallback: "TURN secret (optional)" })}
    </label>
    <BaseTooltip>
      {#snippet trigger(props)}
        <i class="bi bi-info-circle text-body" {...props}></i>
      {/snippet}
      {t("turn-secret.help", {
        fallback: "The access key for the backup connection server, provided by whoever set up the dedicated sharing server.",
      })}
    </BaseTooltip>
  </div>
  <BaseInput
    id={inputId}
    type="password"
    bind:value
    placeholder={t("turn-secret.placeholder", { fallback: "Paste the secret code here" })}
    clearable={!!value}
    {disabled}
  />
</div>
