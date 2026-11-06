"use server";

export type SetupState = { error?: string };

// Disabilita anche la Server Action: il form iniziale non deve creare account alternativi.
export async function setupAction(_prev: SetupState, _form: FormData): Promise<SetupState> {
  return { error: "Registrazione disabilitata. Accedi dal pannello amministratore." };
}
