import type { DbTransaction } from "../../database/db";
import { gameEventTable, gameTable } from "../../database/schema";
import { GameEventOutOfOrderError } from "../error";
import { and, sql, eq, inArray, desc, count, or } from "drizzle-orm";
import {
  GameEventType,
  type GameTurnCompleteEvent,
  type PlayerTurnEvent,
} from "../schema";

const LAST_SUPPORTED_EVENTS: GameEventType[] = [
  GameEventType.PLAYER_TURN,
  GameEventType.TURN_STARTED,
];

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
  event: PlayerTurnEvent,
) {
  const lastEvent = txn
    .select()
    .from(gameEventTable)
    .where(
      and(
        eq(gameEventTable.gameID, gameID),
        inArray(gameEventTable.type, LAST_SUPPORTED_EVENTS),
      ),
    )
    .orderBy(desc(gameEventTable.createdAt))
    .get();

  if (!lastEvent)
    throw new GameEventOutOfOrderError(event.type, LAST_SUPPORTED_EVENTS);

  // TODO - add logic for turn expiry

  return `${gameID}-${event.type}-${event.data.player_id}-${event.data.turn_id}`;
}

export function process(
  txn: DbTransaction,
  gameID: number,
  event: PlayerTurnEvent,
): GameTurnCompleteEvent | null {
  const eventCounts = txn
    .select({
      playerJoinedEventCount: count(
        sql`case when ${gameEventTable.type} = ${GameEventType.PLAYER_JOINED} then 1 end`,
      ),
      playerTurnEventCount: count(
        sql`case when ${gameEventTable.type} = ${GameEventType.PLAYER_TURN} and json_extract(${gameEventTable.payload}, '$.turn_id') = ${event.data.turn_id} then 1 end`,
      ),
    })
    .from(gameEventTable)
    .where(eq(gameEventTable.gameID, gameID))
    .get();

  if (!eventCounts) {
    // TODO - log information
    throw new Error("System in bad state");
  }

  /**
   * No need for any processing if players are yet to complete
   * their respective turn.
   */
  if (eventCounts.playerJoinedEventCount !== eventCounts.playerTurnEventCount)
    return null;

  const events = txn
    .select()
    .from(gameEventTable)
    .where(
      and(
        eq(gameEventTable.gameID, gameID),
        or(
          and(
            eq(gameEventTable.type, GameEventType.TURN_COMPLETE),
            eq(
              sql`json_extract(${gameEventTable.payload}, '$.turn_id')`,
              event.data.turn_id - 1,
            ),
          ),
          and(
            eq(gameEventTable.type, GameEventType.PLAYER_TURN),
            eq(
              sql`json_extract(${gameEventTable.payload}, '$.turn_id')`,
              event.data.turn_id,
            ),
          ),
        ),
      ),
    )
    .all();

  const currentTurnEvents = events
    .filter((event) => event.type === GameEventType.PLAYER_TURN)
    .map((event) => event.payload) as PlayerTurnEvent["data"][];

  /**
   * In case no TURN_COMPLETE event was found,
   * it is safe to assume this was the first turn of the game
   * and previous scores would be zero
   */
  const previousTurnCompleteEvent = (events.find(
    (event) => event.type === GameEventType.TURN_COMPLETE,
  )?.payload ?? {
    turn_id: 0,
    player_scores: Object.fromEntries(
      currentTurnEvents.map((turnEvent) => [turnEvent.player_id, 0]),
    ),
  }) as GameTurnCompleteEvent["data"];

  return {
    type: GameEventType.TURN_COMPLETE,
    data: {
      turn_id: event.data.turn_id,
      player_scores: Object.fromEntries(
        currentTurnEvents.map((turnEvent) => [
          turnEvent.player_id,
          previousTurnCompleteEvent.player_scores[turnEvent.player_id] +
            turnEvent.selection,
        ]),
      ),
    },
  };
}
