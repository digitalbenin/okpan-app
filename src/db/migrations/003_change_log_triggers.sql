-- Change Log Triggers for Core Project Tables
-- Ensure a canonical row-level event is written to change_log
-- for INSERT/UPDATE/DELETE operations across primary domain tables.

-- Helper note:
-- client_id is read from the singleton global_settings table (id=1).
-- origin is set to 'local' by default; remote ingestion may set different provenance.

CREATE TRIGGER IF NOT EXISTS trg_project_change_log_insert
AFTER INSERT ON project
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.id,
    'project',
    'INSERT',
    NEW.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', NEW.id,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at,
      'title_id', NEW.title_id,
      'description_id', NEW.description_id,
      'exports', NEW.exports,
      'password', NEW.password
    ),
    NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_project_change_log_update
AFTER UPDATE ON project
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(NEW.id, OLD.id),
    'project',
    'UPDATE',
    COALESCE(NEW.id, OLD.id),
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'created_at', COALESCE(NEW.created_at, OLD.created_at),
      'updated_at', COALESCE(NEW.updated_at, OLD.updated_at),
      'title_id', COALESCE(NEW.title_id, OLD.title_id),
      'description_id', COALESCE(NEW.description_id, OLD.description_id),
      'exports', COALESCE(NEW.exports, OLD.exports),
      'password', COALESCE(NEW.password, OLD.password)
    ),
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at,
      'title_id', OLD.title_id,
      'description_id', OLD.description_id,
      'exports', OLD.exports,
      'password', OLD.password
    )
  );
END;

-- settings
CREATE TRIGGER IF NOT EXISTS trg_settings_change_log_insert
AFTER INSERT ON settings
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.project_id,
    'settings',
    'INSERT',
    NEW.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', NEW.id,
      'project_id', NEW.project_id,
      'username', NEW.username,
      'password', NEW.password,
      'sync_url', NEW.sync_url,
      'sig_server', NEW.sig_server,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    ),
    NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_settings_change_log_update
AFTER UPDATE ON settings
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(NEW.project_id, OLD.project_id),
    'settings',
    'UPDATE',
    COALESCE(NEW.id, OLD.id),
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'project_id', COALESCE(NEW.project_id, OLD.project_id),
      'username', COALESCE(NEW.username, OLD.username),
      'password', COALESCE(NEW.password, OLD.password),
      'sync_url', COALESCE(NEW.sync_url, OLD.sync_url),
      'sig_server', COALESCE(NEW.sig_server, OLD.sig_server),
      'created_at', COALESCE(NEW.created_at, OLD.created_at),
      'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
    ),
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'project_id', OLD.project_id,
      'username', OLD.username,
      'password', OLD.password,
      'sync_url', OLD.sync_url,
      'sig_server', OLD.sig_server,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_settings_change_log_delete
AFTER DELETE ON settings
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    OLD.project_id,
    'settings',
    'DELETE',
    OLD.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    NULL,
    json_object(
      'id', OLD.id,
      'project_id', OLD.project_id,
      'username', OLD.username,
      'password', OLD.password,
      'sync_url', OLD.sync_url,
      'sig_server', OLD.sig_server,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

-- website_settings
CREATE TRIGGER IF NOT EXISTS trg_website_settings_change_log_insert
AFTER INSERT ON website_settings
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.project_id,
    'website_settings',
    'INSERT',
    NEW.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', NEW.id,
      'project_id', NEW.project_id,
      'title_id', NEW.title_id,
      'about_id', NEW.about_id,
      'authors', NEW.authors,
      'logo_id', NEW.logo_id,
      'subfolder_path', NEW.subfolder_path,
      'show_unmapped', NEW.show_unmapped,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    ),
    NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_website_settings_change_log_update
