<script module>
    import { Toaster } from "melt/builders";
    const toaster = new Toaster({
        closeDelay: 5000,
    });
    export const addToast = (data) => toaster.addToast(data);

    const types = {
        success: "bg-success-subtle",
        error: "bg-danger-subtle",
        warning: "bg-warning-subtle",
        info: "bg-info-subtle",
    };
</script>

<div
    {...toaster.root}
    class="position-fixed z-50 bottom-0 end-0 p-3 d-flex flex-column-reverse border-0 bg-transparent m-0"
    style="width: 500px; inset:auto;"
>
    {#each toaster.toasts as toast (toast.id)}
        <div
            {...toast.content}
            class={`position-relative d-flex flex-column align-items-start p-3 rounded shadow-sm mb-2 ${types[toast.data.type]}`}
        >
            <h5 {...toast.title}>{toast.data.title}</h5>

            <button
                {...toast.close}
                class="btn-close m-2 position-absolute top-0 end-0 outline-none"
                aria-label="dismiss alert"
            >
                <i class="bi bi-x"></i>
            </button>
            <div {...toast.description}>{toast.data.description}</div>
        </div>
    {/each}
</div>
