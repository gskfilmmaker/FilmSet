/**
 * Universal entry — safe to import from Client Components: only fixture
 * data (for prototype-mode screens still on fixtures) and re-exported
 * @filmset/core types/schemas. Drizzle table definitions and the live
 * query builder live behind "@filmset/db/server" (the `schema` namespace
 * export) so a client bundle can never pull in `postgres` or DATABASE_URL,
 * and so their names don't collide with the fixture arrays of the same
 * concept (e.g. `characters`, `locations`).
 */
export * from "./fixtures";