AFTER UPDATE ON website_settings
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(NEW.project_id, OLD.project_id),
    'website_settings',
    'UPDATE',
    COALESCE(NEW.id, OLD.id),
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'project_id', COALESCE(NEW.project_id, OLD.project_id),
      'title_id', COALESCE(NEW.title_id, OLD.title_id),
      'about_id', COALESCE(NEW.about_id, OLD.about_id),
      'authors', COALESCE(NEW.authors, OLD.authors),
      'logo_id', COALESCE(NEW.logo_id, OLD.logo_id),
      'subfolder_path', COALESCE(NEW.subfolder_path, OLD.subfolder_path),
      'show_unmapped', COALESCE(NEW.show_unmapped, OLD.show_unmapped),
      'created_at', COALESCE(NEW.created_at, OLD.created_at),
      'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
    ),
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'project_id', OLD.project_id,
      'title_id', OLD.title_id,
      'about_id', OLD.about_id,
      'authors', OLD.authors,
      'logo_id', OLD.logo_id,
      'subfolder_path', OLD.subfolder_path,
      'show_unmapped', OLD.show_unmapped,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_website_settings_change_log_delete
AFTER DELETE ON website_settings
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    OLD.project_id,
    'website_settings',
    'DELETE',
    OLD.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    NULL,
    json_object(
      'id', OLD.id,
      'project_id', OLD.project_id,
      'title_id', OLD.title_id,
      'about_id', OLD.about_id,
      'authors', OLD.authors,
      'logo_id', OLD.logo_id,
      'subfolder_path', OLD.subfolder_path,
      'show_unmapped', OLD.show_unmapped,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

-- object_display_fields
CREATE TRIGGER IF NOT EXISTS trg_object_display_fields_change_log_insert
AFTER INSERT ON object_display_fields
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.project_id,
    'object_display_fields',
    'INSERT',
    NEW.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', NEW.id,
      'project_id', NEW.project_id,
      'ontology_field_id', NEW.ontology_field_id,
      'research_field_id', NEW.research_field_id,
      'property_name', NEW.property_name,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    ),
    NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_object_display_fields_change_log_update
AFTER UPDATE ON object_display_fields
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(NEW.project_id, OLD.project_id),
    'object_display_fields',
    'UPDATE',
    COALESCE(NEW.id, OLD.id),
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'project_id', COALESCE(NEW.project_id, OLD.project_id),
      'ontology_field_id', COALESCE(NEW.ontology_field_id, OLD.ontology_field_id),
      'research_field_id', COALESCE(NEW.research_field_id, OLD.research_field_id),
      'property_name', COALESCE(NEW.property_name, OLD.property_name),
      'created_at', COALESCE(NEW.created_at, OLD.created_at),
      'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
    ),
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'project_id', OLD.project_id,
      'ontology_field_id', OLD.ontology_field_id,
      'research_field_id', OLD.research_field_id,
      'property_name', OLD.property_name,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_object_display_fields_change_log_delete
AFTER DELETE ON object_display_fields
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    OLD.project_id,
    'object_display_fields',
    'DELETE',
    OLD.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    NULL,
    json_object(
      'id', OLD.id,
      'project_id', OLD.project_id,
      'ontology_field_id', OLD.ontology_field_id,
      'research_field_id', OLD.research_field_id,
      'property_name', OLD.property_name,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

-- research_fields
CREATE TRIGGER IF NOT EXISTS trg_research_fields_change_log_insert
AFTER INSERT ON research_fields
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.project_id,
    'research_fields',
    'INSERT',
    NEW.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', NEW.id,
      'project_id', NEW.project_id,
      'name_id', NEW.name_id,
      'type', NEW.type,
      'description_id', NEW.description_id,
      'private', NEW.private,
      'onwebsite', NEW.onwebsite,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    ),
    NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_research_fields_change_log_update
AFTER UPDATE ON research_fields
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(NEW.project_id, OLD.project_id),
    'research_fields',
    'UPDATE',
    COALESCE(NEW.id, OLD.id),
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'project_id', COALESCE(NEW.project_id, OLD.project_id),
      'name_id', COALESCE(NEW.name_id, OLD.name_id),
      'type', COALESCE(NEW.type, OLD.type),
      'description_id', COALESCE(NEW.description_id, OLD.description_id),
      'private', COALESCE(NEW.private, OLD.private),
      'onwebsite', COALESCE(NEW.onwebsite, OLD.onwebsite),
      'created_at', COALESCE(NEW.created_at, OLD.created_at),
      'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
    ),
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'project_id', OLD.project_id,
      'name_id', OLD.name_id,
      'type', OLD.type,
      'description_id', OLD.description_id,
      'private', OLD.private,
      'onwebsite', OLD.onwebsite,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_research_fields_change_log_delete
