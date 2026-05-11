import { and, eq } from 'drizzle-orm';
import { db } from '../../db/init.js';
import {
  project_activity,
  texts,
  translations
} from '../../db/schema.js';
import {
  IGNORED_ACTIVITY_TABLES,
  TEXT_OWNER_DEFINITIONS,
  findActivityFeedDefinition
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
  return params && typeof params === 'object' ? params : {};
}

function getChangePayload(change) {
  return change.op === 'DELETE'
    ? parseJsonField(change.old_row)
    : parseJsonField(change.new_row);
}

function addCreatedEntityId(createdEntityIdsByType, entityType, entityId) {
  if (!entityType || !entityId) {
    return;
  }

  const entityIds = createdEntityIdsByType.get(entityType) || new Set();
  entityIds.add(String(entityId));
  createdEntityIdsByType.set(entityType, entityIds);
}

function hasCreatedEntityInBatch(createdEntityIdsByType, entityType, entityId) {
  if (!entityType || !entityId) {
    return false;
  }

  return createdEntityIdsByType.get(entityType)?.has(String(entityId)) || false;
}

function collectCreatedEntityIds(changes) {
  const createdEntityIdsByType = new Map();

  for (const change of changes) {
    if (change.op !== 'INSERT') {
      continue;
    }

    const definition = findActivityFeedDefinition(change.table_name, change.op);

    if (!definition || !['directEntity', 'object'].includes(definition.resolver)) {
      continue;
    }

    const payload = getChangePayload(change);
    const entityId = definition.resolver === 'object'
      ? payload?.id || change.row_id
      : change.row_id;

    addCreatedEntityId(createdEntityIdsByType, definition.entityType, entityId);
  }

  return createdEntityIdsByType;
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

async function resolveTextOwnerActivity(change, payload, createdEntityIdsByType) {
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

      if (hasCreatedEntityInBatch(createdEntityIdsByType, ownerDefinition.entityType, owner.id)) {
        return null;
      }

      return {
        actionType: 'update',
        entityType: ownerDefinition.entityType,
        entityId: owner.id,
        institutionId: null,
        institutionName: null,
        messageKey: ownerDefinition.messageKey,
        summaryParams: {}
      };
    }
  }

  return null;
}

async function resolveActivityInput(change, createdEntityIdsByType) {
  if (IGNORED_ACTIVITY_TABLES.has(change.table_name)) {
    return null;
  }

  const definition = findActivityFeedDefinition(change.table_name, change.op);

  if (!definition) {
    return null;
  }

  const payload = getChangePayload(change);

  if (definition.skipIfObjectCreatedInBatch && payload?.object_id && hasCreatedEntityInBatch(createdEntityIdsByType, 'objects', payload.object_id)) {
    return null;
  }

  switch (definition.resolver) {
    case 'institutionMedia':
      return resolveInstitutionMediaActivity(change, definition, payload);
    case 'object':
      return resolveObjectActivity(change, definition, payload);
    case 'objectLink':
      return resolveObjectLinkActivity(definition, payload);
    case 'directEntity':
      return resolveDirectEntityActivity(change, definition);
    case 'textOwner':
      return resolveTextOwnerActivity(change, payload, createdEntityIdsByType);
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

    const createdEntityIdsByType = collectCreatedEntityIds(changes);
    const activityInputs = [];

    for (const change of changes) {
      const activity = await resolveActivityInput(change, createdEntityIdsByType);
      if (activity) {
        activityInputs.push(activity);
      }
    }

    const groupedActivities = groupActivityInputs(activityInputs);
    const activityTimestamp = new Date(syncEvent.created_at || Date.now());

    for (const activity of groupedActivities) {
      await tx
        .insert(project_activity)
        .values({
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
        })
        .execute();
    }
  });
}