export function createFetcher(fetchFn) {
    let data = $state(null);
    let error = $state(null);
    let isLoading = $state(false);

    return {
        get data() { return data; },
        get error() { return error; },
        get isLoading() { return isLoading; },
        async fetch(variables) {
            isLoading = true;
            error = null;
            try {
                const result = await fetchFn(variables);
                if (!result) {
                    throw new Error("No data returned from fetch function");
                }
                if (result.error) {
                    throw new Error(result.error);
                }
                data = result;
                return result;
            } catch (err) {
                error = err;
                throw err;
            } finally {
                isLoading = false;
            }
        },
        reset() {
            data = null;
            error = null;
            isLoading = false;
        }
    };
}