AFTER DELETE ON research_fields
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    OLD.project_id,
    'research_fields',
    'DELETE',
    OLD.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    NULL,
    json_object(
      'id', OLD.id,
      'project_id', OLD.project_id,
      'name_id', OLD.name_id,
      'type', OLD.type,
      'description_id', OLD.description_id,
      'private', OLD.private,
      'onwebsite', OLD.onwebsite,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

-- ontology_fields
CREATE TRIGGER IF NOT EXISTS trg_ontology_fields_change_log_insert
AFTER INSERT ON ontology_fields
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.project_id,
    'ontology_fields',
    'INSERT',
    NEW.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', NEW.id,
      'project_id', NEW.project_id,
      'name_id', NEW.name_id,
      'description_id', NEW.description_id,
      'category_id', NEW.category_id,
      'embeddings', NEW.embeddings,
      'onwebsite', NEW.onwebsite,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    ),
    NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_ontology_fields_change_log_update
AFTER UPDATE ON ontology_fields
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(NEW.project_id, OLD.project_id),
    'ontology_fields',
    'UPDATE',
    COALESCE(NEW.id, OLD.id),
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'project_id', COALESCE(NEW.project_id, OLD.project_id),
      'name_id', COALESCE(NEW.name_id, OLD.name_id),
      'description_id', COALESCE(NEW.description_id, OLD.description_id),
      'category_id', COALESCE(NEW.category_id, OLD.category_id),
      'embeddings', COALESCE(NEW.embeddings, OLD.embeddings),
      'onwebsite', COALESCE(NEW.onwebsite, OLD.onwebsite),
      'created_at', COALESCE(NEW.created_at, OLD.created_at),
      'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
    ),
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'project_id', OLD.project_id,
      'name_id', OLD.name_id,
      'description_id', OLD.description_id,
      'category_id', OLD.category_id,
      'embeddings', OLD.embeddings,
      'onwebsite', OLD.onwebsite,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_ontology_fields_change_log_delete
AFTER DELETE ON ontology_fields
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    OLD.project_id,
    'ontology_fields',
    'DELETE',
    OLD.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    NULL,
    json_object(
      'id', OLD.id,
      'project_id', OLD.project_id,
      'name_id', OLD.name_id,
      'description_id', OLD.description_id,
      'category_id', OLD.category_id,
      'embeddings', OLD.embeddings,
      'onwebsite', OLD.onwebsite,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

-- assets
CREATE TRIGGER IF NOT EXISTS trg_assets_change_log_insert
AFTER INSERT ON assets
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.project_id,
    'assets',
    'INSERT',
    NEW.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', NEW.id,
      'project_id', NEW.project_id,
      'filename', NEW.filename,
      'path', NEW.path,
      'type', NEW.type,
      'formats', NEW.formats,
      'properties', NEW.properties,
      'institution_id', NEW.institution_id,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    ),
    NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_assets_change_log_update
AFTER UPDATE ON assets
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(NEW.project_id, OLD.project_id),
    'assets',
    'UPDATE',
    COALESCE(NEW.id, OLD.id),
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'project_id', COALESCE(NEW.project_id, OLD.project_id),
      'filename', COALESCE(NEW.filename, OLD.filename),
      'path', COALESCE(NEW.path, OLD.path),
      'type', COALESCE(NEW.type, OLD.type),
      'formats', COALESCE(NEW.formats, OLD.formats),
      'properties', COALESCE(NEW.properties, OLD.properties),
      'institution_id', COALESCE(NEW.institution_id, OLD.institution_id),
      'created_at', COALESCE(NEW.created_at, OLD.created_at),
      'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
    ),
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'project_id', OLD.project_id,
      'filename', OLD.filename,
      'path', OLD.path,
      'type', OLD.type,
      'formats', OLD.formats,
      'properties', OLD.properties,
      'institution_id', OLD.institution_id,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_assets_change_log_delete
