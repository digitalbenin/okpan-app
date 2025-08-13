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

  let objectFieldsGroup = $state([
    {
      value: "created_at",
      label: t("common.created-at", { fallback: "Created At" }),
      group: t("common.object-information", { fallback: "Object Information" }),
      groupType: "propertyName",
      id: getSelectedFieldsId(displayFields.result, "created_at"),
    },
    {
      value: "updated_at",
      label: t("common.updated-at", { fallback: "Updated At" }),
      group: t("common.object-information", { fallback: "Object Information" }),
      groupType: "propertyName",
      id: getSelectedFieldsId(displayFields.result, "updated_at"),
    },
  ]);

  let researchFieldsGroup = $state(
    researchFields.result.map((researchField) => {
      return {
        value: researchField.id,
        label: researchField.name.content,
        group: t("common.research-fields", { fallback: "Research Fields" }),
        groupType: "researchFieldId",
        id: getSelectedFieldsId(displayFields.result, researchField.id),
      };
    })
  );

  let fieldsSelected = $state(
    displayFields.result.map((field) => field.value) || []
  );

  let fieldsItems = $state([...objectFieldsGroup, ...researchFieldsGroup]);

  let loading = $state(false);

  function getSelectedFieldsId(fields, value) {
    const elm = fields.find((field) => field.value === value);
    return elm ? elm.id : null;
  }

  watch(
    () => fieldsSelected,
    async (curr, prev) => {
      //   console.log("Fields selected changed:", curr, prev);
      if (!prev) return; // Skip initial run
      loading = true;

      const added = curr.filter((item) => !prev.includes(item));
      const removed = prev.filter((item) => !curr.includes(item));

      if (added.length > 0) {
        const fieldType = fieldsItems.find(
          (item) => item.value === added[0]
        ).groupType;

        await createDisplayField({ projectId, [fieldType]: added[0] });
        await invalidate("app:project-shared");
      }

      if (removed.length > 0) {
        const id = fieldsItems.find((field) => field.value === removed[0])?.id;
        if (!id) return;

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
