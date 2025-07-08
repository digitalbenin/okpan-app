<script>
  import {
    updateInstitution,
    getInstitution,
    // updateTextContent, // Removed: No longer used directly here
  } from "$lib/stores/InstitutionsUtils.js";
  import { page } from "$app/state";
  import BaseBadge from "$lib/components/base/BaseBadge.svelte";
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import Breadcrumb from "$lib/components/projects/Breadcrumb.svelte";
  import { addToast } from "$lib/components/base/BaseToast.svelte";
  import InstitutionData from "./InstitutionData.svelte";
  import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";

  let institution = $derived(page.data.institution);
  let institutionId = $derived(page.data.institution.id);
  let projectLanguages = $derived(page.data.projectLanguages);

  // Get content language store for translations
  const { addTranslation, updateTranslation } = getContentLanguageStore();

  // Modal state
  let showEditModal = $state(false);
  let isSubmitting = $state(false);
  // State to hold the data for the form, initialized when modal opens
  let formDataForEdit = $state({});
  let formErrors = $state({}); // Use this to pass errors to child

  // Helper to safely parse links JSON (handles string or already-parsed object)
  function safeParseLinks(linksData) {
    if (typeof linksData === "string") {
      try {
        const parsed = JSON.parse(linksData);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error("Failed to parse links JSON string:", e);
        return [];
      }
    } else if (Array.isArray(linksData)) {
      // Already an array
      return linksData;
    } else {
      // Not a string or an array
      console.warn("Links data is not a JSON string or an array:", linksData);
      return [];
    }
  }

  function getStatusBadgeClass(status) {
    if (status === "in progress") {
      return "bg-warning text-dark";
    } else if (status === "completed") {
      return "bg-success text-white";
    }
    return "bg-secondary text-white";
  }

  // Helper to get existing translation ID (needed for preparing data)
  function getExistingTranslationId(fieldName, langCode) {
    if (
      !institution ||
      !institution[fieldName] ||
      !institution[fieldName].translations
    ) {
      return null;
    }
    const translation = institution[fieldName].translations.find(
      (t) => t.language?.code === langCode,
    );
    return translation ? translation.id : null;
  }

  function openEditModal() {
    formErrors = {}; // Reset errors

    // Initialize the reactive formDataForEdit object
    const initialFormData = {
      name: {},
      location: {},
      country: {},
      description: {},
      status: institution?.status || "in progress",
      // Include IDs needed for saving, if not part of the context already
      // institutionId: institutionId
    };

    // Populate with default language content
    const defaultLangCode =
      projectLanguages.find((l) => l.is_default)?.code ||
      projectLanguages[0]?.code;
    if (defaultLangCode) {
      initialFormData.name[defaultLangCode] = institution?.name?.content || "";
      initialFormData.location[defaultLangCode] =
        institution?.location?.content || "";
      initialFormData.country[defaultLangCode] =
        institution?.country?.content || "";
      initialFormData.description[defaultLangCode] =
        institution?.description?.content || "";
    }

    // Populate with translations
    projectLanguages.forEach((lang) => {
      const langCode = lang.code;
      if (!initialFormData.name[langCode]) {
        // Avoid overwriting default
        const nameTrans = institution?.name?.translations?.find(
          (t) => t.language?.code === langCode,
        );
        initialFormData.name[langCode] = nameTrans?.content || "";
      }
      if (!initialFormData.location[langCode]) {
        const locTrans = institution?.location?.translations?.find(
          (t) => t.language?.code === langCode,
        );
        initialFormData.location[langCode] = locTrans?.content || "";
      }
      if (!initialFormData.country[langCode]) {
        const countryTrans = institution?.country?.translations?.find(
          (t) => t.language?.code === langCode,
        );
        initialFormData.country[langCode] = countryTrans?.content || "";
      }
      if (!initialFormData.description[langCode]) {
        const descTrans = institution?.description?.translations?.find(
          (t) => t.language?.code === langCode,
        );
        initialFormData.description[langCode] = descTrans?.content || "";
      }
    });

    // Populate links (use safeParseLinks)
    initialFormData.links = safeParseLinks(institution?.links || "[]");

    formDataForEdit = initialFormData;
    showEditModal = true;
  }

  async function handleSubmit() {
    isSubmitting = true;
    formErrors = {};

    const defaultLang = projectLanguages.find((l) => l.is_default);
    const defaultLangCode = defaultLang?.code;

    if (!defaultLangCode || !formDataForEdit.name[defaultLangCode]?.trim()) {
      formErrors = {
        ...formErrors,
        name: "Name is required for the default language",
      };
      isSubmitting = false;
      return;
    }

    try {
      // 1. Prepare a consolidated payload for updateInstitution
      const institutionUpdatePayload = {
        status: formDataForEdit.status,
        // Default language content
        name: formDataForEdit.name[defaultLangCode]?.trim() || "",
        location: formDataForEdit.location[defaultLangCode]?.trim() || "",
        country: formDataForEdit.country[defaultLangCode]?.trim() || "",
        description: formDataForEdit.description[defaultLangCode]?.trim() || "",
        // Links should be passed as a JSON string
        links: JSON.stringify(formDataForEdit.links || []),
        // Include the default language ID for creating new text entries
        languageId: defaultLang?.id,
      };

      // Call the refactored updateInstitution
      await updateInstitution(institutionId, institutionUpdatePayload);

      // 2. Handle translations for secondary languages (existing logic remains)
      const translationPromises = [];
      const secondaryLanguages = projectLanguages.filter(
        (lang) => !lang.is_default,
      );

      secondaryLanguages.forEach((lang) => {
        const langCode = lang.code;

        // Process Name Translation
        const nameVal = formDataForEdit.name[langCode]?.trim() || "";
        const nameMainId = institution.name?.id; // Relies on institution object having name.id
        const nameExistingTranslationId = getExistingTranslationId(
          "name",
          langCode,
        );

        if (nameExistingTranslationId) {
          if (nameVal) {
            translationPromises.push(
              updateTranslation(nameExistingTranslationId, nameVal),
            );
          } else {
            // Optional: delete translation if value is empty
            // translationPromises.push(deleteTranslation(nameExistingTranslationId));
          }
        } else if (nameVal && nameMainId) {
          translationPromises.push(
            addTranslation(nameMainId, langCode, nameVal),
          );
        }

        // Process Location Translation
        const locVal = formDataForEdit.location[langCode]?.trim() || "";
        const locMainId = institution.location?.id;
        const locExistingTranslationId = getExistingTranslationId(
          "location",
          langCode,
        );
        if (locExistingTranslationId) {
          if (locVal) {
            translationPromises.push(
              updateTranslation(locExistingTranslationId, locVal),
            );
          } else {
            /* Optional: delete */
          }
        } else if (locVal && locMainId) {
          translationPromises.push(addTranslation(locMainId, langCode, locVal));
        }

        // Process Country Translation
        const countryVal = formDataForEdit.country[langCode]?.trim() || "";
        const countryMainId = institution.country?.id;
        const countryExistingTranslationId = getExistingTranslationId(
          "country",
          langCode,
        );
        if (countryExistingTranslationId) {
          if (countryVal) {
            translationPromises.push(
              updateTranslation(countryExistingTranslationId, countryVal),
            );
          } else {
            /* Optional: delete */
          }
        } else if (countryVal && countryMainId) {
          translationPromises.push(
            addTranslation(countryMainId, langCode, countryVal),
          );
        }

        // Process Description Translation
        const descVal = formDataForEdit.description[langCode]?.trim() || "";
        const descMainId = institution.description?.id;
        const descExistingTranslationId = getExistingTranslationId(
          "description",
          langCode,
        );
        if (descExistingTranslationId) {
          if (descVal) {
            translationPromises.push(
              updateTranslation(descExistingTranslationId, descVal),
            );
          } else {
            /* Optional: delete */
          }
        } else if (descVal && descMainId) {
          translationPromises.push(
            addTranslation(descMainId, langCode, descVal),
          );
        }
      });

      if (translationPromises.length > 0) {
        await Promise.all(translationPromises);
      }

      showEditModal = false;
      addToast({
        data: {
          title: "Success",
          description: "Institution updated successfully",
          type: "success",
        },
      });
    } catch (error) {
      console.error("Error updating institution:", error);
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="container-fluid mt-4">
  <div class="mb-3">
    <Breadcrumb paths={[]} current={institution?.name?.content} />
  </div>
  <div class="row mb-4 align-items-center">
    <div class="col">
      <div class="d-flex align-items-center">
        <BaseButton
          class="btn btn-sm btn-outline-secondary me-3"
          icon="pencil"
          onClick={openEditModal}
          aria-label="Edit Institution"
        />
        <h1 class="m-0 d-inline-block">{institution?.name?.content}</h1>
        <BaseBadge
          text={institution?.status === "in progress"
            ? "In progress"
            : institution?.status}
          class="ms-3 {getStatusBadgeClass(institution?.status)}"
        />
      </div>
    </div>
  </div>

  <!-- Details Row -->
  <div
    class="row mb-4 border-bottom py-3"
    style="border-color: #e9ecef !important;"
  >
    <div class="col-md-6">
      <div class="mb-2">
        <strong class="text-secondary">Location</strong>
      </div>
      <div>
        <a
          href="https://maps.google.com/?q={institution?.location?.content}"
          target="_blank"
          class="text-primary text-decoration-none"
        >
          {institution?.location?.content}, {institution?.country?.content}
        </a>
        {#if institution?.location?.content}
          <div class="text-muted small mt-1">
            (Map coordinates would go here)
          </div>
        {/if}
      </div>
    </div>
    <div class="col-md-6">
      <div class="mb-2">
        <strong class="text-secondary">Links</strong>
      </div>
      <div>
        {#if institution?.links}
          {#each safeParseLinks(institution.links) as link (link.url)}
            <div class="mb-1">
              <a
                href={link.url}
                target="_blank"
                class="text-primary text-decoration-none">{link.label}</a
              >
            </div>
          {:else}
            <span class="text-muted">No links available.</span>
          {/each}
        {:else}
          <span class="text-muted">No links available.</span>
        {/if}
      </div>
    </div>
  </div>
</div>

<!-- Edit Modal -->
<BaseModal bind:isOpen={showEditModal} size="xl">
  {#snippet header()}
    Edit Institution
  {/snippet}

  {#snippet body()}
    <div class="institution-form-container">
      <InstitutionData
        bind:formData={formDataForEdit}
        bind:errors={formErrors}
        {projectLanguages}
      />
    </div>
  {/snippet}

  {#snippet actions()}
    <div class="d-flex justify-content-end gap-2">
      <BaseButton
        text="Cancel"
        type="button"
        class="btn btn-secondary"
        onClick={() => (showEditModal = false)}
      />
      <BaseButton
        text={isSubmitting ? "Saving..." : "Save Changes"}
        type="button"
        class="btn btn-primary"
        loading={isSubmitting}
        onClick={handleSubmit}
      />
    </div>
  {/snippet}
</BaseModal>

<style>
  /* Style for the Melt UI tabs */
  [data-melt-tabs-trigger-list] {
    display: flex;
    border-bottom: 1px solid #dee2e6;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  [data-melt-tabs-trigger] {
    background: none;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem 0.25rem 0 0;
    cursor: pointer;
  }

  [data-melt-tabs-trigger][data-active] {
    border: 1px solid #dee2e6;
    border-bottom-color: white;
    margin-bottom: -1px;
    background-color: white;
  }

  [data-melt-tabs-content] {
    padding: 1rem 0;
  }
</style>
