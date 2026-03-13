import { browser } from '$app/environment';
import { getResearchFieldById, fetchLinkedObjectsByVocabularyOption } from '$lib/stores/ResearchFieldsUtils.js';
import { error } from '@sveltejs/kit';

function isNotFoundError(value) {
    return /not found/i.test(String(value || ''));
}

/** @type {import('./$types').PageLoad} */
export async function load({ params, parent, url }) {
    if (!browser) return {};
    
    const { connectionId, vocabularyId } = params;
    
    // Validating project existence (loaded by parent layout)
    const parentData = await parent();

    // Linked Objects pagination (1-based in UI)
    const loPageRaw = Number(url?.searchParams?.get('loPage') ?? 1);
    const loPageSizeRaw = Number(url?.searchParams?.get('loPageSize') ?? 24);
    const linkedObjectsPage = Number.isFinite(loPageRaw) && loPageRaw > 0 ? Math.floor(loPageRaw) : 1;
    const allowedPageSizes = new Set([12, 24, 48, 96]);
    const linkedObjectsPageSize = allowedPageSizes.has(loPageSizeRaw) ? loPageSizeRaw : 24;
    
    // Fetch the research field which contains the vocabularies
    const { result: researchField, error: fetchError } = await getResearchFieldById(connectionId);
    
    if (fetchError) {
        if (isNotFoundError(fetchError)) {
            return {
                ...parentData,
                researchField: null,
                vocabulary: null,
                linkedObjects: [],
                linkedObjectsTotalCount: 0,
                linkedObjectsPage,
                linkedObjectsPageSize,
                missingEntity: 'connection'
            };
        }
        console.error("Error loading connection type:", fetchError);
        throw error(500, fetchError);
    }
    
    if (!researchField) {
        return {
            ...parentData,
            researchField: null,
            vocabulary: null,
            linkedObjects: [],
            linkedObjectsTotalCount: 0,
            linkedObjectsPage,
            linkedObjectsPageSize,
            missingEntity: 'connection'
        };
    }
    
    // Find the specific vocabulary
    const vocabulary = researchField.vocabularies?.find(v => v.id === vocabularyId);
    
    if (!vocabulary) {
        return {
            ...parentData,
            researchField,
            vocabulary: null,
            linkedObjects: [],
            linkedObjectsTotalCount: 0,
            linkedObjectsPage,
            linkedObjectsPageSize,
            missingEntity: 'connection'
        };
    }

    // Fetch objects linked to this vocabulary option
    let linkedObjects = [];
    let linkedObjectsTotalCount = 0;
    try {
        const linkedRes = await fetchLinkedObjectsByVocabularyOption({
            projectId: parentData?.project?.id,
            fieldId: connectionId,
            vocabularyId,
            page: linkedObjectsPage,
            pageSize: linkedObjectsPageSize,
        });

        linkedObjects = linkedRes?.items || [];
        linkedObjectsTotalCount = linkedRes?.totalCount || 0;
    } catch (e) {
        console.error('Error loading linked objects:', e);
    }
    
    return {
        ...parentData,
        researchField,
        vocabulary,
        linkedObjects,
        linkedObjectsTotalCount,
        linkedObjectsPage,
        linkedObjectsPageSize
    };
}
