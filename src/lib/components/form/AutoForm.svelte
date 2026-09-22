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
        usePortal = true,
        margin = 4,
        hideLanguageSelector = false,
        activeLanguageCode = $bindable("default"),
        dirtyTracker: externalDirtyTracker = $bindable(null),
    } = $props();

    const { t } = getTranslationStore();

    // Dirty tracking setup
    const formStore = $derived(form?.useStore ? form.useStore((state) => state) : null);

    let dirtyTracker = $state(null);
    let hydrationPristineScheduled = false;
    let lastFormRef = null;
    // Values last written for each hidden field, to skip redundant form updates.
    const lastAppliedHidden = {};

    watch(() => dirtyTracker, (tracker) => { externalDirtyTracker = tracker; });

    /** Hidden fields as [name, resolveValue] pairs, from static values and providers alike. */
    const hiddenEntries = () => [
        ...Object.entries(hiddenStaticValues || {}).map(([name, value]) => [name, () => value]),
        ...Object.entries(hiddenValueProviders || {}).map(([name, provider]) => [name, typeof provider === 'function' ? provider : () => undefined]),
    ];

    /**
     * Form values merged with the hidden field values, so the dirty tracker baseline
     * includes hidden fields too. TanStack injects them into the form after creation,
     * and without this they would register as user edits.
     */
    const mergeHiddenFields = (values) => {
        if (!values || typeof values !== 'object') return values;
        const merged = { ...values };
        hiddenEntries().forEach(([name, resolveValue]) => {
            if (name in merged) return;
            const resolved = resolveValue();
            if (resolved !== undefined) merged[name] = resolved;
        });
        return merged;
    };

    /** Re-baseline the tracker once hidden values have been injected into the form. */
    const scheduleHydrationPristineSync = () => {
        if (hydrationPristineScheduled) return;
        hydrationPristineScheduled = true;
        tick().then(() => {
            hydrationPristineScheduled = false;
            const values = formStore?.current?.values;
            if (dirtyTracker && values) {
                dirtyTracker.setPristine(mergeHiddenFields(values));
            }
        });
    };

    watch(
        () => form,
        (nextForm) => {
            if (nextForm === lastFormRef) return;
            lastFormRef = nextForm;
            dirtyTracker = null;
            hydrationPristineScheduled = false;
        }
    );

    // Create the tracker as soon as form values are available, then keep it in sync.
    // It is re-baselined whenever the form reports itself pristine (e.g. after a reset).
    watch(
        () => formStore?.current?.values,
        (newValues) => {
            if (!newValues) return;

            if (!dirtyTracker) {
                if (!enableDirtyTracking) return;
                dirtyTracker = createDirtyTracker({ initialData: mergeHiddenFields(newValues) });
                scheduleHydrationPristineSync();
                return;
            }

            dirtyTracker.update(newValues);
            if (formStore?.current?.isDirty === false) {
                dirtyTracker.setPristine(mergeHiddenFields(newValues));
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

    // Keep the baseline in sync when the form reports itself pristine
    watch(
        () => formStore?.current?.isDirty,
        (isFormDirty) => {
            if (isFormDirty === false && dirtyTracker) {
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
            charLimit: base.charLimit ?? null,
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

    // Errors surface only once the field was touched or a submit was attempted.
    const formSubmitted = $derived(Boolean(formStore?.current?.isSubmitted));

    const shouldShowError = (meta) =>
        (meta?.errors?.length ?? 0) > 0 && (meta.isTouched || formSubmitted);

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

    const marginClass = $derived(`m-${Math.min(Math.max(Number(margin) || 0, 0), 5)}`);

    const clampColSize = (size) => Math.min(Math.max(size, 1), 12);
    const syncHiddenValues = (entries) => {
        if (!form || entries.length === 0) return false;

        let mutated = false;

        entries.forEach(([name, resolveValue]) => {
            try {
                const nextValue = resolveValue();
                if (nextValue === undefined) return;

                const currentValue = formStore?.current?.values?.[name];
                const hasValueChanged = !valuesEqual(nextValue, lastAppliedHidden[name]);
                const differsFromForm = !valuesEqual(nextValue, currentValue);

                if (differsFromForm) {
                    form.setFieldValue(name, nextValue, { dontValidate: true, dontUpdateMeta: true });
                    mutated = true;
                }

                if (hasValueChanged || differsFromForm) {
                    lastAppliedHidden[name] = nextValue;
                }
            } catch {}
        });

        return mutated;
    };

    watch(
        [
            () => form,
            () => formStore?.current?.values,
            () => hiddenStaticValues,
            () => hiddenValueProviders,
        ],
        () => {
            if (syncHiddenValues(hiddenEntries())) scheduleHydrationPristineSync();
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

{#snippet renderField({ name, config, validatorSource, isRequired = false, languageCode = null })}
    <form.Field
        name={name}
        validators={validatorSource && createFieldValidator?.(name, validatorSource, form, { ...VALIDATE_ON_CHANGE_OPTIONS, maxLength: config.charLimit })}
    >
        {#snippet children(field)}
            <FormField
                {field}
                {config}
                {isRequired}
                {languageCode}
                {shouldShowError}
                {formatErrors}
                {activeLanguageCode}
                {t}
            />
        {/snippet}
    </form.Field>
{/snippet}

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
                    <div class={`col-md-${clampColSize(config.colSize)}`}>
                        {@render renderField({
                            name: fieldName,
                            config,
                            validatorSource: validator,
                            isRequired: isRequired(fieldName),
                            languageCode: defaultLanguage?.code || "default",
                        })}
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
                        <div class={`col-md-${clampColSize(config.colSize)}`}>
                            {@render renderField({
                                name: `translations_${lang.id}_${baseField}`,
                                config,
                                validatorSource: translationsValidator,
                                languageCode: lang.code,
                            })}
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
                <div class={`col-md-${clampColSize(config.colSize)}`}>
                    {@render renderField({
                        name: fieldName,
                        config,
                        validatorSource: validator,
                        isRequired: isRequired(fieldName),
                    })}
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
    enabled={enableDirtyTracking && !!dirtyTracker && !formStore?.current?.isSubmitting}
    message={t("form.unsaved-changes")}
/>
