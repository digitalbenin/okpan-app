<script>
    import { Tabs } from "melt/builders";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { API_SECTIONS } from "$lib/queries/index.js";
    import FormField from "./FormField.svelte";

    const {
        form = null,
        validator = null,
        createFieldValidator = null,
        entity = null,
        operation = null,
        languages = [],
        translatableFields = null,
        translationsValidator = null,
        fieldOrder = [],
        uiSchema = {},
        hiddenFields = [],
        defaultColSize = 12,
        structuredErrors = [],
        setStructuredErrors = null,
        hiddenStaticValues = {},
        hiddenValueProviders = {},
    } = $props();

    const { t } = getTranslationStore();

    // Languages
    const defaultLanguage = $derived(languages?.find((l) => l.is_default) || languages?.[0] || null);
    const secondaryLanguages = $derived(languages?.filter((l) => !l.is_default) || []);

    // Tabs state
    let activeLanguageCode = $state("default");
    const tabs = new Tabs({
        value: "default",
        onValueChange: (value) => (activeLanguageCode = value),
    });

    // Helpers
    const getFieldConfig = (fieldName) => {
        const base = uiSchema?.[fieldName] || {};
        return {
            label: base.label ?? fieldName,
            placeholder: base.placeholder ?? "",
            type: base.type ?? inferTypeFromSchema(fieldName),
            hidden: base.hidden ?? hiddenFields.includes(fieldName),
            colSize: base.colSize ?? defaultColSize,
            renderer: base.renderer ?? null,
            rendererProps: base.rendererProps ?? {},
            options: base.options ?? [],
        };
    };

    const inferTypeFromSchema = (fieldName) => {
        try {
            const shape = validator?.schema?.shape || {};
            const s = shape[fieldName];
            if (!s) return "text";
            const typeName = s?._def?.typeName || s?._def?.innerType?._def?.typeName;
            const typeMap = {
                ZodBoolean: "checkbox",
                ZodNumber: "number",
                ZodBigInt: "number",
                ZodArray: "array",
                ZodObject: "object",
            };
            return typeMap[typeName] || "text";
        } catch {
            return "text";
        }
    };

    const isRequired = (fieldName) => Boolean(validator?.requiredFields?.has(fieldName));

    // Form submission tracking
    let formSubmitted = $state(false);
    $effect(() => {
        if (!form?.subscribe) return;
        const unsubscribe = form.subscribe((state) => {
            formSubmitted = Boolean(state?.isSubmitted || state?.submitCount > 0);
        });
        return () => unsubscribe?.();
    });

    const shouldShowError = (meta) => 
        meta && Array.isArray(meta.errors) && meta.errors.length > 0 && (meta.touched || meta.isTouched || formSubmitted);

    const formatErrors = (errors) => {
        if (!Array.isArray(errors)) return "";
        return errors
            .map((err) => typeof err === "string" ? err : (err?.message ?? (typeof err === "object" ? JSON.stringify(err) : String(err))))
            .filter(Boolean)
            .join(", ");
    };

    // Derive fields
    const schemaFields = $derived(Object.keys(validator?.schema?.shape || {}));

    const deriveTranslatableFields = () => {
        if (Array.isArray(translatableFields)) return translatableFields;
        try {
            const opDef = entity && operation ? API_SECTIONS?.[entity]?.operations?.[operation] : null;
            if (!opDef?.mutations) return [];
            const resultSet = new Set();
            const re = /content\s*:\s*\$(\w+)/g;
            opDef.mutations.forEach((m) => {
                let match;
                while ((match = re.exec(m?.query || ""))) {
                    if (schemaFields.includes(match[1])) resultSet.add(match[1]);
                }
            });
            return Array.from(resultSet);
        } catch {
            return [];
        }
    };

    const derivedTranslatable = $derived(deriveTranslatableFields());

    const orderedFields = $derived.by(() => {
        const nonTranslatable = schemaFields.filter((f) => !derivedTranslatable.includes(f));
        const ordered = [];
        // Honor fieldOrder
        fieldOrder?.forEach((f) => {
            if (!derivedTranslatable.includes(f) && !getFieldConfig(f).hidden && !ordered.includes(f)) {
                ordered.push(f);
            }
        });
        // Add remaining schema fields
        nonTranslatable.forEach((f) => {
            if (!getFieldConfig(f).hidden && !ordered.includes(f)) ordered.push(f);
        });
        // Add uiSchema-only fields
        Object.keys(uiSchema || {}).forEach((f) => {
            if (!derivedTranslatable.includes(f) && !getFieldConfig(f).hidden && !ordered.includes(f)) {
                ordered.push(f);
            }
        });
        return ordered;
    });

    // Hidden values sync
    const valuesEqual = (a, b) => {
        try {
            return JSON.stringify(a) === JSON.stringify(b);
        } catch {
            return a === b;
        }
    };

    let lastHiddenStatic = $state({});
    let lastHiddenProvided = $state({});

    $effect(() => {
        const setter = form?.setFieldValue || form?.setValue;
        if (!setter) return;
        Object.entries(hiddenStaticValues || {}).forEach(([name, value]) => {
            if (!valuesEqual(value, lastHiddenStatic[name])) {
                try {
                    setter(name, value);
                    lastHiddenStatic[name] = value;
                } catch {}
            }
        });
    });

    $effect(() => {
        const setter = form?.setFieldValue || form?.setValue;
        if (!setter) return;
        Object.entries(hiddenValueProviders || {}).forEach(([name, provide]) => {
            try {
                const next = typeof provide === "function" ? provide() : undefined;
                if (next !== undefined && !valuesEqual(next, lastHiddenProvided[name])) {
                    setter(name, next);
                    lastHiddenProvided[name] = next;
                }
            } catch {}
        });
    });

    // Log form errors
    $effect(() => {
        if (!form?.subscribe) return;
        const unsubscribe = form.subscribe((state) => {
            if (state?.errors?.length > 0) console.error("Form validation errors:", state.errors);
        });
        return () => unsubscribe?.();
    });
