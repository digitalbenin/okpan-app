<script>
  import BaseDropdownMenu from "$lib/components/base/BaseDropdownMenu.svelte";

  let {
    languages = [],
    activeLanguageCode = $bindable("default"),
    class: className = "",
  } = $props();

  const defaultLanguage = $derived(
    languages?.find((l) => l.is_default) || languages?.[0] || null
  );
  
  const secondaryLanguages = $derived(
    languages?.filter((l) => !l.is_default) || []
  );

  const allLanguages = $derived([
    defaultLanguage ? { ...defaultLanguage, code: "default" } : null,
    ...secondaryLanguages,
  ].filter(Boolean));

  const currentLanguage = $derived(
    allLanguages.find((l) => 
      activeLanguageCode === "default" 
        ? l.code === "default" 
        : l.id === activeLanguageCode
    )
  );

  const dropdownItems = $derived(
    allLanguages.map((lang) => ({
      label: lang.name || lang.code,
      icon: lang.is_default ? "star-fill" : undefined,
      onClick: () => {
        activeLanguageCode = lang.code === "default" ? "default" : lang.id;
      },
    }))
  );

  let open = $state(false);
</script>

{#if allLanguages.length > 0}
  <div class="language-selector {className}">
    <BaseDropdownMenu
      bind:open
      items={dropdownItems}
      triggerClass="btn btn-sm btn-outline-secondary d-flex align-items-center gap-2"
      align="end"
      sideOffset={8}
    >
      {#snippet trigger()}
        <i class="bi bi-translate"></i>
        <span>{currentLanguage?.name || "Language"}</span>
        <i class="bi bi-chevron-down small"></i>
      {/snippet}
    </BaseDropdownMenu>
  </div>
{/if}
