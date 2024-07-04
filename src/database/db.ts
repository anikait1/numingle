import { PostgresJsQueryResultHKT, drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import postgres from "postgres";
import { PgTransaction } from "drizzle-orm/pg-core";
import { ExtractTablesWithRelations } from "drizzle-orm";

const client = postgres(Bun.env.DB_CONNECTION);
export const db = drizzle(client, { schema, logger: true });
export type DbType = typeof db
export type DbTransaction = PgTransaction<PostgresJsQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>