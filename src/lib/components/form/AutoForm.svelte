<script>
    import { tick } from "svelte";
    import { watch } from "runed";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { API_SECTIONS } from "$lib/queries/index.js";
    import { createDirtyTracker } from "$lib/stores/DirtyTracker.svelte.js";
    import DirtyNavigationGuard from "$lib/components/navigation/DirtyNavigationGuard.svelte";
    import LanguageSelector from "./LanguageSelector.svelte";
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
        enableDirtyTracking = true,
        dirtyTrackingMessage = null,
    } = $props();

    const { t } = getTranslationStore();

    // Dirty tracking setup
    const formStore = $derived(form?.useStore ? form.useStore((state) => state) : null);
    
    let dirtyTracker = $state(null);
    let trackerInitialized = $state(false);
    let hydrationPristineScheduled = $state(false);

    const scheduleHydrationPristineSync = () => {
        if (hydrationPristineScheduled) return;
        hydrationPristineScheduled = true;
        Promise.resolve().then(async () => {
            await tick();
            hydrationPristineScheduled = false;
            if (!trackerInitialized || !dirtyTracker) return;
            const stabilizedValues = formStore?.current?.values;
            if (stabilizedValues) {
                dirtyTracker.setPristine(stabilizedValues);
            }
        });
    };

    let lastFormRef = $state(null);

    $effect(() => {
        if (form === lastFormRef) return;
        lastFormRef = form;
        dirtyTracker = null;
        trackerInitialized = false;
        hydrationPristineScheduled = false;
    });

    // Initialize tracker once form values are available
    watch(
        () => formStore?.current?.values,
        (newValues) => {
            const formState = formStore?.current;
            if (!trackerInitialized && newValues && enableDirtyTracking) {
                dirtyTracker = createDirtyTracker({ initialData: newValues });
                trackerInitialized = true;
                scheduleHydrationPristineSync();
            } else if (dirtyTracker && newValues) {
                dirtyTracker.update(newValues);
                if (formState?.isDirty === false) {
                    dirtyTracker.setPristine(newValues);
                }
            }
        }
    );

    // Mark pristine after successful submission
    watch(
        () => formStore?.current?.isSubmitSuccessful,
        (isSuccessful) => {
            if (isSuccessful && dirtyTracker) {
                dirtyTracker.markPristine();
            }
        }
    );

    // Keep tracker baseline in sync when form reports pristine
    watch(
        () => formStore?.current?.isDirty,
        (isFormDirty) => {
            if (isFormDirty === false && trackerInitialized && dirtyTracker) {
                const latestValues = formStore?.current?.values;
                if (latestValues) {
                    dirtyTracker.setPristine(latestValues);
                }
            }
        }
    );

    // Languages
    const defaultLanguage = $derived(languages?.find((l) => l.is_default) || languages?.[0] || null);
    const secondaryLanguages = $derived(languages?.filter((l) => !l.is_default) || []);

    // Active language state
    let activeLanguageCode = $state("default");

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
    const formSubmitted = $derived(Boolean(formStore?.current?.isSubmitted || formStore?.current?.submitCount > 0));

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

    const getCurrentFormValue = (fieldName) => formStore?.current?.values?.[fieldName];

    let lastHiddenStatic = $state({});
    let lastHiddenProvided = $state({});

    $effect(() => {
        const setter = form?.setFieldValue || form?.setValue;
        if (!setter) return;
        let mutated = false;
        Object.entries(hiddenStaticValues || {}).forEach(([name, value]) => {
            const currentValue = getCurrentFormValue(name);
            const hasValueChanged = !valuesEqual(value, lastHiddenStatic[name]);
            const differsFromForm = !valuesEqual(value, currentValue);
            if (differsFromForm) {
                try {
                    setter(name, value);
                    mutated = true;
                } catch {}
            }
            if (hasValueChanged || differsFromForm) {
                lastHiddenStatic[name] = value;
            }
        });
        if (mutated) scheduleHydrationPristineSync();
    });

    $effect(() => {
        const setter = form?.setFieldValue || form?.setValue;
        if (!setter) return;
        let mutated = false;
        Object.entries(hiddenValueProviders || {}).forEach(([name, provide]) => {
            try {
                const next = typeof provide === "function" ? provide() : undefined;
                if (next === undefined) return;
                const currentValue = getCurrentFormValue(name);
                const hasValueChanged = !valuesEqual(next, lastHiddenProvided[name]);
                const differsFromForm = !valuesEqual(next, currentValue);
                if (differsFromForm) {
                    setter(name, next);
                    mutated = true;
                }
                if (hasValueChanged || differsFromForm) {
                    lastHiddenProvided[name] = next;
                }
            } catch {}
        });
        if (mutated) scheduleHydrationPristineSync();
    });

    // Log form errors
    watch(
        () => formStore?.current?.errors,
        (errors) => {
            if (errors?.length > 0) {
                console.error("Form validation errors:", errors);
            }
        }
    );
</script>

{#if derivedTranslatable.length > 0 && defaultLanguage}
    <div class="m-4">
        <div class="d-flex justify-content-end mb-3">
            <LanguageSelector {languages} bind:activeLanguageCode />
        </div>

        <!-- Default language -->
        {#if activeLanguageCode === "default"}
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
        {/if}

        <!-- Secondary languages -->
        {#each secondaryLanguages as lang}
            {#if activeLanguageCode === lang.id}
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
            {/if}
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

<DirtyNavigationGuard 
    dirtyTracker={dirtyTracker} 
    enabled={enableDirtyTracking && !!dirtyTracker}
    message={dirtyTrackingMessage || t("form.unsaved-changes", { 
        fallback: "You have unsaved changes. Are you sure you want to leave without saving?" 
    })}
/>
