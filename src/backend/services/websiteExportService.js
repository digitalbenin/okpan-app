import fs from 'fs/promises';
import path from 'path';
import { and, eq, inArray } from 'drizzle-orm';
import * as dbSchema from '../../db/schema.js';
import { buildObjectSearchConditions } from '../handlers/exportHandlers.js';

function sanitizeExportFolderName(value, fallback = 'website-export') {
  const normalized = String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+|\.+$/g, '');

  return normalized || fallback;
}

function resolveApplicationRoot({ appPath, resourcesPath, isPackaged } = {}) {
  if (isPackaged) {
    return appPath || (resourcesPath ? path.join(resourcesPath, 'app') : process.cwd());
  }

  return appPath || process.cwd();
}

function getProjectAssetsSourceCandidates(projectId, { appRoot, userDataPath } = {}) {
  const candidates = [];

  if (userDataPath) {
    candidates.push(path.join(userDataPath, 'assets', 'project_assets', projectId));
  }

  if (appRoot) {
    candidates.push(path.join(appRoot, 'src', 'assets', 'project_assets', projectId));
  }

  return candidates;
}

function normalizeLocale(locale) {
  return typeof locale === 'string' ? locale.trim().toLowerCase() : '';
}

function buildTextPayload(textId, textRowsById, translationsByTextId, languagesById) {
  if (!textId) {
    return null;
  }

  const textRow = textRowsById[textId];
  if (!textRow) {
    return null;
  }

  const originalLanguage = languagesById[textRow.original_language_id] || null;
  const translations = (translationsByTextId[textId] || [])
    .map((translation) => {
      const language = languagesById[translation.language_id] || null;
      const languageCode = normalizeLocale(language?.code);
      if (!languageCode || !translation?.content) {
        return null;
      }

      return {
        language_id: translation.language_id,
        language_code: languageCode,
        content: translation.content
      };
    })
    .filter(Boolean);

  return {
    text_id: textId,
    content: textRow.content || '',
    original_language_id: textRow.original_language_id || null,
    original_language_code: normalizeLocale(originalLanguage?.code),
    translations
  };
}

/**
 * Export website data to JSON file and build static site
 * @param {string} projectId - Project ID to export
 * @param {string} outputPath - Destination path for exported website folder
 * @param {Object} options - Export options
 * @param {Object} options.db - Database instance
 * @returns {Promise<Object>} Export result
 */
