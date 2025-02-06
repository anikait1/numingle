import { or, and, eq, inArray } from "drizzle-orm";
import type { DbTransaction } from "../../database/db";
import { gameEventTable } from "../../database/schema";
import {
  GameEventType,
  type GameStartedEvent,
  type PlayerJoinedEvent,
} from "../types";
import { GameAlreadyStartedError, PlayerAlreadyInGameError } from "../error";

export function validate(
  txn: DbTransaction,
  gameID: number,
  event: PlayerJoinedEvent
) {
  const gameEvents = txn
    .select()
    .from(gameEventTable)
    .where(
      and(
        eq(gameEventTable.gameID, gameID),
        inArray(gameEventTable.type, [
          GameEventType.STARTED,
          GameEventType.PLAYER_JOINED,
        ])
      )
    )
    .all();

  for (const gameEvent of gameEvents) {
    switch (gameEvent.type) {
      case GameEventType.STARTED:
        throw new GameAlreadyStartedError();
      case GameEventType.PLAYER_JOINED: {
        const data = gameEvent.payload as PlayerJoinedEvent["data"];
        if (data.player_id === event.data.player_id)
          throw new PlayerAlreadyInGameError();

        break;
      }
    }
  }

  return `${gameID}-${event.type}-${event.data.player_id}`;
}

export function process(
  txn: DbTransaction,
  gameID: number,
  _: PlayerJoinedEvent
): GameStartedEvent | null {
  const playerJoinedEvents = txn
    .select()
    .from(gameEventTable)
    .where(
      and(
        eq(gameEventTable.gameID, gameID),
        eq(gameEventTable.type, GameEventType.PLAYER_JOINED)
      )
    )
    .all();

  if (playerJoinedEvents.length === 2)
    return { type: GameEventType.STARTED, data: {} };

  return null;
}
