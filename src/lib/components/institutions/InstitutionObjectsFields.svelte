<script>
  import { invalidateAll } from "$app/navigation";
  import { watch } from "runed";
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import {
    deleteDisplayField,
    createDisplayField,
  } from "$lib/stores/DisplayFieldsUtils.js";

  const {
    displayFields,
    researchFields,
    projectId,
    as = "select",
    inputClass,
    placeholder,
  } = $props();
  const { t } = getTranslationStore();

  // Normalize incoming props to consistent array shapes
  const dfArray = $derived(
    Array.isArray(displayFields)
      ? displayFields
      : (displayFields?.result || [])
  );
  const rfArray = $derived(
    Array.isArray(researchFields)
      ? researchFields
      : (researchFields?.result || researchFields?.research_fields || [])
  );

  const objectInformationLabel = t("objects.object-information");
  const researchFieldsLabel = t("filters.research-fields");

  const baseObjectFields = [
    {
      value: "created_at",
      label: t("common.created-at"),
      group: objectInformationLabel,
      groupType: "propertyName",
    },
    {
      value: "updated_at",
      label: t("common.updated-at"),
      group: objectInformationLabel,
      groupType: "propertyName",
    },
  ];

  const buildObjectFieldsGroup = (fields = []) =>
    baseObjectFields.map((item) => ({
      ...item,
      id: getSelectedFieldsId(fields, item.value),
    }));

  const buildResearchFieldsGroup = (researchFields = [], fields = []) =>
    researchFields.map((researchField) => ({
      value: researchField.id,
      label: researchField.name.content,
      group: researchFieldsLabel,
      groupType: "researchFieldId",
      id: getSelectedFieldsId(fields, researchField.id),
    }));

  const getFieldValues = (fields) =>
    Array.isArray(fields) ? fields.map((field) => field.value) : [];

  const objectFieldsGroup = $derived.by(() => buildObjectFieldsGroup(dfArray));

  const researchFieldsGroup = $derived.by(() =>
    buildResearchFieldsGroup(rfArray, dfArray)
  );

  const fieldsItems = $derived.by(() => [
    ...objectFieldsGroup,
    ...researchFieldsGroup,
  ]);

  let fieldsSelected = $state([]);

  let loading = $state(false);
  let skipSelectionWatcher = false;

  function getSelectedFieldsId(fields, value) {
    const elm = fields.find((field) => field.value === value);
    return elm ? elm.id : null;
  }

  watch(
    () => ({ fields: dfArray, research: rfArray }),
    ({ fields, research }) => {
      skipSelectionWatcher = true;
      fieldsSelected = getFieldValues(fields);
      queueMicrotask(() => {
        skipSelectionWatcher = false;
      });
    },
    { lazy: false }
  );

  watch(
    () => fieldsSelected,
    async (curr, prev) => {
      if (!prev || skipSelectionWatcher) return; // Skip initial run and store syncs
      loading = true;

      const added = curr.filter((item) => !prev.includes(item));
      const removed = prev.filter((item) => !curr.includes(item));

      if (added.length > 0) {
        const addedItem = fieldsItems.find((item) => item.value === added[0]);
        if (!addedItem) {
          loading = false;
          return;
        }
        const fieldType = addedItem.groupType;

        await createDisplayField({ projectId, [fieldType]: added[0] });
        await invalidateAll();
      }

      if (removed.length > 0) {
        const id = fieldsItems.find((field) => field.value === removed[0])?.id;
        if (!id) {
          loading = false;
          return;
        }

        await deleteDisplayField(id);
        await invalidateAll();
      }
      loading = false;
    },
    { lazy: true }
  );
</script>

<BaseSelect
  bind:value={fieldsSelected}
  items={fieldsItems}
  placeholder={
    placeholder || t("objects.select-fields")
  }
  triggerLabel={
    as === "button" ? t("objects.select-fields") : undefined
  }
  type="multiple"
  as={as}
  inputClass={inputClass}
  disabled={loading}
>
  {#if as === "button"}
    <i class="bi bi-chevron-down"></i>
  {/if}
</BaseSelect>
