## AutoForm.svelte — Presentational auto-form for TanStack Svelte Form (SvelteKit 5 runes)

This document explains how to use `src/lib/components/form/AutoForm.svelte` to rapidly build validated forms with multilingual inputs, custom field renderers, and hidden field automation. Examples follow SvelteKit 5 runes syntax.

### What AutoForm does

- Renders inputs based on a validator schema (Zod) and a UI schema you provide
- Supports multilingual content via language tabs and generated translation inputs
- Integrates with `@tanstack/svelte-form` for field-level and form-level validation
- Allows custom renderers for complex fields (arrays/objects)
- Syncs hidden values into the form (static constants or reactive providers)

AutoForm is intentionally presentational. It does not submit the form. You own `createForm`, validators, `onSubmit`, and payload shaping.

---

### Quick start

Prefer the optimized helpers from `formValidationUtils.js` to cut boilerplate, enable live validation, and get safe defaults.

```js
<script>
  import { createForm } from "@tanstack/svelte-form";
  import { getValidator, createFieldValidator, getFormConfig } from "$lib/stores/formValidationUtils.js";
  import AutoForm from "$lib/components/form/AutoForm.svelte";

  // Props expected from parent route/layout
  const { languages } = $props(); // [{ id, code, name, is_default }]

  const entity = "institutions";
  const operation = "create";

  const validator = getValidator(entity, operation);
  const translationsValidator = getValidator("translations", "create");
  const translatableFields = ["name"]; // or omit to auto-derive

  const form = createForm(() => getFormConfig(entity, operation, {
    onSubmit: async ({ value }) => {
      // Collect secondary language translations
      const payload = { ...value };
      const nameTranslations = [];
      for (const lang of languages) {
        if (!lang.is_default) {
          const k = `translations_${lang.id}_name`;
          if (payload[k]?.trim()) {
            nameTranslations.push({ language_code: lang.code, content: payload[k] });
            delete payload[k];
          }
        }
      }
      console.log({ ...payload, nameTranslations });
    },
  }));
</script>

<form onsubmit={(e) => { e.preventDefault(); e.stopPropagation(); form.handleSubmit(); }}>
  <AutoForm
    {form}
    {validator}
    {createFieldValidator}
    {languages}
    entity={entity}
    operation={operation}
    {translatableFields}
    {translationsValidator}
    fieldOrder={["website"]}
    uiSchema={{
      website: { label: "Website" },
      name: { label: "Institution name", colSize: 6 },
    }}
  />
  <button type="submit" class="btn btn-success">Submit</button>
</form>
```

Notes about the optimized setup:
- `getFormConfig` provides `validators: { onChange: validator.schema }` for live validation, safe `defaultValues` based on operation analysis, and field validators.
- You can still pass your own `defaultValues` via the `options` argument if needed.

---

### Props reference

AutoForm uses runes props via `$props()`.

- `form` (required): TanStack Svelte Form instance from `createForm(() => ({ ... }))`. AutoForm uses `<form.Field name=...>` to bind each input.
- `validator` (required): Object from `getValidator(entity, operation)`, with shape `{ schema, requiredFields }`.
- `createFieldValidator` (required): Factory from `formValidationUtils.js` to attach Zod-based field validators to each `<form.Field>`; AutoForm calls it with `{ validateOnChange: true }`.

- `entity` (optional): API entity key, used with `operation` to derive translatable fields when `translatableFields` is not supplied.
- `operation` (optional): API operation key.

- `languages` (optional): Array of languages (`{ id, code, name, is_default }`). When provided and translatable fields exist, AutoForm renders language tabs.
- `translatableFields` (optional): Explicit array of base field names to render in multilingual tabs. If omitted, AutoForm attempts to derive it from `API_SECTIONS[entity].operations[operation]` by detecting variables used as `content: $var` that also exist in the current validator schema.
- `translationsValidator` (optional): Field-level validator source for translation inputs, typically `getValidator("translations", "create")`.

- `fieldOrder` (optional): Preferred order for non-translatable fields; remaining schema fields are appended afterwards. UI-only fields from `uiSchema` are included even if not present in the validator schema.
- `uiSchema` (optional): Per-field UI config. Shape:
  - `label` (string)
  - `placeholder` (string)
  - `type` ("text" | "textarea" | "checkbox" | "number" | "date" | "select" | "array" | "object"). Unknown types default to text.
  - `options` (for `select`): `[{ value, label }]`
  - `hidden` (boolean)
  - `colSize` (1..12, Bootstrap grid)
  - `renderer` (Svelte component) — for complex fields; bypasses builtin input
  - `rendererProps` (object) — forwarded to `renderer`
