import { appendValue, buildPrefilledMapping, finalizeRow } from '../../shared/presetUtils.js';

// Full Getty AAT URIs as they appear in serialized Linked Art JSON-LD
const AAT = {
  PRIMARY_NAME: 'http://vocab.getty.edu/aat/300404670',
  ACCESSION_NUMBER: 'http://vocab.getty.edu/aat/300312355',
  TYPE_OF_WORK: 'http://vocab.getty.edu/aat/300435443',
  STYLE: 'http://vocab.getty.edu/aat/300015646',
  NATIONALITY: 'http://vocab.getty.edu/aat/300379842',
  GENDER: 'http://vocab.getty.edu/aat/300055147',
  OCCUPATION: 'http://vocab.getty.edu/aat/300263369',
  DESCRIPTION: 'http://vocab.getty.edu/aat/300435416',
  BIOGRAPHY: 'http://vocab.getty.edu/aat/300435422',
  MATERIAL_STMT: 'http://vocab.getty.edu/aat/300435429',
  DIMENSION_STMT: 'http://vocab.getty.edu/aat/300435430',
  HEIGHT: 'http://vocab.getty.edu/aat/300055644',
  WIDTH: 'http://vocab.getty.edu/aat/300055647',
  DIGITAL_IMAGE: 'http://vocab.getty.edu/aat/300215302',
  WEB_PAGE: 'http://vocab.getty.edu/aat/300264578',
};

const LINKED_ART_CONTEXT = 'https://linked.art/ns/v1/linked-art.json';

const LINKED_ART_TYPES = new Set([
  'HumanMadeObject', 'ManMadeObject', 'DigitalObject', 'Person', 'Group', 'Place',
  'VisualItem', 'LinguisticObject', 'PropositionalObject', 'Period',
  'Type', 'Material', 'Language', 'MeasurementUnit', 'Currency',
  'Set', 'Activity', 'Event', 'Actor',
]);

// --- Low-level helpers ---

const ensureArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

// Normalize compact aat: prefix to full URI for comparison
const normalizeAatId = (id) => {
  if (!id || typeof id !== 'string') return null;
  if (id.startsWith('aat:')) return `http://vocab.getty.edu/aat/${id.slice(4)}`;
  return id;
};

// Extract a display label from an entity object (handles _label, label, and identified_by fallback)
const labelOf = (obj) => {
  if (!obj || typeof obj !== 'object') return null;
  const direct = obj._label ?? (obj.label !== undefined ? obj.label : undefined);
  if (direct != null) return direct;
  // Fallback: first Name in identified_by
  if (Array.isArray(obj.identified_by)) {
    const name = obj.identified_by.find((i) => i.type === 'Name');
    if (name) return name.value ?? name.content ?? null;
  }
  return null;
};
const labelsOf = (arr) => ensureArray(arr).map(labelOf).filter(Boolean);

// Check if any item in classified_as has the given AAT id (handles both compact and full URIs)
const hasAat = (classifiedAs, aat) =>
  ensureArray(classifiedAs).some((c) => normalizeAatId(c?.id) === aat);

// Get content from referred_to_by entries whose classified_as (or its nested classified_as) matches
const getStatements = (referredToBy, aat) =>
  ensureArray(referredToBy)
    .filter(
      (s) =>
        hasAat(s.classified_as, aat) ||
        ensureArray(s.classified_as).some((c) => hasAat(c.classified_as, aat))
    )
    .map((s) => s.value ?? s.content)
    .filter(Boolean);

// Get Name content from identified_by, optionally filtered to a specific classifier AAT
const getNames = (identifiedBy, nameAat = null) =>
  ensureArray(identifiedBy)
    .filter((item) => item.type === 'Name' && (!nameAat || hasAat(item.classified_as, nameAat)))
    .map((item) => item.value ?? item.content)
    .filter(Boolean);

// Get Identifier content filtered to a specific type classifier AAT
const getIdentifiers = (identifiedBy, typeAat) =>
  ensureArray(identifiedBy)
    .filter((item) => item.type === 'Identifier' && hasAat(item.classified_as, typeAat))
    .map((item) => item.value ?? item.content)
    .filter(Boolean);

