-- The Connections page description is optional for existing projects.
ALTER TABLE `website_settings` ADD COLUMN `connections_description_id` text REFERENCES `texts`(`id`);
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_website_settings_change_log_insert;
--> statement-breakpoint
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
      'connections_description_id', NEW.connections_description_id,
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
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_website_settings_change_log_update;
--> statement-breakpoint
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
      'connections_description_id', NEW.connections_description_id,
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
      'connections_description_id', OLD.connections_description_id,
      'authors', OLD.authors,
      'logo_id', OLD.logo_id,
      'subfolder_path', OLD.subfolder_path,
      'show_unmapped', OLD.show_unmapped,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_website_settings_change_log_delete;
--> statement-breakpoint
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
      'connections_description_id', OLD.connections_description_id,
      'authors', OLD.authors,
      'logo_id', OLD.logo_id,
      'subfolder_path', OLD.subfolder_path,
      'show_unmapped', OLD.show_unmapped,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;
