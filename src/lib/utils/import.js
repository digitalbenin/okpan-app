/**
 * Creates a tree node representation for nested import preview data.
 * @param {*} value Value stored at the current node.
 * @param {string|number|null} [key=null] Key or index for the current node.
 * @param {number} [depth=0] Current nesting depth.
 * @param {Array<string|number>} [path=[]] Ancestor path segments.
 * @returns {{key: string|number|null, value: *, type: string, depth: number, path: Array<string|number>, pathString: string, expanded: boolean, isExpandable: boolean, children: Array<object>|null, size: number|null}}
 */
export function createTreeNode(value, key = null, depth = 0, path = []) {
  const type = getType(value);
  const currentPath = key !== null ? [...path, key] : path;

  return {
    key,
    value,
    type,
    depth,
    path: currentPath,
    pathString: currentPath.join("."),
    expanded: false,
    isExpandable: type === "object" || type === "array",
    children:
      type === "object" || type === "array"
        ? getChildren(value, depth + 1, currentPath)
        : null,
    size:
      type === "array"
        ? value.length
        : type === "object"
          ? Object.keys(value).length
          : null,
  };
}

function getChildren(obj, depth, path) {
  if (Array.isArray(obj)) {
    return obj.map((item, index) => createTreeNode(item, index, depth, path));
  } else if (obj && typeof obj === "object") {
    return Object.entries(obj).map(([key, value]) =>
      createTreeNode(value, key, depth, path)
    );
  }
  return [];
}

function getType(value) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "array";
  if (value instanceof Date) return "date";
  return typeof value;
}

/**
 * Analyzes the structure of imported JSON data for field mapping.
 * @param {*} jsonValue Parsed JSON root value.
 * @param {number} [maxSamples=100] Maximum number of array items to sample.
 * @returns {object} A normalized analysis tree describing the input shape.
 */
export function analyzeJsonStructure(jsonValue, maxSamples = 100) {
  if (Array.isArray(jsonValue)) {
    return walkJsonStructure(jsonValue, null, 0, [], maxSamples);
  }

  if (jsonValue && typeof jsonValue === "object") {
    return walkJsonStructure(jsonValue, null, 0, [], maxSamples);
  }

  return createNode(null, [], "array", 0, [], "", {}, 0);
}

function walkJsonStructure(
  value,
  key = null,
  depth = 0,
  path = [],
  maxSamples = 10
) {
  const type = getType(value);
  const currentPath = key !== null ? [...path, key] : path;
  const pathString = currentPath.join(".");

  // Handle arrays
  if (type === "array") {
    if (value.length === 0) {
      return createNode(
        key,
        value,
        type,
        depth,
        currentPath,
        pathString,
        [],
        0
      );
    }

    // Sample first maxSamples items to analyze structure
    const samples = value.slice(0, maxSamples);
    const firstItemType = getType(samples[0]);

    // Array of primitives - collect all unique values (up to maxSamples)
    if (isPrimitive(samples[0])) {
      const uniqueValues = [...new Set(value)].slice(0, maxSamples);
      return createNode(
        key,
        value,
        type,
        depth,
        currentPath,
        pathString,
        uniqueValues,
        value.length
      );
    }

    // Array of objects - analyze structure recursively
    if (firstItemType === "object") {
      const keyAnalysis = analyzeObjectArrayKeys(
        samples,
        depth + 1,
        currentPath,
        maxSamples
      );
      return createNode(
        key,
        value,
        type,
        depth,
        currentPath,
        pathString,
        keyAnalysis,
        value.length
      );
    }

    // Array of arrays - analyze each sub-array
    if (firstItemType === "array") {
      const arrayAnalysis = samples.map((subArray, index) =>
        walkJsonStructure(subArray, index, depth + 1, currentPath, maxSamples)
      );
      return createNode(
        key,
        value,
        type,
        depth,
        currentPath,
        pathString,
        arrayAnalysis,
        value.length
      );
    }
  }

  // Handle objects
  if (type === "object") {
    const objectAnalysis = {};

    Object.entries(value).forEach(([objKey, objValue]) => {
      objectAnalysis[objKey] = walkJsonStructure(
        objValue,
        objKey,
        depth + 1,
        currentPath,
        maxSamples
      );
    });

    return createNode(
      key,
      value,
      type,
      depth,
      currentPath,
      pathString,
      objectAnalysis,
      Object.keys(value).length
    );
  }

  // Handle primitives
  if (isPrimitive(value)) {
    return createNode(
      key,
      value,
      type,
      depth,
      currentPath,
      pathString,
      [value],
      null
    );
  }

  // Fallback
  return createNode(key, value, type, depth, currentPath, pathString, [], null);
}

