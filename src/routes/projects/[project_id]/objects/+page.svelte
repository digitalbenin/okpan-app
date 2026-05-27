<script>
  import { queryParameters, ssp } from "sveltekit-search-params";
  import ProjectObjectsView from "$lib/components/objects/ProjectObjectsView.svelte";

  const { data } = $props();

  // URL query parameter definitions — these drive server-side filtering via +page.js
  const params = queryParameters({
    viewAs: ssp.string("grid"),
    pageSize: { encode: (v) => v.toString(), decode: (v) => (v ? parseInt(v) : null), defaultValue: 25 },
    page: { encode: (v) => v.toString(), decode: (v) => (v ? parseInt(v) : null), defaultValue: 1 },
    orderBy: ssp.string("updated_at"),
    direction: ssp.string("asc"),
    search: ssp.string(undefined),
    searchField: { encode: (v) => (v === "all" ? undefined : v), decode: (v) => v || "all", defaultValue: "all" },
    status: { encode: (v) => (v === "all" ? undefined : v), decode: (v) => v || "all", defaultValue: undefined },
    filters: {
      encode: (v) => {
        try {
          if (!v || Object.keys(v).length === 0) return undefined;
          return encodeURIComponent(JSON.stringify(v));
        } catch {
          return undefined;
        }
      },
      decode: (v) => {
        try {
          return v ? JSON.parse(decodeURIComponent(v)) : {};
        } catch {
          return {};
        }
      },
      defaultValue: undefined,
    },
  });

  // Workaround for SvelteKit's reactivity issue with query parameters in child bindings
  const paramsBinding = $derived({ current: params });
</script>

<ProjectObjectsView bind:params={paramsBinding.current} {...data} />