- `hiddenFields` (optional): Additional fields to hide besides any `uiSchema[x].hidden`.
- `defaultColSize` (optional): Default Bootstrap column size for fields (default: 12).

- `structuredErrors` (optional): Array of structured errors for complex fields (e.g., arrays/objects). Forwarded to custom renderers.
- `setStructuredErrors` (optional): Function to update structured errors; AutoForm passes it into `createFieldValidator` so nested components can show item-level errors.

- `hiddenStaticValues` (optional): Object map `{ [name]: value }`. AutoForm sets these into the form once and whenever they change (deep comparison to avoid loops).
- `hiddenValueProviders` (optional): Object map `{ [name]: () => any }`. AutoForm calls these functions reactively and sets the returned values when they change.

Notes:
- Required fields are detected from the validator’s `requiredFields` set. A red asterisk is shown in labels when required.
- Hidden fields are rendered as hidden inputs so that their values are included in form submissions.

---

### Rendering rules and built-in inputs

- Text input (default): `type="text"`
- Textarea: `type: "textarea"`
- Checkbox: `type: "checkbox"` (boolean)
- Number: `type: "number"` (string values from DOM; validate/transform with Zod or in `onSubmit`)
- Date: `type: "date"`
  - Expects ISO string in form state (e.g., `new Date().toISOString()`).
  - AutoForm renders YYYY-MM-DD in the input and converts user selection back to ISO string on change.
- Select: `type: "select"` with `options: [{ value, label }]`.
- Array/object: set a `renderer` component; see next section.

Fields derive `type` from Zod schema when possible, else default to `text`. Use `uiSchema[name].type` to override.

---

### Custom renderers (arrays/objects)

Provide a Svelte component via `uiSchema[name].renderer`. The component receives:

- `value` (bindable via `bind:value`)
- `errors` (array of strings)
- `structuredErrors` (full error array, see shape below)
- Any additional `rendererProps`

It should emit `change` with the new value, or call `onChange` prop, and emit `blur` to trigger validation when needed.

Example using the existing `DynamicArrayField`:

```js
<script>
  import DynamicArrayField from "$lib/components/base/DynamicArrayField.svelte";
  // ... create form, validator, etc.
</script>

<AutoForm
  {form}
  {validator}
  {createFieldValidator}
  entity={"institutions"}
  operation={"create"}
  uiSchema={{
    links: {
      label: "Links",
      renderer: DynamicArrayField,
      rendererProps: {
        arrayFieldName: "links",
        itemFields: [
          { name: "url", label: "URL", type: "text", colSize: 6 },
          { name: "label", label: "Label", type: "text", colSize: 6 },
        ],
        addButtonText: "Add link",
        minItems: 0,
        maxItems: 10,
        structuredErrors, // pass through from your component state
      },
    },
  }}
  {structuredErrors}
  setStructuredErrors={setStructuredErrors}
/>
```

Structured errors shape expected by `DynamicArrayField` for item-level highlighting:

```js
// Zod-style errors with path arrays
// For an array field named "links":
[
  { message: "URL is invalid", path: ["links", 1, "url"] },
  { message: "Label required", path: ["links", 1, "label"] }
]
```

`createFieldValidator` currently populates structured errors for `links`. If you add new complex array/object fields, extend that utility accordingly so errors map to the proper paths.

---

### Multilingual fields (tabs)

When both `languages` and `translatableFields` are provided (or derived), AutoForm renders tabs:

- Default language tab (label = default language name)
- One tab per secondary language

For each base field in `translatableFields`, AutoForm renders:

- Default tab: normal `<form.Field name={baseField}>`
- Each secondary tab: `<form.Field name={`translations_${lang.id}_${baseField}`}>`

Collect secondary inputs on submit by scanning keys that start with `translations_`. Map them into the API’s expected structure, then delete them from the root payload before sending.

Example collection pattern:

```js
const translations = [];
for (const lang of languages) {
  if (!lang.is_default) {
    const k = `translations_${lang.id}_name`;
    if (value[k]) translations.push({ language_code: lang.code, content: value[k] });
    delete value[k];
  }
}
```

