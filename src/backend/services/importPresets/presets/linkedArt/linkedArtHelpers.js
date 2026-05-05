import { appendValue, buildPrefilledMapping, finalizeRow } from '../../shared/presetUtils.js';

// --- Lookup tables ---

const LINKED_ART_CONTEXT = 'https://linked.art/ns/v1/linked-art.json';

const LINKED_ART_TYPES = new Set([
  'HumanMadeObject', 'ManMadeObject', 'DigitalObject', 'Person', 'Group', 'Place',
  'VisualItem', 'LinguisticObject', 'PropositionalObject', 'Period', 'Type',
  'Material', 'Language', 'MeasurementUnit', 'Currency', 'Set', 'Activity', 'Event', 'Actor',
]);

const AAT = {
  PRIMARY_NAME:   'http://vocab.getty.edu/aat/300404670',
  ACCESSION_NUM:  'http://vocab.getty.edu/aat/300312355',
  TYPE_OF_WORK:   'http://vocab.getty.edu/aat/300435443',
  STYLE:          'http://vocab.getty.edu/aat/300015646',
  NATIONALITY:    'http://vocab.getty.edu/aat/300379842',
  GENDER:         'http://vocab.getty.edu/aat/300055147',
  OCCUPATION:     'http://vocab.getty.edu/aat/300263369',
  DESCRIPTION:    'http://vocab.getty.edu/aat/300435416',
  BIOGRAPHY:      'http://vocab.getty.edu/aat/300435422',
  MATERIAL_STMT:  'http://vocab.getty.edu/aat/300435429',
  DIMENSION_STMT: 'http://vocab.getty.edu/aat/300435430',
  WEB_PAGE:       'http://vocab.getty.edu/aat/300264578',
};

const AAT_LANG_CODES = {
  'http://vocab.getty.edu/aat/300388277': 'en',
  'http://vocab.getty.edu/aat/300388256': 'nl',
  'http://vocab.getty.edu/aat/300388254': 'de',
  'http://vocab.getty.edu/aat/300388263': 'fr',
  'http://vocab.getty.edu/aat/300389269': 'es',
  'http://vocab.getty.edu/aat/300389246': 'it',
  'http://vocab.getty.edu/aat/300389171': 'pt',
  'http://vocab.getty.edu/aat/300388255': 'da',
  'http://vocab.getty.edu/aat/300388258': 'sv',
  'http://vocab.getty.edu/aat/300388261': 'fi',
};

const AAT_UNIT_LABELS = {
  'http://vocab.getty.edu/aat/300379098': 'cm',
  'http://vocab.getty.edu/aat/300379099': 'm',
  'http://vocab.getty.edu/aat/300379097': 'mm',
  'http://vocab.getty.edu/aat/300379100': 'in',
  'http://vocab.getty.edu/aat/300265869': 'kg',
  'http://vocab.getty.edu/aat/300265870': 'g',
};

const FIELD_TO_ONTOLOGY = {
  id: 'object id',
  type: 'object type',
  label: 'designation',
  name: 'description',
  accession_number: 'object id',
  description: 'description',
  biography: 'description',
  material_statement: 'material',
  dimension_statement: 'dimensions',
  dimension: 'dimensions',
  object_type: 'object type',
  work_type: 'object type',
  set_type: 'object type',
  set_about: 'iconography',
  style: 'ethnic attribution',
  nationality: 'ethnic attribution',
  material: 'material',
  collection: 'department and institution',
  equivalent_uri: 'weblink',
  current_location: 'display status',
  current_permanent_location: 'notes',
  current_owner: 'provenance',
  current_custodian: 'notes',
  current_permanent_custodian: 'notes',
  object_part_of: 'notes',
  about: 'iconography',
  represents: 'iconography',
  represents_type: 'iconography',
  broader: 'notes',
  gender: 'notes',
  occupation: 'notes',
  language: 'notes',
  digital_carries: 'notes',
  digital_shows: 'notes',
  digital_part_of: 'notes',
  image_url: 'images',
  homepage_url: 'weblink',
  access_url: 'weblink',
  classified_as: 'object type',
  referred_to_by: 'notes',
};

