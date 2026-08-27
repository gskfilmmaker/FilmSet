import "server-only";
import { sql } from "drizzle-orm";
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
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };

/**
 * Runs `fn` inside a transaction impersonating `userId` at the Postgres
 * level — the ONLY way Row Level Security actually applies to this app's
 * queries. DATABASE_URL authenticates as a privileged role (table owner)
 * that bypasses RLS by default; `SET LOCAL ROLE authenticated` drops that
 * privilege for the duration of the transaction, and setting
 * `request.jwt.claims` makes Supabase's `auth.uid()` (which every RLS
 * policy in packages/db/drizzle/*.sql calls) resolve to this user. Every
 * Server Action / Server Component that touches production data must go
 * through this — calling `getDb()` directly runs as the privileged role
 * and skips RLS entirely, which is only appropriate for the seed script
 * and migrations.
 */
export async function runAsUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`);
    await tx.execute(sql`set local role authenticated`);
    return fn(tx);
  });
}
