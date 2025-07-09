-- Create the FTS virtual table for institutions search
CREATE VIRTUAL TABLE IF NOT EXISTS institutions_search USING FTS5(
  institution_id,
  text_id,
  field_name,  -- 'name', 'description', 'country', 'location'
  content,
  language_id,
  tokenize='porter unicode61'
);

-- Trigger for when an institution is deleted
CREATE TRIGGER IF NOT EXISTS institution_delete AFTER DELETE ON institutions
BEGIN
  DELETE FROM institutions_search WHERE institution_id = OLD.id;
END;

-- Trigger for when institution text references change
CREATE TRIGGER IF NOT EXISTS institution_text_ref_update AFTER UPDATE ON institutions
WHEN OLD.name_id != NEW.name_id OR OLD.description_id != NEW.description_id 
  OR OLD.country_id != NEW.country_id OR OLD.location_id != NEW.location_id
BEGIN
  -- Remove old records for changed fields
  DELETE FROM institutions_search 
  WHERE institution_id = OLD.id AND (
    (OLD.name_id IS NOT NULL AND NEW.name_id != OLD.name_id AND text_id = OLD.name_id) OR
    (OLD.description_id IS NOT NULL AND NEW.description_id != OLD.description_id AND text_id = OLD.description_id) OR
    (OLD.country_id IS NOT NULL AND NEW.country_id != OLD.country_id AND text_id = OLD.country_id) OR
    (OLD.location_id IS NOT NULL AND NEW.location_id != OLD.location_id AND text_id = OLD.location_id)
  );
END;

-- Trigger for when text content changes
CREATE TRIGGER IF NOT EXISTS text_content_change AFTER UPDATE OF content ON texts
BEGIN
  -- Update all institutions_search entries that reference this text
  UPDATE institutions_search 
  SET content = NEW.content
  WHERE text_id = NEW.id AND language_id = NEW.original_language_id;
END;

-- Trigger for when a new translation is added
CREATE TRIGGER IF NOT EXISTS translation_insert AFTER INSERT ON translations
BEGIN
  -- Find institutions that reference this text and add to search index
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

-- Trigger for when a translation changes
CREATE TRIGGER IF NOT EXISTS translation_content_change AFTER UPDATE OF content ON translations
BEGIN
  -- Update all institutions_search entries that reference this translation
  UPDATE institutions_search 
  SET content = NEW.content
  WHERE text_id = NEW.text_id AND language_id = NEW.language_id;
END;

-- Trigger for when a translation is deleted
CREATE TRIGGER IF NOT EXISTS translation_delete AFTER DELETE ON translations
BEGIN
  DELETE FROM institutions_search 
  WHERE text_id = OLD.text_id AND language_id = OLD.language_id;
END; 