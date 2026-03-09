-- Change Log Triggers for Junction/Association Tables
-- Emits one row into change_log for INSERT/UPDATE/DELETE on junction tables.
-- Derives project_id via parent references.

-- objects_assets
CREATE TRIGGER IF NOT EXISTS trg_objects_assets_change_log_insert
AFTER INSERT ON objects_assets
WHEN COALESCE(
  (SELECT project_id FROM objects WHERE id = NEW.object_id),
  (SELECT project_id FROM assets WHERE id = NEW.asset_id)
) IS NOT NULL
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(
      (SELECT project_id FROM objects WHERE id = NEW.object_id),
      (SELECT project_id FROM assets WHERE id = NEW.asset_id)
    ),
    'objects_assets',
    'INSERT',
    NEW.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', NEW.id,
      'object_id', NEW.object_id,
      'asset_id', NEW.asset_id,
      'order', NEW."order",
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    ),
    NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_objects_assets_change_log_update
AFTER UPDATE ON objects_assets
WHEN COALESCE(
  (SELECT project_id FROM objects WHERE id = COALESCE(NEW.object_id, OLD.object_id)),
  (SELECT project_id FROM assets WHERE id = COALESCE(NEW.asset_id, OLD.asset_id))
) IS NOT NULL
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(
      (SELECT project_id FROM objects WHERE id = COALESCE(NEW.object_id, OLD.object_id)),
      (SELECT project_id FROM assets WHERE id = COALESCE(NEW.asset_id, OLD.asset_id))
    ),
    'objects_assets',
    'UPDATE',
    COALESCE(NEW.id, OLD.id),
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'object_id', COALESCE(NEW.object_id, OLD.object_id),
      'asset_id', COALESCE(NEW.asset_id, OLD.asset_id),
      'order', COALESCE(NEW."order", OLD."order"),
      'created_at', COALESCE(NEW.created_at, OLD.created_at),
      'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
    ),
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'object_id', OLD.object_id,
      'asset_id', OLD.asset_id,
      'order', OLD."order",
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_objects_assets_change_log_delete
AFTER DELETE ON objects_assets
WHEN COALESCE(
  (SELECT project_id FROM objects WHERE id = OLD.object_id),
  (SELECT project_id FROM assets WHERE id = OLD.asset_id)
) IS NOT NULL
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(
      (SELECT project_id FROM objects WHERE id = OLD.object_id),
      (SELECT project_id FROM assets WHERE id = OLD.asset_id)
    ),
    'objects_assets',
    'DELETE',
    OLD.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    NULL,
    json_object(
      'id', OLD.id,
      'object_id', OLD.object_id,
      'asset_id', OLD.asset_id,
      'order', OLD."order",
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

-- assets_institutions
CREATE TRIGGER IF NOT EXISTS trg_assets_institutions_change_log_insert
AFTER INSERT ON assets_institutions
WHEN COALESCE(
  (SELECT project_id FROM institutions WHERE id = NEW.institution_id),
  (SELECT project_id FROM assets WHERE id = NEW.asset_id)
) IS NOT NULL
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(
      (SELECT project_id FROM institutions WHERE id = NEW.institution_id),
      (SELECT project_id FROM assets WHERE id = NEW.asset_id)
    ),
    'assets_institutions',
    'INSERT',
    NEW.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', NEW.id,
      'asset_id', NEW.asset_id,
      'institution_id', NEW.institution_id,
      'rule', NEW.rule,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    ),
    NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_assets_institutions_change_log_update
AFTER UPDATE ON assets_institutions
WHEN COALESCE(
  (SELECT project_id FROM institutions WHERE id = COALESCE(NEW.institution_id, OLD.institution_id)),
  (SELECT project_id FROM assets WHERE id = COALESCE(NEW.asset_id, OLD.asset_id))
) IS NOT NULL
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(
      (SELECT project_id FROM institutions WHERE id = COALESCE(NEW.institution_id, OLD.institution_id)),
      (SELECT project_id FROM assets WHERE id = COALESCE(NEW.asset_id, OLD.asset_id))
    ),
    'assets_institutions',
    'UPDATE',
    COALESCE(NEW.id, OLD.id),
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'asset_id', COALESCE(NEW.asset_id, OLD.asset_id),
      'institution_id', COALESCE(NEW.institution_id, OLD.institution_id),
      'rule', COALESCE(NEW.rule, OLD.rule),
      'created_at', COALESCE(NEW.created_at, OLD.created_at),
      'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
    ),
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'asset_id', OLD.asset_id,
      'institution_id', OLD.institution_id,
      'rule', OLD.rule,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_assets_institutions_change_log_delete
