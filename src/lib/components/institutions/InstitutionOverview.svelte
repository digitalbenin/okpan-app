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

  let institution = $derived(page.data.institution);
  let institutionId = $derived(page.data.institution.id);
  let projectLanguages = $derived(page.data.projectLanguages);

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
      // Prepare translation arrays for all non-default languages
      const secondaryLanguages = projectLanguages.filter(
        (lang) => !lang.is_default,
      );

      const nameTranslations = [];
      const descriptionTranslations = [];
      const countryTranslations = [];
      const locationTranslations = [];

      // Helper function to get existing translation ID
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

      secondaryLanguages.forEach((lang) => {
        const langCode = lang.code;

        // Prepare name translations
        const nameVal = formDataForEdit.name[langCode]?.trim() || "";
        const nameExistingTranslationId = getExistingTranslationId(
          "name",
          langCode,
        );
        if (nameVal || nameExistingTranslationId) {
          nameTranslations.push({
            id: nameExistingTranslationId,
            language_code: langCode,
            content: nameVal || null,
          });
        }

        // Prepare description translations
        const descVal = formDataForEdit.description[langCode]?.trim() || "";
        const descExistingTranslationId = getExistingTranslationId(
          "description",
          langCode,
        );
        if (descVal || descExistingTranslationId) {
          descriptionTranslations.push({
            id: descExistingTranslationId,
            language_code: langCode,
            content: descVal || null,
          });
        }

        // Prepare country translations
        const countryVal = formDataForEdit.country[langCode]?.trim() || "";
        const countryExistingTranslationId = getExistingTranslationId(
          "country",
          langCode,
        );
        if (countryVal || countryExistingTranslationId) {
          countryTranslations.push({
            id: countryExistingTranslationId,
            language_code: langCode,
            content: countryVal || null,
          });
        }

        // Prepare location translations
        const locVal = formDataForEdit.location[langCode]?.trim() || "";
        const locExistingTranslationId = getExistingTranslationId(
          "location",
          langCode,
        );
        if (locVal || locExistingTranslationId) {
          locationTranslations.push({
            id: locExistingTranslationId,
            language_code: langCode,
            content: locVal || null,
          });
        }
      });

      // Prepare unified payload for updateInstitution
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
        // Translation arrays
        nameTranslations: nameTranslations.filter(
          (t) => t.content !== undefined,
        ),
        descriptionTranslations: descriptionTranslations.filter(
          (t) => t.content !== undefined,
        ),
        countryTranslations: countryTranslations.filter(
          (t) => t.content !== undefined,
        ),
        locationTranslations: locationTranslations.filter(
          (t) => t.content !== undefined,
        ),
      };

      console.log("=== INSTITUTION UPDATE PAYLOAD ===");
      console.log("Full payload:", institutionUpdatePayload);

      // Call the unified updateInstitution function
      const result = await updateInstitution(
        institutionId,
        institutionUpdatePayload,
      );

      if (result.error) {
        console.error("Error updating institution:", result.error);
        addToast({
          data: {
            title: "Error",
            description: "Failed to update institution: " + result.error,
            type: "error",
          },
        });
      } else {
        showEditModal = false;
        addToast({
          data: {
            title: "Success",
            description: "Institution updated successfully",
            type: "success",
          },
        });
      }
    } catch (error) {
      console.error("Error updating institution:", error);
      addToast({
        data: {
          title: "Error",
          description: "Failed to update institution",
          type: "error",
        },
      });
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
