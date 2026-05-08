CREATE VIRTUAL TABLE IF NOT EXISTS institutions_search USING FTS5(
  institution_id,
  text_id,
  field_name,  -- 'name', 'description', 'country', 'location'
  content,
  language_id,
  tokenize='porter unicode61'
);
--> statement-breakpoint
DROP TRIGGER IF EXISTS institution_delete;
--> statement-breakpoint
DROP TRIGGER IF EXISTS institution_insert;
--> statement-breakpoint
DROP TRIGGER IF EXISTS institution_text_ref_update;
--> statement-breakpoint
DROP TRIGGER IF EXISTS text_content_change;
--> statement-breakpoint
DROP TRIGGER IF EXISTS translation_insert;
--> statement-breakpoint
DROP TRIGGER IF EXISTS translation_content_change;
--> statement-breakpoint
DROP TRIGGER IF EXISTS translation_delete;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS institution_delete AFTER DELETE ON institutions
BEGIN
  DELETE FROM institutions_search WHERE institution_id = OLD.id;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS institution_insert AFTER INSERT ON institutions
BEGIN
  INSERT INTO institutions_search (institution_id, text_id, field_name, content, language_id)
  SELECT NEW.id, NEW.name_id, 'name', t.content, t.original_language_id
  FROM texts t
  WHERE NEW.name_id IS NOT NULL AND t.id = NEW.name_id
  UNION ALL
  SELECT NEW.id, NEW.description_id, 'description', t.content, t.original_language_id
  FROM texts t
  WHERE NEW.description_id IS NOT NULL AND t.id = NEW.description_id
  UNION ALL
  SELECT NEW.id, NEW.country_id, 'country', t.content, t.original_language_id
  FROM texts t
  WHERE NEW.country_id IS NOT NULL AND t.id = NEW.country_id
  UNION ALL
  SELECT NEW.id, NEW.location_id, 'location', t.content, t.original_language_id
  FROM texts t
  WHERE NEW.location_id IS NOT NULL AND t.id = NEW.location_id;
  INSERT INTO institutions_search (institution_id, text_id, field_name, content, language_id)
  SELECT NEW.id, NEW.name_id, 'name', tr.content, tr.language_id
  FROM translations tr
  WHERE NEW.name_id IS NOT NULL AND tr.text_id = NEW.name_id
  UNION ALL
  SELECT NEW.id, NEW.description_id, 'description', tr.content, tr.language_id
  FROM translations tr
  WHERE NEW.description_id IS NOT NULL AND tr.text_id = NEW.description_id
  UNION ALL
  SELECT NEW.id, NEW.country_id, 'country', tr.content, tr.language_id
  FROM translations tr
  WHERE NEW.country_id IS NOT NULL AND tr.text_id = NEW.country_id
  UNION ALL
  SELECT NEW.id, NEW.location_id, 'location', tr.content, tr.language_id
  FROM translations tr
  WHERE NEW.location_id IS NOT NULL AND tr.text_id = NEW.location_id;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS institution_text_ref_update AFTER UPDATE ON institutions
WHEN OLD.name_id != NEW.name_id OR OLD.description_id != NEW.description_id
  OR OLD.country_id != NEW.country_id OR OLD.location_id != NEW.location_id
BEGIN
  DELETE FROM institutions_search WHERE institution_id = NEW.id;
  INSERT INTO institutions_search (institution_id, text_id, field_name, content, language_id)
  SELECT NEW.id, NEW.name_id, 'name', t.content, t.original_language_id
  FROM texts t
  WHERE NEW.name_id IS NOT NULL AND t.id = NEW.name_id
  UNION ALL
  SELECT NEW.id, NEW.description_id, 'description', t.content, t.original_language_id
  FROM texts t
  WHERE NEW.description_id IS NOT NULL AND t.id = NEW.description_id
  UNION ALL
  SELECT NEW.id, NEW.country_id, 'country', t.content, t.original_language_id
  FROM texts t
  WHERE NEW.country_id IS NOT NULL AND t.id = NEW.country_id
  UNION ALL
  SELECT NEW.id, NEW.location_id, 'location', t.content, t.original_language_id
  FROM texts t
  WHERE NEW.location_id IS NOT NULL AND t.id = NEW.location_id;
  INSERT INTO institutions_search (institution_id, text_id, field_name, content, language_id)
  SELECT NEW.id, NEW.name_id, 'name', tr.content, tr.language_id
  FROM translations tr
  WHERE NEW.name_id IS NOT NULL AND tr.text_id = NEW.name_id
  UNION ALL
  SELECT NEW.id, NEW.description_id, 'description', tr.content, tr.language_id
  FROM translations tr
  WHERE NEW.description_id IS NOT NULL AND tr.text_id = NEW.description_id
  UNION ALL
  SELECT NEW.id, NEW.country_id, 'country', tr.content, tr.language_id
  FROM translations tr
  WHERE NEW.country_id IS NOT NULL AND tr.text_id = NEW.country_id
  UNION ALL
  SELECT NEW.id, NEW.location_id, 'location', tr.content, tr.language_id
  FROM translations tr
  WHERE NEW.location_id IS NOT NULL AND tr.text_id = NEW.location_id;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS text_content_change AFTER UPDATE OF content ON texts
BEGIN
  UPDATE institutions_search
  SET content = NEW.content
  WHERE text_id = NEW.id AND language_id = NEW.original_language_id;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS translation_insert AFTER INSERT ON translations
BEGIN
  INSERT INTO institutions_search (institution_id, text_id, field_name, content, language_id)
  SELECT
    i.id,
    NEW.text_id,
    CASE
      WHEN i.name_id = NEW.text_id THEN 'name'
      WHEN i.description_id = NEW.text_id THEN 'description'
      WHEN i.country_id = NEW.text_id THEN 'country'
      WHEN i.location_id = NEW.text_id THEN 'location'
    END,
    NEW.content,
    NEW.language_id
  FROM institutions i
  WHERE i.name_id = NEW.text_id OR i.description_id = NEW.text_id
     OR i.country_id = NEW.text_id OR i.location_id = NEW.text_id;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS translation_content_change AFTER UPDATE OF content ON translations
BEGIN
  UPDATE institutions_search
  SET content = NEW.content
  WHERE text_id = NEW.text_id AND language_id = NEW.language_id;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS translation_delete AFTER DELETE ON translations
BEGIN
  DELETE FROM institutions_search
  WHERE text_id = OLD.text_id AND language_id = OLD.language_id;
END;
