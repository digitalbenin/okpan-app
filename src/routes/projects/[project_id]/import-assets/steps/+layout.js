export const load = ({ url }) => {
    const initialInstitutionId = url.searchParams.get('institution_id');

    return {
        initialInstitutionId,
    };
};