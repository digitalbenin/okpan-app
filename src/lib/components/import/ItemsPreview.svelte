<script>
  import { page as pageData } from "$app/state";
  import Table from "$lib/components/base/table/Table.svelte";
  import BaseBadgeField from "$lib/components/base/BaseBadgeField.svelte";
  import BasePagination from "$lib/components/base/BasePagination.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  const { data, mapping } = $props();

  const { t } = getTranslationStore();

  let page = $state(1);
  const columns = $derived.by(() => {
    return [
      {
        value: "mapped-field",
        label: t("common.mapped-field", { fallback: "Mapped field" }),
        sortable: false,
        render: (value) => ({
          component: BaseBadgeField,
          props: { label: value },
        }),
      },
      {
        value: "institution-field",
        label: t("common.institution-field", { fallback: "Institution field" }),
        sortable: false,
      },
      {
        value: "value",
        label: t("common.value", { fallback: "Value" }),
        sortable: false,
        html: true,
      },
    ];
  });

  const item = $derived.by(() => {
    return Object.entries(data[page - 1]).map(([key, value]) => {
      const mappedField = mapping.find(
        (m) => m.headerField === key
      ).mappedField;

      const ontologyLabel = mappedField ? getOntologyLabel(mappedField) : null;
      let outputValue;
      if (value) {
        const splittedValue = String(value).split("|");
        if (splittedValue.length) {
          outputValue = splittedValue
            .map((v) =>
              v.trim()
                ? v.trim()
                : `<i>${t("common.null", { fallback: "null" })}</i>`
            )
            .join("<br/>");
        } else {
          outputValue = value;
        }
      } else {
        outputValue = `<i>${t("common.null", { fallback: "null" })}</i>`;
      }
      return {
        "mapped-field": ontologyLabel,
        "institution-field": key,
        value: outputValue,
      };
    });
  });

  const primaryField = $derived.by(() => {
    return mapping.find((m) => m.primary)?.headerField || "";
  });

  function getOntologyLabel(id) {
    const ontologyField = pageData.data.ontologyFields.result.find(
      (f) => f.id === id
    );
    return ontologyField.name.content;
  }
</script>

<div class="d-flex justify-content-between align-items-center mb-2">
  <div>
    {t("common.object-identifier", { fallback: "Object Identifier" })}:
    <span class="fw-bold">{data[page - 1][primaryField]}</span>
  </div>
  <BasePagination bind:page pageSize={1} count={data.length} size="sm"
  ></BasePagination>
</div>

<Table
  items={item}
  {columns}
  selectable={false}
  size="sm"
  bordered={true}
  wrap={true}
/>
