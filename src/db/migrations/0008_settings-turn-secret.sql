-- Per-project TURN shared secret (TURN REST API) used to derive time-limited
-- TURN credentials for custom signaling servers.
ALTER TABLE `settings` ADD COLUMN `turn_secret` text;
--> statement-breakpoint

-- Recreate the settings change-log triggers so new_row/old_row carry turn_secret.
DROP TRIGGER IF EXISTS trg_settings_change_log_insert;
--> statement-breakpoint
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
      'turn_secret', NEW.turn_secret,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    ),
    NULL
  );
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_settings_change_log_update;
--> statement-breakpoint
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
      'turn_secret', COALESCE(NEW.turn_secret, OLD.turn_secret),
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
      'turn_secret', OLD.turn_secret,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_settings_change_log_delete;
--> statement-breakpoint
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
      'turn_secret', OLD.turn_secret,
      'created_at', OLD.created_at,
      'updated_at', OLD.updated_at
    )
  );
END;
