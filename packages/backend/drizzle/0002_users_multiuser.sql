CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`avatar_color` text DEFAULT '#6366f1' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `documents` ADD `user_id` integer;--> statement-breakpoint
ALTER TABLE `outreach` ADD `user_id` integer;--> statement-breakpoint
ALTER TABLE `profiles` ADD `analytic_top_n` integer DEFAULT 35 NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `ai_top_n` integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `profile_hash` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `user_id` integer;--> statement-breakpoint
ALTER TABLE `job_scores` ADD `ai_fit_assessment` text;
