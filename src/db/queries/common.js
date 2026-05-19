import { sql, aliasedTable } from 'drizzle-orm';
import { GraphQLScalarType, Kind, GraphQLError } from 'graphql';
import * as dbSchema from '../schema.js';

/**
 * @typedef {Object} ResolverDefinition
 * @property {string} name - The GraphQL field name registered in the schema
 * @property {import('graphql').GraphQLOutputType} type - The return type
 * @property {Array<{name: string, type: import('graphql').GraphQLInputType, description: string}>} args
 * @property {function(*, {[key: string]: *}): Promise<*>} resolve - Async resolver; only declare context/info if actually used
 */

// Custom GraphQL JSON scalar that serialises DB strings to objects and
// stringifies incoming values for Drizzle's text({ mode: 'json' }) columns.
export const GraphQLJSON = new GraphQLScalarType({
    name: 'JSON',
    description: 'The `JSON` scalar type represents JSON values as specified by ECMA-404',
    serialize(value) {
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch (e) {
                console.error('GraphQLJSON.serialize: could not parse DB string as JSON', e);
                return null;
            }
        }
        return value;
    },
    parseValue(value) {
        try {
            return JSON.stringify(value);
        } catch (e) {
            throw new GraphQLError('GraphQLJSON.parseValue: ' + e.message);
        }
    },
    parseLiteral(ast) {
        // Recursively convert a GraphQL AST literal node to a plain JS value.
        function astToValue(node) {
            switch (node.kind) {
                case Kind.STRING:
                    // If the string is already valid JSON, pass it through; otherwise encode it.
                    try { JSON.parse(node.value); return node.value; } catch { return JSON.stringify(node.value); }
                case Kind.BOOLEAN:
                    return node.value;
                case Kind.INT:
                case Kind.FLOAT:
                    return parseFloat(node.value);
                case Kind.OBJECT:
                    return Object.fromEntries(node.fields.map(f => [f.name.value, astToValue(f.value)]));
                case Kind.LIST:
                    return node.values.map(astToValue);
                case Kind.NULL:
                    return null;
                default:
                    return undefined;
            }
        }

        const jsValue = astToValue(ast);
        if (typeof jsValue === 'undefined') {
            throw new GraphQLError('GraphQLJSON.parseLiteral: unhandled AST kind ' + ast.kind);
        }
        try {
            return JSON.stringify(jsValue);
        } catch (e) {
            throw new GraphQLError('GraphQLJSON.parseLiteral: ' + e.message);
        }
    }
});

/**
 * Injects a computed count field into a drizzle-graphql generated type.
 *
 * @param {object} drizzleResult - Object returned by `buildSchema`.
 * @param {string} typeName - Name of the GraphQL object type to patch (e.g. `'InstitutionsSelectItem'`).
 * @param {string} fieldName - Name of the new count field to add.
 * @param {import('graphql').GraphQLOutputType} [type] - GraphQL type for the field; defaults to `Int`.
 */
export const addCountField = (drizzleResult, typeName, fieldName, type = drizzleResult.schema._typeMap.Int) => {
    drizzleResult.schema._typeMap[typeName]._fields[fieldName] = {
        name: fieldName,
        type: type,
        args: [],
    };
};

/**
 * Creates a Drizzle subquery that counts related rows grouped by a foreign key.
 *
 * @param {object} db - Drizzle database instance.
 * @param {object} table - Drizzle table to count rows from.
 * @param {string} foreignKeyField - Column name used as the GROUP BY key (e.g. `'institution_id'`).
 * @param {string} countAlias - Alias applied to both the subquery and the count column.
 * @returns {import('drizzle-orm').Subquery}
 */
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

/**
 * Builds the SELECT shape for a multilingual text field (original content + translations array).
 * When `languagesTable` is provided, each translation entry also carries the language metadata.
 *
 * @param {object} textTable - Drizzle alias for the `texts` table.
 * @param {object} translationsTable - Drizzle alias for the `translations` table.
 * @param {object|null} [languagesTable=null] - Optional Drizzle alias for the `languages` table.
 * @returns {object} Drizzle SELECT shape with `content`, `id`, `original_language_id`, and `translations`.
 */
export const createTextFieldWithTranslations = (textTable, translationsTable, languagesTable = null) => {
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

/**
 * Converts a free-text search string into a safe SQLite FTS5 query expression.
 * Each whitespace-separated token becomes a prefix query (`token*`) for word characters,
 * or a phrase query (`"token"`) for tokens containing special characters.
 * Tokens are joined with `AND` so all terms must match.
 *
 * @param {string} input - Raw search string from the user.
 * @returns {string} FTS5-compatible query string, or `''` if the input is empty.
 */
export const buildSafeFtsAndPrefixQuery = (input) => {
    if (!input || typeof input !== 'string') return '';

    const tokens = input
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

    return tokens
        .map((token) => {
            const normalizedToken = token.replace(/^"+|"+$/g, '').trim();
            if (!normalizedToken) return '';

            const escapedToken = normalizedToken.replace(/"/g, '""');
            const isPrefixSafeToken = /^[\p{L}\p{N}_-]+$/u.test(normalizedToken);

            return isPrefixSafeToken ? `${escapedToken}*` : `"${escapedToken}"`;
        })
        .filter(Boolean)
        .join(' AND ');
};

/**
 * Parses the JSON-serialised translations array returned by SQLite `json_group_array`,
 * deduplicates entries by `language_id`, and ensures no null IDs reach GraphQL resolvers.
 *
 * @param {Array<object>} items - Raw rows from a Drizzle query result.
 * @param {string[]} fields - Field names on each item that carry a `{ translations: string }` shape.
 * @returns {Array<object>} The same items with each named field's translations parsed and de-duped.
 */
export const processTranslations = (items, fields) => {
    return items.map(item => {
        fields.forEach(field => {
            if (item[field] && item[field].translations) {
                try {
                    let translations = JSON.parse(item[field].translations);

                    translations = translations
                        .filter(t => t.language_id && t.content)
                        .filter((t, index, self) =>
                            index === self.findIndex(s => s.language_id === t.language_id)
                        );

                    // GraphQL does not accept null IDs; generate a stable fallback.
                    translations = translations.map(t => ({
                        id: t.id || `temp_${field}_${t.language_id}`,
                        language_id: t.language_id,
                        content: t.content,
                        language: t.language
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