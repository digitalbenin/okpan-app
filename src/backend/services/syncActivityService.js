import { and, eq, gte, isNull } from 'drizzle-orm';
import { db } from '../../db/init.js';
import {
  project_activity,
  research_fields,
  texts,
  translations,
  vocabularies
} from '../../db/schema.js';
import {
  ACTIVITY_GROUP_WINDOW_MS,
  IGNORED_ACTIVITY_TABLES,
  TEXT_OWNER_DEFINITIONS,
  findActivityFeedDefinition,
  resolveActivityMessageKey
} from '../../lib/constants/activityFeedDefinitions.js';

function parseJsonField(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeSummaryParams(value) {
  const params = parseJsonField(value);

  if (!params || typeof params !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(params).filter(([, entryValue]) => entryValue !== null && entryValue !== undefined)
  );
}

function getChangePayload(change) {
  return change.op === 'DELETE'
    ? parseJsonField(change.old_row)
    : parseJsonField(change.new_row);
}

function addEntityId(entityIdsByType, entityType, entityId) {
  if (!entityType || !entityId) {
    return;
  }

  const entityIds = entityIdsByType.get(entityType) || new Set();
  entityIds.add(String(entityId));
  entityIdsByType.set(entityType, entityIds);
}

function hasEntityInBatch(entityIdsByType, entityType, entityId) {
  if (!entityType || !entityId) {
    return false;
  }

  return entityIdsByType.get(entityType)?.has(String(entityId)) || false;
}

function collectVocabularyFieldIds(changes) {
  const vocabularyFieldIds = new Set();

  for (const change of changes) {
    if (change.table_name !== 'vocabularies') {
      continue;
    }

    const payload = getChangePayload(change);
    if (payload?.field_id) {
      vocabularyFieldIds.add(String(payload.field_id));
    }
  }

  return vocabularyFieldIds;
}

async function collectCreatedEntityIds(changes, vocabularyFieldIds) {
  const createdEntityIdsByType = new Map();

  for (const change of changes) {
    if (change.op !== 'INSERT') {
      continue;
    }

    const definition = findActivityFeedDefinition(change.table_name, change.op);

    if (!definition || !['directEntity', 'institutionEntity', 'object', 'researchField'].includes(definition.resolver)) {
      continue;
    }

    const payload = getChangePayload(change);
    const entityId = payload?.id || change.row_id;

    const entityType = definition.resolver === 'researchField'
      ? await resolveResearchFieldEntityType(entityId, vocabularyFieldIds)
      : definition.entityType;

    addEntityId(createdEntityIdsByType, entityType, entityId);
  }

  return createdEntityIdsByType;
}

function collectDeletedEntityIds(changes) {
  const deletedEntityIdsByType = new Map();

  for (const change of changes) {
    if (change.op !== 'DELETE') {
      continue;
    }

    const definition = findActivityFeedDefinition(change.table_name, change.op);

    if (!definition || !['directEntity', 'institutionEntity', 'object', 'researchField'].includes(definition.resolver)) {
      continue;
    }

    const payload = getChangePayload(change);
    const entityId = payload?.id || change.row_id;

    // For deletes, the row is already gone — read type from old_row payload instead of querying DB
    let entityType;
    if (definition.resolver === 'researchField') {
      const isVocabulary = String(payload?.type || '').toLowerCase() === 'vocabulary';
      entityType = isVocabulary ? 'connection_types' : 'research_fields';
    } else {
      entityType = definition.entityType;
    }

    addEntityId(deletedEntityIdsByType, entityType, entityId);
  }

  return deletedEntityIdsByType;
}

async function loadTextContent(textId) {
  if (!textId) return null;

  const rows = await db
    .select({ content: texts.content })
    .from(texts)
    .where(eq(texts.id, textId))
    .limit(1)
    .execute();

  return rows[0]?.content || null;
}

async function loadInstitutionContext({ institutionId, nameId } = {}) {
  if (institutionId) {
    const institution = await db.query.institutions.findFirst({
      where: (entity, { eq: equals }) => equals(entity.id, institutionId),
      with: {
        name: true
      }
    });

    if (institution) {
      return {
        institutionId: institution.id,
        institutionName: institution.name?.content || null
      };
    }
  }

  return {
    institutionId: institutionId || null,
    institutionName: await loadTextContent(nameId)
  };
}

async function loadObjectContext({ objectId, institutionId } = {}) {
  if (objectId) {
    const object = await db.query.objects.findFirst({
      where: (entity, { eq: equals }) => equals(entity.id, objectId),
      with: {
        institution: {
          with: {
            name: true
          }
        }
      }
    });

    if (object) {
      return {
        entityId: object.id,
        institutionId: object.institution_id || institutionId || null,
        institutionName: object.institution?.name?.content || null
      };
    }
  }

  const institution = await loadInstitutionContext({ institutionId });
  return {
    entityId: objectId || null,
    institutionId: institution.institutionId,
    institutionName: institution.institutionName
  };
}

// Recovers institution_id from the entity row when it is missing from the change payload.
// Only runs for INSERT/UPDATE — on DELETE the row is already gone.
async function resolveEntityInstitutionId(entityType, entityId, payloadInstitutionId, isDelete) {
  if (payloadInstitutionId) {
    return payloadInstitutionId;
  }

  if (isDelete || !entityId || !db.query[entityType]) {
    return null;
  }

  const row = await db.query[entityType].findFirst({
    where: (entity, { eq: equals }) => equals(entity.id, entityId),
    columns: { institution_id: true }
  });

  return row?.institution_id || null;
}

async function loadTranslationTextId(translationId, payload) {
  if (payload?.text_id) {
    return payload.text_id;
  }

  const rows = await db
    .select({ text_id: translations.text_id })
    .from(translations)
    .where(eq(translations.id, translationId))
    .limit(1)
    .execute();

  return rows[0]?.text_id || null;
}

async function resolveResearchFieldEntityType(researchFieldId, vocabularyFieldIds) {
  if (!researchFieldId) {
    return 'research_fields';
  }

  if (vocabularyFieldIds.has(String(researchFieldId))) {
    return 'connection_types';
  }

  const [field] = await db
    .select({ type: research_fields.type })
    .from(research_fields)
    .where(eq(research_fields.id, researchFieldId))
    .limit(1)
    .execute();

  return String(field?.type || '').toLowerCase() === 'vocabulary' ? 'connection_types' : 'research_fields';
}

function getResearchFieldMessageKey(actionType, entityType) {
  const messagePrefix = entityType === 'connection_types'
    ? 'activity.connection-types'
    : 'activity.research-fields';

  if (actionType === 'create') {
    return `${messagePrefix}-created`;
  }

  if (actionType === 'delete') {
    return `${messagePrefix}-deleted`;
  }

  return `${messagePrefix}-updated`;
}

async function resolveInstitutionMediaActivity(change, definition, payload) {
  const institution = await loadInstitutionContext({
    institutionId: payload?.institution_id
  });

  if (!institution.institutionId) {
    return null;
  }

  return {
    actionType: definition.actionType,
    entityType: definition.entityType,
    entityId: institution.institutionId,
    institutionId: institution.institutionId,
    institutionName: institution.institutionName,
    messageKey: definition.messageKey,
    summaryParams: {
      institutionName: institution.institutionName
    }
  };
}

async function resolveObjectActivity(change, definition, payload) {
  const objectContext = await loadObjectContext({
    objectId: payload?.id || change.row_id,
    institutionId: payload?.institution_id
  });

  if (!objectContext.entityId && !objectContext.institutionId) {
    return null;
  }

  return {
    actionType: definition.actionType,
    entityType: definition.entityType,
    entityId: objectContext.entityId || change.row_id,
    institutionId: objectContext.institutionId,
    institutionName: objectContext.institutionName,
    messageKey: definition.messageKey,
    summaryParams: {
      institutionName: objectContext.institutionName
    }
  };
}

async function resolveInstitutionEntityActivity(change, definition, payload) {
  const entityId = payload?.id || change.row_id;
  const institutionId = await resolveEntityInstitutionId(
    definition.entityType, entityId, payload?.institution_id, change.op === 'DELETE'
  );
  const institution = await loadInstitutionContext({ institutionId });
  const messageKey = resolveActivityMessageKey(definition.messageKey, {
    omitInstitution: !institution.institutionName
  });

  return {
    actionType: definition.actionType,
    entityType: definition.entityType,
    entityId,
    institutionId: institution.institutionId,
    institutionName: institution.institutionName,
    messageKey,
    summaryParams: {
      institutionName: institution.institutionName
    }
  };
}

async function resolveResearchFieldActivity(change, definition, payload, vocabularyFieldIds, createdEntityIdsByType) {
  const entityId = payload?.id || change.row_id;

  // For deletes the row is already gone; old_row (payload) still has the type field
  const entityType = change.op === 'DELETE'
    ? (String(payload?.type || '').toLowerCase() === 'vocabulary' ? 'connection_types' : 'research_fields')
    : await resolveResearchFieldEntityType(entityId, vocabularyFieldIds);

  if (change.op === 'UPDATE' && hasEntityInBatch(createdEntityIdsByType, entityType, entityId)) {
    return null;
  }

  return {
    actionType: definition.actionType,
    entityType,
    entityId,
    institutionId: null,
    institutionName: null,
    messageKey: getResearchFieldMessageKey(definition.actionType, entityType),
    summaryParams: {}
  };
}

async function resolveObjectLinkActivity(definition, payload) {
  if (!payload?.object_id) {
    return null;
  }

  const objectContext = await loadObjectContext({ objectId: payload.object_id });

  return {
    actionType: definition.actionType,
    entityType: definition.entityType,
    entityId: objectContext.entityId || payload.object_id,
    institutionId: objectContext.institutionId,
    institutionName: objectContext.institutionName,
    messageKey: definition.messageKey,
    summaryParams: {
      institutionName: objectContext.institutionName
    }
  };
}

function resolveDirectEntityActivity(change, definition) {
  return {
    actionType: definition.actionType,
    entityType: definition.entityType,
    entityId: change.row_id,
    institutionId: null,
    institutionName: null,
    messageKey: definition.messageKey,
    summaryParams: {}
  };
}

async function resolveTextOwnerActivity(change, payload, createdEntityIdsByType, vocabularyFieldIds) {
  const textId = change.table_name === 'translations'
    ? await loadTranslationTextId(change.row_id, payload)
    : payload?.id || change.row_id;

  if (!textId) {
    return null;
  }

  for (const ownerDefinition of TEXT_OWNER_DEFINITIONS) {
    for (const field of ownerDefinition.fields) {
      const owner = await db.query[ownerDefinition.tableName].findFirst({
        where: (entity, { eq: equals }) => equals(entity[field], textId)
      });

      if (!owner) {
        continue;
      }

      if (ownerDefinition.tableName === 'research_fields') {
        const entityType = await resolveResearchFieldEntityType(owner.id, vocabularyFieldIds);

        if (hasEntityInBatch(createdEntityIdsByType, entityType, owner.id)) {
          return null;
        }

        return {
          actionType: 'update',
          entityType,
          entityId: owner.id,
          institutionId: null,
          institutionName: null,
          messageKey: getResearchFieldMessageKey('update', entityType),
          summaryParams: {}
        };
      }

      if (hasEntityInBatch(createdEntityIdsByType, ownerDefinition.entityType, owner.id)) {
        return null;
      }

      const institution = ownerDefinition.institutionField
        ? await loadInstitutionContext({ institutionId: owner[ownerDefinition.institutionField] })
        : { institutionId: null, institutionName: null };

      const messageKey = resolveActivityMessageKey(ownerDefinition.messageKey, {
        omitInstitution: !institution.institutionName
      });

      return {
        actionType: 'update',
        entityType: ownerDefinition.entityType,
        entityId: owner.id,
        institutionId: institution.institutionId,
        institutionName: institution.institutionName,
        messageKey,
        summaryParams: {
          institutionName: institution.institutionName
        }
      };
    }
  }

  return null;
}

async function resolveActivityInput(change, createdEntityIdsByType, vocabularyFieldIds) {
  if (IGNORED_ACTIVITY_TABLES.has(change.table_name)) {
    return null;
  }

  const definition = findActivityFeedDefinition(change.table_name, change.op);

  if (!definition) {
    return null;
  }

  const payload = getChangePayload(change);

  if (definition.skipIfObjectCreatedInBatch && payload?.object_id && hasEntityInBatch(createdEntityIdsByType, 'objects', payload.object_id)) {
    return null;
  }

  // An UPDATE that arrives in the same batch as the INSERT for this entity is a creation
  // side-effect, not a real edit — suppress it so only the "created" entry is recorded.
  // researchField resolves its entity type dynamically and handles this check itself.
  if (change.op === 'UPDATE' && definition.resolver !== 'researchField') {
    const entityId = payload?.id || change.row_id;
    if (hasEntityInBatch(createdEntityIdsByType, definition.entityType, entityId)) {
      return null;
    }
  }

  switch (definition.resolver) {
    case 'institutionMedia':
      return resolveInstitutionMediaActivity(change, definition, payload);
    case 'object':
      return resolveObjectActivity(change, definition, payload);
    case 'institutionEntity':
      return resolveInstitutionEntityActivity(change, definition, payload);
    case 'researchField':
      return resolveResearchFieldActivity(change, definition, payload, vocabularyFieldIds, createdEntityIdsByType);
    case 'objectLink':
      return resolveObjectLinkActivity(definition, payload);
    case 'directEntity':
      return resolveDirectEntityActivity(change, definition);
    case 'textOwner':
      return resolveTextOwnerActivity(change, payload, createdEntityIdsByType, vocabularyFieldIds);
    default:
      return null;
  }
}

function mergeSummaryParams(existingSummaryParams, nextSummaryParams) {
  return {
    ...normalizeSummaryParams(existingSummaryParams),
    ...normalizeSummaryParams(nextSummaryParams)
  };
}

function groupActivityInputs(activityInputs) {
  const groupedActivities = new Map();

  for (const activity of activityInputs) {
    const groupKey = JSON.stringify([
      activity.messageKey,
      activity.actionType,
      activity.entityType,
      activity.institutionId || null
    ]);

    const existingActivity = groupedActivities.get(groupKey);
    if (!existingActivity) {
      groupedActivities.set(groupKey, {
        ...activity,
        entityIds: new Set(activity.entityId ? [String(activity.entityId)] : [])
      });
      continue;
    }

    if (activity.entityId) {
      existingActivity.entityIds.add(String(activity.entityId));
    }

    existingActivity.entityId = activity.entityId || existingActivity.entityId;
    existingActivity.institutionName = activity.institutionName || existingActivity.institutionName;
    existingActivity.summaryParams = mergeSummaryParams(existingActivity.summaryParams, activity.summaryParams);
  }

  return [...groupedActivities.values()].map((activity) => ({
    ...activity,
    itemCount: activity.entityIds.size || 1,
    summaryParams: mergeSummaryParams(activity.summaryParams, {
      _entityIds: [...activity.entityIds]
    })
  }));
}

function parseSyncEventChanges(syncEvent) {
  const changes = parseJsonField(syncEvent?.changes);
  return Array.isArray(changes) ? changes : [];
}

// Merges an activity record into a recent matching row within the time window,
// or inserts a new one. Handles three cross-batch cases:
//   - Duplicate inserts (e.g. institution created twice across two batches) → merged
//   - Assets uploaded in separate batches → counts merged into one row
//   - UPDATE arriving after its INSERT (e.g. datasource init then name set) → suppressed
async function mergeOrInsertActivity(tx, record) {
  const windowStart = new Date(record.created_at - ACTIVITY_GROUP_WINDOW_MS);

  // Suppress update events when the same entity was just created in a recent batch.
  if (record.action_type === 'update' && record.entity_id) {
    const recentCreate = await tx.query.project_activity.findFirst({
      where: (t, { and: a, eq: e, gte: g }) => a(
        e(t.project_id, record.project_id),
        e(t.entity_type, record.entity_type),
        e(t.entity_id, record.entity_id),
        e(t.action_type, 'create'),
        g(t.updated_at, windowStart)
      ),
      columns: { id: true }
    });
    if (recentCreate) return;
  }

  // Merge with an existing recent row of the same scope, using the dedicated index.
  const actorCondition = record.actor_client_id
    ? eq(project_activity.actor_client_id, record.actor_client_id)
    : isNull(project_activity.actor_client_id);
  const institutionCondition = record.institution_id
    ? eq(project_activity.institution_id, record.institution_id)
    : isNull(project_activity.institution_id);

  const [existing] = await tx
    .select({
      id: project_activity.id,
      item_count: project_activity.item_count,
      entity_id: project_activity.entity_id,
      summary_params: project_activity.summary_params
    })
    .from(project_activity)
    .where(and(
      eq(project_activity.project_id, record.project_id),
      actorCondition,
      eq(project_activity.message_key, record.message_key),
      eq(project_activity.entity_type, record.entity_type),
      institutionCondition,
      gte(project_activity.updated_at, windowStart)
    ))
    .limit(1)
    .execute();

  if (existing) {
    const existingIds = new Set(existing.summary_params?._entityIds || (existing.entity_id ? [existing.entity_id] : []));
    const incomingIds = record.summary_params?._entityIds || (record.entity_id ? [record.entity_id] : []);
    for (const id of incomingIds) existingIds.add(id);
    const mergedIds = [...existingIds];

    await tx
      .update(project_activity)
      .set({
        item_count: mergedIds.length || existing.item_count,
        entity_id: record.entity_id || existing.entity_id,
        updated_at: record.updated_at,
        summary_params: {
          ...normalizeSummaryParams(existing.summary_params),
          ...normalizeSummaryParams(record.summary_params),
          _entityIds: mergedIds
        }
      })
      .where(eq(project_activity.id, existing.id))
      .execute();
  } else {
    await tx.insert(project_activity).values(record).execute();
  }
}

export async function recordProjectActivityFromSyncEvent(projectId, syncEvent) {
  if (!projectId || !syncEvent?.source_key) {
    return;
  }

  const syncKind = syncEvent.kind || syncEvent.sync_kind || 'user';
  const sourceKey = syncEvent.source_key;

  await db.transaction(async (tx) => {
    await tx
      .delete(project_activity)
      .where(and(
        eq(project_activity.project_id, projectId),
        eq(project_activity.source_key, sourceKey)
      ))
      .execute();

    if (syncKind !== 'user') {
      return;
    }

    const changes = parseSyncEventChanges(syncEvent);
    if (changes.length === 0) {
      return;
    }

    const vocabularyFieldIds = collectVocabularyFieldIds(changes);
    const createdEntityIdsByType = await collectCreatedEntityIds(changes, vocabularyFieldIds);
    const deletedEntityIdsByType = collectDeletedEntityIds(changes);
    const activityInputs = [];

    for (const change of changes) {
      const activity = await resolveActivityInput(change, createdEntityIdsByType, vocabularyFieldIds);
      if (
        activity
        && activity.actionType !== 'delete'
        && hasEntityInBatch(deletedEntityIdsByType, activity.entityType, activity.entityId)
      ) {
        continue;
      }

      if (activity) {
        activityInputs.push(activity);
      }
    }

    const groupedActivities = groupActivityInputs(activityInputs);
    const activityTimestamp = new Date(syncEvent.created_at || Date.now());

    for (const activity of groupedActivities) {
      await mergeOrInsertActivity(tx, {
        created_at: activityTimestamp,
        updated_at: activityTimestamp,
        project_id: projectId,
        source_key: sourceKey,
        bundle_id: syncEvent.bundle_id || sourceKey,
        sync_kind: syncKind,
        actor_client_id: syncEvent.actor_client_id || null,
        actor_username: syncEvent.actor_username || null,
        action_type: activity.actionType,
        entity_type: activity.entityType,
        entity_id: activity.entityId,
        institution_id: activity.institutionId,
        institution_name: activity.institutionName,
        message_key: activity.messageKey,
        item_count: activity.itemCount,
        summary_params: activity.summaryParams
      });
    }
  });
}