AFTER DELETE ON assets
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    OLD.project_id,
    'assets',
    'DELETE',
    OLD.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    NULL,
    json_object(
      'id', OLD.id,
      'project_id', OLD.project_id,
      'filename', OLD.filename,
      'path', OLD.path,
      'type', OLD.type,
      'formats', OLD.formats,
      'properties', OLD.properties,
      'institution_id', OLD.institution_id,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

-- generic_assets
CREATE TRIGGER IF NOT EXISTS trg_generic_assets_change_log_insert
AFTER INSERT ON generic_assets
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.project_id,
    'generic_assets',
    'INSERT',
    NEW.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', NEW.id,
      'project_id', NEW.project_id,
      'filename', NEW.filename,
      'path', NEW.path,
      'type', NEW.type,
      'formats', NEW.formats,
      'properties', NEW.properties,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    ),
    NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_generic_assets_change_log_update
AFTER UPDATE ON generic_assets
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(NEW.project_id, OLD.project_id),
    'generic_assets',
    'UPDATE',
    COALESCE(NEW.id, OLD.id),
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'project_id', COALESCE(NEW.project_id, OLD.project_id),
      'filename', COALESCE(NEW.filename, OLD.filename),
      'path', COALESCE(NEW.path, OLD.path),
      'type', COALESCE(NEW.type, OLD.type),
      'formats', COALESCE(NEW.formats, OLD.formats),
      'properties', COALESCE(NEW.properties, OLD.properties),
      'created_at', COALESCE(NEW.created_at, OLD.created_at),
      'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
    ),
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'project_id', OLD.project_id,
      'filename', OLD.filename,
      'path', OLD.path,
      'type', OLD.type,
      'formats', OLD.formats,
      'properties', OLD.properties,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_generic_assets_change_log_delete
AFTER DELETE ON generic_assets
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    OLD.project_id,
    'generic_assets',
    'DELETE',
    OLD.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    NULL,
    json_object(
      'id', OLD.id,
      'project_id', OLD.project_id,
      'filename', OLD.filename,
      'path', OLD.path,
      'type', OLD.type,
      'formats', OLD.formats,
      'properties', OLD.properties,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

-- objects
CREATE TRIGGER IF NOT EXISTS trg_objects_change_log_insert
AFTER INSERT ON objects
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.project_id,
    'objects',
    'INSERT',
    NEW.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', NEW.id,
      'project_id', NEW.project_id,
      'status', NEW.status,
      'name', NEW.name,
      'institution_id', NEW.institution_id,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    ),
    NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_objects_change_log_update
AFTER UPDATE ON objects
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(NEW.project_id, OLD.project_id),
    'objects',
    'UPDATE',
    COALESCE(NEW.id, OLD.id),
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'project_id', COALESCE(NEW.project_id, OLD.project_id),
      'status', COALESCE(NEW.status, OLD.status),
      'name', COALESCE(NEW.name, OLD.name),
      'institution_id', COALESCE(NEW.institution_id, OLD.institution_id),
      'created_at', COALESCE(NEW.created_at, OLD.created_at),
      'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
    ),
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'project_id', OLD.project_id,
      'status', OLD.status,
      'name', OLD.name,
      'institution_id', OLD.institution_id,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_objects_change_log_delete
AFTER DELETE ON objects
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    OLD.project_id,
    'objects',
    'DELETE',
    OLD.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    NULL,
    json_object(
      'id', OLD.id,
      'project_id', OLD.project_id,
      'status', OLD.status,
      'name', OLD.name,
      'institution_id', OLD.institution_id,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

-- templates
CREATE TRIGGER IF NOT EXISTS trg_templates_change_log_insert
AFTER INSERT ON templates
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.project_id,
    'templates',
    'INSERT',
    NEW.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', NEW.id,
      'project_id', NEW.project_id,
      'mapping', NEW.mapping,
      'asset_map_rule', NEW.asset_map_rule,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    ),
    NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_templates_change_log_update