function analyzeObjectArrayKeys(objectArray, depth, path, maxSamples) {
  const keyAnalysis = {};
  const allKeys = new Set();

  // Collect all unique keys from the sample objects
  objectArray.forEach((obj) => {
    if (obj && typeof obj === "object") {
      Object.keys(obj).forEach((key) => allKeys.add(key));
    }
  });

  // For each unique key, analyze its values across all sample objects
  Array.from(allKeys).forEach((keyName) => {
    const keyValues = [];
    const keyValueCounts = new Map();
    const arrayPrimitiveCounts = new Map();
    const arrayObjectKeyCounts = new Map();

    // Collect values for this key from all sample objects
    objectArray.forEach((obj) => {
      if (obj && typeof obj === "object" && obj.hasOwnProperty(keyName)) {
        const value = obj[keyName];
        const valueType = getType(value);

        // For primitives, track unique values and their frequency
        if (isPrimitive(value)) {
          const valueStr = safeStringify(value);
          keyValueCounts.set(valueStr, (keyValueCounts.get(valueStr) || 0) + 1);
        }
        // For arrays, check their content type
        else if (valueType === "array") {
          // Check if it's an empty array or array of primitives
          if (value.length === 0) {
            // Empty arrays - treat as array of primitives with no values
            // Don't add anything to arrayPrimitiveCounts, but mark as array type
          } else if (isPrimitive(value[0])) {
            // Array of primitives - collect all unique primitive values
            value.forEach((primitiveValue) => {
              const valueStr = safeStringify(primitiveValue);
              arrayPrimitiveCounts.set(
                valueStr,
                (arrayPrimitiveCounts.get(valueStr) || 0) + 1
              );
            });
          } else if (getType(value[0]) === "object") {
            // Array of objects - handle separately below
            value.forEach((arrayItem) => {
              if (arrayItem && typeof arrayItem === "object") {
                Object.entries(arrayItem).forEach(
                  ([nestedKey, nestedValue]) => {
                    const combinedKey = `${keyName}.${nestedKey}`;
                    const valueStr = safeStringify(nestedValue);
                    arrayObjectKeyCounts.set(
                      `${combinedKey}:${valueStr}`,
                      (arrayObjectKeyCounts.get(`${combinedKey}:${valueStr}`) ||
                        0) + 1
                    );
                  }
                );
              }
            });
          } else {
            // Array of other complex types - collect for later analysis
            keyValues.push(value);
          }
        }
        // For nested objects, collect them for later analysis
        else if (valueType === "object") {
          keyValues.push(value);
        }
        // For other complex types, collect them
        else {
          if (keyValues.length < maxSamples) {
            keyValues.push(value);
          }
        }
      }
    });

    // Check if this key represents arrays across all samples
    const allValuesAreArrays = objectArray.every((obj) => {
      if (!obj || typeof obj !== "object" || !obj.hasOwnProperty(keyName)) {
        return false;
      }
      return getType(obj[keyName]) === "array";
    });

    // Handle arrays of objects with key-value pairs (like metadata)
    if (arrayObjectKeyCounts.size > 0) {
      // Group by nested keys
      const nestedKeyAnalysis = {};

      arrayObjectKeyCounts.forEach((count, keyValue) => {
        const colonIndex = keyValue.indexOf(":");
        if (colonIndex === -1) return;

        const combinedKey = keyValue.substring(0, colonIndex);
        const valueStr = keyValue.substring(colonIndex + 1);

        const dotIndex = combinedKey.indexOf(".");
        if (dotIndex === -1) return;

        const nestedKey = combinedKey.substring(dotIndex + 1);

        if (!nestedKeyAnalysis[nestedKey]) {
          nestedKeyAnalysis[nestedKey] = new Map();
        }

        nestedKeyAnalysis[nestedKey].set(valueStr, count);
      });

      // Convert to the expected format
      const structuredAnalysis = {};
      Object.entries(nestedKeyAnalysis).forEach(([nestedKey, valueCounts]) => {
        const sortedValues = Array.from(valueCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, maxSamples)
          .map(([valueStr, count]) => ({
            value: safeParse(valueStr),
            count,
            frequency: count / objectArray.length,
          }));

        structuredAnalysis[nestedKey] = {
          key: nestedKey,
          type: "primitive_values",
          arrayType: "array_of_objects",
          depth: depth + 1,
          path: [...path, keyName, nestedKey],
          pathString: [...path, keyName, nestedKey].join("."),
          values: sortedValues,
          totalUniqueValues: valueCounts.size,
          sampleSize: objectArray.length,
        };
      });

      keyAnalysis[keyName] = {
        key: keyName,
        type: "array_of_objects",
        depth: depth,
        path: [...path, keyName],
        pathString: [...path, keyName].join("."),
        analysis: structuredAnalysis,
        sampleSize: objectArray.length,
      };
    }
    // Handle arrays of primitives (including empty arrays)
    else if (allValuesAreArrays || arrayPrimitiveCounts.size > 0) {
      const sortedValues = Array.from(arrayPrimitiveCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxSamples)
        .map(([valueStr, count]) => ({
          value: safeParse(valueStr),
          count,
          frequency: count / objectArray.length,
        }));

      keyAnalysis[keyName] = {
        key: keyName,
        type: "primitive_values",
        arrayType: "array_of_primitives",
        depth: depth,
        path: [...path, keyName],
        pathString: [...path, keyName].join("."),
        values: sortedValues,
        totalUniqueValues: arrayPrimitiveCounts.size,
        sampleSize: objectArray.length,
      };
    }
    // Handle regular primitives vs nested objects - THE KEY FIX IS HERE
    else if (keyValueCounts.size > 0 && keyValues.length > 0) {
      // Mixed case: some primitives (including null) and some objects
      // Check if we have any actual objects (non-null objects)
      const nonNullObjects = keyValues.filter(
        (val) => val && typeof val === "object" && !Array.isArray(val)
      );

      if (nonNullObjects.length > 0) {
        // We have some objects, so treat this as nested objects
        // The primitives (null values) will be handled in the values
        const nestedAnalysis = analyzeObjectArrayKeys(
          nonNullObjects,
          depth + 1,
          [...path, keyName],
          maxSamples
        );

        // Also include the primitive values (like null) in the result
        const sortedPrimitiveValues = Array.from(keyValueCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, maxSamples)
          .map(([valueStr, count]) => ({
            value: safeParse(valueStr),
            count,
            frequency: count / objectArray.length,
          }));

        keyAnalysis[keyName] = {
          key: keyName,
          type: "mixed_object", // New type for mixed null/object cases
          depth: depth,
          path: [...path, keyName],
          pathString: [...path, keyName].join("."),
          analysis: nestedAnalysis,
          primitiveValues: sortedPrimitiveValues, // Include null values here
          sampleSize: objectArray.length,
          objectCount: nonNullObjects.length,
          nullCount: keyValueCounts.get(safeStringify(null)) || 0,
        };
      } else {
        // Only primitives, no objects
        const sortedValues = Array.from(keyValueCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, maxSamples)
          .map(([valueStr, count]) => ({
            value: safeParse(valueStr),
            count,
            frequency: count / objectArray.length,
          }));

        keyAnalysis[keyName] = {
          key: keyName,
          type: "primitive_values",
          depth: depth,
          path: [...path, keyName],
          pathString: [...path, keyName].join("."),
          values: sortedValues,
          totalUniqueValues: keyValueCounts.size,
          sampleSize: objectArray.length,
        };
      }
    }
    // Handle regular primitives only
    else if (keyValueCounts.size > 0) {
      const sortedValues = Array.from(keyValueCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxSamples)
        .map(([valueStr, count]) => ({
          value: safeParse(valueStr),
          count,
          frequency: count / objectArray.length,
        }));

      keyAnalysis[keyName] = {
        key: keyName,
        type: "primitive_values",
        depth: depth,
        path: [...path, keyName],
        pathString: [...path, keyName].join("."),
        values: sortedValues,
        totalUniqueValues: keyValueCounts.size,
        sampleSize: objectArray.length,
      };
    }
    // Handle nested objects only
    else if (keyValues.length > 0) {
      // Filter out null values for object analysis
      const nonNullObjects = keyValues.filter(
        (val) => val && typeof val === "object" && !Array.isArray(val)
      );

      if (nonNullObjects.length > 0) {
        // Handle as nested objects - recursively analyze
        const nestedAnalysis = analyzeObjectArrayKeys(
          nonNullObjects,
          depth + 1,
          [...path, keyName],
          maxSamples
        );

        keyAnalysis[keyName] = {
          key: keyName,
          type: "nested_object",
          depth: depth,
          path: [...path, keyName],
          pathString: [...path, keyName].join("."),
          analysis: nestedAnalysis,
          sampleSize: nonNullObjects.length,
        };
      } else {
        // Handle other complex types (arrays, mixed types, etc.)
        const complexAnalysis = {};

        keyValues.forEach((complexValue, index) => {
          if (complexValue !== null && complexValue !== undefined) {
            const analysisResult = walkJsonStructure(
              complexValue,
              `item_${index}`,
              depth + 1,
              [...path, keyName],
              maxSamples
            );

            const valueType = getType(complexValue);
            const typeKey = `${valueType}_${index}`;
            complexAnalysis[typeKey] = analysisResult;
          }
        });

        keyAnalysis[keyName] = {
          key: keyName,
          type: "complex_values",
          depth: depth,
          path: [...path, keyName],
          pathString: [...path, keyName].join("."),
          analysis: complexAnalysis,
          sampleSize: keyValues.length,
        };
      }
    }
  });

  return keyAnalysis;
}

