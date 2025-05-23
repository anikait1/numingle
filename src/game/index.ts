import type { DbTransaction } from "../database/db";
import { gameEventTable } from "../database/schema";
import {
  GameEventType,
  type GameEvent,
  type GameFinishedEvent,
  type GameTurnCompleteEvent,
  type GameTurnStartedEvent,
  type PlayerTurnEvent,
} from "./events";

export const GameStatus = {
  STALE: "stale",
  CREATED: "created",
  STARTED: "started",
  FINISHED: "finished",
} as const;

export const GameResultReason = {
  SCORE: "score",
};

export type GameStatusType = (typeof GameStatus)[keyof typeof GameStatus];

export type Player = {
  id: number;
  score: number;
  unavailableSelections: number[];
  lastMove: number;
};

export type Game = {
  id: number;
  status: GameStatusType;
  /** turn would be set to 0 when a game is in created state */
  currentTurn: number;
  players: Record<string, Player>;
};

export function reduceEvents(events: GameEvent[]) {
  const game: Game = {
    id: 0,
    status: GameStatus.STALE,
    currentTurn: 0,
    players: {},
  };

  for (const event of events) {
    applyEvent(game, event);
  }
}

function applyEvent(game: Game, event: GameEvent) {
  switch (event.type) {
    case GameEventType.CREATED: {
      game.id = event.data.id;
      game.status = GameStatus.CREATED;
      break;
    }
    case GameEventType.PLAYER_JOINED: {
      game.players[event.data.player_id] = {
        id: event.data.player_id,
        score: 0,
        unavailableSelections: [],
        lastMove: 0,
      };
      break;
    }
    case GameEventType.STARTED: {
      game.status = GameStatus.STARTED;
      break;
    }
    case GameEventType.TURN_STARTED: {
      game.currentTurn = event.data.turn_id;
      for (const [playerID, player] of Object.entries(game.players)) {
        const playerUnavailableSelections =
          event.data.unavailable_selections[playerID];

        player.unavailableSelections = playerUnavailableSelections;
        player.lastMove = 0;
      }
      break;
    }
    case GameEventType.PLAYER_TURN: {
      const player = game.players[event.data.player_id];
      player.lastMove = event.data.selection;
      player.score += event.data.selection;
      break;
    }
    case GameEventType.TURN_COMPLETE: {
      /**
       * All the actions related to turn are performed in
       * 1. PLAYER_TURN
       * 2. TURN_STARTED
       * This event is just to maintain a proper trail of sequence
       */
      break;
    }
    case GameEventType.FINISHED: {
      game.status = GameStatus.FINISHED;
      break;
    }
  }
}

