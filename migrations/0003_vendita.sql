-- Vendita dei mezzi: ogni veicolo può essere a noleggio, in vendita o entrambi.
ALTER TABLE `vehicles` ADD `listing` text DEFAULT 'rental' NOT NULL;
ALTER TABLE `vehicles` ADD `sale_price_eur` integer;
ALTER TABLE `vehicles` ADD `sale_condition` text;
ALTER TABLE `vehicles` ADD `registration_date` text;
ALTER TABLE `vehicles` ADD `sold_at` integer;
CREATE INDEX `vehicles_listing_idx` ON `vehicles` (`listing`, `is_public`, `status`);
CREATE TABLE `sale_inquiries` (
  `id` text PRIMARY KEY NOT NULL,
  `vehicle_id` text NOT NULL,
  `name` text NOT NULL,
  `email` text,
  `phone` text NOT NULL,
  `message` text,
  `status` text DEFAULT 'new' NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `sale_inquiries_status_idx` ON `sale_inquiries` (`status`, `created_at`);

-- Mezzo DEMO in vendita (si rimuove con "Rimuovi dati demo")
INSERT OR IGNORE INTO vehicles (id, slug, location_id, type, brand, model, version, plate, year, color, fuel, transmission, seats, doors, luggage, cargo_volume_m3, payload_kg, cargo_length_cm, license_required, mileage_km, features, description, status, is_public, sort_order, listing, sale_price_eur, sale_condition, registration_date)
SELECT 'de000000-0000-4000-8000-000000000008', 'ford-transit-custom-in-vendita', 'de000000-0000-4000-8000-0000000000a1', 'furgone', 'Ford', 'Transit Custom', '2.0 EcoBlue L1H1', 'FX482KL', 2021, 'Bianco', 'diesel', 'manuale', 3, NULL, NULL, 6, 1100, 260, 'B', 68400,
  '["Tagliandi certificati","Aria condizionata","Sensori di parcheggio","Bluetooth","Unico proprietario"]',
  'Furgone della nostra flotta, sempre tagliandato in officina autorizzata. Pronto alla consegna con passaggio di proprietà incluso.',
  'available', 1, 20, 'sale', 18900, 'usato', '2021-03'
WHERE EXISTS (SELECT 1 FROM locations WHERE id = 'de000000-0000-4000-8000-0000000000a1');
INSERT OR IGNORE INTO vehicle_photos (id, vehicle_id, r2_key, width, height, sort_order)
SELECT 'de000000-0000-4000-8000-000000000800', 'de000000-0000-4000-8000-000000000008', 'demo/transit-l2h2.webp', 1600, 1200, 0
WHERE EXISTS (SELECT 1 FROM vehicles WHERE id = 'de000000-0000-4000-8000-000000000008');
INSERT OR IGNORE INTO vehicle_photos (id, vehicle_id, r2_key, width, height, sort_order)
SELECT 'de000000-0000-4000-8000-000000000801', 'de000000-0000-4000-8000-000000000008', 'demo/transit-l2h2-2.webp', 1600, 1200, 1
WHERE EXISTS (SELECT 1 FROM vehicles WHERE id = 'de000000-0000-4000-8000-000000000008');
-- La Panda demo è sia a noleggio sia in vendita
UPDATE vehicles SET listing = 'both', sale_price_eur = 11500, sale_condition = 'usato', registration_date = '2023-02' WHERE id = 'de000000-0000-4000-8000-000000000005';
