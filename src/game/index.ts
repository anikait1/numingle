import type { DbTransaction } from "../database/db";
import { GameEventType, type GameEvent } from "./types";
import * as PlayerJoinedEventHandler from "./event-handlers/player-joined";
import * as PlayerTurnEventHandler from "./event-handlers/player-turn";
import { gameEventTable, gameTable } from "../database/schema";
import { eq } from "drizzle-orm";
import {
  GameAlreadyStartedError,
  GameNotFoundError,
  PlayerAlreadyInGameError,
  TurnExpiredError,
} from "./error";

export async function handleEvent(
  txn: DbTransaction,
  gameID: number,
  event: GameEvent
) {
  const game = txn
    .select()
    .from(gameTable)
    .where(eq(gameTable.gameID, gameID))
    .get();
  if (!game) throw new GameNotFoundError();

  switch (event.type) {
    case GameEventType.CREATED: {
      await saveEvent(txn, gameID, event, `${gameID}-${event.type}`);
      return;
    }

    case GameEventType.PLAYER_JOINED: {
      try {
        const hash = PlayerJoinedEventHandler.validate(txn, gameID, event);
        await saveEvent(txn, gameID, event, hash);
        const nextEvent = PlayerJoinedEventHandler.process(txn, gameID, event);

        if (!nextEvent) return;
        await handleEvent(txn, gameID, nextEvent);
        return;
      } catch (err) {
        if (err instanceof GameAlreadyStartedError) {
        }

        if (err instanceof PlayerAlreadyInGameError) {
        }

        throw err;
      }
    }

    case GameEventType.STARTED: {
      await saveEvent(txn, gameID, event, `${gameID}-${event.type}`);
      await handleEvent(txn, gameID, {
        type: GameEventType.TURN_STARTED,
        data: { turn_id: 1, expiry: Math.floor(Date.now() / 1000) + 5 },
      });
      return;
    }

    case GameEventType.TURN_STARTED: {
      /**
       * Currently this event is fired internally only,
       * so no need to validate and process it. Simply
       * storing it should be enough.
       */
      await saveEvent(
        txn,
        gameID,
        event,
        `${gameID}-${event.type}-${event.data.turn_id}`
      );
      return;
    }

    case GameEventType.PLAYER_TURN: {
      try {
        const hash = PlayerTurnEventHandler.validate(txn, gameID, event);
        await saveEvent(txn, gameID, event, hash);
        const nextEvent = PlayerTurnEventHandler.process(txn, gameID, event);

        if (!nextEvent) return;
        return await handleEvent(txn, gameID, nextEvent);
      } catch (err) {
        if (!(err instanceof TurnExpiredError)) throw err;

        return await handleEvent(txn, gameID, {
          type: GameEventType.TURN_EXPIRED,
          data: { turn_id: event.data.turn_id },
        });
      }
    }

    case GameEventType.TURN_COMPLETE: {
      break;
    }

    case GameEventType.TURN_EXPIRED: {
      break;
    }

    case GameEventType.FINISHED: {
      break;
    }
  }
}

export async function saveEvent(
  txn: DbTransaction,
  gameID: number,
  event: GameEvent,
  toHash: string
): Promise<typeof gameEventTable.$inferSelect | undefined> {
  return txn
    .insert(gameEventTable)
    .values({
      gameID,
      type: event.type,
      payload: event.data,
      hash: await Bun.password.hash(toHash),
    })
    .onConflictDoNothing()
    .returning()
    .get();
}
