CREATE TABLE `discovery_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`companies_found` integer DEFAULT 0 NOT NULL,
	`companies_new` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_discovery_runs_started` ON `discovery_runs` (`started_at`);--> statement-breakpoint
CREATE TABLE `user_dictionary` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`category` text NOT NULL,
	`term` text NOT NULL,
	`source` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_dict_unique` ON `user_dictionary` (`user_id`,`category`,`term`);--> statement-breakpoint
CREATE INDEX `idx_user_dict_user` ON `user_dictionary` (`user_id`);--> statement-breakpoint
ALTER TABLE `companies` ADD `ashby_slug` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `discovered_at` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `relevance_note` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `archetype` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `exclude_titles` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `remote_preference` integer;