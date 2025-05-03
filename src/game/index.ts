import type { DbTransaction } from "../database/db";
import * as PlayerJoinedEventHandler from "./event-handlers/player-joined";
import * as PlayerTurnEventHandler from "./event-handlers/player-turn";
import { gameEventTable } from "../database/schema";
import { TurnExpiredError } from "./error";
import {
  GameEventType,
  type GameEvent,
  type GameCreatedEvent,
  type GameStartedEvent,
  type PlayerJoinedEvent,
  type PlayerTurnEvent,
  type GameTurnCompleteEvent,
  type GameTurnStartedEvent,
  type GameFinishedEvent,
} from "./schema";

import * as GameCreatedEventHandler from "./event-handlers/game-created";
import * as GameStartedEventHandler from "./event-handlers/game-started";
import * as TurnStartedEventHandler from "./event-handlers/turn-started";
import * as GameFinishedEventHandler from "./event-handlers/game-finished";
import * as TurnCompleteEventHandler from "./event-handlers/turn-complete";

import EventEmitter from "node:events";
import {
  BROADCAST_EVENT,
  DIRECT_EVENT,
  DUPLICATE_EVENT,
  type DuplicateEventType,
  type GameEventHandler,
} from "./event-handlers/types";

class EventHandlerRegistry {
  private handlers: Map<GameEventType, GameEventHandler<GameEvent>> = new Map();

  register<T extends GameEvent>(
    type: GameEventType,
    handler: GameEventHandler<T>
  ) {
    this.handlers.set(type, handler as GameEventHandler<GameEvent>);
  }

  get<T extends GameEvent>(
    type: GameEventType
  ): GameEventHandler<T> | undefined {
    return this.handlers.get(type) as GameEventHandler<T> | undefined;
  }
}

const eventHandlers = new EventHandlerRegistry();
eventHandlers.register<GameCreatedEvent>(
  GameEventType.CREATED,
  GameCreatedEventHandler.Handler
);
eventHandlers.register<PlayerJoinedEvent>(
  GameEventType.PLAYER_JOINED,
  PlayerJoinedEventHandler.Handler
);
eventHandlers.register<GameStartedEvent>(
  GameEventType.STARTED,
  GameStartedEventHandler.Handler
);
eventHandlers.register<GameTurnStartedEvent>(
  GameEventType.TURN_STARTED,
  TurnStartedEventHandler.Handler
);
eventHandlers.register<PlayerTurnEvent>(
  GameEventType.PLAYER_TURN,
  PlayerTurnEventHandler.Handler
);
eventHandlers.register<GameTurnCompleteEvent>(
  GameEventType.TURN_COMPLETE,
  TurnCompleteEventHandler.Handler
);
eventHandlers.register<GameFinishedEvent>(
  GameEventType.FINISHED,
  GameFinishedEventHandler.Handler
);

export function handleEvent(
  txn: DbTransaction,
  gameID: number,
  event: GameEvent
): DuplicateEventType | void {
  const handler = eventHandlers.get(event.type);
  if (!handler) {
    throw new Error(`No handler registered for event type: ${event.type}`);
  }

  try {
    const eventKey = handler.validate(txn, gameID, event);
    if (!saveEvent(txn, gameID, event, eventKey)) return DUPLICATE_EVENT;

    const broadcastType = handler.broadcastType();
    switch (broadcastType) {
      case BROADCAST_EVENT: {
        EVENT_BUS.emit(BROADCAST_EVENT, { gameID, event });
        break;
      }
      case DIRECT_EVENT: {
        EVENT_BUS.emit(DIRECT_EVENT, { gameID, event });
        break;
      }
      case null: {
        break;
      }
    }

    const nextEvent = handler.process(txn, gameID, event);
    if (nextEvent) {
      return handleEvent(txn, gameID, nextEvent);
    }
  } catch (err) {
    if (err instanceof TurnExpiredError) {
      const turnId = "turn_id" in event.data ? event.data.turn_id : undefined;
      if (turnId === undefined) {
        throw new Error("Turn ID not found in event data");
      }
      return handleEvent(txn, gameID, {
        type: GameEventType.TURN_EXPIRED,
        data: { turn_id: turnId },
      });
    }
    throw err;
  }
}

export function saveEvent(
  txn: DbTransaction,
  gameID: number,
  event: GameEvent,
  key: string
): typeof gameEventTable.$inferSelect | undefined {
  return txn
    .insert(gameEventTable)
    .values({
      gameID,
      type: event.type,
      payload: event.data,
      eventKey: key,
    })
    .onConflictDoNothing()
    .returning()
    .get();
}

export const EVENT_BUS = new EventEmitter();
