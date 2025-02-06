import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  out: "./migrations",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url: Bun.env.SQLITE_DB_FILENAME,
  },
});
