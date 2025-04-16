<script>
    import { getContext } from "svelte";

    export let paths = []; // Additional path segments: [{label: 'Path Label', href: '/optional/custom/url'}]
    export let current = ""; // Current page name (last item, not clickable)
    export let projectHidden = false; // Option to hide the project home link (for project homepage itself)

    // Get project context
    const projectId = getContext("projectId");

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
