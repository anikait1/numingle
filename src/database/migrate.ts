import { resolve } from "node:path";

// TODO - setup migration folder path
const projectRoot = resolve(import.meta.dir, "../..");
const MIGRATIONS_FOLDER = resolve(projectRoot, "drizzle");
console.log(import.meta);
// migrate(db, { migrationsFolder: "" });
