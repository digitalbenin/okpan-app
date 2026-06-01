
class Fetcher {
    data = $state(null);
    error = $state(null);
    isLoading = $state(false);

    constructor(fetchFn) {
        this._fetchFn = fetchFn;
        this.fetch = this.fetch.bind(this);
        this.reset = this.reset.bind(this);
    }

    async fetch(variables) {
        this.isLoading = true;
        this.error = null;

        try {
            const result = await this._fetchFn(variables);
            if (!result) {
                throw new Error("No data returned from fetch function");
            }
            if (result.error) {
                throw new Error(result.error);
            }
            this.data = result;
            return result;
        } catch (err) {
            this.error = err;
            throw err;
        } finally {
            this.isLoading = false;
        }
    }

    reset() {
        this.data = null;
        this.error = null;
        this.isLoading = false;
    }
}

export function createFetcher(fetchFn) {
    return new Fetcher(fetchFn);
}
