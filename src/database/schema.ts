import { sql } from "drizzle-orm/sql";
import {
  sqliteTable,
  text,
  integer,
  index, uniqueIndex
} from "drizzle-orm/sqlite-core";

export const userTable = sqliteTable("users", {
  userID: integer("user_id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

export const gameTable = sqliteTable("games", {
  gameID: integer("game_id").primaryKey({ autoIncrement: true }),
  // TODO - the status should be an enum
  status: text("status", {mode: "json"}),
  summary: text("summary", { mode: "json" }),
  joinCode: text("join_code"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

export const gameEventTable = sqliteTable(
  "game_events",
  {
    eventID: integer("event_id").primaryKey({ autoIncrement: true }),
    gameID: integer("game_id")
      .notNull()
      .references(() => gameTable.gameID),
    type: text("type").notNull(),
    payload: text("payload", { mode: "json" }).notNull(),
    eventKey: text("event_key").notNull(),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (table) => [
    index("game_event_idx").on(table.gameID, table.type),
    uniqueIndex("game_event_key").on(table.eventKey),
  ],
);