AFTER DELETE ON assets_institutions
WHEN COALESCE(
  (SELECT project_id FROM institutions WHERE id = OLD.institution_id),
  (SELECT project_id FROM assets WHERE id = OLD.asset_id)
) IS NOT NULL
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(
      (SELECT project_id FROM institutions WHERE id = OLD.institution_id),
      (SELECT project_id FROM assets WHERE id = OLD.asset_id)
    ),
    'assets_institutions',
    'DELETE',
    OLD.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    NULL,
    json_object(
      'id', OLD.id,
      'asset_id', OLD.asset_id,
      'institution_id', OLD.institution_id,
      'rule', OLD.rule,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

-- objects_research_fields
CREATE TRIGGER IF NOT EXISTS trg_objects_research_fields_change_log_insert
AFTER INSERT ON objects_research_fields
WHEN COALESCE(
  (SELECT project_id FROM objects WHERE id = NEW.object_id),
  (SELECT project_id FROM research_fields WHERE id = NEW.field_id)
) IS NOT NULL
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(
      (SELECT project_id FROM objects WHERE id = NEW.object_id),
      (SELECT project_id FROM research_fields WHERE id = NEW.field_id)
    ),
    'objects_research_fields',
    'INSERT',
    NEW.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', NEW.id,
      'object_id', NEW.object_id,
      'field_id', NEW.field_id,
      'vocabulary_id', NEW.vocabulary_id,
      'value', NEW.value,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    ),
    NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_objects_research_fields_change_log_update
AFTER UPDATE ON objects_research_fields
WHEN COALESCE(
  (SELECT project_id FROM objects WHERE id = COALESCE(NEW.object_id, OLD.object_id)),
  (SELECT project_id FROM research_fields WHERE id = COALESCE(NEW.field_id, OLD.field_id))
) IS NOT NULL
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(
      (SELECT project_id FROM objects WHERE id = COALESCE(NEW.object_id, OLD.object_id)),
      (SELECT project_id FROM research_fields WHERE id = COALESCE(NEW.field_id, OLD.field_id))
    ),
    'objects_research_fields',
    'UPDATE',
    COALESCE(NEW.id, OLD.id),
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'object_id', COALESCE(NEW.object_id, OLD.object_id),
      'field_id', COALESCE(NEW.field_id, OLD.field_id),
      'vocabulary_id', COALESCE(NEW.vocabulary_id, OLD.vocabulary_id),
      'value', COALESCE(NEW.value, OLD.value),
      'created_at', COALESCE(NEW.created_at, OLD.created_at),
      'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
    ),
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'object_id', OLD.object_id,
      'field_id', OLD.field_id,
      'vocabulary_id', OLD.vocabulary_id,
      'value', OLD.value,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_objects_research_fields_change_log_delete
