CREATE TABLE `admin_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_login_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_email_unique` ON `admin_users` (`email`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`entity` text,
	`entity_id` text,
	`meta` text,
	`ip_hash` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`kind` text DEFAULT 'rental' NOT NULL,
	`vehicle_id` text NOT NULL,
	`customer_id` text,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`pickup_location_id` text,
	`return_location_id` text,
	`customer_notes` text,
	`internal_notes` text,
	`price_eur` real,
	`deposit_eur` real,
	`rejection_reason` text,
	`km_out` integer,
	`km_in` integer,
	`fuel_out` integer,
	`fuel_in` integer,
	`cargos_sent_at` integer,
	`decided_by` text,
	`decided_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`pickup_location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`return_location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`decided_by`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_code_unique` ON `bookings` (`code`);--> statement-breakpoint
CREATE INDEX `bookings_vehicle_time_idx` ON `bookings` (`vehicle_id`,`status`,`start_at`,`end_at`);--> statement-breakpoint
CREATE INDEX `bookings_status_idx` ON `bookings` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `bookings_customer_idx` ON `bookings` (`customer_id`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text,
	`phone` text,
	`birth_date` text,
	`birth_place` text,
	`citizenship` text,
	`tax_code` text,
	`address` text,
	`license_number` text,
	`license_expiry` text,
	`license_issued_by` text,
	`doc_type` text,
	`doc_number` text,
	`doc_expiry` text,
	`doc_issued_by` text,
	`notes` text,
	`blacklisted` integer DEFAULT false NOT NULL,
	`blacklist_reason` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customers_email_idx` ON `customers` (`email`);--> statement-breakpoint
CREATE INDEX `customers_phone_idx` ON `customers` (`phone`);--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`city` text,
	`phone` text,
	`maps_url` text,
	`hours` text,
	`open_from` text DEFAULT '08:30' NOT NULL,
	`open_to` text DEFAULT '19:00' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`url` text,
	`read_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notifications_created_idx` ON `notifications` (`created_at`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_endpoint_idx` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`user_agent` text,
	FOREIGN KEY (`user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vehicle_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`width` integer,
	`height` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `vehicle_photos_vehicle_idx` ON `vehicle_photos` (`vehicle_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`location_id` text,
	`type` text NOT NULL,
	`brand` text NOT NULL,
	`model` text NOT NULL,
	`version` text,
	`plate` text NOT NULL,
	`vin` text,
	`year` integer,
	`color` text,
	`fuel` text NOT NULL,
	`transmission` text NOT NULL,
	`seats` integer,
	`doors` integer,
	`luggage` integer,
	`cargo_volume_m3` real,
	`payload_kg` integer,
	`cargo_length_cm` integer,
	`license_required` text DEFAULT 'B' NOT NULL,
	`min_driver_age` integer,
	`mileage_km` integer,
	`deposit_eur` integer,
	`price_from_eur` integer,
	`features` text DEFAULT '[]' NOT NULL,
	`description` text,
	`status` text DEFAULT 'available' NOT NULL,
	`is_public` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`insurance_expiry` text,
	`revision_expiry` text,
	`tax_expiry` text,
	`service_due_date` text,
	`service_due_km` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vehicles_slug_unique` ON `vehicles` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `vehicles_plate_unique` ON `vehicles` (`plate`);--> statement-breakpoint
CREATE INDEX `vehicles_public_idx` ON `vehicles` (`is_public`,`status`,`sort_order`);