</script>

{#if derivedTranslatable.length > 0 && defaultLanguage}
    <div class="m-4">
        <div {...tabs.triggerList} class="nav nav-tabs mb-3" role="tablist">
            <button
                {...tabs.getTrigger("default")}
                type="button"
                class={"btn btn-link rounded-0 text-decoration-none " + (activeLanguageCode === "default" ? "text-primary border-0 border-bottom border-primary" : "text-dark")}
                role="tab"
                aria-selected={activeLanguageCode === "default"}
            >
                {defaultLanguage?.name || "Default"}
            </button>
            {#each secondaryLanguages as lang}
                <button
                    {...tabs.getTrigger(lang.id)}
                    type="button"
                    class={"btn btn-link rounded-0 text-decoration-none " + (activeLanguageCode === lang.id ? "text-primary border-0 border-bottom border-primary" : "text-dark")}
                    role="tab"
                    aria-selected={activeLanguageCode === lang.id}
                >
                    {lang.name}
                </button>
            {/each}
        </div>

        <!-- Default language -->
        <div {...tabs.getContent("default")}>
            <div class="pt-2 row">
                {#each derivedTranslatable as fieldName}
                    <div class={`col-md-${Math.min(Math.max(getFieldConfig(fieldName).colSize, 1), 12)}`}>
                        <form.Field
                            name={fieldName}
                            validators={createFieldValidator?.(fieldName, validator, form, setStructuredErrors, { validateOnChange: true })}
                        >
                            {#snippet children(field)}
                                <FormField
                                    {field}
                                    config={getFieldConfig(fieldName)}
                                    isRequired={isRequired(fieldName)}
                                    languageCode={defaultLanguage?.code || "default"}
                                    {shouldShowError}
                                    {formatErrors}
                                    {structuredErrors}
                                    {activeLanguageCode}
                                    {t}
                                />
                            {/snippet}
                        </form.Field>
                    </div>
                {/each}
            </div>
        </div>

        <!-- Secondary languages -->
        {#each secondaryLanguages as lang}
            <div {...tabs.getContent(lang.id)}>
                <div class="pt-2 row">
                    {#each derivedTranslatable as baseField}
                        <div class={`col-md-${Math.min(Math.max(getFieldConfig(baseField).colSize, 1), 12)}`}>
                            <form.Field
                                name={`translations_${lang.id}_${baseField}`}
                                validators={translationsValidator && createFieldValidator?.(`translations_${lang.id}_${baseField}`, translationsValidator, form, setStructuredErrors, { validateOnChange: true })}
                            >
                                {#snippet children(field)}
                                    <FormField
                                        {field}
                                        config={getFieldConfig(baseField)}
                                        languageCode={lang.code}
                                        {shouldShowError}
                                        {formatErrors}
                                        {structuredErrors}
                                        {activeLanguageCode}
                                        {t}
                                    />
                                {/snippet}
                            </form.Field>
                        </div>
                    {/each}
                </div>
            </div>
        {/each}
    </div>
{/if}

<!-- Non-translatable fields -->
<div class="m-4">
    <div class="row">
        {#each orderedFields as fieldName}
            {#if !getFieldConfig(fieldName).hidden && !derivedTranslatable.includes(fieldName)}
                <div class={`col-md-${Math.min(Math.max(getFieldConfig(fieldName).colSize, 1), 12)}`}>
                    <form.Field
                        name={fieldName}
                        validators={createFieldValidator?.(fieldName, validator, form, setStructuredErrors, { validateOnChange: true })}
                    >
                        {#snippet children(field)}
                            <FormField
                                {field}
                                config={getFieldConfig(fieldName)}
                                isRequired={isRequired(fieldName)}
                                {shouldShowError}
                                {formatErrors}
                                {structuredErrors}
                                {activeLanguageCode}
                                {t}
                            />
                        {/snippet}
                    </form.Field>
                </div>
            {/if}
        {/each}
    </div>

    <!-- Hidden fields -->
    {#each schemaFields as name}
        {#if getFieldConfig(name).hidden}
            <form.Field {name}>
                {#snippet children(field)}
                    <input type="hidden" name={field.name} value={field.state.value} />
                {/snippet}
            </form.Field>
        {/if}
    {/each}
</div>
