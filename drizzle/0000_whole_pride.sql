CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`provider` text NOT NULL,
	`zip` text NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`address` text NOT NULL,
	`quantity` integer NOT NULL,
	`total` integer DEFAULT 7500 NOT NULL,
	`status` text DEFAULT 'test_confirmed' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`fingerprint` text NOT NULL,
	`source` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bookings_owner_start` ON `bookings` (`owner`,`start`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`zip` text,
	`source` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_owner_created` ON `events` (`owner`,`created_at`);--> statement-breakpoint
CREATE TABLE `inquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`zip` text NOT NULL,
	`detail` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inquiries_owner_created` ON `inquiries` (`owner`,`created_at`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`recipient` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`due_at` integer NOT NULL,
	`status` text DEFAULT 'preview' NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `notifications_booking` ON `notifications` (`booking_id`);--> statement-breakpoint
CREATE TABLE `slot_locks` (
	`provider` text NOT NULL,
	`slot` integer NOT NULL,
	`booking_id` text NOT NULL,
	PRIMARY KEY(`provider`, `slot`),
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `slot_locks_booking` ON `slot_locks` (`booking_id`);