AFTER UPDATE ON templates
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(NEW.project_id, OLD.project_id),
    'templates',
    'UPDATE',
    COALESCE(NEW.id, OLD.id),
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'project_id', COALESCE(NEW.project_id, OLD.project_id),
      'mapping', COALESCE(NEW.mapping, OLD.mapping),
      'asset_map_rule', COALESCE(NEW.asset_map_rule, OLD.asset_map_rule),
      'created_at', COALESCE(NEW.created_at, OLD.created_at),
      'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
    ),
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'project_id', OLD.project_id,
      'mapping', OLD.mapping,
      'asset_map_rule', OLD.asset_map_rule,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_templates_change_log_delete
AFTER DELETE ON templates
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    OLD.project_id,
    'templates',
    'DELETE',
    OLD.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    NULL,
    json_object(
      'id', OLD.id,
      'project_id', OLD.project_id,
      'mapping', OLD.mapping,
      'asset_map_rule', OLD.asset_map_rule,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

-- languages
CREATE TRIGGER IF NOT EXISTS trg_languages_change_log_insert
AFTER INSERT ON languages
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.project_id,
    'languages',
    'INSERT',
    NEW.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', NEW.id,
      'project_id', NEW.project_id,
      'code', NEW.code,
      'name', NEW.name,
      'is_default', NEW.is_default,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    ),
    NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_languages_change_log_update
AFTER UPDATE ON languages
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(NEW.project_id, OLD.project_id),
    'languages',
    'UPDATE',
    COALESCE(NEW.id, OLD.id),
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'project_id', COALESCE(NEW.project_id, OLD.project_id),
      'code', COALESCE(NEW.code, OLD.code),
      'name', COALESCE(NEW.name, OLD.name),
      'is_default', COALESCE(NEW.is_default, OLD.is_default),
      'created_at', COALESCE(NEW.created_at, OLD.created_at),
      'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
    ),
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'project_id', OLD.project_id,
      'code', OLD.code,
      'name', OLD.name,
      'is_default', OLD.is_default,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_languages_change_log_delete
AFTER DELETE ON languages
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    OLD.project_id,
    'languages',
    'DELETE',
    OLD.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    NULL,
    json_object(
      'id', OLD.id,
      'project_id', OLD.project_id,
      'code', OLD.code,
      'name', OLD.name,
      'is_default', OLD.is_default,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

-- institutions
CREATE TRIGGER IF NOT EXISTS trg_institutions_change_log_insert
AFTER INSERT ON institutions
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.project_id,
    'institutions',
    'INSERT',
    NEW.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', NEW.id,
      'project_id', NEW.project_id,
      'name_id', NEW.name_id,
      'description_id', NEW.description_id,
      'country_id', NEW.country_id,
      'location_id', NEW.location_id,
      'lon', NEW.lon,
      'lat', NEW.lat,
      'website', NEW.website,
      'links', NEW.links,
      'status', NEW.status,
      'logo', NEW.logo,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    ),
    NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_institutions_change_log_update
AFTER UPDATE ON institutions
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(NEW.project_id, OLD.project_id),
    'institutions',
    'UPDATE',
    COALESCE(NEW.id, OLD.id),
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'project_id', COALESCE(NEW.project_id, OLD.project_id),
      'name_id', COALESCE(NEW.name_id, OLD.name_id),
      'description_id', COALESCE(NEW.description_id, OLD.description_id),
      'country_id', COALESCE(NEW.country_id, OLD.country_id),
      'location_id', COALESCE(NEW.location_id, OLD.location_id),
      'lon', COALESCE(NEW.lon, OLD.lon),
      'lat', COALESCE(NEW.lat, OLD.lat),
      'website', COALESCE(NEW.website, OLD.website),
      'links', COALESCE(NEW.links, OLD.links),
      'status', COALESCE(NEW.status, OLD.status),
      'logo', COALESCE(NEW.logo, OLD.logo),
      'created_at', COALESCE(NEW.created_at, OLD.created_at),
      'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
    ),
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'project_id', OLD.project_id,
      'name_id', OLD.name_id,
      'description_id', OLD.description_id,
      'country_id', OLD.country_id,
      'location_id', OLD.location_id,
      'lon', OLD.lon,
      'lat', OLD.lat,
      'website', OLD.website,
      'links', OLD.links,
      'status', OLD.status,
      'logo', OLD.logo,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

