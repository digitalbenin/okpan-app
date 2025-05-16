<script>
    import { page as pageData } from "$app/state";

    // Define props using $props() rune
    let {
        paths = [], // Additional path segments: [{label: 'Path Label', href: '/optional/custom/url'}]
        current = "", // Current page name (last item, not clickable)
        projectHidden = false, // Option to hide the project home link (for project homepage itself)
    } = $props();

    // Get project context
    const projectId = $derived(pageData.data.project.id);
    // Construct the base project URL
    const projectUrl = `/projects/${projectId}`;
</script>

<nav aria-label="breadcrumb">
    <ol class="breadcrumb">
        {#if !projectHidden}
            <li class="breadcrumb-item">
                <a href={projectUrl} class="text-decoration-none">
                    Project Home
                </a>
            </li>
        {/if}

        {#each paths as path}
            <li class="breadcrumb-item">
                <a
                    href={path.href || `${projectUrl}/${path.path || ""}`}
                    class="text-decoration-none"
                >
                    {path.label}
                </a>
            </li>
        {/each}

        {#if current}
            <li class="breadcrumb-item active" aria-current="page">
                {current}
            </li>
        {/if}
    </ol>
</nav>
