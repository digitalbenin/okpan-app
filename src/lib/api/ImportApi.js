/**
 * @namespace frontend.api.ImportApi
 */

/**
 * Opens, parses and imports structured data from a file (CSV, Excel, JSON).
 * @memberOf frontend.api.ImportApi
 * @method
 * @param {Object} params - Import parameters including file path, format, and project context.
 * @returns {Promise.<Object>} Parsed data; throws on error.
 * @throws {Error} On parse failure or import error.
 */
export const selectParseFile = async (params) => {
  let result = null;
  try {
    const response = await window.api.importStructuredData(params);
    result = response.data;
    // Check for GraphQL errors in the response (GraphQL can return data with errors)
    if (result && result.errors) {
      // Get the first error message or a default message
      const errorMessage =
        result.errors[0]?.message || "Open and parsing the file failed";
      console.error("Open and parsing errors:", result.errors);

      addToast({
        data: {
          title: "File Upload Error",
          description: `Error in file upload: ${errorMessage}`,
          type: "error",
        },
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
          type: "error",
        },
      });
      await logError("File Upload", error.message);
    }
    throw error;
  } finally {
    return result;
  }
};

/**
 * Suggests mappings between CSV column names and known ontology fields using AI.
 * @memberOf frontend.api.ImportApi
 * @method
 * @param {Array.<string>} csvFieldNames - The CSV header column names.
 * @param {Object} options - Additional context (projectId, institutionId).
 * @returns {Promise.<Array.<Object>>} Array of suggested field mappings.
 * @throws {Error} On matching failure.
 */
export const suggestFieldMappings = async (csvFieldNames, options) => {
  let result = null;
  try {
    const response = await window.api.suggestFieldMappings(
      csvFieldNames,
      options
    );
    result = response;
    // Check for GraphQL errors in the response (GraphQL can return data with errors)
    if (result && result.errors) {
      // Get the first error message or a default message
      const errorMessage = result.errors[0]?.message || "Matching failed";
      console.error("Matching errors:", result.errors);

      addToast({
        data: {
          title: "Field Mapping Error",
          description: `Error in field mapping: ${errorMessage}`,
          type: "error",
        },
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
          type: "error",
        },
      });
      await logError("Field Mapping", error.message);
    }
    throw error;
  } finally {
    return result;
  }
};

/**
 * Opens a sheet-selection dialog for multi-sheet Excel files.
 * @memberOf frontend.api.ImportApi
 * @method
 * @param {Object} params - Options including file path and project context.
 * @returns {Promise.<{success: boolean, format: (string|undefined), multiPage: (boolean|undefined), data: (Array.<Object>|null|undefined), selectedSheet: (string|undefined), error: (string|null|undefined)}>}
 * @throws {Error} On parse failure.
 */
export const spreadSheetSelection = async (params) => {
  let result = null;
  try {
    const response = await window.api.excelSheetSelection(params);

    result = response;
    // Check for GraphQL errors in the response (GraphQL can return data with errors)
    if (result && result.errors) {
      // Get the first error message or a default message
      const errorMessage =
        result.errors[0]?.message || "Open and parsing the sheet failed";
      console.error("Open and parsing errors:", result.errors);

      addToast({
        data: {
          title: "File Upload Error",
          description: `Error in file upload: ${errorMessage}`,
          type: "error",
        },
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
          type: "error",
        },
      });
      await logError("File Upload", error.message);
    }
    throw error;
  } finally {
    return result;
  }
};

/**
 * Suggests whether an existing import template can be reused for new input headers.
 * @memberOf frontend.api.ImportApi
 * @method
 * @param {Array.<string>} inputHeaders - The input file header column names.
 * @param {string} projectId - The project ID.
 * @returns {Promise.<{success: boolean, matchingTemplates: Array.<Object>, inputHeaders: Array.<string>, projectId: string, institutionId: (string|null|undefined), totalMatches: number, error: (string|undefined)}>}
 * @throws {Error} On suggestion failure.
 */
export const suggestTemplateReuse = async (inputHeaders, projectId) => {
  let result = null;
  try {
    const response = await window.api.suggestTemplateReuse(inputHeaders, projectId);
    result = response;
    // Check for GraphQL errors in the response (GraphQL can return data with errors)
    if (result && result.errors) {
      // Get the first error message or a default message
      const errorMessage = result.errors[0]?.message || "Suggestion failed";
      console.error("Suggestion errors:", result.errors);

      addToast({
        data: {
          title: "Template Suggestion Error",
          description: `Error in template suggestion: ${errorMessage}`,
          type: "error",
        },
      });

      await logError("Template Suggestion", errorMessage);

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
          type: "error",
        },
      });
      await logError("Field Mapping", error.message);
    }
    throw error;
  } finally {
    return result;
  }
};
