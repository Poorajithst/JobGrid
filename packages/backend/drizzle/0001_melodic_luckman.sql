CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`filename` text NOT NULL,
	`raw_text` text NOT NULL,
	`parsed_skills` text,
	`parsed_titles` text,
	`parsed_certs` text,
	`parsed_experience_years` integer,
	`parsed_locations` text,
	`parsed_industries` text,
	`parsed_tools` text,
	`parsed_education` text,
	`uploaded_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `job_scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`profile_id` integer NOT NULL,
	`ipe_score` integer NOT NULL,
	`freshness_score` integer NOT NULL,
	`skill_match_score` integer NOT NULL,
	`title_alignment_score` integer NOT NULL,
	`cert_match_score` integer NOT NULL,
	`competition_score` integer NOT NULL,
	`location_match_score` integer NOT NULL,
	`experience_align_score` integer NOT NULL,
	`matched_skills` text,
	`ai_validated` integer DEFAULT false NOT NULL,
	`ai_agrees` integer,
	`ai_pitch` text,
	`ai_flags` text,
	`scored_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_job_scores_unique` ON `job_scores` (`job_id`,`profile_id`);--> statement-breakpoint
CREATE INDEX `idx_job_scores_profile` ON `job_scores` (`profile_id`);--> statement-breakpoint
CREATE INDEX `idx_job_scores_ipe` ON `job_scores` (`profile_id`,`ipe_score`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`target_titles` text NOT NULL,
	`target_skills` text NOT NULL,
	`target_certs` text,
	`target_locations` text,
	`min_experience_years` integer,
	`max_experience_years` integer,
	`search_queries` text,
	`title_synonyms` text,
	`freshness_weight` real DEFAULT 0.25 NOT NULL,
	`skill_weight` real DEFAULT 0.25 NOT NULL,
	`title_weight` real DEFAULT 0.15 NOT NULL,
	`cert_weight` real DEFAULT 0.1 NOT NULL,
	`competition_weight` real DEFAULT 0.1 NOT NULL,
	`location_weight` real DEFAULT 0.1 NOT NULL,
	`experience_weight` real DEFAULT 0.05 NOT NULL,
	`ai_threshold` integer DEFAULT 60 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
