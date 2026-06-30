-- Triggers to update objects.updated_at when junction table rows change.
-- These fire on every INSERT/UPDATE/DELETE on objects_assets, objects_research_fields,
-- objects_ontology_fields, and objects_datasources, ensuring the parent object's
-- timestamp reflects that its related data has been modified.
--
-- Uses unixepoch('now', 'subsec') * 1000 for millisecond epoch timestamps,
-- matching Drizzle's { mode: 'timestamp_ms' } used in schema.js.
-- P2P sync safety: updated_at is stripped from sync payloads in changeLogTailerService.js.

-- ─── objects_assets ──────────────────────────────────────────────────────────────

CREATE TRIGGER IF NOT EXISTS trg_objects_assets_updated_at_ai
AFTER INSERT ON objects_assets
BEGIN
    UPDATE objects
    SET updated_at = CAST(unixepoch('now', 'subsec') * 1000 AS INTEGER)
    WHERE id = NEW.object_id;
END;

--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS trg_objects_assets_updated_at_au
AFTER UPDATE ON objects_assets
BEGIN
    UPDATE objects
    SET updated_at = CAST(unixepoch('now', 'subsec') * 1000 AS INTEGER)
    WHERE id = NEW.object_id;
END;

--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS trg_objects_assets_updated_at_ad
AFTER DELETE ON objects_assets
BEGIN
    UPDATE objects
    SET updated_at = CAST(unixepoch('now', 'subsec') * 1000 AS INTEGER)
    WHERE id = OLD.object_id;
END;

--> statement-breakpoint

-- ─── objects_research_fields ─────────────────────────────────────────────────────

CREATE TRIGGER IF NOT EXISTS trg_objects_research_fields_updated_at_ai
AFTER INSERT ON objects_research_fields
BEGIN
    UPDATE objects
    SET updated_at = CAST(unixepoch('now', 'subsec') * 1000 AS INTEGER)
    WHERE id = NEW.object_id;
END;

--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS trg_objects_research_fields_updated_at_au
AFTER UPDATE ON objects_research_fields
BEGIN
    UPDATE objects
    SET updated_at = CAST(unixepoch('now', 'subsec') * 1000 AS INTEGER)
    WHERE id = NEW.object_id;
END;

--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS trg_objects_research_fields_updated_at_ad
AFTER DELETE ON objects_research_fields
BEGIN
    UPDATE objects
    SET updated_at = CAST(unixepoch('now', 'subsec') * 1000 AS INTEGER)
    WHERE id = OLD.object_id;
END;

--> statement-breakpoint

-- ─── objects_ontology_fields ─────────────────────────────────────────────────────

CREATE TRIGGER IF NOT EXISTS trg_objects_ontology_fields_updated_at_ai
AFTER INSERT ON objects_ontology_fields
BEGIN
    UPDATE objects
    SET updated_at = CAST(unixepoch('now', 'subsec') * 1000 AS INTEGER)
    WHERE id = NEW.object_id;
END;

--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS trg_objects_ontology_fields_updated_at_au
AFTER UPDATE ON objects_ontology_fields
BEGIN
    UPDATE objects
    SET updated_at = CAST(unixepoch('now', 'subsec') * 1000 AS INTEGER)
    WHERE id = NEW.object_id;
END;

--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS trg_objects_ontology_fields_updated_at_ad
AFTER DELETE ON objects_ontology_fields
BEGIN
    UPDATE objects
    SET updated_at = CAST(unixepoch('now', 'subsec') * 1000 AS INTEGER)
    WHERE id = OLD.object_id;
END;

--> statement-breakpoint

-- ─── objects_datasources ─────────────────────────────────────────────────────────

CREATE TRIGGER IF NOT EXISTS trg_objects_datasources_updated_at_ai
AFTER INSERT ON objects_datasources
BEGIN
    UPDATE objects
    SET updated_at = CAST(unixepoch('now', 'subsec') * 1000 AS INTEGER)
    WHERE id = NEW.object_id;
END;

--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS trg_objects_datasources_updated_at_au
AFTER UPDATE ON objects_datasources
BEGIN
    UPDATE objects
    SET updated_at = CAST(unixepoch('now', 'subsec') * 1000 AS INTEGER)
    WHERE id = NEW.object_id;
END;

--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS trg_objects_datasources_updated_at_ad
AFTER DELETE ON objects_datasources
BEGIN
    UPDATE objects
    SET updated_at = CAST(unixepoch('now', 'subsec') * 1000 AS INTEGER)
    WHERE id = OLD.object_id;
END;