export function handlePlayerTurnEvent(
  game: Game,
  event: PlayerTurnEvent,
  txn: DbTransaction
) {
  /**
   * Ensure the following validations
   * 1. Game has started
   * 2. Player is part of the game
   * 3. Turn event corresponds to the current turn in the game
   * 4. Player has not already made the turn
   * 5. Move made by the player is not part of unavailable selections
   */

  if (game.status !== GameStatus.STARTED) throw new Error("Game not started");

  const player = game.players[event.data.player_id];
  if (!player) throw new Error("Player not part of the game");
  if (player.lastMove !== 0) throw new Error("Player already made move");
  if (game.currentTurn !== event.data.turn_id)
    throw new Error("Event's turn id and game's turn id don't match");
  if (player.unavailableSelections.includes(event.data.selection))
    throw new Error("Cannot pick unavailable selection");

  /** failure to store the event indicates a duplicate event, no need to process it again */
  if (!saveEvent(game.id, event, txn)) {
    return game;
  }

  applyEvent(game, event);
  const lastMoves = Object.values(game.players).map(
    (player) => player.lastMove
  );
  const turnComplete = lastMoves.every((move) => move !== 0);
  if (!turnComplete) return;

  /**
   * Turn is complete, progress the game to next state, that could either be a new turn
   * or game being finished
   */
  const choiceToCompare = event.data.selection;
  const allSameChoices = lastMoves.every((move) => move === choiceToCompare);

  /**
   * If the choices made by the players is different, we proceed to the next turn
   * otherwise the game is finished and move it to finished state
   */
  if (!allSameChoices) {
    const turnCompleteEvent: GameTurnCompleteEvent = {
      type: GameEventType.TURN_COMPLETE,
      data: {
        turn_id: game.currentTurn,
        player_game_data: Object.fromEntries(
          Object.values(game.players).map((player) => [
            `${player.id}`,
            { selection: player.score },
          ])
        ),
      },
    };

    // TODO - handle the case of applied event already existing
    // NOTE - most likely, just fetch all events and return the game state
    if (!saveEvent(game.id, turnCompleteEvent, txn)) {
      console.log({
        gameID: game.id,
        event: turnCompleteEvent,
      });
      throw new Error("Not implemented");
    }

    /** this is essentially a no-op since we don't take any action in TURN_COMPLETE */
    applyEvent(game, turnCompleteEvent);

    const nextTurnStartedEvent: GameTurnStartedEvent = {
      type: GameEventType.TURN_STARTED,
      data: {
        turn_id: game.currentTurn + 1,
        unavailable_selections: Object.fromEntries(
          Object.values(game.players).map((player) => [
            `${player.id}`,
            [
              player.lastMove,
              (player.lastMove + 1) % 9,
              (player.lastMove + 2) % 9,
            ],
          ])
        ),
      },
    };

    // TODO - handle the case of applied event already existing
    // NOTE - most likely, just fetch all events and return the game state
    if (!saveEvent(game.id, nextTurnStartedEvent, txn)) {
      console.log({
        gameID: game.id,
        event: turnCompleteEvent,
      });
      throw new Error("Not implemented");
    }

    applyEvent(game, nextTurnStartedEvent);
    return game;
  }

  const scoreSummaryByPlayerID: Record<string, number> = {};
  let maxScore = -1;

  for (const [playerID, player] of Object.entries(game.players)) {
    /** Build the score summary keyed by player id */
    scoreSummaryByPlayerID[playerID] = player.score;

    /** Calculate the max score in the game */
    maxScore = Math.max(player.score, maxScore);
  }

  const winners = Object.values(game.players).filter(
    (player) => player.score === maxScore
  );
  const gameFinishedEvent: GameFinishedEvent = {
    type: GameEventType.FINISHED,
    data: {
      summary:
        winners.length > 1
          ? {
              status: "draw",
              players: scoreSummaryByPlayerID,
            }
          : {
              status: "result",
              players: scoreSummaryByPlayerID,
              winner: winners[0].id,
              reason: GameResultReason.SCORE,
            },
    },
  };

  // TODO - handle the case of applied event already existing
  // NOTE - most likely, just fetch all events and return the game state
  if (!saveEvent(game.id, gameFinishedEvent, txn)) {
    console.log({
      gameID: game.id,
      event: gameFinishedEvent,
    });
    throw new Error("Not implemented");
  }

  applyEvent(game, gameFinishedEvent);
  return game
}

export function saveEvent(
  gameID: number,
  event: GameEvent,
  txn: DbTransaction
): typeof gameEventTable.$inferSelect | undefined {
  let eventKey: string | null = null;

  switch (event.type) {
    case GameEventType.CREATED: {
      eventKey = `${gameID}-${event.type}`;
      break;
    }
    case GameEventType.PLAYER_JOINED: {
      eventKey = `${gameID}-${event.type}-${event.data.player_id}`;
      break;
    }
    case GameEventType.STARTED: {
      eventKey = `${gameID}-${event.type}`;
      break;
    }
    case GameEventType.TURN_STARTED: {
      eventKey = `${gameID}-${event.type}-${event.data.turn_id}`;
      break;
    }
    case GameEventType.PLAYER_TURN: {
      eventKey = `${gameID}-${event.type}-${event.data.player_id}-${event.data.turn_id}`;
      break;
    }
    case GameEventType.TURN_COMPLETE: {
      eventKey = `${gameID}-${event.type}-${event.data.turn_id}`;
      break;
    }
    case GameEventType.FINISHED: {
      eventKey = `${gameID}-${GameEventType.FINISHED}`;
      break;
    }
  }

  if (!eventKey) {
    throw new Error("Event not configured");
  }

  return txn
    .insert(gameEventTable)
    .values({
      gameID,
      type: event.type,
      payload: event.data,
      eventKey,
    })
    .onConflictDoNothing()
    .returning()
    .get();
}
