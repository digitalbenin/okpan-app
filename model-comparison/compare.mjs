/**
 * Throwaway comparison tool: Granite R2 vs Snowflake Arctic Embed for the
 * import-field matching task.
 *
 * Not part of the app. Lives in a git-ignored folder.
 *
 * Both models are used exactly as the app uses them (CLS pooling, normalized
 * vectors, q8 ONNX export), with the only difference being each model's query
 * convention: Arctic takes a "query: " prefix, Granite takes plain text.
 * Ontology fields are indexed by name only, matching current app behaviour.
 *
 * Usage:
 *   node model-comparison/compare.mjs --headers    # dump extracted headers
 *   node model-comparison/compare.mjs              # full comparison
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import XLSXModule from 'xlsx';
import { pipeline, AutoModel, AutoTokenizer } from '@huggingface/transformers';

// xlsx 0.18 ships CommonJS, so the namespace object holds the real exports.
const XLSX = XLSXModule.default ?? XLSXModule;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(REPO_ROOT, 'src', 'assets', 'models');
const ONTOLOGY_PATH = path.join(REPO_ROOT, 'src', 'db', 'default_ontology_fields.json');
const SAMPLE_DIR = 'C:\\Users\\fenic\\projects\\db-contool-parser\\static\\sample_data';
const TOP_N = 3;

// Each model is configured the way its own documentation prescribes. Prefixes
// are applied to the query (CSV header) and document (ontology field) sides
// separately, because models disagree on whether documents take one at all.
//
// strategy 'pipeline'    -> feature-extraction pipeline with CLS pooling, as the
//                           app uses it. Requires vector normalization.
// strategy 'sentence_embedding' -> the ONNX graph exposes its own pooled,
//                           L2-normalized sentence_embedding output, which is
//                           what the model card documents.
const MODELS = {
    granite: {
        label: 'Granite R2 97M',
        id: 'onnx-community/granite-embedding-97m-multilingual-r2-ONNX',
        dtype: 'q8',
        strategy: 'pipeline',
        queryPrefix: '',
        documentPrefix: ''
    },
    arctic: {
        label: 'Arctic Embed M v2',
        id: 'Snowflake/snowflake-arctic-embed-m-v2.0',
        dtype: 'q8',
        strategy: 'pipeline',
        queryPrefix: 'query: ',
        documentPrefix: ''
    },
    gemma: {
        label: 'EmbeddingGemma 300M q4',
        id: 'onnx-community/embeddinggemma-300m-ONNX',
        dtype: 'q4',
        strategy: 'sentence_embedding',
        queryPrefix: 'task: search result | query: ',
        documentPrefix: 'title: none | text: '
    }
};

// Headers whose correct ontology field is unambiguous, keyed by lowercased
// header text. Ambiguous or purely technical columns are deliberately omitted
// so the accuracy figures stay trustworthy; they still appear in the agreement
// analysis. Ground truth is our own judgement, not a published annotation.
const GROUND_TRUTH = {};
for (const [header, field] of [
    // English - Metropolitan Museum style export
    ['primary rendition no', 'object id'],
    ['object number', 'object id'],
    ['object sort number', 'object id'],
    ['objectid', 'object id'],
    ['accession', 'object id'],
    ['reference_numbers', 'object id'],
    ['classification', 'object type'],
    ['title', 'designation'],
    ['culture', 'ethnic attribution'],
    ['dynasty', 'reign associated name'],
    ['date', 'date made'],
    ['medium', 'material'],
    ['dimensions', 'dimensions'],
    ['credit line', 'prior source'],
    ['geo: city', 'production place'],
    ['geo: country', 'production place'],
    // English - TMS export
    ['tiff', 'images'],
    ['img', 'images'],
    ['maker1', 'producer'],
    ['maker2', 'producer'],
    ['maker3 plus', 'producer'],
    ['begin date', 'date made'],
    ['end date', 'date made'],
    ['title1', 'designation'],
    ['title2', 'designation'],
    ['title3', 'designation'],
    ['object name', 'object type'],
    ['local name', 'object type'],
    ['height in', 'dimensions'],
    ['width in', 'dimensions'],
    ['depth in', 'dimensions'],
    ['primary country', 'production place'],
    ['additional countries', 'production place'],
    ['object type', 'object type'],
    ['status flags', 'display status'],
    // English - MAA Digital Benin template
    ['idno', 'object id'],
    ['id', 'object id'],
    ['year', 'date made'],
    ['d_names', 'producer'],
    ['d_description_name', 'designation'],
    ['maker', 'producer'],
    ['d_place', 'production place'],
    ['d_place_historic', 'production place'],
    ['culture_group', 'ethnic attribution'],
    ['period', 'date made'],
    ['date_made', 'date made'],
    ['source', 'prior source'],
    ['collection or excavation year', 'date collected'],
    ['length', 'dimensions'],
    ['height', 'dimensions'],
    ['width', 'dimensions'],
    ['weight', 'weight'],
    ['material', 'material'],
    // German - SMB-SPK export
    ['ident. nr. // (sortiernr.)', 'object id'],
    ['ident. nr.', 'object id'],
    ['datierung', 'date made'],
    ['objekttyp', 'object type'],
    ['anzahl teile', 'object count'],
    ['beteiligte', 'producer'],
    ['beteiligte // (name, sortierung=kleinste)', 'producer'],
    ['digital assets', 'images'],
    ['standardbild', 'images'],
    ['erwerb. datum', 'accession date'],
    ['erwerbungsart', 'accession method'],
    ['erwerb. von', 'prior source'],
    ['veräußerer', 'prior source'],
    ['geogr. bezüge', 'production place'],
    ['geogr. bezüge // alle', 'production place'],
    ['maße', 'dimensions'],
    ['material / technik', 'material'],
    ['material / technik // alle', 'material'],
    ['obj. status', 'display status'],
    ['sachbegriff', 'object type'],
    ['texte online', 'weblink'],
    ['titel', 'designation'],
    ['verw. institution', 'department and institution'],
    // German - Übersee-Museum export
    ['objektnummer', 'object id'],
    ['objektname', 'designation'],
    ['kultur/ethnie', 'ethnic attribution'],
    ['staat', 'production place'],
    ['ort', 'production place'],
    ['sammlung', 'department and institution'],
    ['geber', 'prior source'],
    ['vorbesitzer', 'prior source'],
    ['sammler', 'prior source'],
    ['erwerbsdatum', 'accession date'],
    ['erwerbsart', 'accession method'],
    ['beschreibung - siehe word-dokument', 'description'],
    // French - Musée du quai Branly export
    ['multimédias', 'images'],
    ['numéro de collection', 'object id'],
    ['numéro d\'objet', 'object id'],
    ['numéro de gestion', 'object id'],
    ['numéro de tri', 'object id'],
    ['numéro de tri 2', 'object id'],
    ['autres numéros', 'object id'],
    ['classifications', 'object type'],
    ['mode d\'entrée', 'accession method'],
    ['rôle', 'prior source role'],
    ['donateur / vendeur / déposant', 'prior source'],
    ['liste des noms', 'producer'],
    ['période', 'date made'],
    ['nom de l\'objet', 'designation'],
    ['date de début', 'date made'],
    ['matériaux et techniques', 'material'],
    ['description', 'description'],
    ['toponyme', 'production place'],
    ['ethnonyme', 'ethnic attribution'],
    ['nombre_elements', 'object count'],
    ['provenance historique', 'provenance'],
    ['références publiées', 'bibliography'],
    ['bibliographie', 'bibliography'],
    ['notes', 'notes'],
    ['remarques du conservateur', 'notes'],
    ['statut de l\'objet', 'display status'],
    ['date d\'entrée dans les collections nationales', 'accession date']
]) {
    GROUND_TRUTH[header] = field;
}

// Language of each labelled header, used for the per-language breakdown.
// Headers that read the same in several languages (e.g. "Date") count as English.
const GERMAN_HEADERS = new Set([
    'ident. nr. // (sortiernr.)', 'ident. nr.', 'datierung', 'objekttyp', 'anzahl teile',
    'beteiligte', 'beteiligte // (name, sortierung=kleinste)', 'digital assets', 'standardbild',
    'erwerb. datum', 'erwerbungsart', 'erwerb. von', 'veräußerer', 'geogr. bezüge',
    'geogr. bezüge // alle', 'maße', 'material / technik', 'material / technik // alle',
    'obj. status', 'sachbegriff', 'texte online', 'titel', 'verw. institution',
    'objektnummer', 'objektname', 'kultur/ethnie', 'staat', 'ort', 'sammlung', 'geber',
    'vorbesitzer', 'sammler', 'erwerbsdatum', 'erwerbsart',
    'beschreibung - siehe word-dokument'
]);

const FRENCH_HEADERS = new Set([
    'multimédias', 'numéro de collection', "numéro d'objet", 'numéro de gestion',
    'numéro de tri', 'numéro de tri 2', 'autres numéros', 'classifications',
    "mode d'entrée", 'rôle', 'donateur / vendeur / déposant', 'liste des noms', 'période',
    "nom de l'objet", 'date de début', 'matériaux et techniques', 'description', 'toponyme',
    'ethnonyme', 'nombre_elements', 'provenance historique', 'références publiées',
    'bibliographie', 'remarques du conservateur', "statut de l'objet",
    "date d'entrée dans les collections nationales"
]);

/**
 * @param {string} header
 * @returns {'en'|'de'|'fr'}
 */