export async function exportStaticWebsite(
  projectId,
  outputPath,
  { db, filters = {}, basePath = '', locale = '', appPath, resourcesPath, userDataPath, isPackaged = false } = {}
) {
  if (basePath && !basePath.startsWith('/')) {
    basePath = '/' + basePath;
  }
  basePath = basePath.replace(/\/$/, '');
  const appRoot = resolveApplicationRoot({ appPath, resourcesPath, isPackaged });
  const websiteDir = path.join(appRoot, 'src', 'website');
  // Prebuilt SPA artifact for static exports (produced before app packaging)
  const buildDir = path.join(websiteDir, 'build-export');
  const availableLocales = await getAvailableWebsiteLocales(appRoot);
  const exportLocale = resolveExportLocale(locale, availableLocales);

  try {
    // Step 1: Export data to JSON structure
    console.log('[Website Export] Step 1/4: Exporting data...');
    const data = await exportWebsiteData(projectId, db, filters);
    
    if (!data || !data.objects) {
      throw new Error('Failed to export data: data or data.objects is null/undefined');
    }

    const resolvedOutputPath = path.join(
      outputPath,
      sanitizeExportFolderName(data.project?.name || projectId, projectId)
    );

    // Build lightweight site.json for sidebar
    const siteData = {
      project: data.project || {},
      settings: data.settings || {},
      locale: exportLocale,
      content_languages: data.content_languages || [],
      default_content_locale: data.default_content_locale || '',
      connection_types: (data.research_fields || [])
        .filter((field) => field?.type === 'vocabulary')
        .map((field) => ({
          id: field.id,
          name: field.name,
          name_i18n: field.name_i18n || null,
          description: field.description,
          description_i18n: field.description_i18n || null,
          count: (data.vocabularies || []).filter(v => v.field_id === field.id).length
        }))
    };

    // Step 2: Validate prebuilt static website artifact exists
    console.log('[Website Export] Step 2/4: Validating prebuilt website artifact...');
    try {
      await fs.access(buildDir);
    } catch {
      throw new Error(
        `Prebuilt website artifact not found at ${buildDir}`
      );
    }

    // Step 3: Copy prebuilt website to destination
    console.log('[Website Export] Step 3/4: Copying prebuilt website to output location...');
    await fs.mkdir(resolvedOutputPath, { recursive: true });
    await fs.cp(buildDir, resolvedOutputPath, { recursive: true });

    // Write export data into output root
    await fs.writeFile(path.join(resolvedOutputPath, 'data.json'), JSON.stringify(data, null, 2), 'utf-8');
    await fs.writeFile(path.join(resolvedOutputPath, 'site.json'), JSON.stringify(siteData, null, 2), 'utf-8');
    console.log(`[Website Export] Exported ${data.objects.length} objects to data.json`);
    console.log('[Website Export] Exported site.json for sidebar');

    // Ensure direct refresh/deep-link works on static hosts without rewrite rules.
    // This runs after writing the exported data so route generation can rely on the final export payload.
    await createSpaShellRoutes(resolvedOutputPath, data, basePath, exportLocale);

    // Step 4: Copy project assets folder
    console.log('[Website Export] Step 4/4: Copying assets...');
    const projectAssetsDest = path.join(resolvedOutputPath, 'assets', projectId);
    const assetSourceCandidates = getProjectAssetsSourceCandidates(projectId, {
      appRoot,
      userDataPath
    });

    let copiedAssets = false;
    for (const projectAssetsSource of assetSourceCandidates) {
      try {
        await fs.access(projectAssetsSource);
        await fs.mkdir(path.join(resolvedOutputPath, 'assets'), { recursive: true });
        await fs.cp(projectAssetsSource, projectAssetsDest, { recursive: true });
        console.log(`[Website Export] Assets copied from ${projectAssetsSource} to ${projectAssetsDest}`);
        copiedAssets = true;
        break;
      } catch {
        // Try the next candidate.
      }
    }

    if (!copiedAssets) {
      console.warn(
        `[Website Export] No assets folder found. Checked: ${assetSourceCandidates.join(', ')}`
      );
    }

    console.log(`[Website Export] Website exported to ${resolvedOutputPath}`);

    return {
      success: true,
      outputPath: resolvedOutputPath,
      objectCount: data.objects.length
    };

  } catch (error) {
    console.error('[Website Export] Error:', error);
    throw new Error(`Website export failed: ${error.message}`);
  }
}

async function getAvailableWebsiteLocales(rootDir) {
  const localesDir = path.join(rootDir, 'src', 'website', 'src', 'lib', 'i18n');

  try {
    const files = await fs.readdir(localesDir, { withFileTypes: true });
    const seen = new Set();
    const locales = [];

    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.json')) {
        continue;
      }

      const bundle = JSON.parse(
        await fs.readFile(path.join(localesDir, file.name), 'utf-8')
      );
      const code = normalizeLocale(bundle?.code);

      if (!code || seen.has(code)) {
        continue;
      }

      seen.add(code);
      locales.push(code);
    }

    return locales;
  } catch (error) {
    console.warn('[Website Export] Failed to read website locale files:', error);
    return [];
  }
}

function resolveExportLocale(locale, availableLocales) {
  if (!Array.isArray(availableLocales) || availableLocales.length === 0) {
    return normalizeLocale(locale);
  }

  const normalized = normalizeLocale(locale);
  if (!normalized) {
    return availableLocales[0];
  }

  const exactMatch = availableLocales.find((candidate) => candidate === normalized);
  if (exactMatch) {
    return exactMatch;
  }

  const baseMatch = availableLocales.find((candidate) => candidate === normalized.split('-')[0]);
  return baseMatch || availableLocales[0];
}

