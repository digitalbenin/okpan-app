<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { goto, invalidateAll } from "$app/navigation";
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import ConnectionFieldsSelector from "$lib/components/research_fields/ConnectionFieldsSelector.svelte";
  import { CONNECTION_TEMPLATES, DEFAULT_FIELDS_CONFIG } from "$lib/constants/connectionTemplates.js";
  import { createResearchField } from "$lib/api/ResearchFieldsApi.js";
  import { IconCirclePlus, IconTags, IconIcons, IconMapPin, IconMicrophone, IconUsersGroup } from "@tabler/icons-svelte";

  let { projectId, languages = [], buttonClass = "btn btn-sm btn-primary text-white" } = $props();

  const { t } = getTranslationStore();

  const defaultLanguage =
    languages?.find((l) => l.is_default) ||
    languages?.[0];

  const templateIcons = {
    custom: IconCirclePlus,
    indigenous_designation: IconTags,
    iconography: IconIcons,
    place: IconMapPin,
    oral_history: IconMicrophone,
    people: IconUsersGroup,
  };

  function getTemplateIcon(templateId) {
    return templateIcons[templateId] || IconCirclePlus;
  }

  function getTemplateIconColor(template, colorType) {
    if (!template || !template.color) {
      if(colorType=="body") return 'text-gray';
      return 'bg-gray-100';
    }
    
    if(colorType=="body") return `text-${template.color}-500`;
    return `bg-${template.color}-100`;
  }

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
        return t("connections.template.custom.label", { fallback: "Custom connection type" });
      case "indigenous_designation":
        return t("connections.template.indigenous_designation.label", {
          fallback: "Indigenous designation",
        });
      case "iconography":
        return t("connections.template.iconography.label", { fallback: "Iconography" });
      case "place":
        return t("connections.template.place.label", { fallback: "Places" });
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
          fallback: "Create a connection type from scratch.",
        });
      case "indigenous_designation":
        return t("connections.template.indigenous_designation.description", {
          fallback: "Record indigenous terms to describe objects.",
        });
      case "iconography":
        return t("connections.template.iconography.description", {
          fallback: "Describe symbols and visual elements present in the objects.",
        });
      case "place":
        return t("connections.template.place.description", {
          fallback: "Geographic locations and sites.",
        });
      case "oral_history":
        return t("connections.template.oral_history.description", {
          fallback: "Audio and video interviews.",
        });
      case "people":
        return t("connections.template.people.description", {
          fallback: "Individual and groups of people.",
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
        fields_config: { ...JSON.parse(JSON.stringify(template.defaultConfig)), templateId: template.id },
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
      }
    } catch (e) {
      console.error("Error creating connection type", e);
    } finally {
      isSubmitting = false;
    }
  }

  async function handleTemplateClick(template) {
    selectedTemplate = template;
  }

  async function handlePrimaryAction() {
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
        fields_config: { ...JSON.parse(JSON.stringify(fieldsConfig)), templateId: selectedTemplate?.id || 'custom' },
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
  <IconCirclePlus size={16} class="me-1" />
  {t("common.add-connection-type", { fallback: "Add connection type" })}
</button>

{#snippet modalHeader()}
  {#if step === 1}
    {t("project.add_connection_type", { fallback: "Add connection type" })}
  {:else if step === 2}
    {t("project.give_name_connection", { fallback: "Give a name to the connection type" })}
  {:else}
    {t("project.add_connection_type", { fallback: "Add a connection type" })}
  {/if}
{/snippet}

{#snippet modalBody()}
  {#if step === 1}
    <p class="mb-4">
      {t("project.choose_template", { fallback: "Choose a template or make your own." })}
    </p>

    <div class="row g-3">
      {#each CONNECTION_TEMPLATES as template}
        {@const IconComponent = getTemplateIcon(template.id)}
        {@const iconBgClass = getTemplateIconColor(template, "bg")}
        {@const iconColorClass = getTemplateIconColor(template, "body")}
        <div class="col-6">
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="bg-white rounded-4 p-3 d-flex flex-column gap-2 cursor-pointer template-option"
            class:border-opacity-50={selectedTemplate?.id === template.id}
            onclick={() => handleTemplateClick(template)}
            role="button"
            tabindex="0"
            style={selectedTemplate?.id === template.id ? `border-color: var(--bs-${template.color})` : undefined}
          >
            <div class="{iconBgClass} rounded-4 d-flex align-items-center justify-content-center flex-shrink-0" style="width: 48px; height: 48px;">
              <IconComponent size={32} class={iconColorClass} />
            </div>
            <p class="fw-semibold mb-0">{getTemplateLabel(template)}</p>
            <p class="small mb-0">{getTemplateDescription(template)}</p>
          </div>
        </div>
      {/each}
    </div>
  {:else if step === 2}
    <p class="mb-4">
      {t("project.edit_later_hint", { fallback: "Don't worry, you can edit them later" })}
    </p>
    <div class="mb-3">
      <label for="name" class="form-label">{t("connections.name-of-connection-type", { fallback: "Name of the connection type" })}</label>
      <input type="text" id="name" class="form-control" bind:value={basicInfo.name} placeholder={t("connections.form.name-placeholder", { fallback: "Custom connection type" })} />
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
        placeholder={t("connections.form.description-placeholder", { fallback: "Content" })}
      ></textarea>
    </div>
  {:else if step === 3}
    <p class="mb-4">
      {t("project.define_fields_connection", {
        fallback: "Define the fields you want to have for this connection type"
      })}
    </p>
    <ConnectionFieldsSelector bind:config={fieldsConfig} />
  {/if}
{/snippet}

{#snippet modalFooter()}
  <BaseButton
    class="btn btn-outline-secondary"
    onClick={() => (isModalOpen = false)}
    text={t("common.cancel", { fallback: "Cancel" })}
  />

  {#if step === 1}
    <BaseButton
      class="btn btn-primary ms-2"
      onClick={handlePrimaryAction}
      disabled={!selectedTemplate}
      text={selectedTemplate?.id !== 'custom'
        ? t("common.create", { fallback: "Create" })
        : t("common.next", { fallback: "Next" })}
    />
  {:else if step === 2}
    <BaseButton
      class="btn btn-primary ms-2"
      onClick={handlePrimaryAction}
      disabled={!basicInfo.name}
      text={t("common.next", { fallback: "Next" })}
    />
  {:else if step === 3}
    <BaseButton
      class="btn btn-primary ms-2"
      onClick={handlePrimaryAction}
      disabled={isSubmitting}
      text={isSubmitting
        ? t("common.saving", { fallback: "Saving..." })
        : t("common.create", { fallback: "Create" })}
    />
  {/if}
{/snippet}

<BaseModal bind:isOpen={isModalOpen} header={modalHeader} body={modalBody} actions={modalFooter} size="lg" />

<style>
  .template-option {
    transition: all 0.15s ease;
    border: 1px solid var(--bs-gray-300);
  }
  .template-option:hover {
    border-color: var(--bs-gray-500);
  }
</style>
