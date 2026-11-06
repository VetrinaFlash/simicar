/** Tabelle fisse CaRGOS (Polizia di Stato). Usabili anche nei componenti client. */

export const CARGOS_DOC_TYPES: { code: string; label: string }[] = [
  { code: "IDENT", label: "Carta d'identità" },
  { code: "IDELE", label: "Carta d'identità elettronica" },
  { code: "PATEN", label: "Patente di guida" },
  { code: "PASOR", label: "Passaporto ordinario" },
  { code: "PASSE", label: "Passaporto di servizio" },
  { code: "PASDI", label: "Passaporto diplomatico" },
  { code: "CIDIP", label: "Carta d'identità diplomatica" },
];

export const CARGOS_PAYMENT_TYPES: { code: string; label: string }[] = [
  { code: "0", label: "Carta di credito" },
  { code: "2", label: "Carta di debito / bancomat" },
  { code: "1", label: "Contanti" },
  { code: "3", label: "Bonifico" },
  { code: "4", label: "RID bancario" },
  { code: "9", label: "Altro" },
];

/** Tipo veicolo CaRGOS: 0 = autovetture, 1 = furgoni. */
export const CARGOS_VEHICLE_TYPE = { auto: "0", furgone: "1" } as const;

export const ITALIA_CODE = 100000100;
