/**
 * Helper function to convert sql.js results to an array of objects
 * @param {import('sql.js').QueryExecResult[]} res
 * @returns {Object[]}
 */
function results_to_objects(res) {
	if (!res || res.length === 0) {
		return [];
	}
	const objects = [];
	const columns = res[0].columns;
	const values = res[0].values;
	for (const value of values) {
		const obj = {};
		for (let i = 0; i < columns.length; i++) {
			obj[columns[i]] = value[i];
		}
		objects.push(obj);
	}
	return objects;
}

/** @type {import('./$types').LayoutServerLoad} */
export async function load({ locals }) {
	const db = locals.db;

	const institutions_res = db.exec('SELECT * FROM institutions');
	const ontology_fields_res = db.exec('SELECT * FROM ontology_fields');
	const research_fields_res = db.exec('SELECT * FROM research_fields');

	return {
		institutions: results_to_objects(institutions_res),
		ontology_fields: results_to_objects(ontology_fields_res),
		research_fields: results_to_objects(research_fields_res)
	};
}