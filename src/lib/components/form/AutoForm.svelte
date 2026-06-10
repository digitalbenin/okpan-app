<script>
    import { tick } from "svelte";
    import { watch } from "runed";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { createDirtyTracker } from "$lib/stores/DirtyTracker.svelte.js";
    import DirtyNavigationGuard from "$lib/components/navigation/DirtyNavigationGuard.svelte";
    import LanguageSelector from "./LanguageSelector.svelte";
    import FormField from "./FormField.svelte";

    let {
        form = null,
        validator = null,
        createFieldValidator = null,
        languages = [],
        translatableFields = null,
        translationsValidator = null,
        fieldOrder = [],
        uiSchema = {},
        hiddenFields = [],
        defaultColSize = 12,
        hiddenStaticValues = {},
        hiddenValueProviders = {},
        enableDirtyTracking = true,
        dirtyTrackingMessage = null,
        usePortal = true,
        margin = 4,
        hideLanguageSelector = false,
        activeLanguageCode = $bindable("default"),
        dirtyTracker: externalDirtyTracker = $bindable(null),
    } = $props();

    const { t } = getTranslationStore();

    // Dirty tracking setup
    const formStore = $derived(form?.useStore ? form.useStore((state) => state) : null);
    const dirtyGuardEnabled = $derived(
        enableDirtyTracking &&
        !!dirtyTracker &&
        !formStore?.current?.isSubmitting
    );
    
    let dirtyTracker = $state(null);
    let trackerInitialized = $state(false);
    let hydrationPristineScheduled = $state(false);

    watch(() => dirtyTracker, (tracker) => { externalDirtyTracker = tracker; });

    /**
     * Merge hidden field values into form values so the dirty tracker baseline
     * always includes them. This prevents false-positive dirty states when
     * TanStack injects hidden fields asynchronously after form creation.
     */
    const mergeHiddenFields = (values) => {
        if (!values || typeof values !== 'object') return values;
        const merged = { ...values };
        Object.entries(hiddenStaticValues || {}).forEach(([name, value]) => {
            if (!(name in merged)) merged[name] = value;
        });
        Object.entries(hiddenValueProviders || {}).forEach(([name, provider]) => {
            if (!(name in merged)) {
                const resolved = typeof provider === 'function' ? provider() : undefined;
                if (resolved !== undefined) merged[name] = resolved;
            }
        });
        return merged;
    };

    const scheduleHydrationPristineSync = () => {
        if (hydrationPristineScheduled) return;
        hydrationPristineScheduled = true;
        Promise.resolve().then(async () => {
            await tick();
            hydrationPristineScheduled = false;
            if (!trackerInitialized || !dirtyTracker) return;
            const stabilizedValues = formStore?.current?.values;
            if (stabilizedValues) {
                dirtyTracker.setPristine(mergeHiddenFields(stabilizedValues));
            }
        });
    };

    let lastFormRef = $state(null);

    watch(
        () => form,
        (nextForm) => {
            if (nextForm === lastFormRef) return;
            lastFormRef = nextForm;
            dirtyTracker = null;
            trackerInitialized = false;
            hydrationPristineScheduled = false;
        }
    );

    // Initialize tracker once form values are available
    watch(
        () => formStore?.current?.values,
        (newValues) => {
            const formState = formStore?.current;
            if (!trackerInitialized && newValues && enableDirtyTracking) {
                dirtyTracker = createDirtyTracker({ initialData: mergeHiddenFields(newValues) });
                trackerInitialized = true;
                scheduleHydrationPristineSync();
            } else if (dirtyTracker && newValues) {
                dirtyTracker.update(newValues);
                if (formState?.isDirty === false) {
                    dirtyTracker.setPristine(mergeHiddenFields(newValues));
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

    // Helpers
    const getFieldConfig = (fieldName) => {
        const base = uiSchema?.[fieldName] || {};
        return {
            label: base.label ?? fieldName,
            placeholder: base.placeholder ?? "",
            type: base.type ?? inferTypeFromSchema(fieldName),
            hidden: base.hidden ?? hiddenFields.includes(fieldName),
            colSize: base.colSize ?? defaultColSize,
            charLimit: base.charLimit ?? 150,
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
    const VALIDATE_ON_CHANGE_OPTIONS = { validateOnChange: true };

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

    const derivedTranslatable = $derived(Array.isArray(translatableFields) ? translatableFields : []);

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

    const marginClass = $derived(`m-${Math.min(Math.max(Number(margin) || 0, 0), 5)}`);

    let lastHiddenStatic = $state({});
    let lastHiddenProvided = $state({});

    const syncHiddenValues = (entries, lastAppliedValues, resolveValue) => {
        const setter = form?.setFieldValue || form?.setValue;
        if (!setter || entries.length === 0) return false;

        let mutated = false;

        entries.forEach(([name, source]) => {
            try {
                const nextValue = resolveValue(source);
                if (nextValue === undefined) return;

                const currentValue = getCurrentFormValue(name);
                const hasValueChanged = !valuesEqual(nextValue, lastAppliedValues[name]);
                const differsFromForm = !valuesEqual(nextValue, currentValue);

                if (differsFromForm) {
                    setter(name, nextValue);
                    mutated = true;
                }

                if (hasValueChanged || differsFromForm) {
                    lastAppliedValues[name] = nextValue;
                }
            } catch {}
        });

        return mutated;
    };

    watch(
        [() => form, () => formStore?.current?.values, () => hiddenStaticValues],
        () => {
            const mutated = syncHiddenValues(
                Object.entries(hiddenStaticValues || {}),
                lastHiddenStatic,
                (value) => value
            );
            if (mutated) scheduleHydrationPristineSync();
        },
        { immediate: true }
    );

    watch(
        [() => form, () => formStore?.current?.values, () => hiddenValueProviders],
        () => {
            const mutated = syncHiddenValues(
                Object.entries(hiddenValueProviders || {}),
                lastHiddenProvided,
                (provide) => (typeof provide === "function" ? provide() : undefined)
            );
            if (mutated) scheduleHydrationPristineSync();
        },
        { immediate: true }
    );

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
    <div class="mb-2">
        {#if !hideLanguageSelector}
        <div class="d-flex justify-content-end mb-3">
            <LanguageSelector {languages} bind:activeLanguageCode {usePortal} />
        </div>
        {/if}

        <!-- Default language -->
        {#if activeLanguageCode === "default"}
            <div class="pt-2 row">
                {#each derivedTranslatable as fieldName}
                    {@const config = getFieldConfig(fieldName)}
                    <div class={`col-md-${Math.min(Math.max(config.colSize, 1), 12)}`}>
                        <form.Field
                            name={fieldName}
                            validators={createFieldValidator?.(fieldName, validator, form, VALIDATE_ON_CHANGE_OPTIONS)}
                        >
                            {#snippet children(field)}
                                <FormField
                                    {field}
                                    {config}
                                    isRequired={isRequired(fieldName)}
                                    languageCode={defaultLanguage?.code || "default"}
                                    {shouldShowError}
                                    {formatErrors}
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
                        {@const config = getFieldConfig(baseField)}
                        <div class={`col-md-${Math.min(Math.max(config.colSize, 1), 12)}`}>
                            <form.Field
                                name={`translations_${lang.id}_${baseField}`}
                                validators={translationsValidator && createFieldValidator?.(`translations_${lang.id}_${baseField}`, translationsValidator, form, VALIDATE_ON_CHANGE_OPTIONS)}
                            >
                                {#snippet children(field)}
                                    <FormField
                                        {field}
                                        {config}
                                        languageCode={lang.code}
                                        {shouldShowError}
                                        {formatErrors}
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
<div class="{marginClass} mt-2">
    <div class="row">
        {#each orderedFields as fieldName}
            {@const config = getFieldConfig(fieldName)}
            {#if !config.hidden && !derivedTranslatable.includes(fieldName)}
                <div class={`col-md-${Math.min(Math.max(config.colSize, 1), 12)}`}>
                    <form.Field
                        name={fieldName}
                        validators={createFieldValidator?.(fieldName, validator, form, VALIDATE_ON_CHANGE_OPTIONS)}
                    >
                        {#snippet children(field)}
                            <FormField
                                {field}
                                {config}
                                isRequired={isRequired(fieldName)}
                                {shouldShowError}
                                {formatErrors}
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
    enabled={dirtyGuardEnabled}
    message={dirtyTrackingMessage || t("form.unsaved-changes")}
/>
