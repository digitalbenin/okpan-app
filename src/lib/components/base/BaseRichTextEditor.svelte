<script>
    import { Editor } from '@tiptap/core';
    import Document from '@tiptap/extension-document';
    import Paragraph from '@tiptap/extension-paragraph';
    import Text from '@tiptap/extension-text';
    import Bold from '@tiptap/extension-bold';
    import Italic from '@tiptap/extension-italic';
    import LinkExtension from '@tiptap/extension-link';
    import { watch } from 'runed';
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { IconBold, IconItalic, IconLink } from "@tabler/icons-svelte";
    import BaseModal from "$lib/components/base/BaseModal.svelte";

    let {
        value = $bindable(''),
        placeholder = '',
        maxLength = null,
        disabled = false,
        id = crypto.randomUUID(),
        label = null,
        errors = [],
        onChange = null,
        onblur = null,
    } = $props();

    const { t } = getTranslationStore();

    let element;
    let editor = $state(null);
    let suppressingUpdate = false;
    let isBoldActive = $state(false);
    let isItalicActive = $state(false);
    let isLinkActive = $state(false);

    const charCount = $derived(typeof value === 'string' ? value.replace(/<[^>]*>/g, '').length : 0);
    const showCharCount = $derived(maxLength != null);
    const hasErrors = $derived(errors && errors.length > 0);

    function refreshActiveStates(ed) {
        isBoldActive = ed.isActive('bold');
        isItalicActive = ed.isActive('italic');
        isLinkActive = ed.isActive('link');
    }

    // Initialize Tiptap editor once the DOM element is available
    watch(() => element, (el) => {
        if (!el || editor) return;

        editor = new Editor({
            element: el,
            extensions: [
                Document,
                Paragraph,
                Text,
                Bold,
                Italic,
                LinkExtension.configure({
                    openOnClick: false,
                    HTMLAttributes: {
                        class: 'text-primary text-decoration-underline'
                    }
                })
            ],
            content: value || '',
            editable: !disabled,
            // onTransaction fires on EVERY state change — including toggling marks
            onTransaction: ({ editor: ed }) => {
                refreshActiveStates(ed);
            },
            onUpdate: ({ editor: ed }) => {
                // Enforce character limit: prevent re-entry when truncating
                if (suppressingUpdate) return;

                if (maxLength != null && ed.getText().length > maxLength) {
                    suppressingUpdate = true;
                    const truncated = ed.getText().substring(0, maxLength);
                    ed.commands.setContent(truncated, false);
                    suppressingUpdate = false;
                    return;
                }

                const html = ed.getHTML();
                if (value !== html) {
                    value = html;
                    if (onChange) onChange(html);
                }
            },
            onFocus: () => {
                if (!disabled && onblur) onblur();
            }
        });

        return () => {
            if (editor) {
                editor.destroy();
                editor = null;
            }
        };
    });

    // Sync external value changes into the editor (e.g., form reset, initial load)
    watch(() => value, (newValue) => {
        if (editor && editor.getHTML() !== newValue) {
            editor.commands.setContent(newValue || '', false);
        }
    });

    // Sync disabled prop to editor
    watch(() => disabled, (isDisabled) => {
        if (editor) {
            editor.setEditable(!isDisabled);
        }
    });

    function toggleBold() {
        editor?.chain().focus().toggleBold().run();
    }

    function toggleItalic() {
        editor?.chain().focus().toggleItalic().run();
    }

    // Link modal state
    let linkModalOpen = $state(false);
    let linkLabel = $state('');
    let linkUrl = $state('');
    let linkHasSelection = $state(false);

    function openLinkModal() {
        if (!editor) return;

        if (editor.isActive('link')) {
            editor.chain().focus().unsetLink().run();
            return;
        }

        const { from, to } = editor.state.selection;
        linkHasSelection = from !== to;
        linkLabel = linkHasSelection
            ? editor.state.doc.textBetween(from, to, ' ')
            : '';
        linkUrl = '';
        linkModalOpen = true;
    }

    function applyLink() {
        if (!editor || !linkUrl.trim()) {
            linkModalOpen = false;
            return;
        }

        const url = linkUrl.trim();

        if (linkHasSelection) {
            // Text is already selected — just apply the link mark
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        } else {
            // No text selected — insert label as linked text
            const label = linkLabel.trim() || url;
            editor.chain().focus().insertContent([
                { type: 'text', text: label, marks: [{ type: 'link', attrs: { href: url } }] },
                { type: 'text', text: ' ' }
            ]).run();
        }

        linkModalOpen = false;
        linkLabel = '';
        linkUrl = '';
    }

    function handleLinkModalKeydown(e) {
        if (e.key === 'Enter' && linkUrl.trim()) {
            e.preventDefault();
            applyLink();
        }
    }
</script>