If you omit `translatableFields`, AutoForm will try to derive them from `API_SECTIONS[entity].operations[operation]` by detecting variables used as `content: $var` in mutations that are also present in the current validator schema.

---

### Hidden values

- `hiddenStaticValues`: immediately set and kept in sync; intended for constants.
- `hiddenValueProviders`: functions called reactively to compute values (e.g., from route params or stores). AutoForm sets the new value only when it changes (deep comparison).

Hidden fields are still part of the form state and will be submitted.

Example:

```js
<AutoForm
  {form}
  {validator}
  {createFieldValidator}
  hiddenStaticValues={{ status: "in progress" }}
  hiddenValueProviders={{
    project_id: () => $page.params.project_id,
    languageId: () => defaultLanguage?.id || "",
  }}
  uiSchema={{ project_id: { hidden: true }, languageId: { hidden: true }, status: { hidden: true } }}
/> 
```

---

### Validation

Attach field-level validators by passing `createFieldValidator`. AutoForm calls it for each `<form.Field>` with `validateOnChange: true` to enable live feedback.

- Form-level validation: prefer `validators: { onChange: validator.schema }` for instant feedback. Use `onSubmit` if you only want validation on submit.
- Field-level validation: AutoForm injects `validators={createFieldValidator(name, validator, form, setStructuredErrors, { validateOnChange: true })}` for each field.
- For complex fields, ensure `createFieldValidator` updates `structuredErrors` so custom renderers can show item-level errors.

Additional helpers in `formValidationUtils.js`:

- `getFormConfig(entity, operation, options)`: returns a ready-to-use config for `createForm`, including `validators.onChange`, safe `defaultValues` derived from your API operation analysis, and `fieldValidators`.
- `getFieldValidators(entity, operation)`: returns a `{ [fieldName]: { onSubmit: fn } }` map if you need to wire field validators yourself.
- `registerCustomValidator(entity, field, { validator, required, defaultValue, transform? })`: extend/override validation for special fields (e.g., arrays, URLs). Registered defaults are used by `generateDefaultValues`.
- `generateDefaultValues(entity, analysis)`: builds defaults for operation variables; overridable per field by registering a custom validator with `defaultValue`.

---

### UI layout and ordering

- Grid: Bootstrap columns via `colSize` (1..12). Default is `defaultColSize`.
- `fieldOrder`: fields listed first; remaining non-translatable schema fields follow; `uiSchema`-only fields are also included if not hidden.
- Hidden fields from schema or `uiSchema` are rendered as `<input type="hidden">` to ensure they are included in submitted values.

---

### Selects and options

For select fields set `uiSchema[name].type = "select"` and provide `options: [{ value, label }]`.

```js
<AutoForm
  {form}
  {validator}
  {createFieldValidator}
  uiSchema={{
    institutionId: {
      type: "select",
      label: "Institution",
      options: institutions.map((i) => ({ value: i.id, label: i.name.content })),
      colSize: 6,
    },
  }}
/>
```

---

### Full example (multilingual + custom renderer + hidden values)

Production-style usage showing live validation and hidden values.

```js
<script>
  import { createForm } from "@tanstack/svelte-form";
  import { getValidator, createFieldValidator, getFormConfig } from "$lib/stores/formValidationUtils.js";
  import { page } from "$app/stores";
  import DynamicArrayField from "$lib/components/base/DynamicArrayField.svelte";
  import AutoForm from "$lib/components/form/AutoForm.svelte";

  const { data } = $props();
  const { languages } = data;
  const defaultLanguage = languages.find((l) => l.is_default) || languages[0];
  const translatableFields = ["name", "description", "country", "location"];

  const validator = getValidator("institutions", "create");
  const translationsValidator = getValidator("translations", "create");

  let structuredErrors = $state([]);
  function setStructuredErrors(errors) { structuredErrors = errors; }

  const form = createForm(() => getFormConfig("institutions", "create", {
    // You can override defaults provided by getFormConfig
    defaultValues: {
      project_id: $page.params.project_id,
      languageId: defaultLanguage?.id || "",
      status: "in progress",
      links: [{ url: "", label: "" }],
    },
    onSubmit: async ({ value }) => {
      // collect translations_*, map to API, then submit
    },
  }));
</script>

<AutoForm
  {form}
  {validator}
  {createFieldValidator}
  entity={"institutions"}
  operation={"create"}
  {languages}
  {translatableFields}
  {translationsValidator}
  fieldOrder={["website", "links"]}
  uiSchema={{
    project_id: { hidden: true },
    languageId: { hidden: true },
    status: { hidden: true },
    links: {
      label: "Links",
      renderer: DynamicArrayField,
      rendererProps: {
        arrayFieldName: "links",
        itemFields: [
          { name: "url", label: "URL", type: "text", colSize: 6 },
          { name: "label", label: "Label", type: "text", colSize: 6 },
        ],
        addButtonText: "Add Link",
        minItems: 0,
        maxItems: 10,
        structuredErrors,
      },
    },
  }}
  hiddenStaticValues={{ status: "in progress" }}
  hiddenValueProviders={{
    project_id: () => $page.params.project_id,
    languageId: () => defaultLanguage?.id || "",
  }}
  {structuredErrors}
  {setStructuredErrors}
  defaultColSize={6}
/>
```