function generateHtmlForRoute(indexHtml, basePath, routePath, locale = '') {
  let prefix;
  let dynamicBaseScript = '';

  if (basePath) {
    prefix = basePath + '/';
    dynamicBaseScript = JSON.stringify(basePath);
  } else {
    // Relative logic
    const depth = routePath === '' ? 0 : routePath.split('/').length;
    prefix = depth === 0 ? './' : '../'.repeat(depth);
    
    dynamicBaseScript = `(function(){
      let p = window.location.pathname;
      if (p.endsWith('/index.html')) p = p.slice(0, -11);
      if (p.endsWith('/')) p = p.slice(0, -1);
      let r = ${JSON.stringify('/' + routePath)};
      if (r.endsWith('/')) r = r.slice(0, -1);
      if (r === '') return p;
      if (p.endsWith(r)) return p.slice(0, p.length - r.length);
      return '';
    })()`;
  }

  // Inject a dynamic base script to window.__SITE_BASE_PATH__ for runtime path resolution,
  // rewrite root-relative paths for assets/imports to use the calculated prefix,
  // and appropriately set the base path in SvelteKit's client-side router config.
  const normalizedLocale = normalizeLocale(locale);
  const htmlWithLocale = normalizedLocale
    ? indexHtml.replace(/(<html\b[^>]*\slang=")([^"]*)(")/i, `$1${normalizedLocale}$3`)
    : indexHtml;

  return htmlWithLocale
    .replace(/<head>/i, '<head>\n\t\t<script>window.__SITE_BASE_PATH__=' + dynamicBaseScript + ';</script>')
    .replace(/href="\//g, 'href="' + prefix)
    .replace(/src="\//g, 'src="' + prefix)
    .replace(/import\("\//g, 'import("' + prefix)
    .replace(/base:\s*(""|'')/g, 'base: ' + dynamicBaseScript);
}

async function createSpaShellRoutes(outputPath, data, basePath = "", locale = '') {
  const indexPath = path.join(outputPath, 'index.html');
  const originalIndexHtml = await fs.readFile(indexPath, 'utf-8');

  // Root index.html
  const rootIndexHtml = generateHtmlForRoute(originalIndexHtml, basePath, "", locale);
  await fs.writeFile(indexPath, rootIndexHtml, 'utf-8');

  const routes = new Set(['about', 'connections']);

  for (const obj of data.objects || []) {
    if (obj?.id) routes.add(encodeURIComponent(obj.id));
  }

  const connectionTypes = data.connection_types || [];
  for (const field of connectionTypes) {
    if (!field?.id) continue;
    const encodedFieldId = encodeURIComponent(field.id);
    routes.add(`connections/${encodedFieldId}`);
    
    const fieldVocabularies = (data.vocabularies || []).filter((v) => String(v.field_id) === String(field.id));
    for (const vocabulary of fieldVocabularies) {
      if (!vocabulary?.id) continue;
      routes.add(`connections/${encodedFieldId}/${encodeURIComponent(vocabulary.id)}`);
    }
  }

  for (const routePath of routes) {
    const routeDir = path.join(outputPath, ...routePath.split('/'));
    await fs.mkdir(routeDir, { recursive: true });
    
    const routeHtml = generateHtmlForRoute(originalIndexHtml, basePath, routePath, locale);
    await fs.writeFile(path.join(routeDir, 'index.html'), routeHtml, 'utf-8');
  }

  console.log(`[Website Export] Generated ${routes.size} SPA route shell files`);
}
/**
 * Export all website data to unified JSON structure
 * @param {string} projectId - Project ID
 * @param {Object} db - Database instance
 * @returns {Promise<Object>} Unified data structure
 */
async function exportWebsiteData(projectId, db, filters = {}) {
  try {
    console.log('[exportWebsiteData] Starting data export for project:', projectId);
    
    // Fetch all objects for this project
    console.log('[exportWebsiteData] Fetching objects...');
    const effectiveFilters = {
      ...(filters || {}),
      project_id: projectId
    };
    const conditions = buildObjectSearchConditions(effectiveFilters);

    const objects = await db.select().from(dbSchema.objects)
      .where(and(...conditions))
      .execute();
    console.log(`[exportWebsiteData] Found ${objects.length} objects`);

    if (objects.length === 0) {
      return {
        metadata: {
          exportedAt: new Date().toISOString(),
          projectId,
          totalObjects: 0,
          version: '1.0'
        },
        project: {},
        settings: {},
        objects: [],
        institutions: [],
        research_fields: [],
        ontology_fields: [],
        vocabularies: []
      };
    }

    const objectIds = objects.map(o => o.id);

    // Fetch all related data
    const [
      objectsOntologyFields,
      objectsResearchFields,
      objectsAssets,
      objectsDatasources,
      institutions,
      researchFields,
      ontologyFields,
      projectLanguages
    ] = await Promise.all([
      db.select().from(dbSchema.objects_ontology_fields)
        .where(inArray(dbSchema.objects_ontology_fields.object_id, objectIds)).execute(),
      db.select().from(dbSchema.objects_research_fields)
        .where(inArray(dbSchema.objects_research_fields.object_id, objectIds)).execute(),
      db.select().from(dbSchema.objects_assets)
        .where(inArray(dbSchema.objects_assets.object_id, objectIds)).execute(),
      db.select().from(dbSchema.objects_datasources)
        .where(inArray(dbSchema.objects_datasources.object_id, objectIds)).execute(),
      db.select().from(dbSchema.institutions)
        .where(eq(dbSchema.institutions.project_id, projectId)).execute(),
      db.select().from(dbSchema.research_fields)
        .where(eq(dbSchema.research_fields.project_id, projectId)).execute(),
      db.select().from(dbSchema.ontology_fields)
        .where(eq(dbSchema.ontology_fields.project_id, projectId)).execute(),
      db.select().from(dbSchema.languages)
        .where(eq(dbSchema.languages.project_id, projectId)).execute()
    ]);

    // Fetch datasources based on IDs referenced in ontology fields
    const datasourceIds = [...new Set(objectsOntologyFields.map(oof => oof.datasources_id).filter(Boolean))];
    const allDatasources = datasourceIds.length > 0
      ? await db.select().from(dbSchema.datasources)
          .where(inArray(dbSchema.datasources.id, datasourceIds)).execute()
      : [];

    // Fetch templates based on objects_datasources references
    const templateIds = [...new Set(objectsDatasources.map(od => od.template_id).filter(Boolean))];
    const allTemplates = templateIds.length > 0
      ? await db.select().from(dbSchema.templates)
          .where(inArray(dbSchema.templates.id, templateIds)).execute()
      : [];
    const templateMap = Object.fromEntries(allTemplates.map(t => [t.id, t]));

    // Build datasource -> template mapping
    const datasourceTemplateMap = Object.fromEntries(
      objectsDatasources.map(od => [od.datasource_id, od.template_id]).filter(([_, tid]) => tid)
    );

    // Fetch assets
    const assetIds = [...new Set(objectsAssets.map(oa => oa.asset_id).filter(Boolean))];
    const assets = assetIds.length > 0
      ? await db.select().from(dbSchema.assets)
          .where(inArray(dbSchema.assets.id, assetIds)).execute()
      : [];

    // Fetch vocabularies for all project research fields of type 'vocabulary'
    const vocabularyFieldIds = researchFields
      .filter(rf => rf.type === 'vocabulary')
      .map(rf => rf.id);
      
    const vocabularies = vocabularyFieldIds.length > 0
      ? await db.select().from(dbSchema.vocabularies)
          .where(inArray(dbSchema.vocabularies.field_id, vocabularyFieldIds)).execute()
      : [];

    // Fetch generic assets for vocabulary images
    const genericAssetIds = [...new Set(vocabularies.map(v => v.main_asset_id).filter(Boolean))];
    
    // Also fetch generic assets associated via vocabularies_generic_assets
    const vocabGenericAssets = vocabularies.length > 0
        ? await db.select().from(dbSchema.vocabularies_generic_assets)
            .where(inArray(dbSchema.vocabularies_generic_assets.vocabulary_id, vocabularies.map(v => v.id))).execute()
        : [];
    
    vocabGenericAssets.forEach(vga => {
        if (vga.generic_asset_id) genericAssetIds.push(vga.generic_asset_id);
    });

    const uniqueGenericAssetIds = [...new Set(genericAssetIds)];
    const genericAssets = uniqueGenericAssetIds.length > 0
      ? await db.select().from(dbSchema.genericAssets)
          .where(inArray(dbSchema.genericAssets.id, uniqueGenericAssetIds)).execute()
      : [];
    const genericAssetMap = Object.fromEntries(genericAssets.map(ga => [ga.id, ga]));

    // Fetch project and settings first (need their text IDs)
    const [project, settings] = await Promise.all([
      db.select().from(dbSchema.project)
        .where(eq(dbSchema.project.id, projectId)).execute().then(rows => rows[0]),
      db.select().from(dbSchema.websiteSettings)
        .where(eq(dbSchema.websiteSettings.project_id, projectId)).execute().then(rows => rows[0])
    ]);

    // Fetch logo asset for settings if exists
    let logoAssetPath = null;
    if (settings?.logo_id) {
      const logoAsset = await db.select().from(dbSchema.genericAssets)
        .where(eq(dbSchema.genericAssets.id, settings.logo_id)).execute().then(rows => rows[0]);
      logoAssetPath = logoAsset?.path || null;
    }

    // Fetch all texts for institution names/descriptions
    const instTextIds = [...new Set(institutions.flatMap(i => 
      [i.name_id, i.description_id, i.country_id, i.location_id].filter(Boolean)
    ))];
    const rfTextIds = [...new Set(researchFields.flatMap(rf => 
      [rf.name_id, rf.description_id].filter(Boolean)
    ))];
    const ofTextIds = [...new Set(ontologyFields.flatMap(of => 
      [of.name_id, of.description_id, of.category_id].filter(Boolean)
    ))];
    const vocabTextIds = [...new Set(vocabularies.flatMap(v => 
      [v.option_id, v.description_id].filter(Boolean)
    ))];
    // Add project and settings text IDs
    const projectTextIds = [project?.title_id, project?.description_id].filter(Boolean);
    const settingsTextIds = [settings?.title_id, settings?.about_id].filter(Boolean);
    // Add datasource text IDs
    const datasourceTextIds = [...new Set(allDatasources.flatMap(ds => 
      [ds.name_id, ds.method_id, ds.notes_id].filter(Boolean)
    ))];
    
    const allTextIds = [...new Set([...instTextIds, ...rfTextIds, ...ofTextIds, ...vocabTextIds, ...projectTextIds, ...settingsTextIds, ...datasourceTextIds])];
    const texts = allTextIds.length > 0
      ? await db.select().from(dbSchema.texts)
          .where(inArray(dbSchema.texts.id, allTextIds)).execute()
      : [];
    const textTranslations = allTextIds.length > 0
      ? await db.select().from(dbSchema.translations)
          .where(inArray(dbSchema.translations.text_id, allTextIds)).execute()
      : [];

    // Create text lookup
    const textMap = Object.fromEntries(texts.map(t => [t.id, t.content]));
    const textRowsById = Object.fromEntries(texts.map(t => [t.id, t]));
    const languagesById = Object.fromEntries(projectLanguages.map(language => [language.id, language]));
    const translationsByTextId = textTranslations.reduce((acc, translation) => {
      if (!translation?.text_id) {
        return acc;
      }

      if (!acc[translation.text_id]) {
        acc[translation.text_id] = [];
      }

      acc[translation.text_id].push(translation);
      return acc;
    }, {});
    const textPayloadMap = Object.fromEntries(
      allTextIds.map((textId) => [textId, buildTextPayload(textId, textRowsById, translationsByTextId, languagesById)])
    );

    const availableContentLanguageCodes = new Set();
    Object.values(textPayloadMap).forEach((payload) => {
      const originalCode = normalizeLocale(payload?.original_language_code);
      if (originalCode) {
        availableContentLanguageCodes.add(originalCode);
      }

      (payload?.translations || []).forEach((translation) => {
        const translationCode = normalizeLocale(translation?.language_code);
        if (translationCode) {
          availableContentLanguageCodes.add(translationCode);
        }
      });
    });

    const contentLanguages = projectLanguages
      .map((language) => ({
        code: normalizeLocale(language.code),
        name: language.name,
        is_default: language.is_default
      }))
      .filter((language) => language.code && availableContentLanguageCodes.has(language.code));

    const defaultContentLocale = contentLanguages.find((language) => Number(language.is_default) === 1)?.code
      || normalizeLocale(textPayloadMap[project?.title_id]?.original_language_code)
      || contentLanguages[0]?.code
      || '';

    // Create datasource lookup with resolved text
    const datasourceMap = Object.fromEntries(allDatasources.map(ds => [ds.id, {
      id: ds.id,
      name: textMap[ds.name_id] || null,
      method: textMap[ds.method_id] || null,
      notes: textMap[ds.notes_id] || null,
      language: ds.language,
      copyright: ds.copyright,
      date: ds.date,
      institution_id: ds.institution_id
    }]));

    // Transform objects with embedded data
    const transformedObjects = objects.map(obj => {
      const objAssets = objectsAssets.filter(oa => oa.object_id === obj.id);
      const objOntologyFields = objectsOntologyFields.filter(oof => oof.object_id === obj.id);
      const objResearchFields = objectsResearchFields.filter(orf => orf.object_id === obj.id);
      
      // Get unique datasource IDs from ontology fields
      const objDatasourceIds = [...new Set(objOntologyFields.map(oof => oof.datasources_id).filter(Boolean))];
      const objDatasources = objDatasourceIds.map(dsId => datasourceMap[dsId]).filter(Boolean);
      
      const institution = institutions.find(i => i.id === obj.institution_id);

      return {
        ...obj,
        institution: institution ? {
          id: institution.id,
          name: textMap[institution.name_id],
          name_i18n: textPayloadMap[institution.name_id] || null,
          description: textMap[institution.description_id],
          description_i18n: textPayloadMap[institution.description_id] || null,
          country: textMap[institution.country_id],
          country_i18n: textPayloadMap[institution.country_id] || null,
          location: textMap[institution.location_id],
          location_i18n: textPayloadMap[institution.location_id] || null,
          website: institution.website
        } : null,
        assets: objAssets.map(oa => {
          const asset = assets.find(a => a.id === oa.asset_id);
          return asset ? {
            order: oa.order,
            asset_id: asset.id,
            asset_filename: asset.filename,
            asset_path: asset.path,
            asset_type: asset.type,
            asset_formats: typeof asset.formats === 'string' ? JSON.parse(asset.formats) : asset.formats
          } : null;
        }).filter(Boolean),
        // Transform ontology fields using template mappings to get correct field_id for multi-mappings
        objectOntologyFields: (() => {
          // Get object's datasources to find templates
          const objDatasources = objectsDatasources.filter(od => od.object_id === obj.id);
          
          // Build expanded fields from template mappings
          const expandedFields = [];
          const processedCombos = new Set(); // Track processed label+field_id+datasource combos
          
          for (const objDs of objDatasources) {
            const template = objDs.template_id ? templateMap[objDs.template_id] : null;
            if (!template?.mapping) continue;
            
            // Parse mapping if needed
            let mapping = template.mapping;
            if (typeof mapping === 'string') {
              try { mapping = JSON.parse(mapping); } catch (e) { continue; }
            }
            if (!Array.isArray(mapping)) continue;
            
            // For each mapping entry, find matching ontology field rows by label
            for (const mapEntry of mapping) {
              const entry = typeof mapEntry === 'string' ? JSON.parse(mapEntry) : mapEntry;
              const label = entry.headerField;
              const mappedFieldId = entry.mappedField;
              
              if (!label || !mappedFieldId) continue;
              
              // Find ontology field rows matching this label and datasource
              const matchingRows = objOntologyFields.filter(
                oof => oof.label === label && oof.datasources_id === objDs.datasource_id
              );
              
              // Take only the first matching row (avoid duplicates) and override field_id from template
              const sourceRow = matchingRows[0];
              if (sourceRow) {
                const comboKey = `${label}|${mappedFieldId}|${objDs.datasource_id}`;
                if (!processedCombos.has(comboKey)) {
                  processedCombos.add(comboKey);
                  expandedFields.push({
                    id: `${sourceRow.id}_${mappedFieldId}`, // Unique id for each mapping
                    label: label,
                    value: sourceRow.value,
                    field_id: mappedFieldId, // Use template's mapped field, not stored field_id
                    datasources_id: sourceRow.datasources_id,
                    primary: entry.primary || sourceRow.primary
                  });
                }
              }
            }
          }
          
          // If no templates found, fall back to raw data (deduplicated)
          if (expandedFields.length === 0) {
            const seen = new Set();
            return objOntologyFields.filter(oof => {
              const key = `${oof.label}|${oof.field_id}|${oof.datasources_id}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          }
          
          return expandedFields;
        })(),
        objectResearchFields: objResearchFields,
        // Add datasources based on ontology field references
        datasources: (() => {
          const dsIds = [...new Set(objOntologyFields.map(oof => oof.datasources_id).filter(Boolean))];
          return dsIds.map(dsId => {
            const ds = allDatasources.find(d => d.id === dsId);
            if (!ds) return null;
            const dsInstitution = ds.institutions_id ? institutionMap[ds.institutions_id] : null;
            return {
              id: ds.id,
              name: textMap[ds.name_id] || 'Unknown',
              name_i18n: textPayloadMap[ds.name_id] || null,
              method: textMap[ds.method_id],
              method_i18n: textPayloadMap[ds.method_id] || null,
              notes: textMap[ds.notes_id],
              notes_i18n: textPayloadMap[ds.notes_id] || null,
              institution: dsInstitution ? {
                id: dsInstitution.id,
                name: textMap[dsInstitution.name_id],
                name_i18n: textPayloadMap[dsInstitution.name_id] || null,
                website: dsInstitution.website
              } : null
            };
          }).filter(Boolean);
        })()
      };
    });

    // Transform other entities with text content
    const transformedInstitutions = institutions.map(i => ({
      id: i.id,
      name: textMap[i.name_id],
      name_i18n: textPayloadMap[i.name_id] || null,
      description: textMap[i.description_id],
      description_i18n: textPayloadMap[i.description_id] || null,
      country: textMap[i.country_id],
      country_i18n: textPayloadMap[i.country_id] || null,
      location: textMap[i.location_id],
      location_i18n: textPayloadMap[i.location_id] || null,
      website: i.website
    }));

    const transformedResearchFields = researchFields.map(rf => ({
      id: rf.id,
      name: textMap[rf.name_id],
      name_i18n: textPayloadMap[rf.name_id] || null,
      description: textMap[rf.description_id],
      description_i18n: textPayloadMap[rf.description_id] || null,
      type: rf.type,
      private: rf.private,
      onwebsite: rf.onwebsite
    }));

    const transformedOntologyFields = ontologyFields.map(of => ({
      id: of.id,
      name: textMap[of.name_id],
      name_i18n: textPayloadMap[of.name_id] || null,
      description: textMap[of.description_id],
      description_i18n: textPayloadMap[of.description_id] || null,
      category: textMap[of.category_id],
      category_i18n: textPayloadMap[of.category_id] || null,
      onwebsite: of.onwebsite
    }));

    // Calculate vocabulary object counts
    const vocabularyCounts = {}; 
    objectsResearchFields.forEach(orf => {
      if (orf.vocabulary_id) {
        vocabularyCounts[orf.vocabulary_id] = (vocabularyCounts[orf.vocabulary_id] || 0) + 1;
      }
    });

    const transformedVocabularies = vocabularies.map(v => {
      const genericAsset = v.main_asset_id ? genericAssetMap[v.main_asset_id] : null;
      
      // Get associated assets from junction table
      const attachedAssets = vocabGenericAssets
        .filter(vga => vga.vocabulary_id === v.id)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(vga => {
             const asset = genericAssetMap[vga.generic_asset_id];
             return asset ? {
                 path: asset.path,
                 type: asset.type,
                 id: asset.id
             } : null;
        })
        .filter(Boolean);

      return {
        id: v.id,
        field_id: v.field_id,
        name: textMap[v.option_id],
        name_i18n: textPayloadMap[v.option_id] || null,
        description: textMap[v.description_id],
        description_i18n: textPayloadMap[v.description_id] || null,
        external_link: v.external_link,
        main_asset_path: genericAsset?.path || null,
        assets: attachedAssets,
        count: vocabularyCounts[v.id] || 0
      };
    });

    console.log('[exportWebsiteData] Data export complete:', {
      objects: transformedObjects.length,
      institutions: transformedInstitutions.length,
      research_fields: transformedResearchFields.length,
      ontology_fields: transformedOntologyFields.length,
      vocabularies: transformedVocabularies.length,
      datasources: allDatasources.length
    });

    // Transform project with resolved text
    const transformedProject = project ? {
      id: project.id,
      name: textMap[project.title_id] || null,
      name_i18n: textPayloadMap[project.title_id] || null,
      description: textMap[project.description_id] || null,
      description_i18n: textPayloadMap[project.description_id] || null
    } : {};

    // Transform settings with resolved text, falling back to project values
    const aboutText = textMap[settings?.about_id] || textMap[project?.description_id] || null;
    const transformedSettings = {
      title: textMap[settings?.title_id] || textMap[project?.title_id] || null,
      title_i18n: textPayloadMap[settings?.title_id] || textPayloadMap[project?.title_id] || null,
      about: aboutText,
      about_i18n: textPayloadMap[settings?.about_id] || textPayloadMap[project?.description_id] || null,
      description: aboutText,
      description_i18n: textPayloadMap[settings?.about_id] || textPayloadMap[project?.description_id] || null,
      authors: settings?.authors || null,
      logo_asset_path: logoAssetPath,
      show_unmapped: settings?.show_unmapped || 0
    };

    const connectionTypes = transformedResearchFields
      .filter((field) => field?.type === 'vocabulary')
      .map((field) => ({
        id: field.id,
        name: field.name,
        name_i18n: field.name_i18n || null,
        description: field.description,
        description_i18n: field.description_i18n || null,
        count: transformedVocabularies.filter(v => v.field_id === field.id).length
      }));

    return {
      metadata: {
        exportedAt: new Date().toISOString(),
        projectId,
        totalObjects: transformedObjects.length,
        version: '1.0'
      },
      project: transformedProject,
      settings: transformedSettings,
      content_languages: contentLanguages.map(({ is_default, ...language }) => language),
      default_content_locale: defaultContentLocale,
      objects: transformedObjects,
      institutions: transformedInstitutions,
      research_fields: transformedResearchFields,
      ontology_fields: transformedOntologyFields,
      vocabularies: transformedVocabularies,
      connection_types: connectionTypes
    };
  } catch (error) {
    console.error('[exportWebsiteData] Error:', error);
    throw error;
  }
}
