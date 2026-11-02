<script>
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let {
    isShared = $bindable(false),
    usePassword = $bindable(true),
    password = $bindable(""),
  } = $props();

  const { t } = getTranslationStore();

  const toggleClass = (active) =>
    active ? "btn btn-success text-white" : "btn btn-light text-muted";
  const toggleStyle = (active) =>
    active
      ? "background-color: #0f8a65; border-color: #0f8a65; width: 60px;"
      : "background-color: white; border: none; width: 60px;";
</script>

<div class="mb-4">
  <div class="d-flex justify-content-between align-items-center mb-4">
    <div class="d-flex align-items-center gap-2">
      <span class="fs-6 text-dark">
        {t("project-create.sharing-title", { fallback: "Do you want to make a collaborative project?" })}
      </span>
    </div>
    <div class="btn-group border rounded" role="group">
      <button type="button" class={toggleClass(isShared)} style={toggleStyle(isShared)} onclick={() => isShared = true}>
        {t("project-create.yes", { fallback: "Yes" })}
      </button>
      <button type="button" class={toggleClass(!isShared)} style={toggleStyle(!isShared)} onclick={() => isShared = false}>
        {t("project-create.no", { fallback: "No" })}
      </button>
    </div>
  </div>

  {#if isShared}
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div class="d-flex align-items-center gap-2">
        <span class="fs-6 text-dark">
          {t("project-create.use-password", { fallback: "Use password" })}
        </span>
      </div>
      <div class="btn-group border rounded" role="group">
        <button type="button" class={toggleClass(usePassword)} style={toggleStyle(usePassword)} onclick={() => usePassword = true}>
          {t("project-create.yes", { fallback: "Yes" })}
        </button>
        <button type="button" class={toggleClass(!usePassword)} style={toggleStyle(!usePassword)} onclick={() => usePassword = false}>
          {t("project-create.no", { fallback: "No" })}
        </button>
      </div>
    </div>
  {/if}

  {#if isShared && usePassword}
    <div class="mb-4">
      <p class="form-label fs-6 text-dark">{t("project-create.password", { fallback: "Password" })}</p>
      <div class="input-group">
        <input
          type="password"
          class="form-control fs-6 px-3 py-2"
          placeholder={t("project-create.password-placeholder", { fallback: "Enter password" })}
          bind:value={password}
        />
      </div>
    </div>
  {/if}

</div>
