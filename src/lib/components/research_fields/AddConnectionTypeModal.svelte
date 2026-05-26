<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { goto, invalidateAll } from "$app/navigation";
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import ConnectionFieldsSelector from "$lib/components/research_fields/ConnectionFieldsSelector.svelte";
  import { CONNECTION_TEMPLATES, DEFAULT_FIELDS_CONFIG } from "$lib/constants/connectionTemplates.js";
  import { createResearchField } from "$lib/api/ResearchFieldsApi.js";

  let { projectId, languages = [], buttonClass = "btn btn-secondary text-white" } = $props();

  const { t } = getTranslationStore();

  const defaultLanguage =
    languages?.find((l) => l.is_default) ||
    languages?.[0];

  // Modal State
  let isModalOpen = $state(false);
  let step = $state(1);
  let selectedTemplate = $state(null);
  let fieldsConfig = $state({ ...DEFAULT_FIELDS_CONFIG });
  let basicInfo = $state({});
  let isSubmitting = $state(false);

  function getTemplateLabel(template) {
    switch (template?.id) {
      case "custom":
        return t("connections.template.custom.label", { fallback: "Custom" });
      case "indigenous_designation":
        return t("connections.template.indigenous_designation.label", {
          fallback: "Indigenous designation",
        });
      case "iconography":
        return t("connections.template.iconography.label", { fallback: "Iconography" });
      case "place":
        return t("connections.template.place.label", { fallback: "Place" });
      case "oral_history":
        return t("connections.template.oral_history.label", { fallback: "Oral history" });
      case "people":
        return t("connections.template.people.label", { fallback: "People" });
      default:
        return template?.label || "";
    }
  }

  function getTemplateDescription(template) {
    switch (template?.id) {
      case "custom":
        return t("connections.template.custom.description", {
          fallback: "Create a connection type from scratch",
        });
      case "indigenous_designation":
        return t("connections.template.indigenous_designation.description", {
          fallback: "Record indigenous names/terms",
        });
      case "iconography":
        return t("connections.template.iconography.description", {
          fallback: "Describe symbols and visual elements",
        });
      case "place":
        return t("connections.template.place.description", {
          fallback: "Geographic locations and sites",
        });
      case "oral_history":
        return t("connections.template.oral_history.description", {
          fallback: "Recordings and transcripts",
        });
      case "people":
        return t("connections.template.people.description", {
          fallback: "Individuals and groups",
        });
      default:
        return template?.description || "";
    }
  }

  function resetModal() {
    step = 1;
    selectedTemplate = null;
    fieldsConfig = { ...DEFAULT_FIELDS_CONFIG };
    basicInfo = {};
    isSubmitting = false;
  }

  function openModal() {
    resetModal();
    isModalOpen = true;
  }

  async function handleQuickCreate(template) {
    isSubmitting = true;
    try {
      const params = {
        projectId,
        type: "vocabulary",
        name: template.label,
        description: template.description || "",
        languageId: defaultLanguage?.id,
        fields_config: JSON.parse(JSON.stringify(template.defaultConfig)),
        onwebsite: 1
      };

      const result = await createResearchField(params);
      if (result && !result.error) {
        isModalOpen = false;
        const newId = result.id || result[0]?.id;
      }
    } catch (e) {
      console.error("Error creating connection type", e);
    } finally {
      isSubmitting = false;
    }
  }

  async function handleTemplateClick(template) {
    if (template.id === "custom") {
      selectedTemplate = template;
    } else {
      selectedTemplate = template;
      await handleQuickCreate(template);
    }
  }

  async function handleNextStep() {
    if (step === 1 && selectedTemplate) {
      if (selectedTemplate.id !== "custom") {
        await handleQuickCreate(selectedTemplate);
        return;
      }
      fieldsConfig = { ...selectedTemplate.defaultConfig };
      step = 2;
    } else if (step === 2) {
      step = 3;
    } else if (step === 3) {
      await handleSubmit();
    }
  }

  async function handleSubmit() {
    isSubmitting = true;
    try {
      const params = {
        projectId,
        type: "vocabulary",
        name: basicInfo[`name`],
        description: basicInfo[`description`] || "",
        languageId: defaultLanguage?.id,
        fields_config: JSON.parse(JSON.stringify(fieldsConfig)),
        onwebsite: 1
      };

      const result = await createResearchField(params);

      if (result && !result.error) {
        isModalOpen = false;
        const newId = result.id || result[0]?.id;
        if (newId) {
          await invalidateAll();
          goto(`/projects/${projectId}/connections/${newId}`);
        } else {
          await invalidateAll();
        }
      } else {
        console.error("Error creating connection type", result?.error);
      }
    } catch (e) {
      console.error("Error creating connection type", e);
    } finally {
      isSubmitting = false;
    }
  }
