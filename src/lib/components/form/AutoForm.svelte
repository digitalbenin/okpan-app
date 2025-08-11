<script>
    import { Tabs } from "melt/builders";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { API_SECTIONS } from "$lib/queries/index.js";

    // Runes props: presentational, universal
    const {
        // Required in presentational mode
        form = null,
        validator = null,
        createFieldValidator = null,

        // Optional metadata to auto-derive translations when not provided
        entity = null,
        operation = null,

        // i18n
        languages = [], // [{ id, code, name, is_default }]
        translatableFields = null, // optional explicit list; if null, attempt to derive
        translationsValidator = null, // optional field-level validator generator for translation inputs

        // UI schema / configuration
        fieldOrder = [], // preferred order for non-translatable fields
        uiSchema = {}, // { [name]: { label?, placeholder?, type?, options?, hidden?, colSize?, renderer?, rendererProps? } }
        hiddenFields = [], // additional hidden field names
        defaultColSize = 12, // default bootstrap col size

        // Select options provider (legacy alias of uiSchema[name].options)
        selectOptions = {},

        // Custom renderers per field (generic, avoids special-casing). If provided in uiSchema[name].renderer, this is ignored.
        customRenderers = {}, // { [name]: SvelteComponent }
        customRendererProps = {}, // { [name]: any }

        // Structured errors for complex fields (e.g., array/object). Caller can pass the form-level errors.
        structuredErrors = [],
        setStructuredErrors = null,

        // Hidden value strategy
        // - hiddenStaticValues: static values applied to hidden fields
        // - hiddenValueProviders: functions returning values (e.g., from stores/utils), synced into the form reactively
        hiddenStaticValues = {}, // { [name]: any }
        hiddenValueProviders = {}, // { [name]: () => any }
    } = $props();

    const { t } = getTranslationStore();

    // Determine default/secondary languages
    const defaultLanguage =
        languages?.find((l) => l.is_default) || languages?.[0] || null;
    const secondaryLanguages = languages?.filter((l) => !l.is_default) || [];

    // Tabs state for multilingual UI
    let activeLanguageCode = $state("default");
    const tabs = new Tabs({
        value: "default",
        onValueChange: (value) => {
            activeLanguageCode = value;
        },
    });

    // Helper: label/placeholder/type/options/hidden/renderer resolution
    function getFieldConfig(fieldName) {
        const base = uiSchema?.[fieldName] || {};
        const options = base.options ?? selectOptions?.[fieldName] ?? [];
        return {
            label:
                base.label ??
                // fallback to translation key if available
                fieldName,
            placeholder: base.placeholder ?? "",
            type: base.type ?? inferTypeFromSchema(fieldName),
            hidden: base.hidden ?? hiddenFields.includes(fieldName),
            colSize: base.colSize ?? defaultColSize,
            renderer: base.renderer ?? customRenderers?.[fieldName] ?? null,
            rendererProps:
                base.rendererProps ?? customRendererProps?.[fieldName] ?? {},
            options,
        };
    }

    // Minimal inference to avoid strict name checks
    function inferTypeFromSchema(fieldName) {
        try {
            const shape = validator?.schema?.shape || {};
            const s = shape[fieldName];
            if (!s) return "text";

            const typeName =
                s?._def?.typeName || s?._def?.innerType?._def?.typeName;
            switch (typeName) {
                case "ZodBoolean":
                    return "checkbox";
                case "ZodNumber":
                case "ZodBigInt":
                    return "number";
                case "ZodArray":
                    return "array";
                case "ZodObject":
                    return "object";
                default:
                    return "text";
            }
        } catch (_e) {
            return "text";
        }
    }

    function isRequired(fieldName) {
        return Boolean(validator?.requiredFields?.has(fieldName));
    }

    // Derive fields from validator schema
    const schemaFields = Object.keys(validator?.schema?.shape || {});

    // Derive translatable fields if not provided
    function deriveTranslatableFields() {
        if (Array.isArray(translatableFields)) return translatableFields;
        try {
            const opDef =
                entity && operation
                    ? API_SECTIONS?.[entity]?.operations?.[operation]
                    : null;
            if (!opDef || !Array.isArray(opDef.mutations)) return [];
            const resultSet = new Set();
            for (const m of opDef.mutations) {
                const q = m?.query || "";
                // Heuristic: any variable used as content: $var, and present in current schema, is considered translatable
                const re = /content\s*:\s*\$(\w+)/g;
                let match;
                while ((match = re.exec(q))) {
                    const varName = match[1];
                    if (schemaFields.includes(varName)) {
                        resultSet.add(varName);
                    }
                }
            }
            return Array.from(resultSet);
        } catch (_e) {
            return [];
        }
    }

    const derivedTranslatable = deriveTranslatableFields();

    // Compute non-translatable visible fields in order
    const nonTranslatableCandidates = schemaFields.filter(
        (f) => !derivedTranslatable.includes(f),
    );
    const orderedFields = [
        ...fieldOrder.filter((f) => nonTranslatableCandidates.includes(f)),
        ...nonTranslatableCandidates.filter((f) => !fieldOrder.includes(f)),
    ];

    // Sync hidden values with guards to avoid loops
    function valuesEqual(a, b) {
        try {
            return JSON.stringify(a) === JSON.stringify(b);
        } catch {
            return a === b;
        }
    }

    let lastHiddenStatic = {};
    let lastHiddenProvided = {};

    $effect(() => {
        if (!form) return;
        const setter = form.setFieldValue || form.setValue || null;
        if (!setter) return;
        for (const [name, value] of Object.entries(hiddenStaticValues || {})) {
            if (!valuesEqual(value, lastHiddenStatic[name])) {
                try {
                    setter(name, value);
                    lastHiddenStatic[name] = value;
                } catch {}
            }
        }
    });

    $effect(() => {
        if (!form) return;
        const setter = form.setFieldValue || form.setValue || null;
        if (!setter) return;
        for (const [name, provide] of Object.entries(
            hiddenValueProviders || {},
        )) {
            try {
                const next =
                    typeof provide === "function" ? provide() : undefined;
                if (
                    next !== undefined &&
                    !valuesEqual(next, lastHiddenProvided[name])
                ) {
                    setter(name, next);
                    lastHiddenProvided[name] = next;
                }
            } catch {}
        }
    });