function createNode(key, value, type, depth, path, pathString, analysis, size) {
  return {
    key,
    value,
    type,
    depth,
    path,
    pathString,
    size,
    analysis,
    isExpandable: type === "object" || type === "array",
    isPrimitive: isPrimitive(value),
  };
}

function isPrimitive(value) {
  const type = getType(value);
  return (
    type === "string" ||
    type === "number" ||
    type === "boolean" ||
    type === "date" ||
    type === "null" ||
    type === "undefined"
  );
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    // Fallback for values that can't be JSON stringified (like functions, circular refs, etc.)
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "string") return `"${value.replace(/"/g, '\\"')}"`;
    if (typeof value === "number" || typeof value === "boolean")
      return String(value);
    if (value instanceof Date) return `"${value.toISOString()}"`;
    // For objects that can't be stringified, use a safe representation
    return `"[${typeof value}]"`;
  }
}

function safeParse(valueStr) {
  try {
    return JSON.parse(valueStr);
  } catch (error) {
    // If parsing fails, return the string as-is (without quotes if it was a simple string)
    if (valueStr.startsWith('"') && valueStr.endsWith('"')) {
      return valueStr.slice(1, -1); // Remove quotes
    }
    return valueStr;
  }
}

/**
 * Extracts all leaf paths from an analyzed import structure.
 * @param {object} treeNode Analysis tree created by analyzeJsonStructure.
 * @returns {string[]} Flat list of leaf path strings.
 */