// Get labels of Type references whose own classified_as contains a meta-classifier (e.g. Type of Work)
const getClassifiersByMeta = (classifiedAs, metaAat) =>
  ensureArray(classifiedAs)
    .filter((c) => hasAat(c.classified_as, metaAat))
    .map(labelOf)
    .filter(Boolean);

// Extract begin/end/label from a TimeSpan object
const extractTimespan = (ts) => ({
  label: ts?._label ?? null,
  begin: ts?.begin_of_the_begin ?? null,
  end: ts?.end_of_the_end ?? null,
});

// Extract digital image URLs from the representation array (via digitally_shown_by)
const extractImageUrls = (representation) =>
  ensureArray(representation)
    .flatMap((vi) => ensureArray(vi.digitally_shown_by))
    .flatMap((obj) => ensureArray(obj.access_point).map((ap) => ap?.id).filter(Boolean));

// Extract web page URL from subject_of (via digitally_carried_by classified as Web Page)
const extractWebPageUrl = (subjectOf) =>
  ensureArray(subjectOf)
    .flatMap((so) => ensureArray(so.digitally_carried_by))
    .filter((obj) => hasAat(obj.classified_as, AAT.WEB_PAGE))
    .flatMap((obj) => ensureArray(obj.access_point).map((ap) => ap?.id).filter(Boolean));

// Format a Dimension object to a human-readable string, using identified_by display name when available
const formatDimension = (d) => {
  const display = getNames(d.identified_by)[0];
  if (display) return display;
  if (d.value == null) return null;
  const unit = labelOf(d.unit);
  const kind = labelsOf(d.classified_as)[0];
  return [kind ? `${kind}:` : null, String(d.value), unit].filter(Boolean).join(' ');
};

// --- Detection ---

const hasLinkedArtContext = (data) => {
  const ctx = data?.['@context'];
  if (!ctx) return false;
  if (typeof ctx === 'string') return ctx === LINKED_ART_CONTEXT;
  if (Array.isArray(ctx)) return ctx.includes(LINKED_ART_CONTEXT);
  return false;
};

export const isLinkedArtShape = (data) => {
  if (Array.isArray(data)) return data.some(isLinkedArtShape);
  if (!data || typeof data !== 'object') return false;
  if (hasLinkedArtContext(data)) return true;
  if (Array.isArray(data['@graph'])) return data['@graph'].some((item) => LINKED_ART_TYPES.has(item?.type));
  return LINKED_ART_TYPES.has(data.type) && 'id' in data && '_label' in data;
};

// --- Entity collection ---

const collectEntities = (data) => {
  if (Array.isArray(data)) return data.flatMap(collectEntities);
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data['@graph'])) return data['@graph'].filter((e) => e && typeof e === 'object');
  return [data];
};

// --- Per-type field extraction ---

const appendSharedFields = (entity, bucket) => {
  appendValue(bucket, 'id', entity.id);
  appendValue(bucket, 'type', entity.type);
  appendValue(bucket, 'label', entity._label);
  const primary = getNames(entity.identified_by, AAT.PRIMARY_NAME);
  appendValue(bucket, 'name', primary.length ? primary : getNames(entity.identified_by));
  appendValue(bucket, 'collection', labelsOf(entity.member_of));
  appendValue(
    bucket,
    'equivalent_uri',
    ensureArray(entity.equivalent).map((e) => e?.id).filter(Boolean)
  );
};

