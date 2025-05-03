import type { DbTransaction } from "../../database/db";
import {
  GameEventType,
  type GameStartedEvent,
  type GameTurnStartedEvent,
} from "../schema";
import {
  BROADCAST_EVENT,
  type BroadcastEventType,
  type DirectEventType,
  type GameEventHandler,
} from "./types";

class GameStartedEventHandler implements GameEventHandler<GameStartedEvent> {
  validate(
    txn: DbTransaction,
    gameID: number,
    event: GameStartedEvent
  ): string {
    return `${gameID}-${GameEventType.STARTED}`;
  }

  process(
    txn: DbTransaction,
    gameID: number,
    event: GameStartedEvent
  ): GameTurnStartedEvent {
    return {
      type: GameEventType.TURN_STARTED,
      data: {
        turn_id: 1,
        expiry: Math.floor(Date.now() / 1000) + 1,
        unavailable_selections: Object.fromEntries(
          event.data.player_ids.map((player_id: number) => [player_id, []])
        ),
      },
    };
  }

  broadcastType(): BroadcastEventType | DirectEventType | null {
    return BROADCAST_EVENT;
  }
}

export const Handler = new GameStartedEventHandler();
