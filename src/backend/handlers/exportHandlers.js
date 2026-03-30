import { dialog } from 'electron';
import { sql, eq, inArray, and, or, notInArray } from 'drizzle-orm';
import * as dbSchema from '../../db/schema.js';
import { exportProjectJson } from '../services/exportJsonService.js';
import { exportProjectSql } from '../services/exportSqlService.js';
import { exportProjectCsv } from '../services/exportCsvService.js';
import { exportConnectionsJson } from '../services/exportConnectionsJsonService.js';
import { importConnectionsJson } from '../services/importConnectionsJsonService.js';
import { exportConnectionTypeCsv } from '../services/exportConnectionTypeCsvService.js';
import { importConnectionTypeCsv } from '../services/importConnectionTypeCsvService.js';

function sanitizeFilenamePart(value, fallback = 'connection-type') {
  const normalized = String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+|\.+$/g, '');
  return normalized || fallback;
}

export function buildCounts({
  objects = [],
  assets = [],
  institutions = [],
} = {}) {
  return {
    objects: objects.length,
    assets: assets.length,
    institutions: institutions.length,
  };
}

export function makeExportResult({ filePath, zipped, counts, fallbackMode }) {
  return { filePath, mode: zipped ? 'zip' : fallbackMode, counts };
}

export function buildObjectSearchConditions(args) {
  const { project_id, institutionIds, status, ontologyQuery, ontologyFieldIds, researchFieldFilters, excludeObjectIds } = args || {};
  const conditions = [eq(dbSchema.objects.project_id, project_id)];
  if (institutionIds && institutionIds.length > 0) conditions.push(inArray(dbSchema.objects.institution_id, institutionIds));
  if (status) conditions.push(eq(dbSchema.objects.status, status));
  if (ontologyQuery && ontologyQuery.trim()) {
    const q = `%${ontologyQuery.trim().toLowerCase()}%`;
    if (ontologyFieldIds && ontologyFieldIds.length > 0) {
      const existsPerField = ontologyFieldIds.map((fid) => sql`EXISTS (SELECT 1 FROM ${dbSchema.objects_ontology_fields} oof WHERE oof.object_id = ${dbSchema.objects.id} AND oof.field_id = ${fid} AND LOWER(oof.value) LIKE ${q})`);
      conditions.push(existsPerField.length === 1 ? existsPerField[0] : or(...existsPerField));
    } else {
      conditions.push(sql`EXISTS (SELECT 1 FROM ${dbSchema.objects_ontology_fields} oof WHERE oof.object_id = ${dbSchema.objects.id} AND LOWER(oof.value) LIKE ${q})`);
    }
  }

  const rfFilters = Array.isArray(researchFieldFilters)
    ? researchFieldFilters.map((f) => { try { return typeof f === 'string' ? JSON.parse(f) : f; } catch { return f; } })
    : [];
  if (rfFilters.length > 0) {
    const rfConds = [];
    for (const filter of rfFilters) {
      const fieldConds = [];
      if (filter?.query && String(filter.query).trim()) {
        const rq = `%${String(filter.query).trim().toLowerCase()}%`;
        fieldConds.push(sql`EXISTS (SELECT 1 FROM ${dbSchema.objects_research_fields} orf WHERE orf.object_id = ${dbSchema.objects.id} AND orf.field_id = ${filter.fieldId} AND LOWER(orf.value) LIKE ${rq})`);
      }
      if (filter?.vocabularyIds && filter.vocabularyIds.length > 0) {
        const vocOr = filter.vocabularyIds.map((vid) => sql`EXISTS (SELECT 1 FROM ${dbSchema.objects_research_fields} orf WHERE orf.object_id = ${dbSchema.objects.id} AND orf.field_id = ${filter.fieldId} AND orf.vocabulary_id = ${vid})`);
        fieldConds.push(vocOr.length === 1 ? vocOr[0] : or(...vocOr));
      }
      if (fieldConds.length > 0) rfConds.push(fieldConds.length === 1 ? fieldConds[0] : and(...fieldConds));
    }
    if (rfConds.length > 0) conditions.push(rfConds.length === 1 ? rfConds[0] : and(...rfConds));
  }

  // Exclude specific object IDs if provided
  if (excludeObjectIds && excludeObjectIds.length > 0) {
    const ex = excludeObjectIds.filter(Boolean);
    if (ex.length > 0) conditions.push(notInArray(dbSchema.objects.id, ex));
  }
  return conditions;
}