const appendObjectFields = (entity, bucket) => {
  appendValue(bucket, 'accession_number', getIdentifiers(entity.identified_by, AAT.ACCESSION_NUMBER));
  appendValue(bucket, 'object_type', getClassifiersByMeta(entity.classified_as, AAT.TYPE_OF_WORK));
  appendValue(bucket, 'style', getClassifiersByMeta(entity.classified_as, AAT.STYLE));
  appendValue(bucket, 'description', getStatements(entity.referred_to_by, AAT.DESCRIPTION));
  appendValue(bucket, 'material_statement', getStatements(entity.referred_to_by, AAT.MATERIAL_STMT));
  appendValue(bucket, 'dimension_statement', getStatements(entity.referred_to_by, AAT.DIMENSION_STMT));
  appendValue(bucket, 'material', labelsOf(entity.made_of));

  const prod = entity.produced_by;
  if (prod) {
    // Gather artists from root and any sub-productions (part or consists_of)
    const artists = [
      ...labelsOf(prod.carried_out_by),
      ...ensureArray(prod.part).flatMap((sub) => labelsOf(sub.carried_out_by)),
      ...ensureArray(prod.consists_of).flatMap((sub) => labelsOf(sub.carried_out_by)),
    ];
    appendValue(bucket, 'artist', artists);
    appendValue(bucket, 'production_place', labelsOf(prod.took_place_at));
    appendValue(bucket, 'technique', labelsOf(prod.technique));
    const ts = extractTimespan(prod.timespan);
    if (ts.label) appendValue(bucket, 'production_date', ts.label);
    if (ts.begin) appendValue(bucket, 'production_date_earliest', ts.begin);
    if (ts.end) appendValue(bucket, 'production_date_latest', ts.end);
  }

  // All dimensions formatted as strings (preferred display form from identified_by, else value+unit)
  appendValue(bucket, 'dimensions', ensureArray(entity.dimension).map(formatDimension).filter(Boolean));

  appendValue(bucket, 'current_owner', labelsOf(entity.current_owner));
  appendValue(bucket, 'current_custodian', labelsOf(entity.current_custodian));
  appendValue(bucket, 'current_permanent_custodian', labelsOf(entity.current_permanent_custodian));
  appendValue(bucket, 'current_location', labelOf(entity.current_location));
  appendValue(bucket, 'current_permanent_location', labelOf(entity.current_permanent_location));
  appendValue(bucket, 'object_part_of', labelsOf(entity.part_of));
  // Textual works physically inscribed on or carried by the object
  appendValue(bucket, 'carries', labelsOf(entity.carries));
  // Visual works shown by the object (its iconography/appearance)
  appendValue(bucket, 'shows', labelsOf(entity.shows));

  // Activities the object was used for (exhibitions, etc.)
  const exhibitions = ensureArray(entity.used_for).map((act) => {
    const label = getNames(act.identified_by)[0] ?? act._label ?? null;
    const ts = act.timespan ? extractTimespan(act.timespan) : null;
    const datePart = ts?.label ?? (ts?.begin ? ts.begin.slice(0, 4) : null);
    return [label, datePart].filter(Boolean).join(' ') || null;
  }).filter(Boolean);
  appendValue(bucket, 'exhibition_history', exhibitions);

  // Destruction event with date
  const destruction = entity.destroyed_by;
  if (destruction) {
    const ts = extractTimespan(destruction.timespan);
    if (ts.label) appendValue(bucket, 'destruction_date', ts.label);
    else if (ts.begin) appendValue(bucket, 'destruction_date', ts.begin.slice(0, 4));
  }

  // Encounter events (discovery, field collection)
  ensureArray(entity.encountered_by).forEach((enc) => {
    const ts = extractTimespan(enc.timespan);
    const who = labelsOf(enc.carried_out_by);
    const place = labelsOf(enc.took_place_at);
    const datePart = ts?.label ?? (ts?.begin ? ts.begin.slice(0, 4) : null);
    const parts = [...who, ...place, datePart].filter(Boolean);
    if (parts.length) appendValue(bucket, 'encounter', parts.join(', '));
  });

  // Provenance from ownership changes (Provenance Activities linked via changed_ownership_through)
  ensureArray(entity.changed_ownership_through).forEach((prov) => {
    const ts = prov.timespan ? extractTimespan(prov.timespan) : null;
    const datePart = ts?.label ?? (ts?.begin ? ts.begin.slice(0, 4) : null);
    const acqs = ensureArray(prov.part).filter((p) => p.type === 'Acquisition');
    acqs.forEach((acq) => {
      const from = labelsOf(acq.transferred_title_from).join(', ');
      const to = labelsOf(acq.transferred_title_to).join(', ');
      const parts = [];
      if (from) parts.push(`from ${from}`);
      if (to) parts.push(`to ${to}`);
      if (datePart) parts.push(`(${datePart})`);
      if (parts.length) appendValue(bucket, 'provenance', parts.join(' '));
    });
    if (acqs.length === 0) {
      const label = getNames(prov.identified_by)[0] ?? prov._label;
      if (label) appendValue(bucket, 'provenance', datePart ? `${label} (${datePart})` : label);
    }
  });

  appendValue(bucket, 'image_url', extractImageUrls(entity.representation));
  appendValue(bucket, 'homepage_url', extractWebPageUrl(entity.subject_of));
};