<div class="base-rich-text-editor">
    {#if label}
        <label class="form-label" for={id}>
            {label}
        </label>
    {/if}

    <div class="card {hasErrors ? 'is-invalid border-danger' : ''}">
        {#if editor}
            <div class="card-header d-flex gap-1 bg-gray-200 p-2 border-bottom">
                <button
                    type="button"
                    class="btn btn-sm {isBoldActive ? 'btn-secondary' : 'btn-outline-secondary'}"
                    onclick={toggleBold}
                    title={t('editor.bold', { fallback: 'Bold' })}
                    disabled={disabled}
                    aria-label={t('editor.bold', { fallback: 'Bold' })}
                >
                    <IconBold size={16} />
                </button>

                <button
                    type="button"
                    class="btn btn-sm {isItalicActive ? 'btn-secondary' : 'btn-outline-secondary'}"
                    onclick={toggleItalic}
                    title={t('editor.italic', { fallback: 'Italic' })}
                    disabled={disabled}
                    aria-label={t('editor.italic', { fallback: 'Italic' })}
                >
                    <IconItalic size={16} />
                </button>

                <button
                    type="button"
                    class="btn btn-sm {isLinkActive ? 'btn-secondary' : 'btn-outline-secondary'}"
                    onclick={openLinkModal}
                    title={t('editor.link', { fallback: 'Link' })}
                    disabled={disabled}
                    aria-label={t('editor.link', { fallback: 'Link' })}
                >
                    <IconLink size={16} />
                </button>
            </div>
        {/if}

        <div class="card-body p-0 position-relative">
            <div
                bind:this={element}
                class="p-3 {disabled ? 'text-muted opacity-50' : ''}"
                class:pe-none={disabled}
                style="min-height: 120px; cursor: {disabled ? 'not-allowed' : 'text'};"
                role="textbox"
                aria-multiline="true"
                aria-label={label || placeholder || t('editor.rich-text', { fallback: 'Rich text editor' })}
            ></div>

            {#if !editor}
                <div class="position-absolute top-0 start-0 p-3 text-muted" style="pointer-events: none; min-height: 120px;">
                    {placeholder || t('editor.placeholder', { fallback: 'Write here...' })}
                </div>
            {/if}
        </div>

        {#if showCharCount}
            <div class="card-footer bg-white border-top-0 d-flex justify-content-end py-1 px-3">
                <small class="text-muted">
                    {t('editor.char-count', {
                        fallback: '{count} / {limit}',
                        values: { count: charCount, limit: maxLength }
                    })}
                </small>
            </div>
        {/if}
    </div>

    {#if hasErrors}
        <div class="invalid-feedback d-block">
            {errors.join(', ')}
        </div>
    {/if}
</div>

<BaseModal bind:isOpen={linkModalOpen} size="sm">
    {#snippet header()}
        {t('editor.link', { fallback: 'Link' })}
    {/snippet}

    {#snippet body()}
        <div class="d-flex flex-column gap-3">
            <div>
                <label class="form-label">
                    {t('editor.link-label', { fallback: 'Text' })}
                </label>
                <input
                    type="text"
                    class="form-control"
                    bind:value={linkLabel}
                    disabled={linkHasSelection}
                    placeholder={t('editor.link-label-placeholder', { fallback: 'Link text' })}
                />
                {#if linkHasSelection}
                    <div class="form-text">
                        {t('editor.link-selection-hint', { fallback: 'Text is selected from the editor' })}
                    </div>
                {/if}
            </div>
            <div>
                <label class="form-label">
                    {t('editor.link-url', { fallback: 'URL' })}
                </label>
                <input
                    type="text"
                    class="form-control"
                    bind:value={linkUrl}
                    placeholder="https://..."
                    onkeydown={handleLinkModalKeydown}
                />
            </div>
        </div>
    {/snippet}

    {#snippet actions()}
        <button
            type="button"
            class="btn btn-secondary"
            onclick={() => { linkModalOpen = false; linkLabel = ''; linkUrl = ''; }}
        >
            {t('common.cancel', { fallback: 'Cancel' })}
        </button>
        <button
            type="button"
            class="btn btn-primary"
            onclick={applyLink}
            disabled={!linkUrl.trim()}
        >
            {t('common.confirm', { fallback: 'Confirm' })}
        </button>
    {/snippet}
</BaseModal>

<style>
    .base-rich-text-editor :global(.ProseMirror) {
        outline: none;
        min-height: 120px;
    }
    .base-rich-text-editor :global(.ProseMirror p) {
        margin-bottom: 0;
    }
    .base-rich-text-editor :global(.ProseMirror p + p) {
        margin-top: 0.5rem;
    }
    .base-rich-text-editor .card.is-invalid {
        border-color: var(--bs-form-invalid-border-color, #dc3545);
    }
</style>
