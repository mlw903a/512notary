CREATE TABLE `rate_limits` (
	`bucket` text PRIMARY KEY NOT NULL,
	`hits` integer NOT NULL
);
