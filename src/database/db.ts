import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

const client = new Database(Bun.env.SQLITE_DB_FILENAME);
export const db = drizzle(client, { schema, logger: true }); // TODO - make logging env variable dependent
export type DbType = typeof db;
export type DbTransaction = Parameters<Parameters<DbType["transaction"]>[0]>[0];