const appendPersonFields = (entity, bucket) => {
  appendValue(bucket, 'nationality', getClassifiersByMeta(entity.classified_as, AAT.NATIONALITY));
  appendValue(bucket, 'gender', getClassifiersByMeta(entity.classified_as, AAT.GENDER));
  appendValue(bucket, 'occupation', getClassifiersByMeta(entity.classified_as, AAT.OCCUPATION));
  appendValue(bucket, 'biography', getStatements(entity.referred_to_by, AAT.BIOGRAPHY));
  appendValue(bucket, 'description', getStatements(entity.referred_to_by, AAT.DESCRIPTION));
  appendValue(bucket, 'residence', labelsOf(entity.residence));
  appendValue(bucket, 'contact_point', ensureArray(entity.contact_point).map((cp) => cp?.content ?? cp?.value).filter(Boolean));

  const birth = entity.born;
  if (birth) {
    appendValue(bucket, 'birth_place', labelsOf(birth.took_place_at));
    const ts = extractTimespan(birth.timespan);
    if (ts.label) appendValue(bucket, 'birth_date', ts.label);
    if (ts.begin) appendValue(bucket, 'birth_date_earliest', ts.begin);
    if (ts.end) appendValue(bucket, 'birth_date_latest', ts.end);
  }

  const death = entity.died;
  if (death) {
    appendValue(bucket, 'death_place', labelsOf(death.took_place_at));
    const ts = extractTimespan(death.timespan);
    if (ts.label) appendValue(bucket, 'death_date', ts.label);
    if (ts.begin) appendValue(bucket, 'death_date_earliest', ts.begin);
    if (ts.end) appendValue(bucket, 'death_date_latest', ts.end);
  }

  // Professional activities (active dates and places)
  ensureArray(entity.carried_out).forEach((act) => {
    const ts = extractTimespan(act.timespan);
    if (ts.label) appendValue(bucket, 'active_dates', ts.label);
    if (ts.begin) appendValue(bucket, 'active_date_begin', ts.begin);
    if (ts.end) appendValue(bucket, 'active_date_end', ts.end);
    appendValue(bucket, 'active_place', labelsOf(act.took_place_at));
  });

  appendValue(bucket, 'participated_in', ensureArray(entity.participated_in).map((act) => getNames(act.identified_by)[0] ?? act._label).filter(Boolean));

  appendValue(bucket, 'image_url', extractImageUrls(entity.representation));
  appendValue(bucket, 'homepage_url', extractWebPageUrl(entity.subject_of));
};

const appendGroupFields = (entity, bucket) => {
  appendValue(bucket, 'nationality', getClassifiersByMeta(entity.classified_as, AAT.NATIONALITY));
  appendValue(bucket, 'biography', getStatements(entity.referred_to_by, AAT.BIOGRAPHY));
  appendValue(bucket, 'description', getStatements(entity.referred_to_by, AAT.DESCRIPTION));
  appendValue(bucket, 'residence', labelsOf(entity.residence));
  appendValue(bucket, 'contact_point', ensureArray(entity.contact_point).map((cp) => cp?.content ?? cp?.value).filter(Boolean));

  const formation = entity.formed_by;
  if (formation) {
    appendValue(bucket, 'formation_place', labelsOf(formation.took_place_at));
    const ts = extractTimespan(formation.timespan);
    if (ts.label) appendValue(bucket, 'formation_date', ts.label);
    if (ts.begin) appendValue(bucket, 'formation_date_earliest', ts.begin);
    if (ts.end) appendValue(bucket, 'formation_date_latest', ts.end);
  }

  const dissolution = entity.dissolved_by;
  if (dissolution) {
    const ts = extractTimespan(dissolution.timespan);
    if (ts.label) appendValue(bucket, 'dissolution_date', ts.label);
    if (ts.begin) appendValue(bucket, 'dissolution_date_earliest', ts.begin);
    if (ts.end) appendValue(bucket, 'dissolution_date_latest', ts.end);
  }

  // Professional activities (active dates and places)
  ensureArray(entity.carried_out).forEach((act) => {
    const ts = extractTimespan(act.timespan);
    if (ts.label) appendValue(bucket, 'active_dates', ts.label);
    if (ts.begin) appendValue(bucket, 'active_date_begin', ts.begin);
    if (ts.end) appendValue(bucket, 'active_date_end', ts.end);
    appendValue(bucket, 'active_place', labelsOf(act.took_place_at));
  });

  appendValue(bucket, 'participated_in', ensureArray(entity.participated_in).map((act) => getNames(act.identified_by)[0] ?? act._label).filter(Boolean));

  appendValue(bucket, 'image_url', extractImageUrls(entity.representation));
  appendValue(bucket, 'homepage_url', extractWebPageUrl(entity.subject_of));
};