-- texts
CREATE TRIGGER IF NOT EXISTS trg_texts_change_log_insert
AFTER INSERT ON texts
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    (SELECT project_id FROM languages WHERE id = NEW.original_language_id),
    'texts',
    'INSERT',
    NEW.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', NEW.id,
      'content', NEW.content,
      'context', NEW.context,
      'original_language_id', NEW.original_language_id,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    ),
    NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_texts_change_log_update
AFTER UPDATE ON texts
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(
      (SELECT project_id FROM languages WHERE id = NEW.original_language_id),
      (SELECT project_id FROM languages WHERE id = OLD.original_language_id)
    ),
    'texts',
    'UPDATE',
    COALESCE(NEW.id, OLD.id),
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'content', COALESCE(NEW.content, OLD.content),
      'context', COALESCE(NEW.context, OLD.context),
      'original_language_id', COALESCE(NEW.original_language_id, OLD.original_language_id),
      'created_at', COALESCE(NEW.created_at, OLD.created_at),
      'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
    ),
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'content', OLD.content,
      'context', OLD.context,
      'original_language_id', OLD.original_language_id,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_texts_change_log_delete
AFTER DELETE ON texts
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    (SELECT project_id FROM languages WHERE id = OLD.original_language_id),
    'texts',
    'DELETE',
    OLD.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    NULL,
    json_object(
      'id', OLD.id,
      'content', OLD.content,
      'context', OLD.context,
      'original_language_id', OLD.original_language_id,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

-- translations
CREATE TRIGGER IF NOT EXISTS trg_translations_change_log_insert
AFTER INSERT ON translations
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    (SELECT project_id FROM languages WHERE id = NEW.language_id),
    'translations',
    'INSERT',
    NEW.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', NEW.id,
      'text_id', NEW.text_id,
      'language_id', NEW.language_id,
      'content', NEW.content,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    ),
    NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_translations_change_log_update
AFTER UPDATE ON translations
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(
      (SELECT project_id FROM languages WHERE id = NEW.language_id),
      (SELECT project_id FROM languages WHERE id = OLD.language_id)
    ),
    'translations',
    'UPDATE',
    COALESCE(NEW.id, OLD.id),
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'text_id', COALESCE(NEW.text_id, OLD.text_id),
      'language_id', COALESCE(NEW.language_id, OLD.language_id),
      'content', COALESCE(NEW.content, OLD.content),
      'created_at', COALESCE(NEW.created_at, OLD.created_at),
      'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
    ),
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'text_id', OLD.text_id,
      'language_id', OLD.language_id,
      'content', OLD.content,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_translations_change_log_delete
AFTER DELETE ON translations
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    (SELECT project_id FROM languages WHERE id = OLD.language_id),
    'translations',
    'DELETE',
    OLD.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    NULL,
    json_object(
      'id', OLD.id,
      'text_id', OLD.text_id,
      'language_id', OLD.language_id,
      'content', OLD.content,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

-- vocabularies
CREATE TRIGGER IF NOT EXISTS trg_vocabularies_change_log_insert
AFTER INSERT ON vocabularies
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(
      (SELECT project_id FROM research_fields WHERE id = NEW.field_id),
      (SELECT project_id FROM generic_assets WHERE id = NEW.main_asset_id)
    ),
    'vocabularies',
    'INSERT',
    NEW.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', NEW.id,
      'option_id', NEW.option_id,
      'description_id', NEW.description_id,
      'main_asset_id', NEW.main_asset_id,
      'field_id', NEW.field_id,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    ),
    NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_vocabularies_change_log_update
AFTER UPDATE ON vocabularies
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(
      (SELECT project_id FROM research_fields WHERE id = COALESCE(NEW.field_id, OLD.field_id)),
      (SELECT project_id FROM generic_assets WHERE id = COALESCE(NEW.main_asset_id, OLD.main_asset_id))
    ),
    'vocabularies',
    'UPDATE',
    COALESCE(NEW.id, OLD.id),
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'option_id', COALESCE(NEW.option_id, OLD.option_id),
      'description_id', COALESCE(NEW.description_id, OLD.description_id),
      'main_asset_id', COALESCE(NEW.main_asset_id, OLD.main_asset_id),
      'field_id', COALESCE(NEW.field_id, OLD.field_id),
      'created_at', COALESCE(NEW.created_at, OLD.created_at),
      'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
    ),
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'option_id', OLD.option_id,
      'description_id', OLD.description_id,
      'main_asset_id', OLD.main_asset_id,
      'field_id', OLD.field_id,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_vocabularies_change_log_delete
