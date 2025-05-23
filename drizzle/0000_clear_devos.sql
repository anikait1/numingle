CREATE TABLE `game_events` (
	`event_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`event_key` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`game_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `game_event_idx` ON `game_events` (`game_id`,`type`);--> statement-breakpoint
CREATE UNIQUE INDEX `game_event_key` ON `game_events` (`event_key`);--> statement-breakpoint
CREATE TABLE `games` (
	`game_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text,
	`summary` text,
	`join_code` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`user_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);