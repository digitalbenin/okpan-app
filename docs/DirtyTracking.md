# Dirty Tracking System

A clean, modern dirty-tracking system for forms using Svelte 5 runes, `@opentf/obj-diff`, and `runed` utilities.

## Architecture

### Core Components

1. **`DirtyTracker.svelte.js`** - Core dirty tracking store
   - Uses `@opentf/obj-diff` for deep object/array comparison
   - Tracks pristine vs current state
   - Provides `isDirty` derived state
   - Methods: `update()`, `markPristine()`, `reset()`, `setPristine()`

2. **`DirtyNavigationGuard.svelte`** - Navigation interceptor component
   - Uses SvelteKit's `beforeNavigate` to intercept navigation
   - Shows `BaseAlertDialog` when navigating away with unsaved changes
   - Customizable title, message, and button text

3. **`AutoForm.svelte`** - Integrated form component
   - Automatically creates dirty tracker from TanStack Form state
   - Uses `watch()` from runed to observe form value changes
   - Marks pristine after successful submission
   - Renders navigation guard when enabled

## Usage

### AutoForm (Automatic)

AutoForm has dirty tracking **enabled by default**. Simply use it normally:

```svelte
<script>
  import AutoForm from "$lib/components/form/AutoForm.svelte";
  import { createForm } from "@tanstack/svelte-form";
  
  const form = createForm(() => ({
    defaultValues: { name: "", email: "" },
    onSubmit: async ({ value }) => {
      await saveData(value);
      // Tracker automatically marks pristine on successful submit
    }
  }));
</script>

<form onsubmit={form.handleSubmit}>
  <AutoForm {form} {validator} />
  <button type="submit">Save</button>
</form>
```

### Custom Configuration

```svelte
<AutoForm 
  {form} 
  {validator}
  enableDirtyTracking={true}
  dirtyTrackingMessage="Custom unsaved changes message"
/>
```

### Manual Usage (Non-AutoForm pages)

For pages not using AutoForm:

```svelte
<script>
  import { createDirtyTracker } from "$lib/stores/DirtyTracker.svelte.js";
  import DirtyNavigationGuard from "$lib/components/navigation/DirtyNavigationGuard.svelte";
  import { watch } from "runed";
  
  let entity = $state({ name: "Initial", tags: ["a", "b"] });
  
  const tracker = createDirtyTracker({ 
    initialData: entity 
  });
  
  // Watch for changes
  watch(
    () => entity,
    (newValue) => tracker.update(newValue)
  );
  
  async function save() {
    await saveToDb(entity);
    tracker.markPristine();
  }
</script>

<input bind:value={entity.name} />
<!-- ... other fields ... -->

<button onclick={save}>Save</button>

<DirtyNavigationGuard {dirtyTracker: tracker} />
```

## How It Works

### Change Detection

1. **Initial Snapshot**: When form loads, current values are captured as pristine state
2. **Deep Comparison**: On every form value change, `@opentf/obj-diff` compares pristine vs current
3. **Dirty Flag**: `isDirty` is `true` when differences exist, `false` when identical
4. **Auto-Reset**: On successful save, current state becomes new pristine baseline

### Navigation Interception

1. User modifies form → `isDirty` becomes `true`
2. User clicks link/back button → `beforeNavigate` fires
3. If dirty, navigation is cancelled and dialog shows
4. User chooses:
   - **Stay**: Dialog closes, navigation cancelled
   - **Leave**: Dialog closes, navigation proceeds via `window.location.href`

### Advantages Over Previous Implementation

- ✅ **Deep comparison**: Detects nested object/array changes
- ✅ **No manual events**: Uses reactive `watch()` instead of event handlers  
- ✅ **Revert detection**: Automatically recognizes when user undoes changes
- ✅ **Clean API**: Simple `update()`, `markPristine()`, `reset()` methods
- ✅ **Svelte 5 native**: Uses runes (`$state`, `$derived`, `watch`)
- ✅ **Zero boilerplate**: AutoForm users get it for free

## API Reference

### `createDirtyTracker(options)`

Creates a dirty tracker instance.

**Options:**
- `initialData` - Initial/pristine state of the data

**Returns:**
```typescript
{
  isDirty: boolean,           // Derived state
  pristineData: any,          // Baseline state
  currentData: any,           // Current state
  update(newData): void,      // Update current data
  markPristine(): void,       // Set current as new pristine
  reset(): void,              // Revert to pristine
  setPristine(data): void     // Replace pristine baseline
}
```

### `<DirtyNavigationGuard />`

**Props:**
- `dirtyTracker` - Tracker instance (required)
- `enabled = true` - Enable/disable guard
- `title = "Unsaved changes"` - Dialog title
- `message = "..."` - Dialog message
- `confirmText = "Leave without saving"` - Leave button text
- `cancelText = "Stay on page"` - Stay button text

### `<AutoForm />` (Dirty Tracking Props)

**Props:**
- `enableDirtyTracking = true` - Enable dirty tracking
- `dirtyTrackingMessage = null` - Custom unsaved changes message

## Examples

### Complex Nested Data

```svelte
<script>
  const tracker = createDirtyTracker({ 
    initialData: {
      user: { name: "John", settings: { theme: "dark" } },
      tags: ["work", "important"],
      metadata: { created: "2024-01-01" }
    }
  });
  
  // All these changes are detected:
  tracker.update({
    user: { name: "Jane", settings: { theme: "light" } }, // nested object change
    tags: ["work"], // array modification
    metadata: { created: "2024-01-01" }
  });
  
  console.log(tracker.isDirty); // true
</script>
```

### Conditional Tracking

```svelte
<AutoForm 
  {form} 
  {validator}
  enableDirtyTracking={mode === "edit"} 
/>
```

### Custom Dialog Styling

```svelte
<DirtyNavigationGuard 
  {dirtyTracker}
  title="Wait!"
  message="Your awesome changes will be lost!"
  confirmText="I don't care, leave"
  cancelText="Let me save first"
/>
```

## Migration from Old System

If you have the old `NavigationGuard.svelte.js` system:

1. Remove old imports:
   ```svelte
   - import { createNavigationGuard } from "$lib/stores/NavigationGuard.svelte.js";
   - import UnsavedChangesDialog from "$lib/components/navigation/UnsavedChangesDialog.svelte";
   ```

2. No replacement needed for AutoForm users - it's automatic!

3. For custom forms, switch to new system:
   ```svelte
   + import { createDirtyTracker } from "$lib/stores/DirtyTracker.svelte.js";
   + import DirtyNavigationGuard from "$lib/components/navigation/DirtyNavigationGuard.svelte";
   ```

## Testing

1. Edit a form field → Navigate away → Dialog appears ✓
2. Edit then revert to original → Navigate away → No dialog ✓
3. Edit and save → Navigate away → No dialog ✓
4. Edit nested object/array → Navigate away → Dialog appears ✓

## Dependencies

- `@opentf/obj-diff` - Deep object comparison
- `runed` - `watch()` utility for reactive tracking
- `@tanstack/svelte-form` - Form state management (for AutoForm)
- `bits-ui` - BaseAlertDialog component
