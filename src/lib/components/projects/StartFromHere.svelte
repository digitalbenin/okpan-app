<script>
  import {
    IconNewSection,
    IconFileImport,
    IconDownload,
    IconSteam,
    IconSchool
  } from "@tabler/icons-svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const {
    onCreateProject,
    onImportProject,
    onJoinProject,
    variant = "cards"
  } = $props();

  const { t, translationState } = getTranslationStore();

  const actions = $derived.by(() => {
    translationState.isInitialized;
    return [
    {
      key: "create",
      icon: IconNewSection,
      title: t("onboarding.create-new-project", { fallback: "Create a new project" }),
      description: t("onboarding.create-new-project-desc", { fallback: "Start from scratch with a blank workspace." }),
      onClick: onCreateProject,
      interactive: true
    },
    {
      key: "import",
      icon: IconFileImport,
      title: t("onboarding.import-project", { fallback: "Import a project" }),
      description: t("onboarding.import-project-desc", { fallback: "Reopen an Okpan project file exported from this or another device." }),
      onClick: onImportProject,
      interactive: true
    },
    {
      key: "download",
      icon: IconDownload,
      title: t("onboarding.download-sample", { fallback: "Download a sample project" }),
      description: t("onboarding.download-sample-desc", { fallback: "Explore Okpan with a ready-made example project, preloaded with data." }),
      onClick: null,
      interactive: false
    },
    {
      key: "join",
      icon: IconSteam,
      title: t("onboarding.join-project", { fallback: "Join a project" }),
      description: t("onboarding.join-project-desc", { fallback: "Enter an invite code to collaborate on an existing project with your team." }),
      onClick: onJoinProject,
      interactive: true
    },
    {
      key: "tutorials",
      icon: IconSchool,
      title: t("onboarding.tutorials", { fallback: "Tutorials" }),
      description: t("onboarding.tutorials-desc", { fallback: "Step-by-step guides to help you get the most out of Okpan. Opens in your browser." }),
      onClick: null,
      interactive: false
    }
  ];
  });
</script>

{#if variant === "cards"}
  <div class="row g-3">
    {#each actions as action}
      {@const Icon = action.icon}
      <div class="col-12 col-lg">
        {#if action.interactive}
          <button
            class="w-100 text-start p-3 d-flex flex-column bg-white border h-100"
            style="border-radius: 16px; border-color: #d5d6d0 !important; gap: 10px;"
            onclick={action.onClick}
          >
            <div
              class="d-flex align-items-center justify-content-center"
              style="width: 64px; height: 64px; background-color: #f5f5f3; border-radius: 16px; padding: 10px; color: #292927;"
            >
              <Icon size={32} stroke={2} />
            </div>
            <h3 class="m-0" style="font-family: 'Crimson Pro', serif; font-size: 28px; line-height: 1.2; letter-spacing: -0.56px; color: #292927;">
              {action.title}
            </h3>
            <p class="m-0" style="font-size: 14px; line-height: 1.5; color: #292927;">
              {action.description}
            </p>
          </button>
        {:else}
          <div
            class="w-100 text-start p-3 d-flex flex-column bg-white border h-100"
            style="border-radius: 16px; border-color: #d5d6d0 !important; gap: 10px;"
          >
            <div
              class="d-flex align-items-center justify-content-center"
              style="width: 64px; height: 64px; background-color: #f5f5f3; border-radius: 16px; padding: 10px; color: #292927;"
            >
              <Icon size={32} stroke={2} />
            </div>
            <h3 class="m-0" style="font-family: 'Crimson Pro', serif; font-size: 28px; line-height: 1.2; letter-spacing: -0.56px; color: #292927;">
              {action.title}
            </h3>
            <p class="m-0" style="font-size: 14px; line-height: 1.5; color: #292927;">
              {action.description}
            </p>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{:else}
  <div class="d-flex flex-column gap-2">
    {#each actions as action}
      {@const Icon = action.icon}
      {#if action.interactive}
        <button
          class="d-flex gap-2 align-items-center p-2 text-start bg-transparent border-0 w-100"
          style="border-radius: 16px; color: #292927;"
          onclick={action.onClick}
        >
          <div
            class="d-flex align-items-center justify-content-center flex-shrink-0"
            style="width: 40px; height: 40px; background-color: #f5f5f3; border-radius: 16px; padding: 4px;"
          >
            <Icon size={32} stroke={2} />
          </div>
          <span style="font-family: 'Crimson Pro', serif; font-size: 24px; line-height: 1.2; letter-spacing: -0.48px;">
            {action.title}
          </span>
        </button>
      {:else}
        <div
          class="d-flex gap-2 align-items-center p-2 w-100"
          style="border-radius: 16px; color: #292927;"
        >
          <div
            class="d-flex align-items-center justify-content-center flex-shrink-0"
            style="width: 40px; height: 40px; background-color: #f5f5f3; border-radius: 16px; padding: 4px;"
          >
            <Icon size={32} stroke={2} />
          </div>
          <span style="font-family: 'Crimson Pro', serif; font-size: 24px; line-height: 1.2; letter-spacing: -0.48px;">
            {action.title}
          </span>
        </div>
      {/if}
    {/each}
  </div>
{/if}
