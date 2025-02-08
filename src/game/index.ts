import type { DbTransaction } from "../database/db";
import * as PlayerJoinedEventHandler from "./event-handlers/player-joined";
import * as PlayerTurnEventHandler from "./event-handlers/player-turn";
import * as GameTurnCompleteEventHandler from "./event-handlers/turn-complete";
import { gameEventTable, gameTable } from "../database/schema";
import {
  GameAlreadyStartedError,
  GameNotFoundError,
  PlayerAlreadyInGameError,
  TurnExpiredError,
} from "./error";
import {
  GameEventType,
  type GameEvent,
  type GameTurnStartedEvent,
} from "./schema";

import EventEmitter from "node:events";

export function handleEvent(
  txn: DbTransaction,
  gameID: number,
  event: GameEvent,
): DuplicateEventType | void {
  switch (event.type) {
    case GameEventType.CREATED: {
      if (!saveEvent(txn, gameID, event, `${gameID}-${event.type}`))
        return DUPLICATE_EVENT;
      return;
    }

    case GameEventType.PLAYER_JOINED: {
      const hash = PlayerJoinedEventHandler.validate(txn, gameID, event);
      if (!saveEvent(txn, gameID, event, hash)) return DUPLICATE_EVENT;

      const nextEvent = PlayerJoinedEventHandler.process(txn, gameID, event);
      if (!nextEvent) return;

      return handleEvent(txn, gameID, nextEvent);
    }

    case GameEventType.STARTED: {
      if (!saveEvent(txn, gameID, event, `${gameID}-${event.type}`))
        return DUPLICATE_EVENT;

      EVENT_BUS.emit(BROADCAST_EVENT, { gameID, event });
      const nextEvent: GameTurnStartedEvent = {
        type: GameEventType.TURN_STARTED,
        data: {
          turn_id: 1,
          expiry: Math.floor(Date.now() / 1000) + 1,
          unavailable_selections: Object.fromEntries(
            event.data.player_ids.map((player_id) => [player_id, []]),
          ),
        },
      };

      return handleEvent(txn, gameID, nextEvent);
    }

    case GameEventType.TURN_STARTED: {
      /**
       * Currently this event is fired internally only,
       * so no need to validate and process it. Simply
       * storing it should be enough.
       */
      if (
        !saveEvent(
          txn,
          gameID,
          event,
          `${gameID}-${event.type}-${event.data.turn_id}`,
        )
      )
        return DUPLICATE_EVENT;

      EVENT_BUS.emit(DIRECT_EVENT, { gameID, event });
      return;
    }

    case GameEventType.PLAYER_TURN: {
      try {
        const hash = PlayerTurnEventHandler.validate(txn, gameID, event);
        if (!saveEvent(txn, gameID, event, hash)) return DUPLICATE_EVENT;

        const nextEvent = PlayerTurnEventHandler.process(txn, gameID, event);
        if (!nextEvent) return;

        return handleEvent(txn, gameID, nextEvent);
      } catch (err) {
        if (!(err instanceof TurnExpiredError)) throw err;

        return handleEvent(txn, gameID, {
          type: GameEventType.TURN_EXPIRED,
          data: { turn_id: event.data.turn_id },
        });
      }
    }

    case GameEventType.TURN_COMPLETE: {
      const hash = GameTurnCompleteEventHandler.validate(txn, gameID, event);
      if (!saveEvent(txn, gameID, event, hash)) return DUPLICATE_EVENT;

      EVENT_BUS.emit(BROADCAST_EVENT, { gameID, event });
      const nextEvent = GameTurnCompleteEventHandler.process(
        txn,
        gameID,
        event,
      );
      if (!nextEvent) return;

      return handleEvent(txn, gameID, nextEvent);
    }

    case GameEventType.TURN_EXPIRED: {
      break;
    }

    case GameEventType.FINISHED: {
      if (!saveEvent(txn, gameID, event, `${gameID}-${event.type}`))
        return DUPLICATE_EVENT;

      EVENT_BUS.emit(BROADCAST_EVENT, { gameID, event });
      return;
    }
  }

  throw new Error();
}

export function saveEvent(
  txn: DbTransaction,
  gameID: number,
  event: GameEvent,
  toHash: string,
): typeof gameEventTable.$inferSelect | undefined {
  return txn
    .insert(gameEventTable)
    .values({
      gameID,
      type: event.type,
      payload: event.data,
      hash: Bun.hash(toHash).toString(),
    })
    .onConflictDoNothing()
    .returning()
    .get();
}

export const DUPLICATE_EVENT = Symbol("duplicate-event");
export const BROADCAST_EVENT = Symbol("broadcast-event");
export const DIRECT_EVENT = Symbol("direct-event");
type DuplicateEventType = typeof DUPLICATE_EVENT;

export const EVENT_BUS = new EventEmitter();