AFTER DELETE ON objects_research_fields
WHEN COALESCE(
  (SELECT project_id FROM objects WHERE id = OLD.object_id),
  (SELECT project_id FROM research_fields WHERE id = OLD.field_id)
) IS NOT NULL
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(
      (SELECT project_id FROM objects WHERE id = OLD.object_id),
      (SELECT project_id FROM research_fields WHERE id = OLD.field_id)
    ),
    'objects_research_fields',
    'DELETE',
    OLD.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    NULL,
    json_object(
      'id', OLD.id,
      'object_id', OLD.object_id,
      'field_id', OLD.field_id,
      'vocabulary_id', OLD.vocabulary_id,
      'value', OLD.value,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

-- objects_ontology_fields
CREATE TRIGGER IF NOT EXISTS trg_objects_ontology_fields_change_log_insert
AFTER INSERT ON objects_ontology_fields
WHEN COALESCE(
  (SELECT project_id FROM objects WHERE id = NEW.object_id),
  (SELECT project_id FROM ontology_fields WHERE id = NEW.field_id),
  (SELECT project_id FROM institutions WHERE id = (SELECT institution_id FROM datasources WHERE id = NEW.datasources_id))
) IS NOT NULL
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(
      (SELECT project_id FROM objects WHERE id = NEW.object_id),
      (SELECT project_id FROM ontology_fields WHERE id = NEW.field_id),
      (SELECT project_id FROM institutions WHERE id = (SELECT institution_id FROM datasources WHERE id = NEW.datasources_id))
    ),
    'objects_ontology_fields',
    'INSERT',
    NEW.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', NEW.id,
      'object_id', NEW.object_id,
      'field_id', NEW.field_id,
      'datasources_id', NEW.datasources_id,
      'label', NEW.label,
      'value', NEW.value,
      'primary', NEW."primary",
      'default_description', NEW.default_description,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    ),
    NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_objects_ontology_fields_change_log_update
AFTER UPDATE ON objects_ontology_fields
WHEN COALESCE(
  (SELECT project_id FROM objects WHERE id = COALESCE(NEW.object_id, OLD.object_id)),
  (SELECT project_id FROM ontology_fields WHERE id = COALESCE(NEW.field_id, OLD.field_id)),
  (SELECT project_id FROM institutions WHERE id = (SELECT institution_id FROM datasources WHERE id = COALESCE(NEW.datasources_id, OLD.datasources_id)))
) IS NOT NULL
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(
      (SELECT project_id FROM objects WHERE id = COALESCE(NEW.object_id, OLD.object_id)),
      (SELECT project_id FROM ontology_fields WHERE id = COALESCE(NEW.field_id, OLD.field_id)),
      (SELECT project_id FROM institutions WHERE id = (SELECT institution_id FROM datasources WHERE id = COALESCE(NEW.datasources_id, OLD.datasources_id)))
    ),
    'objects_ontology_fields',
    'UPDATE',
    COALESCE(NEW.id, OLD.id),
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'object_id', COALESCE(NEW.object_id, OLD.object_id),
      'field_id', COALESCE(NEW.field_id, OLD.field_id),
      'datasources_id', COALESCE(NEW.datasources_id, OLD.datasources_id),
      'label', COALESCE(NEW.label, OLD.label),
      'value', COALESCE(NEW.value, OLD.value),
      'primary', COALESCE(NEW."primary", OLD."primary"),
      'default_description', COALESCE(NEW.default_description, OLD.default_description),
      'created_at', COALESCE(NEW.created_at, OLD.created_at),
      'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
    ),
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'object_id', OLD.object_id,
      'field_id', OLD.field_id,
      'datasources_id', OLD.datasources_id,
      'label', OLD.label,
      'value', OLD.value,
      'primary', OLD."primary",
      'default_description', OLD.default_description,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_objects_ontology_fields_change_log_delete
AFTER DELETE ON objects_ontology_fields
WHEN COALESCE(
  (SELECT project_id FROM objects WHERE id = OLD.object_id),
  (SELECT project_id FROM ontology_fields WHERE id = OLD.field_id),
  (SELECT project_id FROM institutions WHERE id = (SELECT institution_id FROM datasources WHERE id = OLD.datasources_id))
) IS NOT NULL
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(
      (SELECT project_id FROM objects WHERE id = OLD.object_id),
      (SELECT project_id FROM ontology_fields WHERE id = OLD.field_id),
      (SELECT project_id FROM institutions WHERE id = (SELECT institution_id FROM datasources WHERE id = OLD.datasources_id))
    ),
    'objects_ontology_fields',
    'DELETE',
    OLD.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    NULL,
    json_object(
      'id', OLD.id,
      'object_id', OLD.object_id,
      'field_id', OLD.field_id,
      'datasources_id', OLD.datasources_id,
      'label', OLD.label,
      'value', OLD.value,
      'primary', OLD."primary",
      'default_description', OLD.default_description,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

-- vocabularies_generic_assets
CREATE TRIGGER IF NOT EXISTS trg_vocabularies_generic_assets_change_log_insert
AFTER INSERT ON vocabularies_generic_assets
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(
      (SELECT project_id FROM generic_assets WHERE id = NEW.generic_asset_id),
      (SELECT project_id FROM research_fields WHERE id = (SELECT field_id FROM vocabularies WHERE id = NEW.vocabulary_id))
    ),
    'vocabularies_generic_assets',
    'INSERT',
    NEW.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', NEW.id,
      'vocabulary_id', NEW.vocabulary_id,
      'generic_asset_id', NEW.generic_asset_id,
      'order', NEW."order",
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    ),
    NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_vocabularies_generic_assets_change_log_update