---

### Common pitfalls and guidance

- Number inputs emit strings from the DOM. Let Zod coerce/validate, or convert in `onSubmit`.
- Date inputs expect ISO strings in form state; conversions are handled internally for the HTML input.
- If `languages` is provided but no `translatableFields` are detected/derived, the tabs area is not rendered.
- Use `fieldOrder` to place important fields first; remaining non-translatable fields are appended automatically.
- Always hide and set hidden values using `uiSchema[name].hidden` plus `hiddenStaticValues`/`hiddenValueProviders` to keep state consistent.

---

### Troubleshooting

- Nothing renders: ensure `form`, `validator`, and `createFieldValidator` are passed. Check `validator.schema.shape` contains your expected field names.
- Required indicators missing: ensure your validator exposes `requiredFields` (the helper in `formValidationUtils.js` already sets this for known entities).
- Custom renderer not updating value: either emit a `change` event with `detail` being the value, or call `onChange` prop.
- Translation fields not saved: remember to gather `translations_<languageId>_<baseField>` on submit and map them to your API’s translations input.

---

### Where validation and derivations come from

- Validation is produced by `getValidator(entity, operation)` in `src/lib/stores/formValidationUtils.js` by combining Drizzle schemas, API operation analysis, and custom field registrations. It exposes `{ schema, requiredFields }` and is cached per operation.
- `getFormConfig` builds a full TanStack config using the same analysis (`validators.onChange`, `defaultValues`, and `fieldValidators`).
- Translatable field derivation (when `translatableFields` is omitted) inspects `API_SECTIONS[entity].operations[operation]` for variables used as `content: $var` that also exist in the validator schema.

### Complete example: Research fields with vocabularies (create/edit)

This example shows a single screen using `AutoForm` for the field itself and a custom array renderer (`DynamicArrayField`) to manage vocabularies. It submits field data and a `vocabularies` array; then coordinates `addVocabulary` (supports translations on create), `updateVocabulary`, and `deleteVocabulary` calls.

