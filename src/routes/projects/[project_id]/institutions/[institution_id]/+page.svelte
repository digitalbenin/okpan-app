<script>
  import { page } from "$app/state";
  import { queryParameters, ssp } from "sveltekit-search-params";
  import InstitutionOverview from "$lib/components/institutions/InstitutionOverview.svelte";
  import InstitutionItems from "$lib/components/institutions/InstitutionItems.svelte";

  const { data } = $props();

  const params = queryParameters({
    view: ssp.string("objects"),
    page: {
      encode: (value) => value.toString(),
      decode: (value) => (value ? parseInt(value) : null),
      defaultValue: 1,
    },
    pageSize: {
      encode: (value) => value.toString(),
      decode: (value) => (value ? parseInt(value) : null),
      defaultValue: 2,
    },
    oOrderBy: ssp.string("name"),
    oDirection: ssp.string("asc"),
    oSearch: ssp.string(undefined),
    oSearchField: {
      encode: (value) => (value === "all" ? undefined : value),
      decode: (value) => (value ? value : "all"),
      defaultValue: undefined,
    },
    oStatus: {
      encode: (value) => (value === "all" ? undefined : value),
      decode: (value) => (value ? value : "all"),
      defaultValue: undefined,
    },

    aOrderBy: ssp.string("name"),
    aDirection: ssp.string("asc"),
    aSearch: ssp.string(undefined),
    aLinked: ssp.boolean(undefined),

    sOrderBy: ssp.string("name"),
    sDirection: ssp.string("asc"),
    sSearch: ssp.string(undefined),
  });
  $inspect(data);
</script>

<InstitutionOverview institution={data.institution} />
<InstitutionItems bind:view={params.view} ...data />
