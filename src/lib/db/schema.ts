import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const now = sql`(unixepoch() * 1000)`;

/* ───────────── Utenti del pannello ───────────── */

export const adminUsers = sqliteTable("admin_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at").notNull().default(now),
  lastLoginAt: integer("last_login_at"),
});

export const sessions = sqliteTable(
  "sessions",
  {
    // SHA-256 del token: il token in chiaro vive solo nel cookie
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull().default(now),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/* ───────────── Sedi (predisposto per il multisede) ───────────── */

export const locations = sqliteTable("locations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  phone: text("phone"),
  mapsUrl: text("maps_url"),
  hours: text("hours"),
  openFrom: text("open_from").notNull().default("08:30"),
  openTo: text("open_to").notNull().default("19:00"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull().default(now),
});

/* ───────────── Flotta ───────────── */

export type VehicleType = "auto" | "furgone";
export type VehicleStatus = "available" | "maintenance" | "inactive";
/** Destinazione del mezzo: solo noleggio, solo vendita, o entrambi. */
export type VehicleListing = "rental" | "sale" | "both";

export const vehicles = sqliteTable(
  "vehicles",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    locationId: text("location_id").references(() => locations.id, { onDelete: "set null" }),
    type: text("type").$type<VehicleType>().notNull(),
    brand: text("brand").notNull(),
    model: text("model").notNull(),
    version: text("version"),
    plate: text("plate").notNull().unique(),
    vin: text("vin"),
    year: integer("year"),
    color: text("color"),
    fuel: text("fuel").notNull(), // benzina, diesel, ibrida, elettrica, gpl, metano
    transmission: text("transmission").notNull(), // manuale, automatico
    seats: integer("seats"),
    doors: integer("doors"),
    luggage: integer("luggage"),
    cargoVolumeM3: real("cargo_volume_m3"),
    payloadKg: integer("payload_kg"),
    cargoLengthCm: integer("cargo_length_cm"),
    licenseRequired: text("license_required").notNull().default("B"),
    minDriverAge: integer("min_driver_age"),
    mileageKm: integer("mileage_km"),
    depositEur: integer("deposit_eur"),
    priceFromEur: integer("price_from_eur"), // facoltativo, solo indicativo sul sito
    features: text("features", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    description: text("description"),
    status: text("status").$type<VehicleStatus>().notNull().default("available"),
    listing: text("listing").$type<VehicleListing>().notNull().default("rental"),
    salePriceEur: integer("sale_price_eur"),
    saleCondition: text("sale_condition"), // nuovo, km0, usato
    registrationDate: text("registration_date"), // yyyy-mm (immatricolazione)
    soldAt: integer("sold_at"),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    // Scadenze (date ISO yyyy-mm-dd)
    insuranceExpiry: text("insurance_expiry"),
    revisionExpiry: text("revision_expiry"),
    taxExpiry: text("tax_expiry"),
    serviceDueDate: text("service_due_date"),
    serviceDueKm: integer("service_due_km"),
    createdAt: integer("created_at").notNull().default(now),
    updatedAt: integer("updated_at").notNull().default(now),
  },
  (t) => [index("vehicles_public_idx").on(t.isPublic, t.status, t.sortOrder)],
);

export const vehiclePhotos = sqliteTable(
  "vehicle_photos",
  {
    id: text("id").primaryKey(),
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull(),
    width: integer("width"),
    height: integer("height"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("vehicle_photos_vehicle_idx").on(t.vehicleId, t.sortOrder)],
);

/* ───────────── Clienti ───────────── */

export const customers = sqliteTable(
  "customers",
  {
    id: text("id").primaryKey(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    birthDate: text("birth_date"),
    birthPlace: text("birth_place"),
    citizenship: text("citizenship"),
    taxCode: text("tax_code"),
    address: text("address"),
    licenseNumber: text("license_number"),
    licenseExpiry: text("license_expiry"),
    licenseIssuedBy: text("license_issued_by"),
    docType: text("doc_type"),
    docNumber: text("doc_number"),
    docExpiry: text("doc_expiry"),
    docIssuedBy: text("doc_issued_by"),
    // Codici CaRGOS (tabella luoghi / documenti della Polizia)
    birthPlaceCode: integer("birth_place_code"),
    citizenshipCode: integer("citizenship_code"),
    residenceCode: integer("residence_code"),
    residenceName: text("residence_name"),
    docTypeCode: text("doc_type_code"),
    docIssuedCode: integer("doc_issued_code"),
    licenseIssuedCode: integer("license_issued_code"),
    notes: text("notes"),
    blacklisted: integer("blacklisted", { mode: "boolean" }).notNull().default(false),
    blacklistReason: text("blacklist_reason"),
    createdAt: integer("created_at").notNull().default(now),
    updatedAt: integer("updated_at").notNull().default(now),
  },
  (t) => [index("customers_email_idx").on(t.email), index("customers_phone_idx").on(t.phone)],
);

/* ───────────── Prenotazioni ───────────── */

export type BookingKind = "rental" | "block";
export type BookingStatus = "pending" | "confirmed" | "rejected" | "cancelled" | "completed";
export type BookingSource = "web" | "admin";

export const bookings = sqliteTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    kind: text("kind").$type<BookingKind>().notNull().default("rental"),
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "restrict" }),
    customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
    source: text("source").$type<BookingSource>().notNull(),
    status: text("status").$type<BookingStatus>().notNull(),
    startAt: integer("start_at").notNull(), // epoch ms UTC
    endAt: integer("end_at").notNull(),
    pickupLocationId: text("pickup_location_id").references(() => locations.id, { onDelete: "set null" }),
    returnLocationId: text("return_location_id").references(() => locations.id, { onDelete: "set null" }),
    customerNotes: text("customer_notes"),
    internalNotes: text("internal_notes"),
    priceEur: real("price_eur"),
    depositEur: real("deposit_eur"),
    rejectionReason: text("rejection_reason"),
    kmOut: integer("km_out"),
    kmIn: integer("km_in"),
    fuelOut: integer("fuel_out"), // ottavi 0-8
    fuelIn: integer("fuel_in"),
    cargosSentAt: integer("cargos_sent_at"),
    cargosTransactionId: text("cargos_transaction_id"),
    cargosError: text("cargos_error"),
    cargosAttemptAt: integer("cargos_attempt_at"),
    paymentType: text("payment_type"),
    decidedBy: text("decided_by").references(() => adminUsers.id, { onDelete: "set null" }),
    decidedAt: integer("decided_at"),
    createdAt: integer("created_at").notNull().default(now),
    updatedAt: integer("updated_at").notNull().default(now),
  },
  (t) => [
    index("bookings_vehicle_time_idx").on(t.vehicleId, t.status, t.startAt, t.endAt),
    index("bookings_status_idx").on(t.status, t.createdAt),
    index("bookings_customer_idx").on(t.customerId),
  ],
);