const appendPlaceFields = (entity, bucket) => {
  appendValue(bucket, 'parent_place', labelOf(entity.part_of));
  appendValue(bucket, 'place_type', labelsOf(entity.classified_as));
  appendValue(bucket, 'coordinates', entity.defined_by);
  appendValue(bucket, 'description', getStatements(entity.referred_to_by, AAT.DESCRIPTION));
};

const appendSetFields = (entity, bucket) => {
  appendValue(bucket, 'description', getStatements(entity.referred_to_by, AAT.DESCRIPTION));
  appendValue(bucket, 'set_type', labelsOf(entity.classified_as));
  appendValue(bucket, 'set_about', labelsOf(entity.about));
  if (entity.created_by) {
    appendValue(bucket, 'set_creator', labelsOf(entity.created_by.carried_out_by));
    const ts = extractTimespan(entity.created_by.timespan);
    if (ts.label) appendValue(bucket, 'set_creation_date', ts.label);
    if (ts.begin) appendValue(bucket, 'set_creation_date_earliest', ts.begin);
    if (ts.end) appendValue(bucket, 'set_creation_date_latest', ts.end);
    appendValue(bucket, 'set_creation_place', labelsOf(entity.created_by.took_place_at));
  }
};

const appendWorkFields = (entity, bucket) => {
  appendValue(bucket, 'work_type', getClassifiersByMeta(entity.classified_as, AAT.TYPE_OF_WORK));
  appendValue(bucket, 'description', getStatements(entity.referred_to_by, AAT.DESCRIPTION));
  appendValue(bucket, 'language', labelsOf(entity.language));
  appendValue(bucket, 'content', entity.content);
  appendValue(bucket, 'about', labelsOf(entity.about));
  // For VisualItem: entities this visual work represents or depicts
  appendValue(bucket, 'represents', labelsOf(entity.represents));
  appendValue(bucket, 'represents_type', labelsOf(entity.represents_instance_of_type));
  if (entity.created_by) {
    appendValue(bucket, 'author', labelsOf(entity.created_by.carried_out_by));
    const ts = extractTimespan(entity.created_by.timespan);
    if (ts.label) appendValue(bucket, 'work_creation_date', ts.label);
    if (ts.begin) appendValue(bucket, 'work_creation_date_earliest', ts.begin);
    if (ts.end) appendValue(bucket, 'work_creation_date_latest', ts.end);
    appendValue(bucket, 'work_creation_place', labelsOf(entity.created_by.took_place_at));
  }
  // Publication activities (publisher, place, date)
  ensureArray(entity.used_for).forEach((pub) => {
    appendValue(bucket, 'publisher', labelsOf(pub.carried_out_by));
    appendValue(bucket, 'publication_place', labelsOf(pub.took_place_at));
    const ts = extractTimespan(pub.timespan);
    if (ts.label) appendValue(bucket, 'publication_date', ts.label);
    if (ts.begin) appendValue(bucket, 'publication_date_earliest', ts.begin);
  });
};

