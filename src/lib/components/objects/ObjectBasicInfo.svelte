<script>
  import BaseSelectNew from "$lib/components/base/BaseSelectNew.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const { t } = getTranslationStore();

  let {
    objectName = $bindable(""),
    selectedInstitutionId = $bindable(null),
    institutionItems = [],
    onNameInput = undefined,
    onNameFocus = undefined,
    onNameBlur = undefined,
    onInstitutionValueChange = undefined,
    children
  } = $props();

  const handleInstitutionValueChange = (val) => {
    selectedInstitutionId = val;
    onInstitutionValueChange?.(val);
  };
</script>

<div class="d-flex flex-column gap-3">
  <div onfocusin={() => onNameFocus?.()} onfocusout={() => onNameBlur?.()}>
    {#if children}
      {@render children()}
    {:else}
      <label class="form-label mb-2" for="object-name-input">
        {t("objects.object_name", { fallback: "Object name" })}
        <span class="text-danger">*</span>
      </label>
      <input
        id="object-name-input"
        type="text"
        class="form-control"
        placeholder={t("objects.object_name", { fallback: "Object name" })}
        bind:value={objectName}
        oninput={onNameInput}
      />
    {/if}
  </div>

  <div>
    <span class="form-label d-block mb-2">
      {t("common.institution", { fallback: "Institution" })}
      <span class="text-danger">*</span>
    </span>
    <BaseSelectNew
      placeholder={t("common.select-institution", {
        fallback: "Select institution",
      })}
      items={institutionItems}
      value={selectedInstitutionId}
      onValueChange={handleInstitutionValueChange}
      type="single"
      size="md"
      inputClass="w-100"
      contentProps={{ width: "anchor" }}
    />
  </div>
</div>

