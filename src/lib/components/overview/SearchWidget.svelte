<script>
  import { resource } from "runed";
  import { Combobox } from "bits-ui";
  import { fade } from "svelte/transition";
  import { goto } from "$app/navigation";
  import { getSearch } from "$lib/stores/SearchUtils.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";

  const { t } = getTranslationStore();

  let {
    contentProps,
    portalProps,
    placeholder = t("common.search", { fallback: "Search" }),
    projectId,
    minSearchLength = 3,
    ...restProps
  } = $props();

  const types = $derived([
    {
      value: "all",
      label: t("common.all", { fallback: "All" }),
    },
    {
      value: "institutions",
      label: t("common.institutions", { fallback: "Institutions" }),
    },
    { value: "objects", label: t("common.objects", { fallback: "Objects" }) },
    { value: "assets", label: t("common.assets", { fallback: "Assets" }) },
  ]);

  // svelte-ignore state_referenced_locally
  let typesValue = $state(types[0].value);

  let searchQuery = $state("");
  let open = $state(false);

  const filteredItems = resource(
    [() => searchQuery, () => typesValue],
    async ([searchQuery, typesValue]) => {
      if (!searchQuery.trim() || searchQuery.length < minSearchLength) {
        return [];
      }
      const entityTypes = typesValue !== "all" ? [typesValue] : null;

      const response = await getSearch({
        query: searchQuery,
        projectId,
        entityTypes,
      }); // add filter by type value
      return response.items.map((d) => ({
        ...d,
        label: d.title,
        value: d.id,
      }));
    },
    {
      debounce: 300,
      lazy: true,
      initialValue: [],
    },
  );

  const icons = {
    institution: "bank2",
    object: "box",
    asset: "file-earmark",
  };

  function makeLink(item) {
    switch (item.type) {
      case "institution":
        return `/projects/${item.project_id}/institutions/${item.id}`;
      case "object":
        return `/projects/${item.project_id}/institutions/${item.institution_id}/objects/${item.id}`;
      case "asset":
        return `/projects/${item.project_id}/assets/${item.id}`;
      default:
        return "#";
    }
  }

  function handleInputFocus() {
    if (searchQuery.length) {
      open = true;
    }
  }

  function handleValueChange(value) {
    if (value) {
      const item = filteredItems.current.find((i) => i.id === value);
      if (item) {
        const link = makeLink(item);
        goto(link);
      }
    }
  }
</script>

<Combobox.Root
  type="single"
  {...restProps}
  onValueChange={handleValueChange}
  bind:open
>
  <div class="input-group">
    <span class="input-group-text bg-white">
      {#if filteredItems.loading}
        <div
          in:fade={{ delay: 300 }}
          class="spinner-border spinner-border-sm"
          role="status"
        >
          <span class="visually-hidden">Loading...</span>
        </div>
      {:else}
        <i class="bi bi-search text-muted"></i>
      {/if}
    </span>
    <Combobox.Input
      class="form-control border-start-0"
      {placeholder}
      oninput={(e) => (searchQuery = e.currentTarget.value)}
      onfocus={handleInputFocus}
    />
    <div class="input-group-text p-0 bg-white">
      <BaseSelect bind:value={typesValue} items={types} inputClass="border-0"
      ></BaseSelect>
    </div>
  </div>
  <Combobox.Portal {...portalProps}>
    <Combobox.Content {...contentProps}>
      {#snippet child({ wrapperProps, props, open })}
        {#if open}
          <div {...wrapperProps}>
            <div
              {...props}
              class="content mt-1 shadow-sm bg-white border rounded-2 z-1 p-1"
            >
              <Combobox.ScrollUpButton
                class="border-bottom d-flex justify-content-center"
              >
                <i class="bi bi-caret-up-fill"></i>
              </Combobox.ScrollUpButton>

              <Combobox.Viewport>
                {#if searchQuery.length < minSearchLength}
                  <div class="p-2 text-muted text-center">
                    Type at least 3 characters
                  </div>
                {:else if filteredItems.current.length === 0 && !filteredItems.loading}
                  <div
                    in:fade={{ delay: 300 }}
                    class="p-2 text-muted text-center"
                  >
                    No results found
                  </div>
                {:else}
                  {#each filteredItems.current as item (item.value)}
                    <Combobox.Item
                      value={item.value}
                      label={item.label}
                      disabled={item.disabled}
                    >
                      {#snippet children({ selected, highlighted })}
                        <div
                          class="d-flex align-items-start justify-content-between rounded p-1 cursor-pointer gap-2"
                          class:text-bg-light={highlighted}
                        >
                          <div class="lh-sm text-break">{item.label}</div>
                          <div class="flex-shrink-0 fs-7 text-black-50">
                            {item.type} <i class="bi bi-{icons[item.type]}"></i>
                          </div>
                        </div>
                      {/snippet}
                    </Combobox.Item>
                  {/each}
                {/if}
              </Combobox.Viewport>

              <Combobox.ScrollDownButton
                class="border-top d-flex justify-content-center"
              >
                <i class="bi bi-caret-down-fill"></i>
              </Combobox.ScrollDownButton>
            </div>
          </div>
        {/if}
      {/snippet}
    </Combobox.Content>
  </Combobox.Portal>
</Combobox.Root>

<style>
  .content {
    width: var(--bits-floating-anchor-width);
    max-height: var(--bits-floating-available-height);
  }
</style>
