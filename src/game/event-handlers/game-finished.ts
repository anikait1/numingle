import type { DbTransaction } from "../../database/db";
import { GameEventType, type GameFinishedEvent } from "../schema";
import {
    type BroadcastEventType,
    type DirectEventType,
    type GameEventHandler,
} from "./types";

class GameFinishedEventHandler implements GameEventHandler<GameFinishedEvent> {
  validate(
    txn: DbTransaction,
    gameID: number,
    event: GameFinishedEvent
  ): string {
    return `${gameID}-${GameEventType.FINISHED}`;
  }

  process(txn: DbTransaction, gameID: number, event: GameFinishedEvent): null {
    return null;
  }

  broadcastType(): BroadcastEventType | DirectEventType | null {
    return null;
  }
}

export const Handler = new GameFinishedEventHandler();
