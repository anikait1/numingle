import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const userTable = pgTable("users", {
  userID: serial("user_id").primaryKey(),
  username: varchar("username", { length: 128 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const gameStatusEnum = pgEnum("game_status", [
  "WAITING",
  "MERGED",
  "INPROGRESS",
  "ABANDONED",
  "FINISHED",
]);
export const moveStatusEnum = pgEnum("move_status", ["PENDING", "COMPLETED"]);

export const gameTable = pgTable("games", {
  gameID: serial("game_id").primaryKey(),
  status: gameStatusEnum("status").default("WAITING").notNull(),
  attributes: jsonb("attributes")
    .default({ winnerID: null, reason: null })
    .notNull(),
  currentTurnID: integer("current_turn_id").notNull().default(1),
  currentTurnExpiresAt: timestamp("current_turn_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  version: integer("version").default(1).notNull(),
  // mergedGameID: integer("merged_game_id").references(() => gameTable.gameID),
});

export const activeGameTable = pgTable("active_games", {
  gameID: integer("game_id")
    .references(() => gameTable.gameID)
    .notNull(),
  userID: integer("user_id")
    .primaryKey()
    .references(() => userTable.userID),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const gameUserMapTable = pgTable(
  "game_user_map",
  {
    gameID: integer("game_id").references(() => gameTable.gameID),
    userID: integer("user_id").references(() => userTable.userID),
    score: integer("score").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    pkWithCustomName: primaryKey({
      name: "game_users",
      columns: [table.gameID, table.userID],
    }),
  })
);

export const moveTable = pgTable(
  "moves",
  {
    turnID: integer("turn_id").notNull(),
    gameID: serial("game_id")
      .notNull()
      .references(() => gameTable.gameID),
    userID: serial("user_id")
      .notNull()
      .references(() => userTable.userID),
    selection: integer("selection"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    pkWithCustomName: primaryKey({
      name: "game_user_moves",
      columns: [table.gameID, table.userID, table.turnID],
    }),
  })
);
