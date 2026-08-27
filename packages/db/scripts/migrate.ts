import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Applies every versioned migration under packages/db/migrations/ in
 * order, tracked in a `drizzle`.`__drizzle_migrations` table so re-running
 * is safe. Needs a direct (non-transaction-pooled) connection — use
 * Supabase's "Session pooler" or direct connection string, not the
 * "Transaction pooler" the running app uses.
 */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log("[migrate] Applying migrations…");
  await migrate(db, { migrationsFolder: "./migrations" });
  console.log("[migrate] Done.");

  await client.end();
}

main().catch((err) => {
  console.error("[migrate] Failed:", err);
  process.exit(1);
});