export async function handleExportProject(event, options, { db }) {
    try {
        const {
            filePath: inputFilePath,
            filters = {},
            includeAssets = false,
            mode = 'sql', // 'sql' | 'zip' (only relevant for SQL)
            format = 'json' // 'sql' | 'json' (default to JSON for unified API)
        } = options || {};

        // Route by format
        if (format === 'json') {
            // Handle file path for JSON export
            let filePath = inputFilePath;
            if (!filePath) {
                const result = await dialog.showSaveDialog({
                    title: 'Save JSON Export ZIP',
                    defaultPath: 'export-json.zip',
                    filters: [{ name: 'Zip', extensions: ['zip'] }]
                });
                if (result.canceled) return { canceled: true };
                filePath = result.filePath;
            }

            // Ensure .zip extension for JSON
            const zipPath = filePath && typeof filePath === 'string' && filePath.toLowerCase().endsWith('.zip')
                ? filePath
                : (filePath + '.zip');
            return await exportProjectJson({ filePath: zipPath, filters, includeAssets }, { db });
        }

        if (format === 'csv') {
            let filePath = inputFilePath;
            if (!filePath) {
                const result = await dialog.showSaveDialog({
                    title: 'Save CSV Export ZIP',
                    defaultPath: 'export-csv.zip',
                    filters: [{ name: 'Zip', extensions: ['zip'] }]
                });
                if (result.canceled) return { canceled: true };
                filePath = result.filePath;
            }
            const zipPath = filePath && typeof filePath === 'string' && filePath.toLowerCase().endsWith('.zip')
                ? filePath
                : (filePath + '.zip');
            return await exportProjectCsv({ filePath: zipPath, filters, includeAssets }, { db });
        }

        if (!filters?.project_id) {
            throw new Error('project_id is required in filters');
        }

        // SQL export
        let filePath = inputFilePath;
        const wantZip = (mode === 'zip' || includeAssets) || (typeof filePath === 'string' && filePath.toLowerCase().endsWith('.zip'));

        if (!filePath) {
            const result = await dialog.showSaveDialog({
                title: wantZip ? 'Save Export ZIP' : 'Save SQL export',
                defaultPath: wantZip ? 'export.zip' : 'export.sql',
                filters: wantZip ? [{ name: 'Zip', extensions: ['zip'] }] : [{ name: 'SQL', extensions: ['sql'] }]
            });
            if (result.canceled) return { canceled: true };
            filePath = result.filePath;
        }

        return await exportProjectSql(
            { filePath, filters, includeAssets, mode: wantZip ? 'zip' : 'sql' },
            { db }
        );
    } catch (error) {
        console.error('Error in handleExportProject:', error);
        throw error;
    }
}

export async function handleExportConnections(event, options, { db }) {
  try {
    const {
      filePath: inputFilePath,
      projectId
    } = options || {};

    if (!projectId) {
      throw new Error('projectId is required');
    }

    let filePath = inputFilePath;
    if (!filePath) {
      const result = await dialog.showSaveDialog({
        title: 'Save Connections Export ZIP',
        defaultPath: 'connections-export.zip',
        filters: [{ name: 'Zip', extensions: ['zip'] }]
      });
      if (result.canceled) return { canceled: true };
      filePath = result.filePath;
    }

    const zipPath = filePath && typeof filePath === 'string' && filePath.toLowerCase().endsWith('.zip')
      ? filePath
      : (filePath + '.zip');

    return await exportConnectionsJson({ filePath: zipPath, projectId }, { db });
  } catch (error) {
    console.error('Error in handleExportConnections:', error);
    throw error;
  }
}

export async function handleImportConnections(event, options, { db }) {
  try {
    const { filePath: inputFilePath, projectId } = options || {};

    if (!projectId) {
      throw new Error('projectId is required');
    }

    let filePath = inputFilePath;
    if (!filePath) {
      const result = await dialog.showOpenDialog({
        title: 'Import Connections Export ZIP',
        filters: [{ name: 'Zip', extensions: ['zip'] }],
        properties: ['openFile']
      });
      if (result.canceled) return { canceled: true };
      filePath = result.filePaths[0];
    }

    return await importConnectionsJson({ filePath, projectId }, { db });
  } catch (error) {
    console.error('Error in handleImportConnections:', error);
    throw error;
  }
}

export async function handleExportConnectionTypeCsv(event, options, { db }) {
  try {
    const {
      filePath: inputFilePath,
      projectId,
      connectionTypeId
    } = options || {};

    if (!projectId) {
      throw new Error('projectId is required');
    }
    if (!connectionTypeId) {
      throw new Error('connectionTypeId is required');
    }

    const [connectionType] = await db
      .select({
        id: dbSchema.research_fields.id,
        name: dbSchema.texts.content
      })
      .from(dbSchema.research_fields)
      .leftJoin(dbSchema.texts, eq(dbSchema.texts.id, dbSchema.research_fields.name_id))
      .where(and(
        eq(dbSchema.research_fields.id, connectionTypeId),
        eq(dbSchema.research_fields.project_id, projectId)
      ))
      .execute();

    if (!connectionType) {
      throw new Error('Connection type not found');
    }

    let filePath = inputFilePath;
    if (!filePath) {
      const result = await dialog.showSaveDialog({
        title: 'Save Connection Type CSV Export',
        defaultPath: `${sanitizeFilenamePart(connectionType.name)}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      });
      if (result.canceled) return { canceled: true };
      filePath = result.filePath;
    }

    const csvPath = filePath && typeof filePath === 'string' && filePath.toLowerCase().endsWith('.csv')
      ? filePath
      : `${filePath}.csv`;

    return await exportConnectionTypeCsv({ filePath: csvPath, projectId, connectionTypeId }, { db });
  } catch (error) {
    console.error('Error in handleExportConnectionTypeCsv:', error);
    throw error;
  }
}

export async function handleImportConnectionTypeCsv(event, options, { db }) {
  try {
    const {
      filePath: inputFilePath,
      projectId,
      connectionTypeName
    } = options || {};

    if (!projectId) {
      throw new Error('projectId is required');
    }
    if (!connectionTypeName) {
      throw new Error('connectionTypeName is required');
    }

    let filePath = inputFilePath;
    if (!filePath) {
      const result = await dialog.showOpenDialog({
        title: 'Import Connection Type CSV',
        filters: [{ name: 'CSV', extensions: ['csv'] }],
        properties: ['openFile']
      });
      if (result.canceled) return { canceled: true };
      filePath = result.filePaths[0];
    }

    return await importConnectionTypeCsv({ filePath, projectId, connectionTypeName }, { db });
  } catch (error) {
    console.error('Error in handleImportConnectionTypeCsv:', error);
    throw error;
  }
}