</script>

<button class={buttonClass} onclick={openModal}>
  <i class="bi bi-plus-lg me-1"></i>
  {t("common.add-connection-type", { fallback: "Add connection type" })}
</button>

{#snippet modalHeader()}
  {#if step === 1}
    {t("project.add_connection_type", { fallback: "Add a new connection type" })}
  {:else if step === 2}
    {t("project.give_name_connection", { fallback: "Give a name to the connection type" })}
  {:else}
    {t("project.define_fields_connection", {
      fallback: "Define the fields you want to have for this connection type"
    })}
  {/if}
{/snippet}

{#snippet modalBody()}
  <p class="mb-4">
    {#if step === 1}
      {t("project.choose_template", { fallback: "Choose a template or make your own." })}
    {:else}
      {t("project.edit_later_hint", { fallback: "Don't worry, you can edit them later" })}
    {/if}
  </p>

  {#if step === 1}
    <div class="row g-4">
      {#each CONNECTION_TEMPLATES as template}
        <div class="col-md-4">
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="card h-100 shadow-sm template-card"
            class:selected={selectedTemplate?.id === template.id}
            onclick={() => handleTemplateClick(template)}
          >
            <div
              class="card-body text-center d-flex flex-column align-items-center justify-content-center p-3"
              style="min-height: 150px;"
            >
              <i class={`bi ${template.icon} fs-1 mb-2`}></i>
              <p class="card-title mb-1">{getTemplateLabel(template)}</p>
              <p class="text-muted small mb-0">{getTemplateDescription(template)}</p>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else if step === 2}
    <div class="p-3">
      <div class="mb-3">
        <label for="name" class="form-label">{t("common.title", { fallback: "Title" })}</label>
        <input type="text" id="name" class="form-control" bind:value={basicInfo.name} />
      </div>
      <div class="mb-3">
        <label for="description" class="form-label">
          {t("common.description", { fallback: "Description" })}
        </label>
        <textarea
          id="description"
          class="form-control"
          rows="3"
          bind:value={basicInfo.description}
        ></textarea>
      </div>
    </div>
  {:else if step === 3}
    <ConnectionFieldsSelector bind:config={fieldsConfig} />
  {/if}
{/snippet}

{#snippet modalFooter()}
  <BaseButton
    class="btn btn-secondary"
    onClick={() => (isModalOpen = false)}
    text={t("common.cancel", { fallback: "Cancel" })}
  />

  {#if step === 1}
    <BaseButton
      class="btn btn-primary ms-2"
      onClick={handleNextStep}
      disabled={!selectedTemplate}
      text={t("common.next", { fallback: "Next" })}
    />
  {:else if step === 2}
    <BaseButton
      class="btn btn-primary ms-2"
      onClick={handleNextStep}
      disabled={!basicInfo.name}
      text={t("common.next", { fallback: "Next" })}
    />
  {:else if step === 3}
    <BaseButton
      class="btn btn-primary ms-2"
      onClick={handleSubmit}
      disabled={isSubmitting}
      text={isSubmitting
        ? t("common.saving", { fallback: "Saving..." })
        : t("common.create", { fallback: "Create" })}
    />
  {/if}
{/snippet}

<BaseModal bind:isOpen={isModalOpen} header={modalHeader} body={modalBody} actions={modalFooter} size="xl" />

<style>
  .template-card {
    cursor: pointer;
    transition: all 0.2s ease;
    border: 2px solid transparent;
  }
  .template-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
  }
  .template-card.selected {
    border-color: var(--bs-primary);
    background-color: #f0fdf4;
  }
  :global(.template-card.selected .bi) {
    color: var(--bs-primary) !important;
  }
</style>
