import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "./db";

// TODO - setup migration folder path
migrate(db, { migrationsFolder: "" });
