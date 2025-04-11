import { useGraphQL } from '$lib/stores/GraphqlUtils.js';
import { API_SECTIONS } from '$lib/utils/queries.js';

/**
 * Example of using partial updates in a component
 */
export async function updateProjectTitle(projectId, newTitle) {
    const { partialUpdate } = useGraphQL();

    try {
        // Only update the title field
        const result = await partialUpdate('projects', 'update', {
            projectId,
            title: newTitle
            // No need to include description - it won't be updated
        });

        return { success: true, data: result };
    } catch (error) {
        console.error('Failed to update project title:', error);
        return { success: false, error };
    }
}

/**
 * Example of bulk updating multiple projects
 */
export async function bulkUpdateProjects(projects) {
    const { bulkUpdate } = useGraphQL();

    try {
        // Update multiple projects with different fields
        const result = await bulkUpdate('projects', 'update', projects);
        // Example projects array:
        // [
        //   { projectId: 'proj1', title: 'New Title 1' },
        //   { projectId: 'proj2', description: 'New Description 2' },
        //   { projectId: 'proj3', title: 'Title 3', description: 'Description 3' }
        // ]

        return { success: true, data: result };
    } catch (error) {
        console.error('Failed to bulk update projects:', error);
        return { success: false, error };
    }
}

/**
 * Example of using the queries with embedded counts
 */
export async function getProjectWithCounts(projectId) {
    const { executeQuery } = useGraphQL();

    try {
        // Use the getById query that includes counts
        const result = await executeQuery('projects', 'getById', {
            projectId: projectId
        });

        return { success: true, data: result };
    } catch (error) {
        console.error('Failed to get project with counts:', error);
        return { success: false, error };
    }
}

/**
 * Example of using the institutions list query with pagination
 */
export async function getInstitutionsPaginated(projectId, page = 0, pageSize = 10) {
    const { executeQuery } = useGraphQL();

    try {
        // Use the list query with pagination
        const result = await executeQuery('institutions', 'list', {
            projectId: projectId,
            page,
            pageSize,
            orderBy: 'name',
            direction: 'asc'
        });

        return {
            success: true,
            data: result.result,
            totalCount: result.count
        };
    } catch (error) {
        console.error('Failed to get institutions:', error);
        return { success: false, error };
    }
} 