const appendEventFields = (entity, bucket) => {
  const ts = extractTimespan(entity.timespan);
  if (ts.label) appendValue(bucket, 'date', ts.label);
  if (ts.begin) appendValue(bucket, 'date_begin', ts.begin);
  if (ts.end) appendValue(bucket, 'date_end', ts.end);
  appendValue(bucket, 'place', labelsOf(entity.took_place_at));
  appendValue(bucket, 'carried_out_by', labelsOf(entity.carried_out_by));
  appendValue(bucket, 'participant', labelsOf(entity.participant));
  appendValue(bucket, 'description', getStatements(entity.referred_to_by, AAT.DESCRIPTION));
  // Provenance Activity: extract Acquisition and Payment parts
  ensureArray(entity.part)
    .filter((p) => p.type === 'Acquisition')
    .forEach((acq) => {
      const from = labelsOf(acq.transferred_title_from).join(', ');
      const to = labelsOf(acq.transferred_title_to).join(', ');
      const parts = [];
      if (from) parts.push(`from ${from}`);
      if (to) parts.push(`to ${to}`);
      if (parts.length) appendValue(bucket, 'ownership_transfer', parts.join(' '));
    });
  ensureArray(entity.part)
    .filter((p) => p.type === 'Payment' && p.paid_amount)
    .forEach((pmt) => {
      const amt = pmt.paid_amount;
      const currency = labelOf(amt.currency) ?? '';
      const from = labelsOf(pmt.paid_from).join(', ');
      const to = labelsOf(pmt.paid_to).join(', ');
      const parts = [amt.value != null ? `${amt.value} ${currency}`.trim() : null, from && `from ${from}`, to && `to ${to}`].filter(Boolean);
      if (parts.length) appendValue(bucket, 'payment', parts.join(' '));
    });
};

const appendConceptFields = (entity, bucket) => {
  appendValue(bucket, 'broader', labelsOf(entity.broader));
  appendValue(bucket, 'description', getStatements(entity.referred_to_by, AAT.DESCRIPTION));
};

const appendDigitalObjectFields = (entity, bucket) => {
  appendValue(bucket, 'format', entity.format);
  appendValue(bucket, 'access_url', ensureArray(entity.access_point).map((ap) => ap?.id).filter(Boolean));
  appendValue(bucket, 'description', getStatements(entity.referred_to_by, AAT.DESCRIPTION));
  // File dimensions (e.g. pixel width/height, file size in bytes)
  appendValue(bucket, 'dimensions', ensureArray(entity.dimension).map(formatDimension).filter(Boolean));
  // Works carried or shown digitally
  appendValue(bucket, 'digital_carries', labelsOf(entity.digitally_carries));
  appendValue(bucket, 'digital_shows', labelsOf(entity.digitally_shows));
  appendValue(bucket, 'digital_part_of', labelsOf(entity.part_of));
  if (entity.created_by) {
    appendValue(bucket, 'creator', labelsOf(entity.created_by.carried_out_by));
    const ts = extractTimespan(entity.created_by.timespan);
    if (ts.label) appendValue(bucket, 'digital_creation_date', ts.label);
  }
};

// --- Entity projection ---

const FIELD_APPENDERS = {
  HumanMadeObject: appendObjectFields,
  ManMadeObject: appendObjectFields,
  Person: appendPersonFields,
  Group: appendGroupFields,
  Place: appendPlaceFields,
  Set: appendSetFields,
  LinguisticObject: appendWorkFields,
  VisualItem: appendWorkFields,
  PropositionalObject: appendWorkFields,
  Activity: appendEventFields,
  Event: appendEventFields,
  Period: appendEventFields,
  Type: appendConceptFields,
  Material: appendConceptFields,
  Language: appendConceptFields,
  MeasurementUnit: appendConceptFields,
  Currency: appendConceptFields,
  DigitalObject: appendDigitalObjectFields,
};

const projectEntity = (entity) => {
  if (!entity || typeof entity !== 'object' || !entity.type) return null;
  const bucket = {};
  appendSharedFields(entity, bucket);
  FIELD_APPENDERS[entity.type]?.(entity, bucket);
  return finalizeRow(bucket);
};

