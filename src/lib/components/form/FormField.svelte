<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

    const {
        field,
        config,
        isRequired = false,
        languageCode = null,
        shouldShowError,
        formatErrors,
        activeLanguageCode = null,
        t: tProp = null,
    } = $props();

    const { t: tDefault } = getTranslationStore();
    const t = tProp || tDefault;

    const labelText = $derived(
        languageCode ? `${config.label} (${languageCode})` : config.label
    );

    const charLimit = $derived(config.charLimit ?? null);
    const rawCharCount = $derived(typeof field.state.value === 'string' ? field.state.value.length : 0);
    // Strip HTML tags so the count reflects visible/plain text only (e.g. rich text editor values)
    const charCount = $derived(
        typeof field.state.value === 'string'
            ? field.state.value.replace(/<[^>]*>/g, '').length
            : 0
    );
    const showCharCount = $derived(charLimit != null && (config.type === 'text' || config.type === 'textarea' || config.renderer));
    const maxLength = $derived(charLimit != null ? charLimit : null);
</script>

{#if config.hidden}
    <input type="hidden" name={field.name} value={field.state.value} />
{:else}
    <div class="mb-3">
        {#if config.type !== "checkbox"}
        <p class="form-label d-flex justify-content-between align-items-center" for={field.name}>
            <span>
                {labelText}
                {#if isRequired}<span class="text-danger">*</span>{/if}
            </span>
            {#if showCharCount}
                <span class="text-muted" style="font-size: 0.75rem;">{charCount}/{charLimit}</span>
            {/if}
        </p>
        {/if}

        {#if config.renderer}
            {@const Renderer = config.renderer}
            <Renderer
                bind:value={field.state.value}
                {...config.rendererProps}
                colSize={config.colSize}
                errors={field.state.meta.errors}
                {field}
                {activeLanguageCode}
                onChange={(v) => field.handleChange(v)}
                onblur={field.handleBlur}
            />
        {:else if config.type === "select"}
            <select
                id={field.name}
                name={field.name}
                class={"form-select " + (shouldShowError(field.state.meta) ? "is-invalid" : "")}
                value={field.state.value}
                onchange={(e) => field.handleChange(e.target.value)}
                onblur={field.handleBlur}
            >
                <option value="">{t("common.select", { fallback: "Select" })}</option>
                {#each config.options as opt}
                    <option value={opt.value}>{opt.label}</option>
                {/each}
            </select>
        {:else if config.type === "date"}
            <input
                id={field.name}
                name={field.name}
                type="date"
                class={"form-control " + (shouldShowError(field.state.meta) ? "is-invalid" : "")}
                value={field.state.value ? new Date(field.state.value).toISOString().split("T")[0] : ""}
                onchange={(e) => field.handleChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
                onblur={field.handleBlur}
            />
        {:else if config.type === "textarea"}
            <textarea
                id={field.name}
                name={field.name}
                class={"form-control " + (shouldShowError(field.state.meta) ? "is-invalid" : "")}
                rows="3"
                placeholder={config.placeholder}
                value={field.state.value}
                maxlength={maxLength}
                oninput={(e) => field.handleChange(e.target.value)}
                onblur={field.handleBlur}
            ></textarea>
        {:else if config.type === "checkbox"}
            <div class="form-check">
                <input
                    id={field.name}
                    name={field.name}
                    type="checkbox"
                    class="form-check-input"
                    checked={Boolean(field.state.value)}
                    onchange={(e) => field.handleChange(e.target.checked)}
                    onblur={field.handleBlur}
                />
                <label class="form-check-label" for={field.name}>{labelText}</label>
            </div>
        {:else if config.type === "number"}
            <input
                id={field.name}
                name={field.name}
                type="number"
                class={"form-control " + (shouldShowError(field.state.meta) ? "is-invalid" : "")}
                placeholder={config.placeholder}
                value={field.state.value}
                oninput={(e) => field.handleChange(e.target.value)}
                onblur={field.handleBlur}
            />
        {:else}
            <input
                id={field.name}
                name={field.name}
                type="text"
                class={"form-control " + (shouldShowError(field.state.meta) ? "is-invalid" : "")}
                placeholder={config.placeholder}
                value={field.state.value}
                maxlength={maxLength}
                oninput={(e) => field.handleChange(e.target.value)}
                onblur={field.handleBlur}
            />
        {/if}

        {#if shouldShowError(field.state.meta)}
            <div class="invalid-feedback">
                {formatErrors(field.state.meta.errors)}
            </div>
        {/if}
    </div>
{/if}
