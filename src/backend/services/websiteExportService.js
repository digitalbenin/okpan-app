import { spawn } from 'child_process';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { eq, inArray } from 'drizzle-orm';
import * as dbSchema from '../../db/schema.js';
import { getProjectAssetFolder } from '../utils/paths.js';

/**
 * Export website data to JSON file and build static site
 * @param {string} projectId - Project ID to export
 * @param {string} outputPath - Destination path for exported website folder
 * @param {Object} options - Export options
 * @param {Object} options.db - Database instance
 * @returns {Promise<Object>} Export result
 */
export async function exportStaticWebsite(projectId, outputPath, { db }) {
  const rootDir = process.cwd();
  const websiteDir = path.join(rootDir, 'src', 'website');
  const staticDir = path.join(websiteDir, 'static');
  // Use build-export folder for static exports (separate from preview build folder)
  const buildDir = path.join(websiteDir, 'build-export');
  // data.json is written to static temporarily for the build, then cleaned up
  const dataJsonPath = path.join(staticDir, 'data.json');
  // site.json contains only project/settings for sidebar (small file, loaded client-side)
  const siteJsonPath = path.join(staticDir, 'site.json');

  try {
    // Step 1: Export data to JSON in website/static folder (temporary, for build)
    console.log('[Website Export] Step 1/4: Exporting data...');
    const data = await exportWebsiteData(projectId, db);
    
    if (!data || !data.objects) {
      throw new Error('Failed to export data: data or data.objects is null/undefined');
    }
    
    await fs.mkdir(staticDir, { recursive: true });
    await fs.writeFile(dataJsonPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[Website Export] Exported ${data.objects.length} objects to data.json`);
    
    // Also write site.json with just project/settings and connection types (small file, loaded client-side)
    const siteData = {
      project: data.project || {},
      settings: data.settings || {},
      connection_types: (data.research_fields || [])
        .filter((field) => field?.type === 'vocabulary')
        .map((field) => ({
          id: field.id,
          name: field.name,
          description: field.description,
          count: (data.vocabularies || []).filter(v => v.field_id === field.id).length
        }))
    };
    await fs.writeFile(siteJsonPath, JSON.stringify(siteData, null, 2), 'utf-8');
    console.log('[Website Export] Exported site.json for sidebar');

    // Step 2: Build static site
    console.log('[Website Export] Step 2/4: Building static site...');
    console.log('[Website Export] This may take a few minutes...');
    
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

    await new Promise((resolve, reject) => {
      const buildProcess = spawn(npmCommand, ['run', 'build', '--', '--mode', 'production'], {
        cwd: websiteDir,
        env: {
          ...process.env,
          STATIC_EXPORT: 'true',
          NODE_ENV: 'production' // ensure SvelteKit writes production bootstrap (no __sveltekit_dev)
        },
        shell: true
      });

      let errorOutput = '';

      buildProcess.stdout.on('data', (data) => {
        // Log build progress without flooding console
        const output = data.toString().trim();
        if (output && !output.match(/^\s*$/)) {
          console.log('[Build]', output);
        }
      });

      buildProcess.stderr.on('data', (data) => {
        const output = data.toString().trim();
        if (output && !output.match(/^\s*$/)) {
          errorOutput += output + '\n';
          console.error('[Build Error]', output);
        }
      });

      buildProcess.on('close', (code) => {
        if (code === 0) {
          console.log('[Website Export] Build completed successfully');
          resolve();
        } else {
          reject(new Error(`Build process exited with code ${code}${errorOutput ? ':\n' + errorOutput : ''}`))
        }
      });

      buildProcess.on('error', (error) => {
        reject(new Error(`Failed to start build process: ${error.message}`));
      });
    });

    // Clean up temporary data.json from static folder (it's now in build-export)
    try {
      await fs.unlink(dataJsonPath);
      console.log('[Website Export] Cleaned up temporary data.json from static folder');
    } catch (err) {
      // Ignore if file doesn't exist
    }
    
    // Clean up temporary site.json from static folder (it's now in build-export)
    try {
      await fs.unlink(siteJsonPath);
      console.log('[Website Export] Cleaned up temporary site.json from static folder');
    } catch (err) {
      // Ignore if file doesn't exist
    }

    // Step 3: Copy build output to destination
    console.log('[Website Export] Step 3/4: Copying to output location...');
    await fs.mkdir(outputPath, { recursive: true });
    await fs.cp(buildDir, outputPath, { recursive: true });

    // Step 4: Copy project assets folder
    console.log('[Website Export] Step 4/4: Copying assets...');
    // Check userData location first (new), then legacy CWD location
    const projectAssetsSource = (() => {
      const newPath = getProjectAssetFolder(projectId);
      if (fsSync.existsSync(newPath)) return newPath;
      const legacyPath = path.join(rootDir, 'src', 'assets', 'project_assets', projectId);
      return fsSync.existsSync(legacyPath) ? legacyPath : newPath; // default to new even if missing
    })();
    const projectAssetsDest = path.join(outputPath, 'assets', projectId);
    
    try {
      await fs.access(projectAssetsSource);
      await fs.mkdir(path.join(outputPath, 'assets'), { recursive: true });
      await fs.cp(projectAssetsSource, projectAssetsDest, { recursive: true });
      console.log(`[Website Export] Assets copied to ${projectAssetsDest}`);
    } catch (err) {
      console.warn(`[Website Export] No assets folder found at ${projectAssetsSource}, skipping asset copy`);
    }

    console.log(`[Website Export] Website exported to ${outputPath}`);

    return {
      success: true,
      outputPath,
      objectCount: data.objects.length
    };

  } catch (error) {
    console.error('[Website Export] Error:', error);
    throw new Error(`Website export failed: ${error.message}`);
  }
}
/**
 * Export all website data to unified JSON structure
 * @param {string} projectId - Project ID
 * @param {Object} db - Database instance
 * @returns {Promise<Object>} Unified data structure
 */
async function exportWebsiteData(projectId, db) {
  try {
    console.log('[exportWebsiteData] Starting data export for project:', projectId);
    
    // Fetch all objects for this project
    console.log('[exportWebsiteData] Fetching objects...');
    const objects = await db.select().from(dbSchema.objects)
      .where(eq(dbSchema.objects.project_id, projectId))
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
      ontologyFields
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
        .where(eq(dbSchema.ontology_fields.project_id, projectId)).execute()
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

    // Create text lookup
    const textMap = Object.fromEntries(texts.map(t => [t.id, t.content]));

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
          description: textMap[institution.description_id],
          country: textMap[institution.country_id],
          location: textMap[institution.location_id],
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
              method: textMap[ds.method_id],
              notes: textMap[ds.notes_id],
              institution: dsInstitution ? {
                id: dsInstitution.id,
                name: textMap[dsInstitution.name_id],
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
      description: textMap[i.description_id],
      country: textMap[i.country_id],
      location: textMap[i.location_id],
      website: i.website
    }));

    const transformedResearchFields = researchFields.map(rf => ({
      id: rf.id,
      name: textMap[rf.name_id],
      description: textMap[rf.description_id],
      type: rf.type,
      private: rf.private,
      onwebsite: rf.onwebsite
    }));

    const transformedOntologyFields = ontologyFields.map(of => ({
      id: of.id,
      name: textMap[of.name_id],
      description: textMap[of.description_id],
      category: textMap[of.category_id],
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
        description: textMap[v.description_id],
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
      description: textMap[project.description_id] || null
    } : {};

    // Transform settings with resolved text, falling back to project values
    const aboutText = textMap[settings?.about_id] || textMap[project?.description_id] || null;
    const transformedSettings = {
      title: textMap[settings?.title_id] || textMap[project?.title_id] || null,
      about: aboutText,
      description: aboutText,
      authors: settings?.authors || null,
      logo_asset_path: logoAssetPath,
      show_unmapped: settings?.show_unmapped || 0
    };

    const connectionTypes = transformedResearchFields
      .filter((field) => field?.type === 'vocabulary')
      .map((field) => ({
        id: field.id,
        name: field.name,
        description: field.description,
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
