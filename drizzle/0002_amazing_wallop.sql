CREATE TABLE `calendar_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `calendar_blocks_provider_start` ON `calendar_blocks` (`provider`,`start`);
--> statement-breakpoint
CREATE TRIGGER calendar_block_conflict BEFORE INSERT ON calendar_blocks
WHEN EXISTS (SELECT 1 FROM slot_locks WHERE provider = NEW.provider AND slot < NEW.end AND slot + 3600000 > NEW.start)
OR EXISTS (SELECT 1 FROM calendar_blocks WHERE provider = NEW.provider AND start < NEW.end AND end > NEW.start)
BEGIN SELECT RAISE(ABORT, 'calendar conflict'); END;
--> statement-breakpoint
CREATE TRIGGER booking_block_conflict BEFORE INSERT ON slot_locks
WHEN EXISTS (SELECT 1 FROM calendar_blocks WHERE provider = NEW.provider AND start < NEW.slot + 3600000 AND end > NEW.slot)
BEGIN SELECT RAISE(ABORT, 'calendar conflict'); END;