function languageOf(header) {
    const key = header.toLowerCase().replace(/\s+/g, ' ').trim();
    if (GERMAN_HEADERS.has(key)) return 'de';
    if (FRENCH_HEADERS.has(key)) return 'fr';
    return 'en';
}

function listSampleFiles() {
    const found = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (/\.(csv|xlsx|xls)$/i.test(entry.name) && !entry.name.startsWith('~$')) {
                found.push(full);
            }
        }
    };
    walk(SAMPLE_DIR);
    return found.sort();
}

function cleanHeader(value) {
    return String(value ?? '')
        .replace(/^\uFEFF/, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractCsvHeaders(filePath) {
    const text = fs.readFileSync(filePath, 'utf8');
    const rows = parse(text, {
        relax_column_count: true,
        relax_quotes: true,
        skip_empty_lines: true,
        to_line: 1
    });
    return (rows[0] || []).map(cleanHeader).filter(Boolean);
}

function extractXlsxHeaders(filePath) {
    const workbook = XLSX.readFile(filePath, { sheetRows: 5 });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, blankrows: false });
    const firstRow = rows.find((row) => Array.isArray(row) && row.some((cell) => cleanHeader(cell)));
    return (firstRow || []).map(cleanHeader).filter(Boolean);
}

function relative(filePath) {
    return path.relative(SAMPLE_DIR, filePath);
}

