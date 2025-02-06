import type { DbTransaction } from "../../database/db";
import { gameEventTable } from "../../database/schema";
import { TurnExpiredError } from "../error";
import {
  GameEventType,
  type GameFinishedEvent,
  type GameTurnCompleteEvent,
  type GameTurnStartedEvent,
  type PlayerJoinedEvent,
  type PlayerTurnEvent,
} from "../types";
import { and, sql, eq, inArray } from "drizzle-orm";

/**
 * For a player's turn to be valid, following conditions need to be true
 * 1. Game is started
 * 2. Turn is valid
 *  2.1 Turn started
 *  2.2 Turn is not complete
 *  2.3 Turn is not expired
 * 3. Player has not made a turn (this would be handled with hash),
 * so we need not validate this
 */
export function validate(
  txn: DbTransaction,
  gameID: number,
  event: PlayerTurnEvent
) {
  const gameStatusEvents = txn
    .select()
    .from(gameEventTable)
    .where(
      and(
        eq(gameEventTable.gameID, gameID),
        inArray(gameEventTable.type, [
          GameEventType.STARTED,
          GameEventType.FINISHED,
          GameEventType.ABANDONED,
        ])
      )
    )
    .all();

  const gameStartedEvent = gameStatusEvents.find(
    (gameStatusEvent) => gameStatusEvent.type === GameEventType.STARTED
  );
  if (!gameStartedEvent) throw new Error();

  const gameEndedEvent = gameStatusEvents.find(
    (gameStatusEvent) =>
      gameStatusEvent.type === GameEventType.FINISHED ||
      gameStatusEvent.type === GameEventType.ABANDONED
  );
  if (gameEndedEvent) throw new Error();

  const turnEvents = txn
    .select()
    .from(gameEventTable)
    .where(
      and(
        eq(gameEventTable.gameID, gameID),
        inArray(gameEventTable.type, [
          GameEventType.TURN_STARTED,
          GameEventType.TURN_COMPLETE,
          GameEventType.TURN_EXPIRED,
        ]),
        eq(
          sql`json_extract(${gameEventTable.payload}, '$.turn_id')`,
          event.data.turn_id
        )
      )
    )
    .all();

  const turnStartedEvent = turnEvents.find(
    (turnEvent) => turnEvent.type === GameEventType.TURN_STARTED
  );
  if (!turnStartedEvent) throw new Error();

  const turnCompletedEvent = turnEvents.find(
    (turnEvent) => turnEvent.type === GameEventType.TURN_COMPLETE
  );
  if (turnCompletedEvent) throw new Error();

  const turnExpiredEvent = turnEvents.find(
    (turnEvent) => turnEvent.type === GameEventType.TURN_COMPLETE
  );
  if (turnExpiredEvent) throw new Error();

  if (
    Math.floor(Date.now() / 1000) >
    (turnStartedEvent.payload as GameTurnStartedEvent["data"]).expiry
  )
    throw new TurnExpiredError();

  return `${gameID}-${event.type}-${event.data.player_id}-${event.data.turn_id}`;
}

export function process(
  txn: DbTransaction,
  gameID: number,
  event: PlayerTurnEvent
): GameTurnCompleteEvent | null {
  const playerJoinedEvents = txn
    .select()
    .from(gameEventTable)
    .where(
      and(
        eq(gameEventTable.gameID, gameID),
        inArray(gameEventTable.type, [GameEventType.PLAYER_JOINED])
      )
    )
    .all();

  const playerTurnEvents = txn
    .select()
    .from(gameEventTable)
    .where(
      and(
        eq(gameEventTable.gameID, gameID),
        eq(gameEventTable.type, GameEventType.PLAYER_TURN),
        eq(
          sql`json_extract(${gameEventTable.payload}, '$.turn_id')`,
          event.data.turn_id
        )
      )
    )
    .all();

  if (playerJoinedEvents.length !== playerTurnEvents.length) {
    return null;
  }

  const otherPlayerTurnEventPayload = playerTurnEvents.find(
    (turnEvent) =>
      (turnEvent.payload as PlayerTurnEvent["data"]).player_id !==
      event.data.player_id
  )!.payload as PlayerTurnEvent["data"];

  const previousTurnCompleteEvent = txn
    .select({
      data: gameEventTable.payload,
    })
    .from(gameEventTable)
    .where(
      and(
        eq(gameEventTable.gameID, gameID),
        eq(gameEventTable.type, GameEventType.PLAYER_TURN),
        eq(
          sql`json_extract(${gameEventTable.payload}, '$.turn_id')`,
          event.data.turn_id - 1
        )
      )
    )
    .get();

  const data = previousTurnCompleteEvent?.data as
    | GameTurnCompleteEvent["data"]
    | undefined;
  return {
    type: GameEventType.TURN_COMPLETE,
    data: {
      turn_id: event.data.turn_id,
      player_scores: {
        [event.data.player_id]:
          data?.player_scores?.[event.data.player_id] ??
          0 + event.data.selection,
        [otherPlayerTurnEventPayload.player_id]:
          data?.player_scores?.[otherPlayerTurnEventPayload.player_id] ??
          0 + otherPlayerTurnEventPayload.selection,
      },
    },
  };
}
