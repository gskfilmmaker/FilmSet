import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Server-only Postgres client (Supabase's connection pooler). Never import
 * this from a Client Component — the `server-only` guard throws if the
 * bundler pulls it into client code, since DATABASE_URL carries
 * production-write credentials.
 */
function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it as a Vercel/local environment variable — see docs/design-system/README.md#environment.",
    );
  }
  const client = postgres(connectionString, { prepare: false });
  return drizzle(client, { schema });
}

let cached: ReturnType<typeof createDb> | undefined;

export function getDb() {
  cached ??= createDb();
  return cached;
}

export type Db = ReturnType<typeof getDb>;
export { schema };
