<script>
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseTooltip from "$lib/components/base/BaseTooltip.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { normalizeSignalingUrl } from "$lib/utils/signalingUrl.js";

  let {
    value = $bindable(""),
    disabled = false,
  } = $props();

  const { t } = getTranslationStore();
  const inputId = `signaling-${crypto.randomUUID()}`;

  const validation = $derived(normalizeSignalingUrl(value));

  // The field only appears when the dedicated server is enabled, so the URL is
  // required: an empty value is an error, not "use the default network".
  const errorMessage = $derived.by(() => {
    if (!value?.trim()) {
      return t("signaling.error-required", { fallback: "Enter the server address." });
    }
    if (validation.ok) return "";
    const key = validation.error === "protocol"
      ? "signaling.error-protocol"
      : "signaling.error-invalid";
    return t(key, {
      fallback: "Enter a valid server address, for example https://relay.example.com.",
    });
  });

  const warningMessage = $derived(
    validation.warning === "insecure"
      ? t("signaling.warning-insecure", {
          fallback: "ws:// is not encrypted. Use wss:// outside trusted local networks.",
        })
      : ""
  );
</script>

<div>
  <div class="d-flex align-items-center gap-2 mb-2">
    <label class="form-label mb-0" for={inputId}>
      {t("signaling.label", { fallback: "Signaling server" })}
    </label>
    <BaseTooltip>
      {#snippet trigger(props)}
        <i class="bi bi-info-circle text-body" {...props}></i>
      {/snippet}
      {t("signaling.help", {
        fallback: "The server that helps project members find each other online. Whoever set up the dedicated sharing server provides the address.",
      })}
    </BaseTooltip>
  </div>
  <BaseInput
    id={inputId}
    bind:value
    placeholder={t("signaling.placeholder", { fallback: "https://relay.example.com" })}
    clearable={!!value}
    {disabled}
  />

  {#if errorMessage}
    <p class="text-danger mt-2 mb-0">{errorMessage}</p>
  {:else if warningMessage}
    <p class="text-warning-emphasis mt-2 mb-0">{warningMessage}</p>
  {/if}
</div>
