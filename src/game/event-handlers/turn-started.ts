import type { DbTransaction } from "../../database/db";
import { GameEventType, type GameTurnStartedEvent } from "../schema";
import {
    type BroadcastEventType,
    type DirectEventType,
    type GameEventHandler,
} from "./types";

class TurnStartedEventHandler
  implements GameEventHandler<GameTurnStartedEvent>
{
  validate(
    txn: DbTransaction,
    gameID: number,
    event: GameTurnStartedEvent
  ): string {
    return `${gameID}-${GameEventType.TURN_STARTED}-${event.data.turn_id}`;
  }

  process(
    txn: DbTransaction,
    gameID: number,
    event: GameTurnStartedEvent
  ): null {
    return null;
  }

  broadcastType(): BroadcastEventType | DirectEventType | null {
    return null;
  }
}

export const Handler = new TurnStartedEventHandler();
