import { eq, and, inArray, sql } from "drizzle-orm";
import type { DbTransaction } from "../../database/db";
import { gameEventTable } from "../../database/schema";
import {
  GameEventType,
  type GameFinishedEvent,
  type GameTurnCompleteEvent,
  type GameTurnStartedEvent,
  type PlayerTurnEvent,
} from "../types";
import { GameEventOutOfOrderError } from "../error";

const LAST_SUPPORTED_EVENTS = [GameEventType.PLAYER_TURN];

export function validate(
  txn: DbTransaction,
  gameID: number,
  event: GameTurnCompleteEvent,
) {
  const lastEvent = txn
    .select()
    .from(gameEventTable)
    .where(
      and(
        eq(gameEventTable.gameID, gameID),
        inArray(gameEventTable.type, LAST_SUPPORTED_EVENTS),
      ),
    );

  if (!lastEvent)
    throw new GameEventOutOfOrderError(event.type, LAST_SUPPORTED_EVENTS);

  return `${gameID}-${event.type}-${event.data.turn_id}`;
}

export function process(
  txn: DbTransaction,
  gameID: number,
  event: GameTurnCompleteEvent,
): GameFinishedEvent | GameTurnStartedEvent {
  const playerTurns = txn
    .select()
    .from(gameEventTable)
    .where(
      and(
        eq(gameEventTable.gameID, gameID),
        eq(gameEventTable.type, GameEventType.PLAYER_TURN),
        eq(
          sql`json_extract(${gameEventTable.payload}, '$.turn_id')`,
          event.data.turn_id,
        ),
      ),
    )
    .all();

  const playerSelection = (playerTurns[0].payload as PlayerTurnEvent["data"])
    .selection;
  if (
    playerTurns.every(
      (turn) =>
        (turn.payload as PlayerTurnEvent["data"]).selection === playerSelection,
    )
  ) {
    return {
      type: GameEventType.FINISHED,
      data: {
        summary: {
          players: Object.fromEntries(
            Object.entries(event.data.player_scores).map(([id, score]) => [
              id,
              { score },
            ]),
          ),
          ...(new Set(Object.values(event.data.player_scores)).size === 1
            ? { status: "draw" }
            : {
                status: "result",
                winner: Number(
                  Object.entries(event.data.player_scores).reduce((a, b) =>
                    a[1] > b[1] ? a : b,
                  )[0],
                ),
                reason: "score",
              }),
        },
      },
    };
  }

  return {
    type: GameEventType.TURN_STARTED,
    data: {
      turn_id: event.data.turn_id + 1,
      expiry: Math.floor(Date.now() / 1000) + 5,
    },
  };
}
