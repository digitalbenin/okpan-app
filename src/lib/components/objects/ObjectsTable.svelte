<script>
  import Table from "$lib/components/base/table/Table.svelte";
  import TableImagePreview from "$lib/components/base/table/TableImagePreview.svelte";
  import TableLink from "$lib/components/base/table/TableLink.svelte";
  import BaseBadgeStatus from "$lib/components/base/BaseBadgeStatus.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { formatDate } from "$lib/utils/dates.js";
  import { getObjectIdentifier } from "$lib/stores/ObjectsUtils.js";
  import { getObjectImageUrl } from "$lib/utils/media.js";

  let {
    items,
    params = $bindable(),
    orderBy = $bindable(),
    direction = $bindable(),
    selectedObjects = $bindable(),
    displayFields,
    displayInstitution = false,
    listQuery = "",
  } = $props();

  const { t, translationState } = getTranslationStore();

  let defaultColumns = $derived.by(() => {
    const col = [
      {
        value: "image",
        label: null,
        sortable: false,
        accessor: (value) => ({
          src: getObjectImageUrl(value, 'sm', false),
          id: value.id,
        }),
        render: (value) => ({
          component: TableImagePreview,
          props: value,
        }),
      },
      {
        value: "name",
        label: t("common.object-id", { fallback: "Object ID" }),
        sortable: true,
        accessor: (value) => {
          const text =
            (value?.name?.content && String(value.name.content).trim()) ||
            (typeof value?.name === "string" && String(value.name).trim()) ||
            getObjectIdentifier(value);
          const baseUrl = `/projects/${value.project_id}/institutions/${value.institution_id}/objects/${value.id}`;
          const url = listQuery ? `${baseUrl}${listQuery}` : baseUrl;
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

    if (displayInstitution) {
      col.splice(col.length - 1, 0, {
        value: "institution",
        label: t("common.institution", { fallback: "Institution" }),
        sortable: false,
        accessor: (value) => {
          return {
            url: `/projects/${value.project_id}/institutions/${value.institution_id}`,
            text: value.institution.name.content,
          };
        },
        render: (value) => ({
          component: TableLink,
          props: value,
        }),
      });
    }

    return col;
  });

  const optionalColumns = $derived.by(() => {
    const fields = displayFields?.result || [];
    return fields.map((field) => {
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
          label: field.name.content,
          //   sortable: true,
          accessor: (value) => {
            const research_field = (value.objectsResearchFields || []).find(
              (rf) => rf?.researchField?.id === field.value
            );
            return research_field
              ? (research_field?.vocabulary?.option?.content ?? research_field?.value ?? null)
              : null;
          },
        };
      }
    });
  });
</script>

<Table
  {items}
  columns={[...defaultColumns, ...optionalColumns]}
  bind:orderBy
  bind:direction
  bind:selected={selectedObjects}
/>
