<script>
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseSelectNew from "$lib/components/base/BaseSelectNew.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const { t } = getTranslationStore();

  let {
    objectName = $bindable(""),
    selectedInstitutionId = $bindable(null),
    institutionItems = [],
    onNameInput = undefined,
    onInstitutionValueChange = undefined,
  } = $props();


  const handleInstitutionValueChange = (val) => {
    selectedInstitutionId = val;
    onInstitutionValueChange?.(val);
  };
</script>

<div class="card bg-white border-0">
  <div class="card-body">
    <div class="mb-3">
      <p class="mb-0">
        <i class="bi bi-info-circle me-2"></i>
        {t("objects.basic_object_information", {
      fallback: "Basic object Information",
    })}</p>
    </div>

    <div class="d-flex flex-column gap-3">
      <div>
        <p class="mb-2">
          {t("objects.object_name", { fallback: "Object name" })}
        </p>
        <BaseInput
          placeholder={t("objects.object_name", { fallback: "Object name" })}
          size="sm"
          bind:value={objectName}
          {onNameInput}
        />
      </div>

      <div>
        <p class="my-3">
          {t("institutions.institution", { fallback: "Institution" })}
        </p>
        <BaseSelectNew
          placeholder={t("institutions.select_institution", {
            fallback: "Select institution",
          })}
          items={institutionItems}
          value={selectedInstitutionId}
          onValueChange={handleInstitutionValueChange}
          type="single"
          size="sm"
          inputClass="w-100"
          contentProps={{ width: "anchor" }}
        />
      </div>
    </div>
  </div>
</div>