AFTER DELETE ON vocabularies
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    COALESCE(
      (SELECT project_id FROM research_fields WHERE id = OLD.field_id),
      (SELECT project_id FROM generic_assets WHERE id = OLD.main_asset_id)
    ),
    'vocabularies',
    'DELETE',
    OLD.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    NULL,
    json_object(
      'id', OLD.id,
      'option_id', OLD.option_id,
      'description_id', OLD.description_id,
      'main_asset_id', OLD.main_asset_id,
      'field_id', OLD.field_id,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

-- datasources
CREATE TRIGGER IF NOT EXISTS trg_datasources_change_log_insert
AFTER INSERT ON datasources
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    (SELECT project_id FROM institutions WHERE id = NEW.institution_id),
    'datasources',
    'INSERT',
    NEW.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', NEW.id,
      'name_id', NEW.name_id,
      'institution_id', NEW.institution_id,
      'language', NEW.language,
      'copyright', NEW.copyright,
      'method_id', NEW.method_id,
      'contact', NEW.contact,
      'notes_id', NEW.notes_id,
      'date', NEW.date,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    ),
    NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_datasources_change_log_update
AFTER UPDATE ON datasources
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    (SELECT project_id FROM institutions WHERE id = COALESCE(NEW.institution_id, OLD.institution_id)),
    'datasources',
    'UPDATE',
    COALESCE(NEW.id, OLD.id),
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'name_id', COALESCE(NEW.name_id, OLD.name_id),
      'institution_id', COALESCE(NEW.institution_id, OLD.institution_id),
      'language', COALESCE(NEW.language, OLD.language),
      'copyright', COALESCE(NEW.copyright, OLD.copyright),
      'method_id', COALESCE(NEW.method_id, OLD.method_id),
      'contact', COALESCE(NEW.contact, OLD.contact),
      'notes_id', COALESCE(NEW.notes_id, OLD.notes_id),
      'date', COALESCE(NEW.date, OLD.date),
      'created_at', COALESCE(NEW.created_at, OLD.created_at),
      'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
    ),
    json_object(
      'id', COALESCE(NEW.id, OLD.id),
      'name_id', OLD.name_id,
      'institution_id', OLD.institution_id,
      'language', OLD.language,
      'copyright', OLD.copyright,
      'method_id', OLD.method_id,
      'contact', OLD.contact,
      'notes_id', OLD.notes_id,
      'date', OLD.date,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_datasources_change_log_delete
AFTER DELETE ON datasources
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    (SELECT project_id FROM institutions WHERE id = OLD.institution_id),
    'datasources',
    'DELETE',
    OLD.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    NULL,
    json_object(
      'id', OLD.id,
      'name_id', OLD.name_id,
      'institution_id', OLD.institution_id,
      'language', OLD.language,
      'copyright', OLD.copyright,
      'method_id', OLD.method_id,
      'contact', OLD.contact,
      'notes_id', OLD.notes_id,
      'date', OLD.date,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_institutions_change_log_delete
AFTER DELETE ON institutions
BEGIN
  INSERT INTO change_log (id, project_id, table_name, op, row_id, client_id, origin, new_row, old_row)
  VALUES (
    lower(hex(randomblob(16))),
    OLD.project_id,
    'institutions',
    'DELETE',
    OLD.id,
    (SELECT client_id FROM global_settings WHERE id = 1),
    'local',
    NULL,
    json_object(
      'id', OLD.id,
      'project_id', OLD.project_id,
      'name_id', OLD.name_id,
      'description_id', OLD.description_id,
      'country_id', OLD.country_id,
      'location_id', OLD.location_id,
      'lon', OLD.lon,
      'lat', OLD.lat,
      'website', OLD.website,
      'links', OLD.links,
      'status', OLD.status,
      'logo', OLD.logo,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;