// Maps extracted field names to ontology field names for pre-filling the import mapping step
const FIELD_TO_ONTOLOGY = {
  // Identity
  type:                'object type',
  accession_number:    'object id',
  id:                  'object id',
  label:               'designation',
  name:                'description',
  equivalent_uri:      'weblink',

  // Statements & description
  description:         'description',
  biography:           'description',
  content:             'description',
  material_statement:  'material',
  dimension_statement: 'dimensions',
  dimensions:          'dimensions',
  about:               'iconography',
  represents:          'iconography',
  represents_type:     'iconography',
  set_about:           'iconography',

  // Classification
  object_type:         'object type',
  work_type:           'object type',
  set_type:            'object type',
  style:               'ethnic attribution',
  nationality:         'ethnic attribution',

  // Materials
  material:            'material',

  // Production / creation
  artist:                       'producer',
  author:                       'producer',
  creator:                      'producer',
  carried_out_by:               'producer',
  publisher:                    'producer',
  set_creator:                  'producer',
  technique:                    'production technique',
  production_place:             'production place',
  work_creation_place:          'production place',
  publication_place:            'production place',
  set_creation_place:           'production place',
  production_date:              'date made',
  production_date_earliest:     'date made',
  production_date_latest:       'date made',
  work_creation_date:           'date made',
  work_creation_date_earliest:  'date made',
  work_creation_date_latest:    'date made',
  publication_date:             'date made',
  publication_date_earliest:    'date made',
  set_creation_date:            'date made',
  set_creation_date_earliest:   'date made',
  set_creation_date_latest:     'date made',

  // Person dates (birth → date made; death → notes)
  birth_date:              'date made',
  birth_date_earliest:     'date made',
  birth_date_latest:       'date made',
  death_date:              'notes',
  death_date_earliest:     'notes',
  death_date_latest:       'notes',

  // Group dates (formation → date made; dissolution → notes)
  formation_date:               'date made',
  formation_date_earliest:      'date made',
  formation_date_latest:        'date made',
  dissolution_date:             'notes',
  dissolution_date_earliest:    'notes',
  dissolution_date_latest:      'notes',

  // Active dates (carried_out activities)
  active_dates:       'date made',
  active_date_begin:  'date made',
  active_date_end:    'date made',

  // Event dates
  date:       'event',
  date_begin: 'event',
  date_end:   'event',

  // Places
  birth_place:         'place collected',
  formation_place:     'place collected',
  place:               'place collected',
  active_place:        'place collected',
  death_place:         'notes',
  production_location: 'production place',

  // Provenance & ownership
  current_owner:                'provenance',
  prior_owner:                  'prior source',
  provenance:                   'provenance',
  ownership_transfer:           'provenance',
  current_location:             'display status',
  current_custodian:            'notes',
  current_permanent_custodian:  'notes',
  current_permanent_location:   'notes',
  object_part_of:               'notes',
  encounter:                    'notes',

  // Object content / physical links
  carries:             'notes',
  shows:               'iconography',

  // Activities & events
  exhibition_history:  'exhibition history',
  participated_in:     'event',
  payment:             'notes',

  // Condition / modification
  destruction_date:    'notes',

  // People attributes
  gender:      'notes',
  occupation:  'notes',
  residence:   'notes',
  contact_point: 'notes',

  // Concept hierarchy
  broader:     'notes',

  // Place attributes
  parent_place:  'notes',
  place_type:    'notes',
  coordinates:   'notes',

  // Works attributes
  language:           'notes',
  digital_carries:    'notes',
  digital_shows:      'notes',
  digital_part_of:    'notes',
  digital_creation_date: 'notes',

  // Media & links
  image_url:    'images',
  homepage_url: 'weblink',
  access_url:   'weblink',
  format:       'notes',

  // Collection membership
  collection: 'department and institution',
};

// --- Public API ---

export const extractLinkedArtProjection = (data) => {
  const rows = collectEntities(data)
    .map(projectEntity)
    .filter((r) => r && Object.keys(r).length > 0);

  const mapping = buildPrefilledMapping(rows, ['name', 'label', 'id']);
  const prefilledMapping = mapping.map((entry) => ({
    ...entry,
    mappedFieldName: FIELD_TO_ONTOLOGY[entry.headerField] ?? null,
  }));

  return { rows, prefilledMapping, warnings: [] };
};
