CREATE TABLE `actions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`project_id` text,
	`user_id` text,
	`client_id` text,
	`action_type` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`changes` text,
	`yjs_update` blob,
	`parent_action_id` text,
	`metadata` text,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `asset_local_state` (
	`asset_id` text PRIMARY KEY NOT NULL,
	`sync_status` text DEFAULT 'missing',
	`sync_error` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`last_attempt_at` integer,
	`last_success_at` integer,
	`download_progress` real DEFAULT 0,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`filename` text,
	`path` text,
	`type` text,
	`formats` text,
	`properties` text,
	`institution_id` text,
	`project_id` text,
	`torrent_info_hash` text,
	`torrent_name` text,
	`torrent_length` integer,
	`torrent_piece_length` integer,
	`asset_content_mime` text,
	`asset_content_ext` text,
	`asset_content_sha256` text,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `assets_institutions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`asset_id` text,
	`institution_id` text,
	`rule` text,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `change_log` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`project_id` text NOT NULL,
	`table_name` text NOT NULL,
	`op` text NOT NULL,
	`row_id` text NOT NULL,
	`client_id` text,
	`origin` text DEFAULT 'local',
	`new_row` text,
	`old_row` text,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `change_log_order_idx` ON `change_log` (`project_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `datasources` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`name_id` text,
	`institution_id` text,
	`import_id` text,
	`source` text,
	`language` text,
	`copyright` text,
	`method_id` text,
	`contact` text,
	`notes_id` text,
	`date` integer,
	FOREIGN KEY (`name_id`) REFERENCES `texts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`import_id`) REFERENCES `imports`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`method_id`) REFERENCES `texts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`notes_id`) REFERENCES `texts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `generic_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`filename` text,
	`path` text,
	`type` text,
	`formats` text,
	`properties` text,
	`project_id` text,
	`torrent_info_hash` text,
	`torrent_name` text,
	`torrent_length` integer,
	`torrent_piece_length` integer,
	`asset_content_mime` text,
	`asset_content_ext` text,
	`asset_content_sha256` text,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `generic_asset_local_state` (
	`generic_asset_id` text PRIMARY KEY NOT NULL,
	`sync_status` text DEFAULT 'missing',
	`sync_error` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`last_attempt_at` integer,
	`last_success_at` integer,
	`download_progress` real DEFAULT 0,
	FOREIGN KEY (`generic_asset_id`) REFERENCES `generic_assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `global_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`client_id` text NOT NULL,
	`username` text,
	`interface_language` text,
	`app_version` text,
	`initialized_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `global_settings_client_id_unique` ON `global_settings` (`client_id`);--> statement-breakpoint
CREATE TABLE `imports` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`filename` text,
	`data` text
);
--> statement-breakpoint
CREATE TABLE `ingestion_state` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`project_id` text NOT NULL,
	`last_processed_change_id` text,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`last_processed_change_id`) REFERENCES `change_log`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingestion_state_project_id_unique` ON `ingestion_state` (`project_id`);--> statement-breakpoint
CREATE TABLE `institutions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`name_id` text NOT NULL,
	`description_id` text,
	`country_id` text,
	`location_id` text,
	`lon` integer,
	`lat` integer,
	`website` text,
	`links` text,
	`project_id` text,
	`status` text,
	`logo` text,
	FOREIGN KEY (`name_id`) REFERENCES `texts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`description_id`) REFERENCES `texts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`country_id`) REFERENCES `texts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `texts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_institutions_project_id` ON `institutions` (`project_id`);--> statement-breakpoint
CREATE TABLE `interface_translations_idx` (
	`id` text PRIMARY KEY NOT NULL,
	`locale_namespace_key` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `interface_translations_idx_locale_namespace_key_unique` ON `interface_translations_idx` (`locale_namespace_key`);--> statement-breakpoint
CREATE TABLE `interface_languages` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `interface_languages_code_unique` ON `interface_languages` (`code`);--> statement-breakpoint
CREATE TABLE `interface_translations` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`locale` text NOT NULL,
	`namespace` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	FOREIGN KEY (`locale`) REFERENCES `interface_languages`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `languages` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`project_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`is_default` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `logs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`level` text DEFAULT 'error' NOT NULL,
	`action` text NOT NULL,
	`message` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `object_display_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`project_id` text NOT NULL,
	`ontology_field_id` text,
	`research_field_id` text,
	`property_name` text,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ontology_field_id`) REFERENCES `ontology_fields`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`research_field_id`) REFERENCES `research_fields`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `objects` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`status` text DEFAULT 'in progress',
	`name` text,
	`institution_id` text,
	`project_id` text,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_objects_project_id` ON `objects` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_objects_institution_id` ON `objects` (`institution_id`);--> statement-breakpoint
CREATE INDEX `idx_objects_status` ON `objects` (`status`);--> statement-breakpoint
CREATE INDEX `idx_objects_project_institution` ON `objects` (`project_id`,`institution_id`);--> statement-breakpoint
CREATE TABLE `objects_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`asset_id` text,
	`object_id` text,
	`order` integer,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`object_id`) REFERENCES `objects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `objects_assets_object_asset_unique` ON `objects_assets` (`object_id`,`asset_id`);--> statement-breakpoint
CREATE INDEX `idx_objects_assets_object_id` ON `objects_assets` (`object_id`);--> statement-breakpoint
CREATE INDEX `idx_objects_assets_asset_id` ON `objects_assets` (`asset_id`);--> statement-breakpoint
CREATE TABLE `objects_datasources` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`object_id` text,
	`datasource_id` text,
	`template_id` text,
	FOREIGN KEY (`object_id`) REFERENCES `objects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`datasource_id`) REFERENCES `datasources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_objects_datasources_object_id` ON `objects_datasources` (`object_id`);--> statement-breakpoint
