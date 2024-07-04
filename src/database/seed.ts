import { parseArgs } from "util";
import { exit } from "node:process";
import { faker } from "@faker-js/faker";
import { db } from "./db";
import {  userTable } from "./schema";

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    resource: {
      type: "string",
      multiple: false,
      default: "unknown",
    },
    count: {
      type: "string",
      multiple: false,
      default: "1000",
    },
  },
  strict: true,
  allowPositionals: true,
});

const VALID_RESOURCES = ["users", "games"];
const resource = values.resource!;
if (!VALID_RESOURCES.includes(resource)) {
  console.error(
    `Invalid flag --resource (${resource}). Allowed values: [${VALID_RESOURCES.join(
      ", "
    )}]`
  );
  exit(1);
}

const rowsCount = parseInt(values.count!, 10);
if (Number.isNaN(rowsCount) || rowsCount < 1) {
  console.error(
    `Invalid flag --count (${values.count}). Value should be greater than 1`
  );
  exit(1);
}

switch (resource) {
  case "users": {
    const result = await seedUsers(rowsCount);
    console.log(`Seeded Users`, result);
    break;
  }
}

exit(0);

async function seedUsers(usersCount: number) {
  const uniqueUsernames = new Set<string>();
  const dbPayload: any[] = [];
  const expectedCount = usersCount;
  let retryAttempts = 2;

  while (usersCount) {
    const username =
      Math.random() < 0.5
        ? faker.internet.displayName()
        : faker.internet.userName();

    if (uniqueUsernames.has(username) && retryAttempts > 0) {
      retryAttempts--;
      continue;
    }

    uniqueUsernames.add(username);
    dbPayload.push({ username });
    usersCount--;
    retryAttempts = 2;
  }

  const result = await db
    .insert(userTable)
    .values(dbPayload)
    .onConflictDoNothing()
    .returning();

  return {
    count: expectedCount,
    attempted: dbPayload.length,
    success: result.length,
  };
}

// this is actually simulating multiple games
// rather than seeding
async function seedGames() {

}