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
    children
  } = $props();


  const handleInstitutionValueChange = (val) => {
    selectedInstitutionId = val;
    onInstitutionValueChange?.(val);
  };
</script>

<div class="card bg-white border-0">
  <div class="card-body">
   

    <div class="d-flex flex-column gap-0">
      <div>
        {#if children}
          {@render children()}
        {:else}
          <p class="mb-2">
            {t("objects.object_name", { fallback: "Object name" })}
          </p>
          <BaseInput
            placeholder={t("objects.object_name", { fallback: "Object name" })}
            size="sm"
            bind:value={objectName}
            {onNameInput}
          />
        {/if}
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
