<script>
    import GraphQLExplorer from "$lib/components/test/GraphQlExplorer.svelte";
    import GraphqlSchemaExporter from "$lib/components/test/GraphqlSchemaExporter.svelte";
</script>

<div class="container py-4">
    <GraphqlSchemaExporter />

    <!--<div class="mb-5">
        <h2 class="text-xl font-semibold mb-3">GraphQL Test Pages</h2>
        <div class="list-group">
            <a
                href="/test/graphql/partial-updates"
                class="list-group-item list-group-item-action d-flex align-items-center"
            >
                <div>
                    <strong>Partial Updates & Bulk Operations Test</strong>
                    <p class="mb-0 text-muted">
                        Test PATCH-style partial updates and bulk operations
                        using the new GraphQL utilities
                    </p>
                </div>
                <span class="ms-auto">→</span>
            </a>
        </div>
    </div>-->

    <GraphQLExplorer />
</div>

<svelte:head>
    <title>GraphQL Utilities Test</title>
</svelte:head>

<style>
    /* Add any custom styles here if needed */
</style>
