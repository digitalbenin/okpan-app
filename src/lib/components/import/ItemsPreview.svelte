<script>
  import { page as pageData } from "$app/state";
  import Table from "$lib/components/base/table/Table.svelte";
  import BaseBadgeField from "$lib/components/base/BaseBadgeField.svelte";
  import BasePagination from "$lib/components/base/BasePagination.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  const { data, mapping } = $props();

  const { t } = getTranslationStore();

  let page = $state(1);

  function toDisplayValues(value) {
    if (Array.isArray(value)) {
      return value
        .flat(Infinity)
        .filter((entry) => entry !== undefined && entry !== null && String(entry).trim() !== "")
        .map((entry) => String(entry).trim());
    }

    if (value === undefined || value === null || String(value).trim() === "") {
      return [];
    }

    return [String(value).trim()];
  }

  function toHtmlValue(value) {
    const displayValues = toDisplayValues(value);
    if (!displayValues.length) {
      return `<i>${t("common.null", { fallback: "null" })}</i>`;
    }

    return displayValues.join("<br/>");
  }

  function toPrimaryLabel(value) {
    return toDisplayValues(value)[0] || "";
  }

  const columns = $derived.by(() => {
    return [
      {
        value: "institution-field",
        label: t("common.institution-field", { fallback: "Institution field" }),
        sortable: false,
      },
      {
        value: "mapped-field",
        label: t("common.mapped-field", { fallback: "Mapped field" }),
        sortable: false,
        render: (value) => ({
          component: BaseBadgeField,
          props: { label: `${value}` },
        }),
        nowrap: true,
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
      const mappedFields = (mapping || [])
        .filter((m) => m?.headerField === key)
        .map((m) => m?.mappedField)
        .filter(Boolean);

      const ontologyLabel = mappedFields.length
        ? mappedFields.map((id) => getOntologyLabel(id)).filter(Boolean).join(", ")
        : null;
      return {
        "mapped-field": ontologyLabel,
        "institution-field": key,
        value: toHtmlValue(value),
      };
    });
  });

  const primaryField = $derived.by(() => {
    return mapping.find((m) => m.primary)?.headerField || "";
  });

  function getOntologyLabel(id) {
    console.log(id, pageData?.data?.ontologyFields);
    const ontologyField = pageData.data.ontologyFields.result.find(
      (f) => f.id === id,
    );
    console.log("ontologyField", ontologyField);
    return ontologyField.name.content;
  }
</script>

<div class="d-flex justify-content-between align-items-center mb-2">
  <div>
    {t("common.object-identifier", { fallback: "Object Identifier" })}:
    <span class="fw-bold">{toPrimaryLabel(data[page - 1][primaryField])}</span>
  </div>
  <BasePagination bind:page pageSize={1} count={data.length} size="sm"
  ></BasePagination>
</div>

<Table items={item} {columns} selectable={false} bordered={false} wrap={true} />
