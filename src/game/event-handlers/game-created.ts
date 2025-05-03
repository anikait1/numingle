import type { DbTransaction } from "../../database/db";
import {
    GameEventType,
    type GameCreatedEvent,
    type GameEvent,
} from "../schema";
import type {
    BroadcastEventType,
    DirectEventType,
    GameEventHandler,
} from "./types";

class GameCreatedEventHandler implements GameEventHandler<GameCreatedEvent> {
  validate(
    txn: DbTransaction,
    gameID: number,
    event: GameCreatedEvent
  ): string {
    return `${gameID}-${GameEventType.CREATED}`;
  }

  process(
    txn: DbTransaction,
    gameID: number,
    event: GameCreatedEvent
  ): GameEvent | null {
    return null;
  }

  broadcastType(): BroadcastEventType | DirectEventType | null {
    return null;
  }
}

export const Handler = new GameCreatedEventHandler();
