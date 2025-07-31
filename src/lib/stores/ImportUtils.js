export const selectParseFile = async (params) => {
    let result = null;
    try {
        const response = await window.api.importStructuredData(params);
        result = response.data;
        // Check for GraphQL errors in the response (GraphQL can return data with errors)
        if (result && result.errors) {
            // Get the first error message or a default message
            const errorMessage = result.errors[0]?.message || 'Open and parsing the file failed';
            console.error('Open and parsing errors:', result.errors);

            addToast({
                data: {
                    title: "File Upload Error",
                    description: `Error in file upload: ${errorMessage}`,
                    type: "error"
                }
            });

            await logError("File Upload", errorMessage);

            // Create a custom error with the upload error details
            const error = new Error(errorMessage);
            error.uploadErrors = result.errors;
            error.uploadResult = result;

            // Throw the error to be caught by the calling function
            throw error;
        }
    } catch (error) {
        // Handle network/execution errors (different from upload errors in the response)
        if (!error.uploadErrors) {
            addToast({
                data: {
                    title: "Error",
                    description: `Failed to fetch query File Upload: ${error.message}`,
                    type: "error"
                }
            });
            await logError("File Upload", error.message);
        }
        throw error;
    } finally {
        return result;
    }
}



export const suggestFieldMappings = async (csvFieldNames, options) => {
    let result = null;
    try {
        const response = await window.api.suggestFieldMappings(csvFieldNames, options);
        result = response;
        // Check for GraphQL errors in the response (GraphQL can return data with errors)
        if (result && result.errors) {
            // Get the first error message or a default message
            const errorMessage = result.errors[0]?.message || 'Matching failed';
            console.error('Matching errors:', result.errors);

            addToast({
                data: {
                    title: "Field Mapping Error",
                    description: `Error in field mapping: ${errorMessage}`,
                    type: "error"
                }
            });

            await logError("Field Mapping", errorMessage);

            // Create a custom error with the matching error details
            const error = new Error(errorMessage);
            error.matchingErrors = result.errors;
            error.matchingResult = result;

            // Throw the error to be caught by the calling function
            throw error;
        }
    } catch (error) {
        // Handle network/execution errors (different from matching errors in the response)
        if (!error.matchingErrors) {
            addToast({
                data: {
                    title: "Error",
                    description: `Failed to fetch query Field Mapping: ${error.message}`,
                    type: "error"
                }
            });
            await logError("Field Mapping", error.message);
        }
        throw error;
    } finally {
        return result;
    }
}


