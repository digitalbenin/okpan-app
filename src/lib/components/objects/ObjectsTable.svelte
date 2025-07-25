<script>
  import Table from "$lib/components/base/table/Table.svelte";
  import TableImagePreview from "$lib/components/base/table/TableImagePreview.svelte";
  import TableLink from "$lib/components/base/table/TableLink.svelte";
  import BaseBadgeStatus from "$lib/components/base/BaseBadgeStatus.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { formatDate } from "$lib/utils/dates.js";
  import { getObjectIdentifier } from "$lib/utils/objects.js";

  let {
    items,
    params = $bindable(),
    selectedObjects = $bindable(),
    displayFields,
  } = $props();

  const { t, translationState } = getTranslationStore();

  let defaultColumns = [
    {
      value: "image",
      label: null,
      sortable: false,
      accessor: (value) => {
        const src =
          value.objectsAssets && value.objectsAssets.length > 0
            ? value.objectsAssets[0].asset.formats.sm
            : null;
        const id = value.id;
        return {
          src,
          id,
        };
      },
      render: (value) => ({
        component: TableImagePreview,
        props: value,
      }),
    },
    {
      value: "object_id",
      label: t("common.object-id", { fallback: "Object ID" }),
      sortable: false,
      accessor: (value) => {
        const text = getObjectIdentifier(value);
        const url = `/projects/${value.project_id}/institutions/${value.institution_id}/objects/${value.id}`;
        return {
          url,
          text,
        };
      },
      render: (value) => ({
        component: TableLink,
        props: value,
      }),
    },
    {
      value: "status",
      label: t("common.status", { fallback: "Status" }),
      sortable: true,
      render: (value) => ({
        component: BaseBadgeStatus,
        props: { status: value },
      }),
    },
  ];

  const optionalColumns = $derived.by(() => {
    return displayFields.result.map((field) => {
      if (field.type === "object_property") {
        return {
          value: field.value,
          label: t(`common.${field.value}`, { fallback: field.value }),
          sortable: true,
          render: (value) =>
            formatDate(+value, translationState.currentLocale, true),
        };
      } else if (field.type === "research_field") {
        return {
          value: field.value,
          label: field.name?.content,
          //   sortable: true,
          accessor: (value) => {
            const research_field = value.objectsResearchFields.find(
              (rf) => rf.researchField.id === field.value
            );
            return research_field
              ? research_field.vocabulary.option.content
              : null;
          },
        };
      }
    });
  });

  $inspect(optionalColumns);
</script>

<Table
  {items}
  columns={[...defaultColumns, ...optionalColumns]}
  bind:orderBy={params.oOrderBy}
  bind:direction={params.oDirection}
  bind:selected={selectedObjects}
/>