/* ───────────── Notifiche ───────────── */

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    userAgent: text("user_agent"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("push_endpoint_idx").on(t.endpoint)],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    url: text("url"),
    readAt: integer("read_at"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("notifications_created_idx").on(t.createdAt)],
);

/* ───────────── Sicurezza e configurazione ───────────── */

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    meta: text("meta", { mode: "json" }).$type<Record<string, unknown>>(),
    ipHash: text("ip_hash"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: integer("window_start").notNull(),
  count: integer("count").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at").notNull().default(now),
});

/* ───────────── Tabelle CaRGOS ───────────── */

export const cargosPlaces = sqliteTable(
  "cargos_places",
  {
    code: integer("code").primaryKey(),
    name: text("name").notNull(),
    province: text("province"),
    kind: text("kind").$type<"comune" | "stato">().notNull(),
  },
  (t) => [index("cargos_places_name_idx").on(t.name)],
);

/* ───────────── Vendita: richieste di informazioni ───────────── */

export type InquiryStatus = "new" | "contacted" | "closed";

export const saleInquiries = sqliteTable(
  "sale_inquiries",
  {
    id: text("id").primaryKey(),
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone").notNull(),
    message: text("message"),
    status: text("status").$type<InquiryStatus>().notNull().default("new"),
    createdAt: integer("created_at").notNull().default(now),
    updatedAt: integer("updated_at").notNull().default(now),
  },
  (t) => [index("sale_inquiries_status_idx").on(t.status, t.createdAt)],
);
