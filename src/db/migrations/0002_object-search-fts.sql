CREATE VIRTUAL TABLE IF NOT EXISTS objects_search
USING fts5(
  object_id UNINDEXED,
  content,
  source UNINDEXED,
  tokenize='unicode61'
);
--> statement-breakpoint
CREATE VIRTUAL TABLE IF NOT EXISTS objects_ontology_fields_search
USING fts5(
  oof_id UNINDEXED,
  object_id UNINDEXED,
  field_id UNINDEXED,
  content,
  tokenize='unicode61'
);
--> statement-breakpoint
CREATE VIRTUAL TABLE IF NOT EXISTS objects_research_fields_search
USING fts5(
  orf_id UNINDEXED,
  object_id UNINDEXED,
  field_id UNINDEXED,
  vocabulary_id UNINDEXED,
  content,
  tokenize='unicode61'
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_objects_search_insert
AFTER INSERT ON objects
BEGIN
  INSERT INTO objects_search (object_id, content, source)
  VALUES (NEW.id, LOWER(COALESCE(NEW.name, '')), 'name');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_objects_search_update
AFTER UPDATE OF name ON objects
BEGIN
  DELETE FROM objects_search WHERE object_id = OLD.id AND source = 'name';
  INSERT INTO objects_search (object_id, content, source)
  VALUES (NEW.id, LOWER(COALESCE(NEW.name, '')), 'name');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_objects_search_delete
AFTER DELETE ON objects
BEGIN
  DELETE FROM objects_search WHERE object_id = OLD.id;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_oof_search_insert
AFTER INSERT ON objects_ontology_fields
BEGIN
  INSERT INTO objects_ontology_fields_search (oof_id, object_id, field_id, content)
  VALUES (NEW.id, NEW.object_id, NEW.field_id, LOWER(COALESCE(NEW.value, '')));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_oof_search_update
AFTER UPDATE ON objects_ontology_fields
BEGIN
  DELETE FROM objects_ontology_fields_search WHERE oof_id = OLD.id;
  INSERT INTO objects_ontology_fields_search (oof_id, object_id, field_id, content)
  VALUES (NEW.id, NEW.object_id, NEW.field_id, LOWER(COALESCE(NEW.value, '')));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_oof_search_delete
AFTER DELETE ON objects_ontology_fields
BEGIN
  DELETE FROM objects_ontology_fields_search WHERE oof_id = OLD.id;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_orf_search_insert
AFTER INSERT ON objects_research_fields
BEGIN
  INSERT INTO objects_research_fields_search (orf_id, object_id, field_id, vocabulary_id, content)
  VALUES (NEW.id, NEW.object_id, NEW.field_id, NEW.vocabulary_id, LOWER(COALESCE(NEW.value, '')));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_orf_search_update
AFTER UPDATE ON objects_research_fields
BEGIN
  DELETE FROM objects_research_fields_search WHERE orf_id = OLD.id;
  INSERT INTO objects_research_fields_search (orf_id, object_id, field_id, vocabulary_id, content)
  VALUES (NEW.id, NEW.object_id, NEW.field_id, NEW.vocabulary_id, LOWER(COALESCE(NEW.value, '')));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_orf_search_delete
AFTER DELETE ON objects_research_fields
BEGIN
  DELETE FROM objects_research_fields_search WHERE orf_id = OLD.id;
END;
