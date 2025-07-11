-- Migration 003: Enrich actions table with metadata

-- Add metadata field to actions table
ALTER TABLE actions ADD COLUMN metadata TEXT; 