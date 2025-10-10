<script>
  import { queryParameters, ssp } from "sveltekit-search-params";
  import InstitutionOverview from "$lib/components/institutions/InstitutionOverview.svelte";
  import InstitutionItems from "$lib/components/institutions/InstitutionItems.svelte";

  const { data } = $props();
  const paramsOptions = {
    view: ssp.string("objects"),
    pageSize: {
      encode: (value) => value.toString(),
      decode: (value) => (value ? parseInt(value) : null),
      defaultValue: 25,
    },
    oPage: {
      encode: (value) => value.toString(),
      decode: (value) => (value ? parseInt(value) : null),
      defaultValue: 1,
    },
    oOrderBy: ssp.string("updated_at"),
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
    // Persist institution advanced filters in the querystring (JSON-encoded)
    oFilters: {
      encode: (value) =>
        value && Object.keys(value).length
          ? encodeURIComponent(JSON.stringify(value))
          : undefined,
      decode: (value) => {
        if (!value) return {};
        try {
          return JSON.parse(decodeURIComponent(value));
        } catch (_) {
          return {};
        }
      },
      defaultValue: {},
    },
    aPage: {
      encode: (value) => value.toString(),
      decode: (value) => (value ? parseInt(value) : null),
      defaultValue: 1,
    },
    aOrderBy: ssp.string("filename"),
    aDirection: ssp.string("asc"),
    aSearch: ssp.string(undefined),
    aLinked: {
      encode: (value) => (value === "all" ? undefined : value),
      decode: (value) => (value ? value : "all"),
      defaultValue: undefined,
    },
    sPage: {
      encode: (value) => value.toString(),
      decode: (value) => (value ? parseInt(value) : null),
      defaultValue: 1,
    },
    sOrderBy: ssp.string("name"),
    sDirection: ssp.string("asc"),
    sSearch: ssp.string(undefined),
  };
  const params = queryParameters(paramsOptions);

  const paramsBinding = $derived({ current: params }); //workaround for SvelteKit's reactivity issue with query parameters
</script>

<InstitutionOverview institution={data.institution} />
<InstitutionItems
  bind:view={params.view}
  bind:params={paramsBinding.current}
  {...data}
/>
