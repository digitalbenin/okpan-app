<script>
  const { template, ontologyFields = [], objects = [] } = $props();

$inspect(template, "template");

  const mappings = $derived(
    Array.isArray(template?.mapping)
      ? template.mapping
          .map((entry) => {
            if (!entry) return null;
            if (typeof entry === "string") {
              try {
                return JSON.parse(entry);
              } catch (err) {
                console.warn("Failed to parse template mapping entry", err, entry);
                return null;
              }
            }
            if (typeof entry === "object") {
              return entry;
            }
            return null;
          })
          .filter(Boolean)
      : [],
  );

  function getFieldName(fieldId) {
    if (!fieldId) return "Unmapped";
    const f = (ontologyFields || []).find((o) => o?.id === fieldId);
    return f?.name?.content || "Unmapped";
  }

  function getPreviewValues(fieldId) {
    const seen = new Set();
    const values = [];
    for (const obj of objects || []) {
      const fields = obj?.objectsOntologyFields || [];
      for (const ofv of fields) {
        const id = ofv?.ontologyField?.id;
        if (id === fieldId) {
          const val = ofv?.value;
          if (val != null && !seen.has(val)) {
            seen.add(val);
            values.push(val);
            if (values.length >= 5) break;
          }
        }
      }
      if (values.length >= 5) break;
    }
    return { values, more: Math.max(0, seen.size - values.length) };
  }

  function truncateValue(val, max = 40) {
    const s = val == null ? "" : String(val);
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
  }
</script>

{#if mappings.length === 0}
  <div class="card border-0">
    <div class="card-body text-muted">No template mapping available.</div>
  </div>
{:else}
  <div class="d-flex flex-column gap-3">
    {#each mappings as m, i}
      <div class="card border-0">
        <div class="card-body">
          <div class="d-flex align-items-center justify-content-between">
            <div class="text-muted small">{i + 1} of {mappings.length}</div>
          </div>

          <p class="fw-semibold mb-2">
            {m.headerField || "(Untitled)"}
            <span class="mx-2">→</span>
            <span class="">{getFieldName(m.mappedField)}</span>
          </p>

          <hr class="my-3" />

          {#key m.mappedField}
            {@const preview = getPreviewValues(m.mappedField)}
            <div class="text-muted">
              <span class="me-2">Preview</span>
              {#if preview.values.length > 0}
                {preview.values.map((v) => truncateValue(v, 40)).join(" | ")}
                {#if preview.more > 0}
                  <span class="ms-2">other {preview.more}...</span>
                {/if}
              {:else}
                <span class="fst-italic">No values</span>
              {/if}
            </div>
          {/key}
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .card-body {
    background-color: #f2f5f7;
    border-radius: 0.5rem;
  }
</style>
