CREATE TABLE `project_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`project_id` text NOT NULL,
  `source_key` text NOT NULL,
  `bundle_id` text,
  `sync_kind` text DEFAULT 'user' NOT NULL,
	`actor_client_id` text,
	`actor_username` text,
	`action_type` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`institution_id` text,
	`institution_name` text,
	`message_key` text NOT NULL,
	`item_count` integer DEFAULT 1 NOT NULL,
	`summary_params` text,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_project_activity_project_updated` ON `project_activity` (`project_id`,`updated_at`,`id`);
--> statement-breakpoint
CREATE INDEX `idx_project_activity_source` ON `project_activity` (`project_id`,`source_key`);
--> statement-breakpoint
CREATE INDEX `idx_project_activity_bundle` ON `project_activity` (`project_id`,`bundle_id`);
--> statement-breakpoint
CREATE INDEX `idx_project_activity_feed_grouping` ON `project_activity` (`project_id`,`actor_client_id`,`message_key`,`entity_type`,`institution_id`,`updated_at`);
