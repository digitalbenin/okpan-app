<script>
  import { page as pageData } from "$app/state";
  import { IconChevronLeft, IconChevronRight, IconArrowRight } from "@tabler/icons-svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  const { data, mapping } = $props();

  const { t } = getTranslationStore();

  let page = $state(1);
  const total = $derived(data.length);

  const primaryField = $derived.by(() => {
    return mapping.find((m) => m.primary)?.headerField || "";
  });

  const primaryValue = $derived(data[page - 1]?.[primaryField] ?? "");

  const item = $derived.by(() => {
    return Object.entries(data[page - 1]).map(([key, value]) => {
      const mappedFields = (mapping || [])
        .filter((m) => m?.headerField === key)
        .map((m) => m?.mappedField)
        .filter(Boolean);

      const ontologyLabel = mappedFields.length
        ? mappedFields.map((id) => getOntologyLabel(id)).filter(Boolean).join(", ")
        : null;
      let outputValue;
      if (value) {
        const splittedValue = String(value).split("|");
        if (splittedValue.length) {
          outputValue = splittedValue
            .map((v) =>
              v.trim()
                ? v.trim()
                : `<i>${t("common.null", { fallback: "null" })}</i>`,
            )
            .join("<br/>");
        } else {
          outputValue = value;
        }
      } else {
        outputValue = `<i>${t("common.null", { fallback: "null" })}</i>`;
      }
      return {
        key,
        "mapped-field": ontologyLabel,
        value: outputValue,
      };
    });
  });

  function getOntologyLabel(id) {
    const ontologyField = pageData.data.ontologyFields.find(
      (f) => f.id === id,
    );
    return ontologyField?.name?.content ?? "";
  }

  function prevPage() {
    if (page > 1) page--;
  }

  function nextPage() {
    if (page < total) page++;
  }
</script>

<div class="d-flex justify-content-between align-items-center mb-2">
  <div>
    <span class="text-body">{t("import.preview-object", { fallback: "Preview object" })} </span>
    <span class="text-body-secondary">({page}/{total})</span>
    <span class="text-body">: </span>
    <span class="fw-semibold">{primaryValue}</span>
  </div>
  <div class="d-flex border rounded-2 overflow-hidden" style="border-color: #97a0b7;">
    <button class="btn btn-sm border-0 rounded-0 px-3 py-2" style="border-right: 1px solid #97a0b7;" onclick={prevPage} disabled={page <= 1}>
      <IconChevronLeft size={16} />
    </button>
    <button class="btn btn-sm border-0 rounded-0 px-3 py-2" onclick={nextPage} disabled={page >= total}>
      <IconChevronRight size={16} />
    </button>
  </div>
</div>

<div class="border rounded-3 overflow-hidden">
  <div class="d-flex border-bottom px-3 py-2 fw-semibold text-body-secondary" style="font-size: 14px;">
    <span style="width: 272px; flex-shrink: 0;">{t("import.institution-field", { fallback: "Institution field" })}</span>
    <span style="width: 287px; flex-shrink: 0;">{t("import.mapped-field", { fallback: "Mapped field" })}</span>
    <span class="flex-fill">{t("import.value", { fallback: "Value" })}</span>
  </div>
  {#each item as row}
    <div class="d-flex border-bottom px-3 py-2">
      <span class="fw-semibold text-break" style="width: 272px; flex-shrink: 0; font-size: 16px;">{row.key}</span>
      <span style="width: 287px; flex-shrink: 0;">
        {#if row["mapped-field"]}
          <IconArrowRight size={14} class="mx-1" />
          <span class="badge rounded-1 px-2 py-1" style="background: #d5d6d0; color: #292927; font-weight: 400; font-size: 14px;">{row["mapped-field"]}</span>
        {:else}
          <span class="text-body-secondary">{t("import.not-matched", { fallback: "Not matched" })}</span>
        {/if}
      </span>
      <span class="flex-fill text-break">{@html row.value}</span>
    </div>
  {/each}
</div>
