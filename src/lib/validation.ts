import { z } from "zod";

const trimmed = (max: number) => z.string().trim().max(max);
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida");
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Orario non valido");
const optDate = z
  .union([isoDate, z.literal("")])
  .optional()
  .transform((v) => (v ? v : null));
const optInt = (min = 0, max = 10_000_000) =>
  z
    .union([z.literal(""), z.coerce.number().int().min(min).max(max)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v));
const optNum = (min = 0, max = 10_000_000) =>
  z
    .union([z.literal(""), z.coerce.number().min(min).max(max)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v));

export const phone = z
  .string()
  .trim()
  .min(6, "Numero di telefono troppo corto")
  .max(25)
  .regex(/^[+0-9 ()./-]+$/, "Numero di telefono non valido");

export const bookingRequestSchema = z.object({
  vehicleId: z.string().uuid(),
  startDate: isoDate,
  startTime: hhmm,
  endDate: isoDate,
  endTime: hhmm,
  firstName: trimmed(60).min(1, "Inserisci il nome"),
  lastName: trimmed(60).min(1, "Inserisci il cognome"),
  email: z.string().trim().toLowerCase().max(160).email("Email non valida"),
  phone,
  notes: optional(1000),
  privacy: z.literal("on", { message: "Devi accettare l'informativa privacy" }),
  website: z.string().max(0).optional(), // honeypot: deve restare vuoto
  turnstileToken: z.string().max(2048).optional(),
});

export const vehicleSchema = z.object({
  type: z.enum(["auto", "furgone"]),
  brand: trimmed(40).min(1, "Inserisci la marca"),
  model: trimmed(60).min(1, "Inserisci il modello"),
  version: optional(60),
  plate: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => v.replace(/\s+/g, ""))
    .pipe(z.string().regex(/^[A-Z0-9]{5,10}$/, "Targa non valida")),
  vin: z
    .string()
    .trim()
    .toUpperCase()
    .max(17)
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^[A-HJ-NPR-Z0-9]{17}$/.test(v), "Il telaio deve avere 17 caratteri"),
  year: optInt(1950, 2100),
  color: optional(30),
  fuel: z.enum(["benzina", "diesel", "ibrida", "elettrica", "gpl", "metano"]),
  transmission: z.enum(["manuale", "automatico"]),
  seats: optInt(1, 60),
  doors: optInt(1, 10),
  luggage: optInt(0, 20),
  cargoVolumeM3: optNum(0, 100),
  payloadKg: optInt(0, 40_000),
  cargoLengthCm: optInt(0, 2_000),
  licenseRequired: z.enum(["B", "B96", "BE", "C1", "C"]),
  minDriverAge: optInt(18, 99),
  mileageKm: optInt(0, 5_000_000),
  depositEur: optInt(0, 100_000),
  priceFromEur: optInt(0, 100_000),
  features: z
    .string()
    .max(1000)
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20)
        .map((s) => s.slice(0, 40)),
    ),
  description: optional(2000),
  status: z.enum(["available", "maintenance", "inactive"]),
  isPublic: z
    .string()
    .optional()
    .transform((v) => v === "on"),
  insuranceExpiry: optDate,
  revisionExpiry: optDate,
  taxExpiry: optDate,
  serviceDueDate: optDate,
  serviceDueKm: optInt(0, 5_000_000),
});

export const customerSchema = z.object({
  firstName: trimmed(60).min(1, "Inserisci il nome"),
  lastName: trimmed(60).min(1, "Inserisci il cognome"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(160)
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || z.string().email().safeParse(v).success, "Email non valida"),
  phone: optional(25),
  birthDate: optDate,
  birthPlace: optional(80),
  citizenship: optional(60),
  taxCode: z
    .string()
    .trim()
    .toUpperCase()
    .max(16)
    .optional()
    .transform((v) => (v ? v : null)),
  address: optional(200),
  licenseNumber: optional(30),
  licenseExpiry: optDate,
  licenseIssuedBy: optional(80),
  docType: optional(30),
  docNumber: optional(30),
  docExpiry: optDate,
  docIssuedBy: optional(80),
  notes: optional(2000),
  blacklisted: z
    .string()
    .optional()
    .transform((v) => v === "on"),
  blacklistReason: optional(300),
});

export const adminBookingSchema = z.object({
  vehicleId: z.string().uuid(),
  customerId: z.string().uuid().optional().or(z.literal("")),
  newFirstName: optional(60),
  newLastName: optional(60),
  newEmail: optional(160),
  newPhone: optional(25),
  startDate: isoDate,
  startTime: hhmm,
  endDate: isoDate,
  endTime: hhmm,
  priceEur: optNum(0, 1_000_000),
  depositEur: optNum(0, 1_000_000),
  internalNotes: optional(2000),
  kind: z.enum(["rental", "block"]),
  sendEmail: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

export function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Dati non validi";
}

export const MAX_RENTAL_MS = 366 * 86_400_000;
