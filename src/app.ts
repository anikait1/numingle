import { db } from "./database/db";
import { gameTable } from "./database/schema";
import { handleEvent } from "./game";
import { GameEventType } from "./game/types";
import { eq } from "drizzle-orm";

db.transaction((txn) => {
  const game = txn
    .select()
    .from(gameTable)
    .where(eq(gameTable.gameID, 4))
    .get();
  if (!game) return;

  handleEvent(txn, game.gameID, {
    type: GameEventType.CREATED,
    data: { id: game.gameID, joinCode: "AXY" },
  });

  handleEvent(txn, game.gameID, {
    type: GameEventType.PLAYER_JOINED,
    data: { player_id: 1 },
  });

  handleEvent(txn, game.gameID, {
    type: GameEventType.PLAYER_JOINED,
    data: { player_id: 2 },
  });

  handleEvent(txn, game.gameID, {
    type: GameEventType.PLAYER_TURN,
    data: { player_id: 1, selection: 1, turn_id: 1 },
  });

  handleEvent(txn, game.gameID, {
    type: GameEventType.PLAYER_TURN,
    data: { player_id: 2, selection: 3, turn_id: 1 },
  });
});