AFTER UPDATE ON vocabularies_generic_assets
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(
      (SELECT project_id FROM generic_assets WHERE id = COALESCE(NEW.generic_asset_id, OLD.generic_asset_id)),
      (SELECT project_id FROM research_fields WHERE id = (SELECT field_id FROM vocabularies WHERE id = COALESCE(NEW.vocabulary_id, OLD.vocabulary_id)))
    ),
    'vocabularies_generic_assets',
    'UPDATE',
    COALESCE(NEW.id, OLD.id),
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'vocabulary_id', COALESCE(NEW.vocabulary_id, OLD.vocabulary_id),
      'generic_asset_id', COALESCE(NEW.generic_asset_id, OLD.generic_asset_id),
      'order', COALESCE(NEW."order", OLD."order"),
      'created_at', COALESCE(NEW.created_at, OLD.created_at),
      'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
    ),
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'vocabulary_id', OLD.vocabulary_id,
      'generic_asset_id', OLD.generic_asset_id,
      'order', OLD."order",
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_vocabularies_generic_assets_change_log_delete
AFTER DELETE ON vocabularies_generic_assets
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(
      (SELECT project_id FROM generic_assets WHERE id = OLD.generic_asset_id),
      (SELECT project_id FROM research_fields WHERE id = (SELECT field_id FROM vocabularies WHERE id = OLD.vocabulary_id))
    ),
    'vocabularies_generic_assets',
    'DELETE',
    OLD.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    NULL,
    json_object(
      'id', OLD.id,
      'vocabulary_id', OLD.vocabulary_id,
      'generic_asset_id', OLD.generic_asset_id,
      'order', OLD."order",
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

-- objects_datasources
CREATE TRIGGER IF NOT EXISTS trg_objects_datasources_change_log_insert
AFTER INSERT ON objects_datasources
WHEN (SELECT project_id FROM objects WHERE id = NEW.object_id) IS NOT NULL
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    (SELECT project_id FROM objects WHERE id = NEW.object_id),
    'objects_datasources',
    'INSERT',
    NEW.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', NEW.id,
      'object_id', NEW.object_id,
      'datasource_id', NEW.datasource_id,
      'template_id', NEW.template_id,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    ),
    NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_objects_datasources_change_log_update
AFTER UPDATE ON objects_datasources
WHEN (SELECT project_id FROM objects WHERE id = COALESCE(NEW.object_id, OLD.object_id)) IS NOT NULL
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    (SELECT project_id FROM objects WHERE id = COALESCE(NEW.object_id, OLD.object_id)),
    'objects_datasources',
    'UPDATE',
    COALESCE(NEW.id, OLD.id),
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'object_id', COALESCE(NEW.object_id, OLD.object_id),
      'datasource_id', COALESCE(NEW.datasource_id, OLD.datasource_id),
      'template_id', COALESCE(NEW.template_id, OLD.template_id),
      'created_at', COALESCE(NEW.created_at, OLD.created_at),
      'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
    ),
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'object_id', OLD.object_id,
      'datasource_id', OLD.datasource_id,
      'template_id', OLD.template_id,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_objects_datasources_change_log_delete
AFTER DELETE ON objects_datasources
WHEN (SELECT project_id FROM objects WHERE id = OLD.object_id) IS NOT NULL
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    (SELECT project_id FROM objects WHERE id = OLD.object_id),
    'objects_datasources',
    'DELETE',
    OLD.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    NULL,
    json_object(
      'id', OLD.id,
      'object_id', OLD.object_id,
      'datasource_id', OLD.datasource_id,
      'template_id', OLD.template_id,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;