```svelte
<script>
  import { createForm } from "@tanstack/svelte-form";
  import AutoForm from "$lib/components/form/AutoForm.svelte";
  import DynamicArrayField from "$lib/components/base/DynamicArrayField.svelte";
  import { page } from "$app/stores";
  import { getValidator, createFieldValidator, getFormConfig } from "$lib/stores/formValidationUtils.js";
  // Pretend to use these helpers from ResearchFieldsUtils (implementations may follow)
  import {
    createResearchField,
    updateResearchField,
    updateVocabulary,
    addVocabulary,
    deleteVocabulary
  } from "$lib/stores/ResearchFieldsUtils.js";

  const { data } = $props();
  const { languages, researchField = null } = data; // null on create
  const defaultLanguage = languages?.find(l => l.is_default) || languages?.[0];
  const isEdit = !!researchField;

  const validator = getValidator("research_fields", isEdit ? "update" : "create");
  const translationsValidator = getValidator("translations", "create");

  const defaults = isEdit ? {
    name: researchField?.name?.content || "",
    description: researchField?.description?.content || "",
    type: researchField?.type || "vocabulary",
    vocabularies: (researchField?.vocabularies || []).map(v => ({
      id: v.id,
      option: v.option?.content || "",
      description: v.description?.content || "",
      mainAsset: v.mainAsset?.id || null
    }))
  } : {
    type: "vocabulary",
    vocabularies: [{ option: "", description: "", mainAsset: null }]
  };

  const form = createForm(() => getFormConfig("research_fields", isEdit ? "update" : "create", {
    defaultValues: defaults,
    onSubmit: async ({ value }) => {
      const payload = { ...value };

      // Collect field translations
      const nameTranslations = [];
      const descriptionTranslations = [];
      for (const lang of languages || []) {
        if (!lang.is_default) {
          const nk = `translations_${lang.id}_name`;
          const dk = `translations_${lang.id}_description`;
          if (payload[nk]) nameTranslations.push({ language_code: lang.code, content: payload[nk] });
          if (payload[dk]) descriptionTranslations.push({ language_code: lang.code, content: payload[dk] });
          delete payload[nk];
          delete payload[dk];
        }
      }

      const vocabularies = Array.isArray(payload.vocabularies) ? payload.vocabularies : [];
      delete payload.vocabularies;

      // Create or update the field
      let fieldId = researchField?.id;
      if (isEdit) {
        await updateResearchField(fieldId, {
          name: payload.name,
          description: payload.description,
          type: payload.type,
          nameTranslations: nameTranslations.length ? nameTranslations : undefined,
          descriptionTranslations: descriptionTranslations.length ? descriptionTranslations : undefined
        });
      } else {
        const res = await createResearchField({
          projectId: $page.params.project_id,
          languageId: defaultLanguage?.id || "",
          name: payload.name,
          description: payload.description,
          type: payload.type,
          nameTranslations: nameTranslations.length ? nameTranslations : undefined,
          descriptionTranslations: descriptionTranslations.length ? descriptionTranslations : undefined
        });
        // Robust fallback extraction depending on util implementation
        fieldId = res?.result?.[0]?.id || res?.insertIntoResearch_fields?.[0]?.id || res?.id;
      }

      // Sync vocabularies
      for (const item of vocabularies) {
        const optionTranslations = item.optionTranslations || [];
        const descriptionTranslations = item.descriptionTranslations || [];

        if (item._delete && item.id) {
          await deleteVocabulary(item.id);
          continue;
        }

        if (!item.id) {
          await addVocabulary(fieldId, {
            languageId: defaultLanguage?.id || "",
            option: item.option || "",
            description: item.description || "",
            mainAsset: item.mainAsset || null,
            optionTranslations: optionTranslations.length ? optionTranslations : undefined,
            descriptionTranslations: descriptionTranslations.length ? descriptionTranslations : undefined
          });
        } else {
          await updateVocabulary(item.id, {
            option: item.option,
            description: item.description,
            mainAsset: item.mainAsset || null,
            optionTranslations: optionTranslations.length ? optionTranslations : undefined,
            descriptionTranslations: descriptionTranslations.length ? descriptionTranslations : undefined
          });
        }
      }
    }
  }));
</script>

<AutoForm
  {form}
  {validator}
  {createFieldValidator}
  entity={"research_fields"}
  operation={isEdit ? "update" : "create"}
  {languages}
  {translationsValidator}
  fieldOrder={["type", "vocabularies"]}
  uiSchema={{
    projectId: { hidden: true },
    languageId: { hidden: true },
    type: { label: "Type", type: "select", options: [{ value: "vocabulary", label: "Vocabulary" }] },
    name: { label: "Name", colSize: 6 },
    description: { label: "Description", type: "textarea", colSize: 6 },
    vocabularies: {
      label: "Vocabularies",
      renderer: DynamicArrayField,
      rendererProps: {
        arrayFieldName: "vocabularies",
        itemFields: [
          { name: "option", label: "Label", type: "text", colSize: 6 },
          { name: "description", label: "Description", type: "textarea", colSize: 6 },
          { name: "mainAsset", label: "Main asset ID", type: "text", colSize: 6 }
        ],
        addButtonText: "Add term",
        minItems: 0,
        maxItems: 200
      }
    }
  }}
  hiddenValueProviders={{
    projectId: () => $page.params.project_id,
    languageId: () => defaultLanguage?.id || ""
  }}
  defaultColSize={6}
/>
```

Notes

- `addVocabulary` now accepts `optionTranslations` and `descriptionTranslations` to create translations together with the term.
- For editing existing terms, continue to use `updateVocabulary` with `optionTranslations` / `descriptionTranslations`.
- If your renderer collects per-item multilingual inputs, shape them as arrays: `[{ language_code, content }]`.