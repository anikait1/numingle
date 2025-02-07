import { db } from "./database/db";
import { gameTable } from "./database/schema";
import { handleEvent } from "./game";
import { eq } from "drizzle-orm";
import { GameEventType } from "./game/schema";

db.transaction((txn) => {
  const game = txn
    .insert(gameTable)
    .values({
      joinCode: "APY",
    })
    .returning()
    .get();
  if (!game) return;

  handleEvent(txn, game.gameID, {
    type: GameEventType.CREATED,
    data: { id: game.gameID, joinCode: "AXY" },
  });
});
