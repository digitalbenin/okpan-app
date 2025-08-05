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

export function analyzeJsonStructure(jsonArray, maxSamples = 10) {
  if (!Array.isArray(jsonArray) || jsonArray.length === 0) {
    throw new Error("Input must be a non-empty array");
  }

  return walkJsonStructure(jsonArray, null, 0, []);
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
        // For arrays of primitives (like tags), collect all unique primitive values
        else if (
          valueType === "array" &&
          value.length > 0 &&
          isPrimitive(value[0])
        ) {
          value.forEach((primitiveValue) => {
            const valueStr = safeStringify(primitiveValue);
            arrayPrimitiveCounts.set(
              valueStr,
              (arrayPrimitiveCounts.get(valueStr) || 0) + 1
            );
          });
        }
        // For arrays of objects (like metadata with name/value pairs)
        else if (
          valueType === "array" &&
          value.length > 0 &&
          getType(value[0]) === "object"
        ) {
          // Collect all objects from all arrays to analyze recursively
          value.forEach((arrayItem) => {
            if (arrayItem && typeof arrayItem === "object") {
              Object.entries(arrayItem).forEach(([nestedKey, nestedValue]) => {
                // Create a combined key for tracking (e.g., "metadata.name", "metadata.value")
                const combinedKey = `${keyName}.${nestedKey}`;
                const valueStr = safeStringify(nestedValue);
                arrayObjectKeyCounts.set(
                  `${combinedKey}:${valueStr}`,
                  (arrayObjectKeyCounts.get(`${combinedKey}:${valueStr}`) ||
                    0) + 1
                );
              });
            }
          });
        }
        // For nested objects, we want to flatten and analyze their properties
        else if (valueType === "object") {
          // Don't add to keyValues for recursive analysis yet
          // Instead, we'll handle this case separately below
        }
        // For other complex types, analyze recursively
        else {
          if (keyValues.length < maxSamples) {
            keyValues.push(
              walkJsonStructure(
                value,
                keyName,
                depth + 1,
                [...path, keyName],
                maxSamples
              )
            );
          }
        }
      }
    });

    // Handle arrays of objects with key-value pairs (like metadata)
    if (arrayObjectKeyCounts.size > 0) {
      // Group by nested keys
      const nestedKeyAnalysis = {};

      arrayObjectKeyCounts.forEach((count, keyValue) => {
        const colonIndex = keyValue.indexOf(":");
        if (colonIndex === -1) return; // Skip malformed entries

        const combinedKey = keyValue.substring(0, colonIndex);
        const valueStr = keyValue.substring(colonIndex + 1);

        const dotIndex = combinedKey.indexOf(".");
        if (dotIndex === -1) return; // Skip malformed entries

        const nestedKey = combinedKey.substring(dotIndex + 1);

        if (!nestedKeyAnalysis[nestedKey]) {
          nestedKeyAnalysis[nestedKey] = new Map();
        }

        nestedKeyAnalysis[nestedKey].set(valueStr, count);
      });

      // Convert to the expected format and analyze recursively if needed
      const structuredAnalysis = {};
      Object.entries(nestedKeyAnalysis).forEach(([nestedKey, valueCounts]) => {
        const sortedValues = Array.from(valueCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, maxSamples)
          .map(([valueStr, count]) => {
            const parsedValue = safeParse(valueStr);
            return {
              value: parsedValue,
              count,
              frequency: count / objectArray.length,
            };
          });

        // Check if any of the values are complex and need further analysis
        const hasComplexValues = sortedValues.some(
          (item) => !isPrimitive(item.value) && item.value !== null
        );

        if (hasComplexValues) {
          // If there are complex values, we need to analyze them recursively
          const complexValues = sortedValues
            .filter((item) => !isPrimitive(item.value) && item.value !== null)
            .map((item) => item.value);

          // Recursively analyze the complex values
          const recursiveAnalysis = analyzeObjectArrayKeys(
            complexValues,
            depth + 2,
            [...path, keyName, nestedKey],
            maxSamples
          );

          structuredAnalysis[nestedKey] = {
            key: nestedKey,
            type: "complex_values",
            depth: depth + 2,
            path: [...path, keyName, nestedKey],
            pathString: [...path, keyName, nestedKey].join("."),
            analysis: recursiveAnalysis,
            primitiveValues: sortedValues.filter((item) =>
              isPrimitive(item.value)
            ),
            sampleSize: objectArray.length,
          };
        } else {
          // All values are primitive
          structuredAnalysis[nestedKey] = {
            key: nestedKey,
            type: "primitive_values",
            arrayType: "array_of_objects",
            depth: depth + 2,
            path: [...path, keyName, nestedKey],
            pathString: [...path, keyName, nestedKey].join("."),
            values: sortedValues,
            totalUniqueValues: valueCounts.size,
            sampleSize: objectArray.length,
          };
        }
      });

      keyAnalysis[keyName] = {
        key: keyName,
        type: "array_of_objects",
        depth: depth + 1,
        path: [...path, keyName],
        pathString: [...path, keyName].join("."),
        analysis: structuredAnalysis,
        sampleSize: objectArray.length,
      };
    }
    // Handle arrays of primitives
    else if (arrayPrimitiveCounts.size > 0) {
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
        depth: depth + 1,
        path: [...path, keyName],
        pathString: [...path, keyName].join("."),
        values: sortedValues,
        totalUniqueValues: arrayPrimitiveCounts.size,
        sampleSize: objectArray.length,
      };
    }
    // Handle regular primitives
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
        depth: depth + 1,
        path: [...path, keyName],
        pathString: [...path, keyName].join("."),
        values: sortedValues,
        totalUniqueValues: keyValueCounts.size,
        sampleSize: objectArray.length,
      };
    }
    // Handle nested objects - analyze their nested properties
    else {
      // Check if this key contains objects across all samples
      const nestedObjects = objectArray
        .map((obj) => (obj && typeof obj === "object" ? obj[keyName] : null))
        .filter((val) => val && typeof val === "object" && !Array.isArray(val));

      if (nestedObjects.length > 0) {
        // Recursively analyze the nested object properties
        const nestedAnalysis = analyzeObjectArrayKeys(
          nestedObjects,
          depth + 1,
          [...path, keyName],
          maxSamples
        );

        keyAnalysis[keyName] = {
          key: keyName,
          type: "nested_object",
          depth: depth + 1,
          path: [...path, keyName],
          pathString: [...path, keyName].join("."),
          analysis: nestedAnalysis,
          sampleSize: nestedObjects.length,
        };
      }
      // Handle other complex values
      else if (keyValues.length > 0) {
        keyAnalysis[keyName] = {
          key: keyName,
          type: "complex_values",
          depth: depth + 1,
          path: [...path, keyName],
          pathString: [...path, keyName].join("."),
          values: keyValues,
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

// function getType(value) {
//   if (value === null) return "null";
//   if (value === undefined) return "undefined";
//   if (Array.isArray(value)) return "array";
//   if (value instanceof Date) return "date";
//   return typeof value;
// }

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