// Keys skipped during generic recursive flattening.
// Only keys whose values are consumed *inline* by flatten/textOf/labelOf belong here.
// Domain keys handled by appendAliases are NOT listed — they must still be traversed
// generically so no content is lost when they appear deeper in the tree.
const SKIP_KEYS = new Set([
  '@context', '@graph',            // JSON-LD document wrappers
  'id', 'type', '_label', 'label', // entity identity — emitted via appendAliases
  'classified_as', 'equivalent', 'notation', // consumed inline by hasAat / textOf
  'language', '@language', '@value',         // consumed inline by langCodesOf / textOf
  'content', 'value',                        // consumed inline by textOf (text of LinguisticObject / Dimension)
  'access_point',                            // consumed inline as URL fallback in flatten
  'identified_by',                           // consumed by labelOf; appendAliases emits clean name.* aliases
]);

// --- Micro-helpers ---

// Wraps any value in an array; returns [] for null/undefined.
const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

// Expands compact AAT URIs (aat:300404670 → full http://vocab.getty.edu/aat/... URL).
const normalizeAat = (id) =>
  typeof id === 'string' && id.startsWith('aat:')
    ? `http://vocab.getty.edu/aat/${id.slice(4)}`
    : id;

// Returns true if any entry in `classifiedAs` matches the given full AAT URI.
const hasAat = (classifiedAs, aat) =>
  arr(classifiedAs).some((c) => normalizeAat(c?.id ?? c) === aat);

// Maps a Linked Art `language[]` array to ISO 639-1 codes.
// Resolves Getty AAT language URIs (e.g. aat:300388277 → 'en'), falls back to
// @language inline values or the last URI path segment.
const langCodesOf = (language) =>
  [...new Set(
    arr(language).map((l) => {
      const id = normalizeAat(l?.id) ?? l?.id;
      return l?.['@language'] ?? AAT_LANG_CODES[id] ?? id?.split('/').pop() ?? null;
    }).filter(Boolean),
  )];

// Returns the best plain-text value directly on a node without deep recursion.
// Checks @value (JSON-LD), value/content (LinguisticObject), _label/label, then
// SKOS notation entries (preferring English).
const textOf = (node) => {
  if (node == null) return null;
  if (typeof node !== 'object') return String(node);
  const v = node['@value'] ?? node.value ?? node.content ?? node._label ?? node.label;
  if (v != null) return String(v);
  // SKOS notation: [{@language, @value}]
  const notes = arr(node.notation);
  const hit = notes.find((n) => n?.['@language'] === 'en') ?? notes[0];
  return hit?.['@value'] ? String(hit['@value']) : null;
};

// Returns the best human-readable label for any Linked Art node.
// Strategy: direct text via textOf → identified_by Names (primary names first)
// → concatenated part texts. Returns null if nothing is found.
const labelOf = (node) => {
  if (!node || typeof node !== 'object') return null;
  const direct = textOf(node);
  if (direct) return direct;
  // Try identified_by, preferring primary names
  const candidates = arr(node.identified_by)
    .filter((n) => n?.type === 'Name' || n?.type === 'Identifier')
    .sort((a, b) => (hasAat(b.classified_as, AAT.PRIMARY_NAME) ? 1 : 0) - (hasAat(a.classified_as, AAT.PRIMARY_NAME) ? 1 : 0));
  for (const n of candidates) {
    const t = textOf(n) ?? arr(n.part).map(textOf).filter(Boolean).join(' / ');
    if (t) return t;
  }
  const parts = arr(node.part).map(textOf).filter(Boolean);
  return parts.length ? parts.join(' / ') : null;
};

