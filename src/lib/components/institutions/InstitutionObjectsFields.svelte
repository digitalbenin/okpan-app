<script>
  import { invalidate } from "$app/navigation";
  import { watch } from "runed";
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import {
    deleteDisplayField,
    createDisplayField,
  } from "$lib/stores/DisplayFieldsUtils.js";

  const { displayFields, researchFields, projectId } = $props();
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

  const objectInformationLabel = t("common.object-information", { fallback: "Object Information" });
  const researchFieldsLabel = t("common.research-fields", { fallback: "Research Fields" });

  const baseObjectFields = [
    {
      value: "created_at",
      label: t("common.created-at", { fallback: "Created At" }),
      group: objectInformationLabel,
      groupType: "propertyName",
    },
    {
      value: "updated_at",
      label: t("common.updated-at", { fallback: "Updated At" }),
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

  let objectFieldsGroup = $state(buildObjectFieldsGroup(dfArray));

  let researchFieldsGroup = $state(buildResearchFieldsGroup(rfArray, dfArray));

  let fieldsSelected = $state(getFieldValues(dfArray));

  let fieldsItems = $state([...objectFieldsGroup, ...researchFieldsGroup]);

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
      objectFieldsGroup = buildObjectFieldsGroup(fields);
      researchFieldsGroup = buildResearchFieldsGroup(research, fields);
      fieldsItems = [...objectFieldsGroup, ...researchFieldsGroup];
      fieldsSelected = getFieldValues(fields);
      queueMicrotask(() => {
        skipSelectionWatcher = false;
      });
    },
    { lazy: true }
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
        await invalidate("app:project-shared");
      }

      if (removed.length > 0) {
        const id = fieldsItems.find((field) => field.value === removed[0])?.id;
        if (!id) {
          loading = false;
          return;
        }

        await deleteDisplayField(id);
        await invalidate("app:project-shared");
      }
      loading = false;
    },
    { lazy: true }
  );
</script>

<BaseSelect
  bind:value={fieldsSelected}
  items={fieldsItems}
  placeholder={t("common.default", {
    fallback: "Default",
  })}
  type="multiple"
  size="sm"
  disabled={loading}
></BaseSelect>