export function extractLeafPaths(treeNode) {
  function traverseNode(node) {
    // If this is a leaf node, return its path
    if (!node.analysis) {
      return [node.pathString];
    }

    // If node has analysis, traverse and collect all nested paths
    if (node.analysis) {
      return Object.values(node.analysis).reduce((paths, childNode) => {
        return paths.concat(traverseNode(childNode));
      }, []);
    }

    return [];
  }

  return traverseNode(treeNode);
}

/**
 * Projects imported records to the selected field mapping.
 * @param {Array<Record<string, any>>} data Parsed source records.
 * @param {Array<{headerField: string}>} mapping Selected mapping definitions.
 * @param {string} format Source format identifier.
 * @returns {Array<Record<string, any>>} Transformed records matching the selected mapping.
 */
export function parseData(data, mapping, format) {
  const output = data.map((item) => {
    if (format === "json" || format === "xml") {
      const transformedItem = {};
      mapping.forEach((mapping) => {
        const sourcePath = mapping.headerField.split(".");
        // Extract value from nested path
        const value = getNestedValue(item, sourcePath);
        if (value !== undefined) {
          transformedItem[mapping.headerField] = value;
        }
      });
      return transformedItem;
    } else {
      const fields = mapping.map((mapping) => mapping.headerField);
      return Object.fromEntries(
        Object.entries(item).filter(([key]) => fields.includes(key))
      );
    }
  });
  return output;
}

function getNestedValue(obj, path) {
  return path.reduce((current, key, index, array) => {
    const type = getType(current);
    let next;
    if (type === "object") {
      next = current[key];
    } else if (type === "array") {
      if (current.length === 0) {
        next = null; // If no mapping, return the array as is
      }
      const types = current.map((d) => getType(d));
      if (types.every((t) => t === "object")) {
        next = current.map((d) => d[key]);
      } else {
        next = current.join("|");
      }
    } else {
      // If the value is not an object or array, return it directly
      next = current;
    }
    const nextType = getType(next);
    if (nextType === "array" && index === array.length - 1) {
      if (next.length === 0) {
        next = null; // If no mapping, return the array as is
      } else {
        next = next.join("|");
      }
    }
    return next;
  }, obj);
}