// --- Recursive flattener ---
// Traverses any Linked Art value tree and emits every leaf into `bucket` at its
// natural dot-separated field path.  The caller passes `langs` (ISO codes) so
// language context discovered higher up (e.g. on a `referred_to_by` entry) can
// be applied to child nodes that do not carry their own `language` property.
//
// Rules:
//   array   → recurse each item at the same path
//   primitive → emit at `path` or `path.<lang>` for each active language code
//   object  → read own `language` array (overrides inherited langs), then:
//     - if path ends in `.dimension`: emit `<path>.<kind>=<value> <unit>` and stop
//     - always emit the node's summary label (or access_point URL) at the current path
//     - recurse into all non-SKIP_KEYS children; `part` children inherit active langs
function flatten(bucket, path, value, langs = []) {
  if (value == null) return;

  if (Array.isArray(value)) {
    value.forEach((item) => flatten(bucket, path, item, langs));
    return;
  }

  if (typeof value !== 'object') {
    const keys = langs.length ? langs : [null];
    keys.forEach((l) => appendValue(bucket, l ? `${path}.${l}` : path, value));
    return;
  }

  const ownLangs = langCodesOf(value.language);
  const activeLangs = ownLangs.length ? ownLangs : langs;

  // Dimension item: emit as `<path>.<kind> = "value unit"` and stop recursing
  if (path === 'dimension' || path.endsWith('.dimension')) {
    const kind = arr(value.classified_as).map((c) => labelOf(c) ?? textOf(c)).filter(Boolean)[0];
    if (value.value != null && kind) {
      const unitId = normalizeAat(value.unit?.id);
      const unit = labelOf(value.unit) ?? AAT_UNIT_LABELS[unitId] ?? null;
      const dimPath = `${path}.${kind.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
      appendValue(bucket, dimPath, [String(value.value), unit].filter(Boolean).join(' '));
      return;
    }
  }

  // Emit the node's summary label (or access_point URL as fallback)
  const summary = labelOf(value) ?? arr(value.access_point).map((p) => p?.id).filter(Boolean)[0] ?? null;
  if (summary) {
    const keys = activeLangs.length ? activeLangs : [null];
    keys.forEach((l) => appendValue(bucket, l ? `${path}.${l}` : path, summary));
  }

  // Recurse into non-structural children; pass language context into `part` sub-objects
  for (const [key, child] of Object.entries(value)) {
    if (SKIP_KEYS.has(key)) continue;
    flatten(bucket, `${path}.${key}`, child, key === 'part' ? activeLangs : []);
  }
}

// --- Curated alias extraction ---
// Emits a fixed set of well-known Linked Art fields into `bucket` under clean,
// human-readable keys (e.g. name.en, description.nl, accession_number, image_url).
// This runs before the generic `flatten` pass; finalizeRow deduplicates any overlap.
const appendAliases = (entity, bucket) => {
  appendValue(bucket, 'id', entity.id);
  appendValue(bucket, 'type', entity.type);
  appendValue(bucket, 'label', entity._label ?? labelOf(entity));

  // Names by language (prefer AAT primary names)
  const allNames = arr(entity.identified_by).filter((n) => n?.type === 'Name');
  const primaryNames = allNames.filter((n) => hasAat(n.classified_as, AAT.PRIMARY_NAME));
  (primaryNames.length ? primaryNames : allNames).forEach((n) => {
    const text = textOf(n) ?? arr(n.part).map(textOf).filter(Boolean).join(' / ');
    if (!text) return;
    const codes = langCodesOf(n.language);
    codes.length
      ? codes.forEach((c) => appendValue(bucket, `name.${c}`, text))
      : appendValue(bucket, 'name', text);
  });

  // Statements (description, biography, etc.) by language
  const emitStatement = (aat, field) =>
    arr(entity.referred_to_by)
      .filter((s) => hasAat(s.classified_as, aat) || arr(s.classified_as).some((c) => hasAat(c.classified_as, aat)))
      .forEach((s) => {
        const text = s.value ?? s.content;
        if (!text) return;
        const codes = langCodesOf(s.language);
        codes.length
          ? codes.forEach((c) => appendValue(bucket, `${field}.${c}`, text))
          : appendValue(bucket, field, text);
      });
  emitStatement(AAT.DESCRIPTION, 'description');
  emitStatement(AAT.BIOGRAPHY, 'biography');
  emitStatement(AAT.MATERIAL_STMT, 'material_statement');
  emitStatement(AAT.DIMENSION_STMT, 'dimension_statement');

  // Accession number
  arr(entity.identified_by)
    .filter((n) => n?.type === 'Identifier' && hasAat(n.classified_as, AAT.ACCESSION_NUM))
    .forEach((n) => appendValue(bucket, 'accession_number', n.value ?? n.content));

  // Typed classifications
  const classLabels = (aat) =>
    arr(entity.classified_as).filter((c) => hasAat(c.classified_as, aat)).map(labelOf).filter(Boolean);
  appendValue(bucket, 'style',       classLabels(AAT.STYLE));
  appendValue(bucket, 'nationality', classLabels(AAT.NATIONALITY));
  appendValue(bucket, 'gender',      classLabels(AAT.GENDER));
  appendValue(bucket, 'occupation',  classLabels(AAT.OCCUPATION));

  const isObject = entity.type === 'HumanMadeObject' || entity.type === 'ManMadeObject';
  const isWork   = entity.type === 'LinguisticObject' || entity.type === 'VisualItem' || entity.type === 'PropositionalObject';
  if (isObject) appendValue(bucket, 'object_type', classLabels(AAT.TYPE_OF_WORK));
  if (isWork)   appendValue(bucket, 'work_type',   classLabels(AAT.TYPE_OF_WORK));
  if (entity.type === 'Set') {
    appendValue(bucket, 'set_type',  arr(entity.classified_as).map(labelOf).filter(Boolean));
    appendValue(bucket, 'set_about', arr(entity.about).map(labelOf).filter(Boolean));
  }
  // Catch-all: emit all classified_as labels (specific typed ones already emitted above)
  appendValue(bucket, 'classified_as', arr(entity.classified_as).map(labelOf).filter(Boolean));

  // Relations
  appendValue(bucket, 'collection',                   arr(entity.member_of).map(labelOf).filter(Boolean));
  appendValue(bucket, 'equivalent_uri',               arr(entity.equivalent).map((e) => e?.id).filter(Boolean));
  appendValue(bucket, 'current_location',             labelOf(entity.current_location));
  appendValue(bucket, 'current_permanent_location',   labelOf(entity.current_permanent_location));
  appendValue(bucket, 'current_owner',                arr(entity.current_owner).map(labelOf).filter(Boolean));
  appendValue(bucket, 'current_custodian',            arr(entity.current_custodian).map(labelOf).filter(Boolean));
  appendValue(bucket, 'current_permanent_custodian',  arr(entity.current_permanent_custodian).map(labelOf).filter(Boolean));
  appendValue(bucket, 'material',                     arr(entity.made_of).map(labelOf).filter(Boolean));
  appendValue(bucket, 'language',                     arr(entity.language).map(labelOf).filter(Boolean));
  appendValue(bucket, 'broader',                      arr(entity.broader).map(labelOf).filter(Boolean));
  appendValue(bucket, 'about',                        arr(entity.about).map(labelOf).filter(Boolean));
  appendValue(bucket, 'represents',                   arr(entity.represents).map(labelOf).filter(Boolean));
  appendValue(bucket, 'represents_type',              arr(entity.represents_instance_of_type).map(labelOf).filter(Boolean));
  appendValue(bucket, 'digital_carries',              arr(entity.digitally_carries).map(labelOf).filter(Boolean));
  appendValue(bucket, 'digital_shows',                arr(entity.digitally_shows).map(labelOf).filter(Boolean));
  appendValue(bucket, 'digital_part_of',              arr(entity.part_of).map(labelOf).filter(Boolean));
  appendValue(bucket, 'object_part_of',               arr(entity.part_of).map(labelOf).filter(Boolean));
  appendValue(bucket, 'access_url',                   arr(entity.access_point).map((p) => p?.id).filter(Boolean));

  appendValue(bucket, 'image_url',
    arr(entity.representation)
      .flatMap((v) => arr(v.digitally_shown_by))
      .flatMap((d) => arr(d.access_point).map((p) => p?.id))
      .filter(Boolean));

  appendValue(bucket, 'homepage_url',
    arr(entity.subject_of)
      .flatMap((s) => arr(s.digitally_carried_by))
      .filter((d) => hasAat(d.classified_as, AAT.WEB_PAGE))
      .flatMap((d) => arr(d.access_point).map((p) => p?.id))
      .filter(Boolean));
};

// --- Entity projection ---

// Produces a flat row object for a single Linked Art entity.
// First runs appendAliases for curated fields, then the generic flatten pass for
// everything else. After finalizeRow, removes any header whose value is a bare
// integer and that has child headers (e.g. `produced_by = 1` when
// `produced_by.carried_out_by` already carries the real data).
const projectEntity = (entity) => {
  if (!entity?.type) return null;
  const bucket = {};
  appendAliases(entity, bucket);
  for (const [key, value] of Object.entries(entity)) {
    if (SKIP_KEYS.has(key)) continue;
    flatten(bucket, key, value);
  }
  const row = finalizeRow(bucket);
  // Drop numeric summaries for keys whose children carry the actual data
  for (const k of Object.keys(row)) {
    if (Object.keys(row).some((c) => c.startsWith(`${k}.`)) && /^\d+$/.test(String(row[k]).trim()))
      delete row[k];
  }
  return Object.keys(row).length ? row : null;
};

// --- Detection & collection ---

// Returns true if the data looks like a Linked Art document.
// Accepts: single entity, arrays of entities, or @graph containers.
export const isLinkedArtShape = (data) => {
  if (Array.isArray(data)) return data.some(isLinkedArtShape);
  if (!data || typeof data !== 'object') return false;
  const ctx = data['@context'];
  if (ctx === LINKED_ART_CONTEXT || (Array.isArray(ctx) && ctx.includes(LINKED_ART_CONTEXT))) return true;
  if (Array.isArray(data['@graph'])) return data['@graph'].some((item) => LINKED_ART_TYPES.has(item?.type));
  return LINKED_ART_TYPES.has(data.type) && 'id' in data;
};

// Extracts the list of individual entity objects from any supported input shape:
// array of entities, @graph container, or a single entity object.
const collectEntities = (data) => {
  if (Array.isArray(data)) return data.flatMap(collectEntities);
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data['@graph'])) return data['@graph'].filter((item) => item && typeof item === 'object');
  return [data];
};

// --- Ontology hint ---

// Maps a parsed header field name to an ontology field name for pre-filling the
// import mapping UI.  Tries three strategies in order:
//   1. Exact match in FIELD_TO_ONTOLOGY
//   2. Strip a trailing language suffix (e.g. `name.en` → `name`) and match again
//   3. Any `dimension.<kind>` header maps to the generic `dimensions` ontology field
const getOntologyHint = (field) => {
  if (FIELD_TO_ONTOLOGY[field]) return FIELD_TO_ONTOLOGY[field];
  const segs = field.split('.');
  if (/^[a-z]{2,3}$/i.test(segs.at(-1))) {
    const base = segs.slice(0, -1).join('.');
    if (FIELD_TO_ONTOLOGY[base]) return FIELD_TO_ONTOLOGY[base];
  }
  if (segs[0] === 'dimension' && segs.length === 2) return FIELD_TO_ONTOLOGY.dimension;
  return null;
};

// --- Public API ---

export const extractLinkedArtProjection = (data) => {
  const rows = collectEntities(data).map(projectEntity).filter(Boolean);
  const headers = [...new Set(rows.flatMap(Object.keys))];
  const primaryHeader =
    headers.find((h) => h === 'name' || h.startsWith('name.')) ??
    headers.find((h) => h === 'label' || h.startsWith('label.')) ??
    'id';
  const mapping = buildPrefilledMapping(rows, [primaryHeader]);
  return {
    rows,
    prefilledMapping: mapping.map((e) => ({ ...e, mappedFieldName: getOntologyHint(e.headerField) })),
    warnings: [],
  };
};