/**
 * Trim and collapse whitespace exactly like the app's embedding service does.
 * @param {string} text
 * @returns {string}
 */
function normalize(text) {
    return text.trim().replace(/\s+/g, ' ');
}

async function embedAll(modelConfig, texts) {
    const extractor = await pipeline('feature-extraction', modelConfig.id, {
        cache_dir: CACHE_DIR,
        dtype: 'q8'
    });

    const vectors = new Map();
    for (const text of texts) {
        if (vectors.has(text)) continue;
        const input = `${modelConfig.queryPrefix}${normalize(text)}`;
        const output = await extractor(input, { pooling: 'cls', normalize: true });
        vectors.set(text, Array.from(output.data));
    }

    await extractor.dispose();
    return vectors;
}

function cosine(a, b) {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i += 1) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function rank(header, ontologyVectors) {
    const headerVector = ontologyVectors.headers.get(header);
    return [...ontologyVectors.fields.entries()]
        .map(([name, vector]) => ({ name, similarity: cosine(headerVector, vector) }))
        .sort((a, b) => b.similarity - a.similarity);
}

function percentile(sorted, p) {
    if (!sorted.length) return 0;
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

async function main() {
    const seed = JSON.parse(fs.readFileSync(ONTOLOGY_PATH, 'utf8'));
    const ontologyNames = seed.fields.map((field) => field.name);

    const files = listSampleFiles();
    const perFile = [];
    const allHeaders = new Set();

    for (const file of files) {
        let headers = [];
        try {
            headers = /\.csv$/i.test(file) ? extractCsvHeaders(file) : extractXlsxHeaders(file);
        } catch (error) {
            headers = [];
            perFile.push({ file, headers, error: error.message });
            continue;
        }
        headers.forEach((header) => allHeaders.add(header));
        perFile.push({ file, headers });
    }

    if (process.argv.includes('--headers')) {
        for (const entry of perFile) {
            console.log(`\n### ${relative(entry.file)} (${entry.headers.length} headers)`);
            if (entry.error) console.log(`  ERROR: ${entry.error}`);
            for (const header of entry.headers) console.log(`  - ${header}`);
        }
        console.log(`\nTotal files: ${perFile.length}, unique headers: ${allHeaders.size}`);
        return;
    }

    const headerList = [...allHeaders].sort();
    const results = {};

    for (const [key, config] of Object.entries(MODELS)) {
        console.log(`Embedding with ${config.label} (${config.id}, dtype ${config.dtype})...`);
        const embed = await createEmbedder(config);

        const fieldVectors = new Map();
        for (const name of ontologyNames) {
            fieldVectors.set(name, await embed(name, config.documentPrefix));
        }

        const headerVectors = new Map();
        for (const header of headerList) {
            headerVectors.set(header, await embed(header, config.queryPrefix));
        }

        await embed.dispose();

        const ranked = new Map();
        for (const header of headerList) {
            const headerVector = headerVectors.get(header);
            ranked.set(header, [...fieldVectors.entries()]
                .map(([name, vector]) => ({ name, similarity: cosine(headerVector, vector) }))
                .sort((a, b) => b.similarity - a.similarity));
        }

        results[key] = { config, ranked, dimension: fieldVectors.get(ontologyNames[0]).length };
    }

    report(perFile, headerList, results);
}

/**
 * Builds an embedder for one model, hiding the differences between the
 * pipeline and sentence_embedding strategies behind a single call signature.
 * The returned function carries a `dispose` method for cleanup.
 *
 * @param {{id: string, dtype: string, strategy: string}} config
 * @returns {Promise<((text: string, prefix: string) => Promise<number[]>) & {dispose: () => Promise<void>}>}
 */
async function createEmbedder(config) {
    if (config.strategy === 'sentence_embedding') {
        const tokenizer = await AutoTokenizer.from_pretrained(config.id, { cache_dir: CACHE_DIR });
        const model = await AutoModel.from_pretrained(config.id, { cache_dir: CACHE_DIR, dtype: config.dtype });

        const embed = async (text, prefix) => {
            const inputs = await tokenizer([`${prefix}${normalize(text)}`], { padding: true });
            const output = await model(inputs);
            // This export already pools and L2-normalizes internally.
            return Array.from(output.sentence_embedding.data);
        };
        embed.dispose = async () => { await model.dispose(); };
        return embed;
    }

    const extractor = await pipeline('feature-extraction', config.id, {
        cache_dir: CACHE_DIR,
        dtype: config.dtype
    });

    const embed = async (text, prefix) => {
        const output = await extractor(`${prefix}${normalize(text)}`, { pooling: 'cls', normalize: true });
        return Array.from(output.data);
    };
    embed.dispose = async () => { await extractor.dispose(); };
    return embed;
}

function report(perFile, headerList, results) {
    const lines = [];
    const push = (line = '') => {
        lines.push(line);
        console.log(line);
    };

    push('# Embedding model comparison - import field matching');
    push();
    push(`Sample files: ${perFile.length} (${perFile.filter((f) => /\.csv$/i.test(f.file)).length} csv, ` +
        `${perFile.filter((f) => /\.xlsx$/i.test(f.file)).length} xlsx)`);
    push(`Unique headers: ${headerList.length}`);
    push();
    push('| model | dtype | dimension | query prefix | document prefix | strategy |');
    push('| --- | --- | --- | --- | --- | --- |');
    for (const result of Object.values(results)) {
        const { config } = result;
        push(`| ${config.label} | ${config.dtype} | ${result.dimension} | ` +
            `\`${config.queryPrefix || '(none)'}\` | \`${config.documentPrefix || '(none)'}\` | ${config.strategy} |`);
    }
    push();

    const keys = Object.keys(results);
    const labelFor = (header) => GROUND_TRUTH[header.toLowerCase().replace(/\s+/g, ' ').trim()];
    const labelled = headerList.filter((header) => labelFor(header));

    push('## Ground-truth accuracy');
    push();
    push(`${labelled.length} of ${headerList.length} headers have an unambiguous expected field. ` +
        'Accuracy is measured against that expectation, not against the other model.');
    push();
    push('| model | top-1 correct | top-1 | top-3 correct | top-3 |');
    push('| --- | --- | --- | --- | --- |');
    for (const [key, result] of Object.entries(results)) {
        const ranked = result.ranked;
        let top1 = 0;
        let top3 = 0;
        for (const header of labelled) {
            const expected = labelFor(header);
            const list = ranked.get(header);
            if (list[0].name === expected) top1 += 1;
            if (list.slice(0, TOP_N).some((entry) => entry.name === expected)) top3 += 1;
        }
        const pct = (n) => `${((n / labelled.length) * 100).toFixed(1)}%`;
        push(`| ${result.config.label} | ${top1}/${labelled.length} | ${pct(top1)} | ${top3}/${labelled.length} | ${pct(top3)} |`);
    }
    push();

    const LANGUAGES = ['en', 'de', 'fr'];

    const isRight = (result, header) => result.ranked.get(header)[0].name === labelFor(header);
    const rightCount = (header) => keys.filter((key) => isRight(results[key], header)).length;

    push('### Head-to-head on labelled headers');
    push();
    push('How many models get each header right, so a single model winning is visible.');
    push();
    push('| models correct | headers |');
    push('| --- | --- |');
    for (let count = keys.length; count >= 0; count -= 1) {
        const matching = labelled.filter((header) => rightCount(header) === count);
        push(`| ${count} of ${keys.length} | ${matching.length} |`);
    }
    push();

    const soloWins = {};
    for (const key of keys) {
        soloWins[key] = labelled.filter((header) => isRight(results[key], header) && rightCount(header) === 1);
        push(`Headers only ${results[key].config.label} gets right (${soloWins[key].length}): ` +
            `${soloWins[key].join(', ') || '(none)'}`);
        push();
    }

    push('### Accuracy by header language');
    push();
    push('| language | headers | ' + Object.values(results).map((r) => `${r.config.label} top-1`).join(' | ') + ' |');
    push('| --- | --- | ' + Object.keys(results).map(() => '---').join(' | ') + ' |');
    for (const language of LANGUAGES) {
        const subset = labelled.filter((header) => languageOf(header) === language);
        if (!subset.length) continue;
        const cells = Object.values(results).map((result) => {
            const correct = subset.filter((header) => result.ranked.get(header)[0].name === labelFor(header)).length;
            return `${correct}/${subset.length} (${((correct / subset.length) * 100).toFixed(1)}%)`;
        });
        push(`| ${language} | ${subset.length} | ${cells.join(' | ')} |`);
    }
    push();

    const wrongByAtLeastOne = labelled.filter((header) => {
        const expected = labelFor(header);
        return Object.values(results).some((result) => result.ranked.get(header)[0].name !== expected);
    });

    push(`## Labelled headers where at least one model misses top-1 (${wrongByAtLeastOne.length})`);
    push();
    push('| header | expected | ' + Object.values(results).map((r) => `${r.config.label}`).join(' | ') + ' |');
    push('| --- | --- | ' + keys.map(() => '---').join(' | ') + ' |');
    for (const header of wrongByAtLeastOne.sort((a, b) => a.localeCompare(b))) {
        const expected = labelFor(header);
        const cells = keys.map((key) => {
            const entry = results[key].ranked.get(header)[0];
            const name = entry.name === expected ? entry.name : `${entry.name} (miss)`;
            return `${name} ${entry.similarity.toFixed(3)}`;
        });
        push(`| ${header} | ${expected} | ${cells.join(' | ')} |`);
    }
    push();

    push('## Pairwise agreement on top-1');
    push();
    push('| pair | identical top-1 | first model top-1 in other top-' + TOP_N + ' |');
    push('| --- | --- | --- |');
    for (let i = 0; i < keys.length; i += 1) {
        for (let j = i + 1; j < keys.length; j += 1) {
            const left = results[keys[i]];
            const right = results[keys[j]];
            let identical = 0;
            let contained = 0;
            for (const header of headerList) {
                const leftList = left.ranked.get(header);
                const rightList = right.ranked.get(header);
                if (leftList[0].name === rightList[0].name) identical += 1;
                if (leftList.slice(0, TOP_N).some((entry) => entry.name === rightList[0].name)) contained += 1;
            }
            const pct = (n) => `${((n / headerList.length) * 100).toFixed(1)}%`;
            push(`| ${left.config.label} vs ${right.config.label} | ${identical} (${pct(identical)}) | ` +
                `${contained} (${pct(contained)}) |`);
        }
    }
    push();

    push('## Score distributions (top-1 per header)');
    push();
    push('| model | min | p25 | median | p75 | max |');
    push('| --- | --- | --- | --- | --- | --- |');
    for (const [key, result] of Object.entries(results)) {
        const scores = headerList.map((header) => result.ranked.get(header)[0].similarity).sort((a, b) => a - b);
        push(`| ${result.config.label} | ${percentile(scores, 0).toFixed(3)} | ${percentile(scores, 0.25).toFixed(3)} | ` +
            `${percentile(scores, 0.5).toFixed(3)} | ${percentile(scores, 0.75).toFixed(3)} | ${percentile(scores, 1).toFixed(3)} |`);
    }
    push();

    push('## Calibration: threshold and confidence bands');
    push();
    push('Derived from the labelled headers above, so the app can use fixed values.');
    push('A match is a suggestion whose similarity clears the threshold; the app');
    push(`then applies top-1 automatically and lists up to ${TOP_N}.`);
    push();

    for (const key of keys) {
        const result = results[key];
        const ranked = result.ranked;

        // Score of the expected field (a true match) versus the best competing
        // field (the noise ceiling for that header).
        const correctScores = [];
        const noiseScores = [];
        for (const header of labelled) {
            const expected = labelFor(header);
            const list = ranked.get(header);
            const correct = list.find((entry) => entry.name === expected);
            if (correct) correctScores.push(correct.similarity);
            const bestWrong = list.find((entry) => entry.name !== expected);
            if (bestWrong) noiseScores.push(bestWrong.similarity);
        }
        correctScores.sort((a, b) => a - b);
        noiseScores.sort((a, b) => a - b);

        push(`### ${result.config.label}`);
        push();
        push('| signal | p10 | p25 | median | p75 | p90 |');
        push('| --- | --- | --- | --- | --- | --- |');
        const row = (scores) => [0.1, 0.25, 0.5, 0.75, 0.9]
            .map((p) => percentile(scores, p).toFixed(3)).join(' | ');
        push(`| correct matches | ${row(correctScores)} |`);
        push(`| best incorrect match | ${row(noiseScores)} |`);
        push();

        // Sweep the full range any model can produce, so the optimum is interior
        // rather than clipped at the boundary.
        let bestF1 = null;
        const sweep = [];
        for (let threshold = 0.10; threshold <= 0.95001; threshold += 0.01) {
            let truePositives = 0;
            let falsePositives = 0;
            let falseNegatives = 0;
            for (const header of labelled) {
                const expected = labelFor(header);
                const accepted = ranked.get(header)
                    .filter((entry) => entry.similarity >= threshold)
                    .slice(0, TOP_N);
                truePositives += accepted.filter((entry) => entry.name === expected).length;
                falsePositives += accepted.filter((entry) => entry.name !== expected).length;
                if (!accepted.some((entry) => entry.name === expected)) falseNegatives += 1;
            }
            const precision = truePositives + falsePositives > 0
                ? truePositives / (truePositives + falsePositives) : 1;
            const recall = truePositives + falseNegatives > 0
                ? truePositives / (truePositives + falseNegatives) : 0;
            const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
            if (!bestF1 || f1 > bestF1.f1) bestF1 = { threshold, precision, recall, f1 };
            sweep.push({ threshold, precision, recall, f1 });
        }

        push('| threshold | precision | recall | F1 |');
        push('| --- | --- | --- | --- |');
        for (const entry of sweep) {
            if (Math.round(entry.threshold * 100) % 5 !== 0) continue;
            push(`| ${entry.threshold.toFixed(2)} | ${entry.precision.toFixed(3)} | ` +
                `${entry.recall.toFixed(3)} | ${entry.f1.toFixed(3)} |`);
        }
        push();

        // Round to two decimals so the app can carry clean constants.
        const threshold = Math.round(bestF1.threshold * 100) / 100;
        const high = Math.round(percentile(correctScores, 0.75) * 100) / 100;
        const medium = Math.round(percentile(correctScores, 0.5) * 100) / 100;

        push(`Best F1 at threshold **${threshold.toFixed(2)}** ` +
            `(precision ${bestF1.precision.toFixed(3)}, recall ${bestF1.recall.toFixed(3)}, ` +
            `F1 ${bestF1.f1.toFixed(3)}).`);
        push();
        push(`Recommended constants: threshold \`${threshold.toFixed(2)}\`, ` +
            `confidence bands high \`${high.toFixed(2)}\`, medium \`${medium.toFixed(2)}\`, ` +
            `low \`${threshold.toFixed(2)}\`.`);
        push();
    }

    push('## Per-file: top-1 for every header');
    push();
    for (const file of perFile) {
        push(`### ${relative(file.file)}`);
        push();
        push('| header | ' + keys.map((key) => `${results[key].config.label} top-1`).join(' | ') + ' |');
        push('| --- | ' + keys.map(() => '---').join(' | ') + ' |');
        for (const header of file.headers) {
            const cells = keys.map((key) => {
                const entry = results[key].ranked.get(header)?.[0];
                if (!entry) return '-';
                const expected = labelFor(header);
                const mark = expected ? (entry.name === expected ? '' : ' (miss)') : '';
                return `${entry.name} ${entry.similarity.toFixed(3)}${mark}`;
            });
            if (cells.every((cell) => cell === '-')) continue;
            push(`| ${header} | ${cells.join(' | ')} |`);
        }
        push();
    }

    const outPath = path.join(__dirname, 'results.md');
    fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
    console.log(`\nReport written to ${outPath}`);
}

main().catch((error) => {
    console.error('Comparison failed:', error);
    process.exit(1);
});
