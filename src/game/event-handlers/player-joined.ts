import { and, eq, desc } from "drizzle-orm";
import type { DbTransaction } from "../../database/db";
import { gameEventTable } from "../../database/schema";
import { GameEventOutOfOrderError } from "../error";
import {
  GameEventType,
  type GameStartedEvent,
  type PlayerJoinedEvent,
} from "../schema";
import type {
  BroadcastEventType,
  DirectEventType,
  GameEventHandler,
} from "./types";
import { BROADCAST_EVENT } from "./types";

const LAST_SUPPORTED_EVENTS = [
  GameEventType.STARTED,
  GameEventType.PLAYER_JOINED,
];
const REQUIRED_PLAYER_COUNT_TO_START_GAME = 2;

class PlayerJoinedEventHandler implements GameEventHandler<PlayerJoinedEvent> {
  validate(
    txn: DbTransaction,
    gameID: number,
    event: PlayerJoinedEvent
  ): string {
    const lastEvent = txn
      .select()
      .from(gameEventTable)
      .where(eq(gameEventTable.gameID, gameID))
      .orderBy(desc(gameEventTable.createdAt))
      .get();

    if (!lastEvent)
      throw new GameEventOutOfOrderError(event.type, LAST_SUPPORTED_EVENTS);
    return `${gameID}-${event.type}-${event.data.player_id}`;
  }

  process(
    txn: DbTransaction,
    gameID: number,
    event: PlayerJoinedEvent
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

    if (playerJoinedEvents.length === REQUIRED_PLAYER_COUNT_TO_START_GAME)
      return {
        type: GameEventType.STARTED,
        data: {
          player_ids: playerJoinedEvents.map(
            (joinEvent) =>
              (joinEvent.payload as PlayerJoinedEvent["data"]).player_id
          ),
        },
      };

    return null;
  }

  broadcastType(): BroadcastEventType | DirectEventType | null {
    return BROADCAST_EVENT;
  }
}

export const Handler = new PlayerJoinedEventHandler();