</script>

{#if derivedTranslatable.length > 0 && defaultLanguage}
    <div class="mb-4">
        <div {...tabs.triggerList} class="nav nav-tabs mb-3" role="tablist">
            <button
                {...tabs.getTrigger("default")}
                type="button"
                class={"btn btn-link rounded-0 text-decoration-none " +
                    (activeLanguageCode === "default"
                        ? "text-primary border-0 border-bottom border-primary"
                        : "text-dark")}
                role="tab"
                aria-selected={activeLanguageCode === "default"}
                data-active={activeLanguageCode === "default" ? "" : undefined}
            >
                {defaultLanguage?.name || "Default"}
            </button>
            {#each secondaryLanguages as lang}
                <button
                    {...tabs.getTrigger(lang.id)}
                    type="button"
                    class={"btn btn-link rounded-0 text-decoration-none " +
                        (activeLanguageCode === lang.id
                            ? "text-primary border-0 border-bottom border-primary"
                            : "text-dark")}
                    role="tab"
                    aria-selected={activeLanguageCode === lang.id}
                    data-active={activeLanguageCode === lang.id
                        ? ""
                        : undefined}
                >
                    {lang.name}
                </button>
            {/each}
        </div>

        <!-- Default language fields -->
        <div {...tabs.getContent("default")}>
            <div class="pt-2">
                <div class="row">
                    {#each derivedTranslatable as fieldName}
                        {#key fieldName}
                            <div
                                class={`col-md-${Math.min(Math.max(getFieldConfig(fieldName).colSize, 1), 12)}`}
                            >
                                <form.Field
                                    name={fieldName}
                                    validators={typeof createFieldValidator ===
                                    "function"
                                        ? createFieldValidator(
                                              fieldName,
                                              validator,
                                              form,
                                              setStructuredErrors,
                                              { validateOnChange: true },
                                          )
                                        : undefined}
                                >
                                    {#snippet children(field)}
                                        {#if getFieldConfig(fieldName).hidden}
                                            <input
                                                type="hidden"
                                                name={field.name}
                                                value={field.state.value}
                                            />
                                        {:else}
                                            <div class="mb-3">
                                                <p
                                                    class="form-label"
                                                    for={field.name}
                                                >
                                                    {getFieldConfig(fieldName)
                                                        .label} ({defaultLanguage?.code ||
                                                        "default"})
                                                    {#if isRequired(fieldName)}<span
                                                            class="text-danger"
                                                            >*</span
                                                        >{/if}
                                                </p>

                                                {#if getFieldConfig(fieldName).type === "textarea"}
                                                    <textarea
                                                        id={field.name}
                                                        name={field.name}
                                                        class={"form-control " +
                                                            (field.state.meta
                                                                .errors.length >
                                                            0
                                                                ? "is-invalid"
                                                                : "")}
                                                        rows="3"
                                                        placeholder={getFieldConfig(
                                                            fieldName,
                                                        ).placeholder}
                                                        value={field.state
                                                            .value}
                                                        oninput={(e) =>
                                                            field.handleChange(
                                                                e.target.value,
                                                            )}
                                                        onblur={field.handleBlur}
                                                    ></textarea>
                                                {:else if getFieldConfig(fieldName).type === "checkbox"}
                                                    <input
                                                        id={field.name}
                                                        name={field.name}
                                                        type="checkbox"
                                                        class="form-check-input"
                                                        checked={Boolean(
                                                            field.state.value,
                                                        )}
                                                        onchange={(e) =>
                                                            field.handleChange(
                                                                e.target
                                                                    .checked,
                                                            )}
                                                        onblur={field.handleBlur}
                                                    />
                                                {:else}
                                                    <input
                                                        id={field.name}
                                                        name={field.name}
                                                        type="text"
                                                        class={"form-control " +
                                                            (field.state.meta
                                                                .errors.length >
                                                            0
                                                                ? "is-invalid"
                                                                : "")}
                                                        placeholder={getFieldConfig(
                                                            fieldName,
                                                        ).placeholder}
                                                        value={field.state
                                                            .value}
                                                        oninput={(e) =>
                                                            field.handleChange(
                                                                e.target.value,
                                                            )}
                                                        onblur={field.handleBlur}
                                                    />
                                                {/if}

                                                {#if field.state.meta.errors.length > 0}
                                                    <div
                                                        class="invalid-feedback"
                                                    >
                                                        {field.state.meta.errors.join(
                                                            ", ",
                                                        )}
                                                    </div>
                                                {/if}
                                            </div>
                                        {/if}
                                    {/snippet}
                                </form.Field>
                            </div>
                        {/key}
                    {/each}
                </div>
            </div>
        </div>

        <!-- Secondary languages -->
        {#each secondaryLanguages as lang}
            <div {...tabs.getContent(lang.id)}>
                <div class="pt-2">
                    <div class="row">
                        {#each derivedTranslatable as baseField}
                            {#key `${lang.id}-${baseField}`}
                                <div
                                    class={`col-md-${Math.min(Math.max(getFieldConfig(baseField).colSize, 1), 12)}`}
                                >
                                    <form.Field
                                        name={`translations_${lang.id}_${baseField}`}
                                        validators={translationsValidator &&
                                        typeof createFieldValidator ===
                                            "function"
                                            ? createFieldValidator(
                                                  `translations_${lang.id}_${baseField}`,
                                                  translationsValidator,
                                                  form,
                                                  setStructuredErrors,
                                                  { validateOnChange: true },
                                              )
                                            : undefined}
                                    >
                                        {#snippet children(field)}
                                            {#if getFieldConfig(baseField).hidden}
                                                <input
                                                    type="hidden"
                                                    name={field.name}
                                                    value={field.state.value}
                                                />
                                            {:else}
                                                <div class="mb-3">
                                                    <p
                                                        class="form-label"
                                                        for={field.name}
                                                    >
                                                        {getFieldConfig(
                                                            baseField,
                                                        ).label} ({lang.code})
                                                    </p>

                                                    {#if getFieldConfig(baseField).type === "textarea"}
                                                        <textarea
                                                            id={field.name}
                                                            name={field.name}
                                                            class={"form-control " +
                                                                (field.state
                                                                    .meta.errors
                                                                    .length > 0
                                                                    ? "is-invalid"
                                                                    : "")}
                                                            rows="3"
                                                            placeholder={getFieldConfig(
                                                                baseField,
                                                            ).placeholder}
                                                            value={field.state
                                                                .value}
                                                            oninput={(e) =>
                                                                field.handleChange(
                                                                    e.target
                                                                        .value,
                                                                )}
                                                            onblur={field.handleBlur}
                                                        ></textarea>
                                                    {:else}
                                                        <input
                                                            id={field.name}
                                                            name={field.name}
                                                            type="text"
                                                            class={"form-control " +
                                                                (field.state
                                                                    .meta.errors
                                                                    .length > 0
                                                                    ? "is-invalid"
                                                                    : "")}
                                                            placeholder={getFieldConfig(
                                                                baseField,
                                                            ).placeholder}
                                                            value={field.state
                                                                .value}
                                                            oninput={(e) =>
                                                                field.handleChange(
                                                                    e.target
                                                                        .value,
                                                                )}
                                                            onblur={field.handleBlur}
                                                        />
                                                    {/if}

                                                    {#if field.state.meta.errors.length > 0}
                                                        <div
                                                            class="invalid-feedback"
                                                        >
                                                            {field.state.meta.errors.join(
                                                                ", ",
                                                            )}
                                                        </div>
                                                    {/if}
                                                </div>
                                            {/if}
                                        {/snippet}
                                    </form.Field>
                                </div>
                            {/key}
                        {/each}
                    </div>
                </div>
            </div>
        {/each}
    </div>
{/if}

<!-- Non-translatable fields -->
<div class="mb-4">
    <div class="row">
        {#each orderedFields as fieldName}
            {#if !getFieldConfig(fieldName).hidden && !derivedTranslatable.includes(fieldName)}
                <div
                    class={`col-md-${Math.min(Math.max(getFieldConfig(fieldName).colSize, 1), 12)}`}
                >
                    <form.Field
                        name={fieldName}
                        validators={typeof createFieldValidator === "function"
                            ? createFieldValidator(
                                  fieldName,
                                  validator,
                                  form,
                                  setStructuredErrors,
                                  { validateOnChange: true },
                              )
                            : undefined}
                    >
                        {#snippet children(field)}
                            <div class="mb-3">
                                <p class="form-label" for={field.name}>
                                    {getFieldConfig(fieldName).label}
                                    {#if isRequired(fieldName)}<span
                                            class="text-danger">*</span
                                        >{/if}
                                </p>

                                {#if getFieldConfig(fieldName).renderer}
                                    <svelte:component
                                        this={getFieldConfig(fieldName)
                                            .renderer}
                                        bind:value={field.state.value}
                                        {...getFieldConfig(fieldName)
                                            .rendererProps}
                                        errors={field.state.meta.errors}
                                        {structuredErrors}
                                        on:change={(e) =>
                                            field.handleChange(e.detail ?? e)}
                                        on:blur={field.handleBlur}
                                    />
                                {:else if getFieldConfig(fieldName).type === "select"}
                                    <select
                                        id={field.name}
                                        name={field.name}
                                        class={"form-select " +
                                            (field.state.meta.errors.length > 0
                                                ? "is-invalid"
                                                : "")}
                                        value={field.state.value}
                                        onchange={(e) =>
                                            field.handleChange(e.target.value)}
                                        onblur={field.handleBlur}
                                    >
                                        <option value=""
                                            >{t("common.select", {
                                                fallback: "Select",
                                            })}</option
                                        >
                                        {#each getFieldConfig(fieldName).options as opt}
                                            <option value={opt.value}
                                                >{opt.label}</option
                                            >
                                        {/each}
                                    </select>
                                {:else if getFieldConfig(fieldName).type === "date"}
                                    <input
                                        id={field.name}
                                        name={field.name}
                                        type="date"
                                        class={"form-control " +
                                            (field.state.meta.errors.length > 0
                                                ? "is-invalid"
                                                : "")}
                                        value={field.state.value
                                            ? new Date(field.state.value)
                                                  .toISOString()
                                                  .split("T")[0]
                                            : ""}
                                        onchange={(e) =>
                                            field.handleChange(
                                                e.target.value
                                                    ? new Date(
                                                          e.target.value,
                                                      ).toISOString()
                                                    : null,
                                            )}
                                        onblur={field.handleBlur}
                                    />
                                {:else if getFieldConfig(fieldName).type === "textarea"}
                                    <textarea
                                        id={field.name}
                                        name={field.name}
                                        class={"form-control " +
                                            (field.state.meta.errors.length > 0
                                                ? "is-invalid"
                                                : "")}
                                        rows="3"
                                        placeholder={getFieldConfig(fieldName)
                                            .placeholder}
                                        value={field.state.value}
                                        oninput={(e) =>
                                            field.handleChange(e.target.value)}
                                        onblur={field.handleBlur}
                                    ></textarea>
                                {:else if getFieldConfig(fieldName).type === "checkbox"}
                                    <input
                                        id={field.name}
                                        name={field.name}
                                        type="checkbox"
                                        class="form-check-input"
                                        checked={Boolean(field.state.value)}
                                        onchange={(e) =>
                                            field.handleChange(
                                                e.target.checked,
                                            )}
                                        onblur={field.handleBlur}
                                    />
                                {:else if getFieldConfig(fieldName).type === "number"}
                                    <input
                                        id={field.name}
                                        name={field.name}
                                        type="number"
                                        class={"form-control " +
                                            (field.state.meta.errors.length > 0
                                                ? "is-invalid"
                                                : "")}
                                        placeholder={getFieldConfig(fieldName)
                                            .placeholder}
                                        value={field.state.value}
                                        oninput={(e) =>
                                            field.handleChange(e.target.value)}
                                        onblur={field.handleBlur}
                                    />
                                {:else}
                                    <input
                                        id={field.name}
                                        name={field.name}
                                        type="text"
                                        class={"form-control " +
                                            (field.state.meta.errors.length > 0
                                                ? "is-invalid"
                                                : "")}
                                        placeholder={getFieldConfig(fieldName)
                                            .placeholder}
                                        value={field.state.value}
                                        oninput={(e) =>
                                            field.handleChange(e.target.value)}
                                        onblur={field.handleBlur}
                                    />
                                {/if}

                                {#if field.state.meta.errors.length > 0}
                                    <div class="invalid-feedback">
                                        {field.state.meta.errors.join(", ")}
                                    </div>
                                {/if}
                            </div>
                        {/snippet}
                    </form.Field>
                </div>
            {/if}
        {/each}
    </div>

    <!-- Hidden fields rendered to ensure inclusion in submit values -->
    {#each schemaFields as name}
        {#if getFieldConfig(name).hidden}
            <form.Field {name}>
                {#snippet children(field)}
                    <input
                        type="hidden"
                        name={field.name}
                        value={field.state.value}
                    />
                {/snippet}
            </form.Field>
        {/if}
    {/each}
</div>

<!-- Optional form-level error summary (presentational) -->
<form.Subscribe selector={(state) => ({ errors: state.errors })}>
    {#snippet children(formState)}
        {#if formState.errors?.length > 0}
            <div class="alert alert-danger">
                <strong
                    >{t("common.fix-errors", {
                        fallback: "Please fix the following errors:",
                    })}</strong
                >
                <ul class="mb-0 mt-1">
                    {#each formState.errors as error}
                        <li>{error}</li>
                    {/each}
                </ul>
            </div>
        {/if}
    {/snippet}
</form.Subscribe>
