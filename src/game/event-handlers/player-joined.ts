import { and, eq, desc } from "drizzle-orm";
import type { DbTransaction } from "../../database/db";
import { gameEventTable } from "../../database/schema";
import {
  GameEventOutOfOrderError
} from "../error";
import {
  GameEventType,
  type GameStartedEvent,
  type PlayerJoinedEvent,
} from "../schema";

const LAST_SUPPORTED_EVENTS = [
  GameEventType.STARTED,
  GameEventType.PLAYER_JOINED,
];
const REQUIRED_PLAYER_COUNT_TO_START_GAME = 2;

export function validate(
  txn: DbTransaction,
  gameID: number,
  event: PlayerJoinedEvent,
) {
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

export function process(
  txn: DbTransaction,
  gameID: number,
  _: PlayerJoinedEvent,
): GameStartedEvent | null {
  const playerJoinedEvents = txn
    .select()
    .from(gameEventTable)
    .where(
      and(
        eq(gameEventTable.gameID, gameID),
        eq(gameEventTable.type, GameEventType.PLAYER_JOINED),
      ),
    )
    .all();

  if (playerJoinedEvents.length === REQUIRED_PLAYER_COUNT_TO_START_GAME)
    return {
      type: GameEventType.STARTED,
      data: {
        player_ids: playerJoinedEvents.map(
          (joinEvent) =>
            (joinEvent.payload as PlayerJoinedEvent["data"]).player_id,
        ),
      },
    };

  return null;
}