CREATE INDEX `idx_objects_datasources_datasource_id` ON `objects_datasources` (`datasource_id`);--> statement-breakpoint
CREATE INDEX `idx_objects_datasources_template_id` ON `objects_datasources` (`template_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `objects_datasources_object_datasource_unique` ON `objects_datasources` (`object_id`,`datasource_id`);--> statement-breakpoint
CREATE TABLE `objects_ontology_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`label` text,
	`value` text,
	`object_id` text,
	`field_id` text,
	`datasources_id` text,
	`primary` integer,
	`default_description` integer,
	FOREIGN KEY (`object_id`) REFERENCES `objects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`field_id`) REFERENCES `ontology_fields`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`datasources_id`) REFERENCES `datasources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_objects_ontology_fields_object_id` ON `objects_ontology_fields` (`object_id`);--> statement-breakpoint
CREATE INDEX `idx_objects_ontology_fields_field_id` ON `objects_ontology_fields` (`field_id`);--> statement-breakpoint
CREATE INDEX `idx_objects_ontology_fields_object_field` ON `objects_ontology_fields` (`object_id`,`field_id`);--> statement-breakpoint
CREATE TABLE `objects_research_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`object_id` text,
	`field_id` text,
	`vocabulary_id` text,
	`value` text,
	FOREIGN KEY (`object_id`) REFERENCES `objects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`field_id`) REFERENCES `research_fields`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vocabulary_id`) REFERENCES `vocabularies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_objects_research_fields_object_id` ON `objects_research_fields` (`object_id`);--> statement-breakpoint
CREATE INDEX `idx_objects_research_fields_field_id` ON `objects_research_fields` (`field_id`);--> statement-breakpoint
CREATE INDEX `idx_objects_research_fields_vocabulary_id` ON `objects_research_fields` (`vocabulary_id`);--> statement-breakpoint
CREATE INDEX `idx_objects_research_fields_object_field` ON `objects_research_fields` (`object_id`,`field_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `objects_research_fields_object_field_vocabulary_unique` ON `objects_research_fields` (`object_id`,`field_id`,`vocabulary_id`);--> statement-breakpoint
CREATE TABLE `ontology_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`name_id` text,
	`description_id` text,
	`category_id` text,
	`embeddings` text,
	`onwebsite` integer DEFAULT 1,
	`project_id` text NOT NULL,
	FOREIGN KEY (`name_id`) REFERENCES `texts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`description_id`) REFERENCES `texts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `texts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `project` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`title_id` text,
	`description_id` text,
	`exports` text,
	`password` text,
	`is_shared` integer DEFAULT 0 NOT NULL,
	`created_app_version` text,
	FOREIGN KEY (`title_id`) REFERENCES `texts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`description_id`) REFERENCES `texts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `research_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`name_id` text NOT NULL,
	`type` text,
	`description_id` text,
	`project_id` text,
	`private` integer DEFAULT 0 NOT NULL,
	`onwebsite` integer DEFAULT 1 NOT NULL,
	`fields_config` text,
	FOREIGN KEY (`name_id`) REFERENCES `texts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`description_id`) REFERENCES `texts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_research_fields_project_id` ON `research_fields` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_research_fields_type` ON `research_fields` (`type`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`username` text,
	`password` text,
	`sync_url` text,
	`sig_server` text,
	`project_id` text,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`name` text,
	`mapping` text,
	`project_id` text,
	`institution_id` text,
	`asset_map_rule` text,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `texts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`content` text NOT NULL,
	`context` text NOT NULL,
	`original_language_id` text NOT NULL,
	FOREIGN KEY (`original_language_id`) REFERENCES `languages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `translations` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`text_id` text NOT NULL,
	`language_id` text NOT NULL,
	`content` text NOT NULL,
	FOREIGN KEY (`text_id`) REFERENCES `texts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`language_id`) REFERENCES `languages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vocabularies` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`option_id` text,
	`description_id` text,
	`main_asset_id` text,
	`external_link` text,
	`field_id` text,
	FOREIGN KEY (`option_id`) REFERENCES `texts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`description_id`) REFERENCES `texts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`main_asset_id`) REFERENCES `generic_assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`field_id`) REFERENCES `research_fields`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_vocabularies_field_id` ON `vocabularies` (`field_id`);--> statement-breakpoint
CREATE TABLE `vocabularies_generic_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`vocabulary_id` text,
	`generic_asset_id` text,
	`order` integer,
	FOREIGN KEY (`vocabulary_id`) REFERENCES `vocabularies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`generic_asset_id`) REFERENCES `generic_assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `website_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`title_id` text,
	`short_description_id` text,
	`about_id` text,
	`authors` text,
	`logo_id` text,
	`subfolder_path` text,
	`show_unmapped` integer DEFAULT 0 NOT NULL,
	`project_id` text,
	FOREIGN KEY (`title_id`) REFERENCES `texts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`short_description_id`) REFERENCES `texts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`about_id`) REFERENCES `texts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`logo_id`) REFERENCES `generic_assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `website_settings_project_id_unique` ON `website_settings` (`project_id`);--> statement-breakpoint
CREATE TABLE `yjs_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`project_id` text NOT NULL,
	`last_change_id` text,
	`snapshot_bytes` blob NOT NULL,
	`state_vector` blob,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`last_change_id`) REFERENCES `change_log`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `yjs_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`project_id` text NOT NULL,
	`from_change_id` text,
	`to_change_id` text,
	`update_bytes` blob NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_change_id`) REFERENCES `change_log`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`to_change_id`) REFERENCES `change_log`(`id`) ON UPDATE no action ON DELETE set null
);
