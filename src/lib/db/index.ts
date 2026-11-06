import "server-only";
import { drizzle } from "drizzle-orm/d1";
import { cache } from "react";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

export const getDb = cache(async () => {
  const env = await getEnv();
  return drizzle(env.DB as unknown as Parameters<typeof drizzle>[0], { schema });
});

export type DB = Awaited<ReturnType<typeof getDb>>;
export { schema };
