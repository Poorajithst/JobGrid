CREATE TABLE `companies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`greenhouse_slug` text,
	`lever_slug` text,
	`active` integer DEFAULT true NOT NULL,
	`last_checked` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`company` text NOT NULL,
	`location` text,
	`applicants` integer,
	`description` text,
	`link` text NOT NULL,
	`source` text NOT NULL,
	`ats_id` text,
	`posted_at` text,
	`scraped_at` text DEFAULT (datetime('now')) NOT NULL,
	`fit_score` integer,
	`competition` text,
	`recommendation` text,
	`pitch` text,
	`score_reason` text,
	`status` text DEFAULT 'discovered' NOT NULL,
	`notes` text,
	`next_action` text,
	`applied_at` text,
	`interview_at` text,
	`offer_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_link_unique` ON `jobs` (`link`);--> statement-breakpoint
CREATE INDEX `idx_jobs_source` ON `jobs` (`source`);--> statement-breakpoint
CREATE INDEX `idx_jobs_status` ON `jobs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_jobs_fit_score` ON `jobs` (`fit_score`);--> statement-breakpoint
CREATE INDEX `idx_jobs_source_ats_id` ON `jobs` (`source`,`ats_id`);--> statement-breakpoint
CREATE TABLE `outreach` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `scrape_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`jobs_found` integer DEFAULT 0 NOT NULL,
	`jobs_new` integer DEFAULT 0 NOT NULL,
	`sources_run` text,
	`status` text NOT NULL,
	`error` text
);
