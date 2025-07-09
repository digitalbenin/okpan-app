import { sql, aliasedTable } from 'drizzle-orm';
import { GraphQLScalarType, Kind, GraphQLError } from 'graphql';
import * as dbSchema from '../schema';

// Define a GraphQL JSON scalar type
export const GraphQLJSON = new GraphQLScalarType({
    name: 'JSON',
    description: 'The `JSON` scalar type represents JSON values as specified by ECMA-404',
    serialize(valueFromResolver) { // Value from resolver/DB output to client
        if (typeof valueFromResolver === 'string') {
            try {
                return JSON.parse(valueFromResolver); // Ensure client gets a parsed object
            } catch (e) {
                // If DB string isn't valid JSON or resolver returned non-JSON string for other reasons
                // Log error and return null or throw, depending on desired strictness
                console.error("GraphQLJSON.serialize: Error parsing string from resolver/DB: ", e);
                return null; // Or throw new GraphQLError('Failed to serialize JSON from resolver.');
            }
        }
        // If it's already an object (e.g., Drizzle parsed it, or resolver built it), pass through.
        return valueFromResolver;
    },
    parseValue(inputValueFromClient) { // Value from client variables to resolver
        // Since the $links variable is JSON!, inputValueFromClient will be the JS object/array.
        // Drizzle's text({ mode: 'json' }) expects a string for insertion.
        try {
            return JSON.stringify(inputValueFromClient);
        } catch (e) {
            throw new GraphQLError('Failed to stringify JSON value for resolver: ' + e.message);
        }
    },
    parseLiteral(ast) { // Value from query literal to resolver
        // This helper converts an AST node to its JavaScript value, then stringifies it.
        function astToValue(node) {
            switch (node.kind) {
                case Kind.STRING: // A string literal could be pre-stringified JSON or just a string
                    // For safety, if it's a string, try parsing. If it fails, it's not JSON.
                    // If it parses, it means it was a string *containing* JSON, which is unusual for a JSON literal.
                    // More commonly, for a JSON scalar, object/list literals are used.
                    // For now, assume a string literal IS the content, to be stringified if not already part of a larger structure.
                    // This part is tricky; typically one might expect ObjectValue or ListValue for JSON literals.
                    // If a string is passed, it implies it's a simple JSON string value like "\"my string\""
                    // or it is the *content* of what should be stringified.
                    // Let's assume it IS the JSON string content for Drizzle if it's a simple string literal.
                    try {
                        JSON.parse(node.value); // Validate if it's a JSON string
                        return node.value; // Return the string itself if it's already valid JSON string
                    } catch (e) {
                        // If it's not a valid JSON string, then it's a plain string to be encoded *as* a JSON string.
                        return JSON.stringify(node.value);
                    }
                case Kind.BOOLEAN:
                    return node.value;
                case Kind.INT:
                case Kind.FLOAT:
                    return parseFloat(node.value);
                case Kind.OBJECT:
                    return Object.fromEntries(node.fields.map(field => [field.name.value, astToValue(field.value)]));
                case Kind.LIST:
                    return node.values.map(astToValue);
                case Kind.NULL:
                    return null;
                default:
                    return undefined; // Or throw for unhandled kinds
            }
        }
        const jsValue = astToValue(ast);
        if (typeof jsValue === 'undefined') {
            throw new GraphQLError('Could not parse literal to a valid JS value for JSON: ' + ast.kind);
        }
        // The resolver expects a string for Drizzle's text({ mode: 'json' })
        try {
            return JSON.stringify(jsValue);
        } catch (e) {
            throw new GraphQLError('Failed to stringify parsed literal for JSON: ' + e.message);
        }
    }
});

// Helper function to add count fields to entity types
export const addCountField = (drizzleResult, typeName, fieldName, type = drizzleResult.schema._typeMap.Int) => {
    drizzleResult.schema._typeMap[typeName]._fields[fieldName] = {
        name: fieldName,
        type: type,
        args: [],
    };
};

// Helper function to create a count subquery
export const createCountSubquery = (db, table, foreignKeyField, countAlias) => {
    return db
        .select({
            [foreignKeyField]: table[foreignKeyField],
            [countAlias]: sql`count(*)`.as(countAlias)
        })
        .from(table)
        .groupBy(table[foreignKeyField])
        .as(countAlias);
};

// Helper function to create a text field with translations
export const createTextFieldWithTranslations = (textTable, translationsTable, languagesTable = null) => {
    // If languagesTable is provided, include language information
    if (languagesTable) {
        return {
            content: textTable.content,
            id: textTable.id,
            original_language_id: textTable.original_language_id,
            translations: sql`json_group_array(json_object(
                'id', ${translationsTable.id},
                'language_id', ${translationsTable.language_id},
                'content', ${translationsTable.content},
                'language', json_object(
                    'id', ${languagesTable.id},
                    'code', ${languagesTable.code},
                    'name', ${languagesTable.name}
                )
            ))`.as('translations')
        };
    }

    // Fallback to original behavior if no languagesTable provided
    return {
        content: textTable.content,
        id: textTable.id,
        original_language_id: textTable.original_language_id,
        translations: sql`json_group_array(json_object(
            'id', ${translationsTable.id},
            'language_id', ${translationsTable.language_id},
            'content', ${translationsTable.content}
        ))`.as('translations')
    };
};

// Helper function to process translations in results
export const processTranslations = (items, fields) => {
    return items.map(item => {
        fields.forEach(field => {
            if (item[field] && item[field].translations) {
                try {
                    // Parse the JSON string into an array
                    let translations = JSON.parse(item[field].translations);

                    // Filter out null entries and duplicates
                    translations = translations
                        .filter(t => t.language_id && t.content) // Keep entries with language_id and content
                        .filter((t, index, self) =>
                            index === self.findIndex(s => s.language_id === t.language_id)
                        );

                    // Make sure id field isn't null to avoid GraphQL errors
                    translations = translations.map(t => ({
                        id: t.id || `temp_${field}_${t.language_id}`, // Fallback ID to avoid null
                        language_id: t.language_id,
                        content: t.content,
                        language: t.language // Preserve language object if present
                    }));

                    item[field].translations = translations.length > 0 ? translations : [];
                } catch (e) {
                    console.error(`Error parsing translations for ${field}:`, e);
                    item[field].translations = [];
                }
            } else if (item[field]) {
                item[field].translations = [];
            }
        });

        // Parse links field if it exists and is a string
        if (item.links && typeof item.links === 'string') {
            try {
                item.links = JSON.parse(item.links);
            } catch (e) {
                console.error(`Error parsing links for item ${item.id}:`, e);
                item.links = [];
            }
        }

        return item;
    });
}; 