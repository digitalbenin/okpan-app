export const getAssetsPaths = async (params) => {
  let result = null;
  try {

    const response = await window.api.openFileDialog({
      isDirectory: params.isDirectory,
      multiple: !params.isDirectory,
    });


    result = response;
    // Check for GraphQL errors in the response (GraphQL can return data with errors)
    if (result && result.errors) {
      // Get the first error message or a default message
      const errorMessage =
        result.errors[0]?.message || "Reading file paths failed";
      console.error("Reading file paths errors:", result.errors);

      addToast({
        data: {
          title: "Reading file Error",
          description: `Error in reading file paths: ${errorMessage}`,
          type: "error",
        },
      });

      await logError("Reading file paths", errorMessage);

      // Create a custom error with the upload error details
      const error = new Error(errorMessage);
      error.filePathsErrors = result.errors;
      error.filePathsResult = result;

      // Throw the error to be caught by the calling function
      throw error;
    }
  } catch (error) {
    // Handle network/execution errors (different from file paths errors in the response)
    if (!error.filePathsErrors) {
      addToast({
        data: {
          title: "Error",
          description: `Failed to fetch file paths: ${error.message}`,
          type: "error",
        },
      });
      await logError("Reading file paths", error.message);
    }
    throw error;
  } finally {
    return result.filePaths;
  }
};
