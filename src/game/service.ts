import assert from "node:assert";
import { DrizzleError, and, eq, inArray, sql } from "drizzle-orm";
import { DbTransaction } from "../database/db";
import {
  activeGameTable,
  gameTable,
  gameUserMapTable,
  moveTable,
} from "../database/schema";
import {
  GAME_HASH_PREFIX,
  GAME_TURN_EXPIRY_MILLISECONDS,
  USER_HASH_PREFIX,
  GameStatus,
  OngoingGameStatus,
  GameDetails,
  GameVersion,
  GAME_ABANDONED_TURN_EXPIRED_REASON,
  GAME_FINISHED_TURN_EXPIRED_REASON,
} from "./constants";
import { acquireTxnScopeAdvisoryLock } from "../database/advisory-lock";
import {
  DataInconsistencyError,
  GameNotInProgressError,
  GameSearchInProgressError,
  GameUpdateInProgress,
  GameVersionMismatchError,
  NoGameFoundError,
  NotEnoughPlayersError,
  UserActiveGameExistsError,
} from "./errors";
import { hashStringToNumber } from "../common/hash";
import * as MoveService from "../moves/service";

export async function searchGameForUser(userID: number, txn: DbTransaction) {
  const lockKey = hashStringToNumber(`${USER_HASH_PREFIX}_${userID}`);
  const lockForUserSearch = await acquireTxnScopeAdvisoryLock(lockKey, txn);
  if (!lockForUserSearch) {
    throw new GameSearchInProgressError(userID);
  }

  const ongoingGame = await getOngoingGameForUser(userID, txn);
  if (ongoingGame) {
    // TODO - handle waiting and in progress games differently
    return ongoingGame.gameID;
    // switch (ongoingGame.status) {
    //   case GameStatus.INPROGRESS: {
    //     return ongoingGame.gameID;
    //   }
    //   case GameStatus.WAITING: {
    //     // TODO - write function to merge games
    //     return ongoingGame.gameID;
    //   }
    // }
  }

  const joinedExistingGame = await searchWaitingGames(userID, txn);
  if (joinedExistingGame !== null) {
    return joinedExistingGame;
  }

  try {
    return await createNewGame(userID, txn);
  } catch (err) {
    if (err instanceof UserActiveGameExistsError) {
      const ongoingGame = await getOngoingGameForUser(userID, txn);
      if (!ongoingGame) {
        throw new DataInconsistencyError(userID);
      }

      return ongoingGame.gameID;
    }

    console.error("unknown error occured", err);
    return null;
  }
}

export async function getGameDetails(
  gameID: number,
  txn: DbTransaction
): Promise<GameDetails | null> {
  const movesAgg = txn
    .select({
      value: sql`
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'turnID', ${moveTable.turnID},
              'selection', ${moveTable.selection}
            ) order by ${moveTable.turnID}
          ),
          '[]'::jsonb
        )
      `,
    })
    .from(moveTable)
    .where(
      and(
        eq(moveTable.gameID, gameTable.gameID),
        eq(moveTable.userID, gameUserMapTable.userID)
      )
    );

  const userMovesAgg = txn
    .select({
      value: sql`
        coalesce(
          jsonb_object_agg(
            ${gameUserMapTable.userID}, ${movesAgg}
          ),
          '{}'::jsonb
        )
      `,
    })
    .from(gameUserMapTable)
    .where(eq(gameUserMapTable.gameID, gameTable.gameID));

  const rows = await txn
    .select({
      game: sql<GameDetails>`jsonb_build_object(
        'gameID', ${gameTable.gameID},
        'status', ${gameTable.status},
        'currentTurnID', ${gameTable.currentTurnID},
        'turnExpired', coalesce(${gameTable.currentTurnExpiresAt} < now(), false),
        'users', ${userMovesAgg},
        'version', ${gameTable.version}
      )`,
    })
    .from(gameTable)
    .where(eq(gameTable.gameID, gameID));

  if (!rows.length) {
    return null;
  }

  return rows[0].game;
}

export async function getOngoingGameForUser(
  userID: number,
  txn: DbTransaction
): Promise<OngoingGameStatus | null> {
  const rows = await txn
    .select({
      gameID: activeGameTable.gameID,
      status: gameTable.status,
      turnExpired: sql<boolean>`coalesce(${gameTable.currentTurnExpiresAt} < now(), false)`,
    })
    .from(activeGameTable)
    .innerJoin(gameTable, eq(gameTable.gameID, activeGameTable.gameID))
    .where(
      and(
        eq(activeGameTable.userID, userID),
        inArray(gameTable.status, [GameStatus.INPROGRESS, GameStatus.WAITING])
      )
    );

  if (!rows.length) {
    return null;
  }

  return rows[0];
}

export async function updateGameState(gameID: number, txn: DbTransaction) {
  const game = await getGameDetails(gameID, txn);
  if (!game) {
    throw new NoGameFoundError();
  }

  if (game.status !== GameStatus.INPROGRESS) {
    throw new GameNotInProgressError();
  }

  if (Object.keys(game.users).length !== 2) {
    throw new NotEnoughPlayersError();
  }

  const lockKey = hashStringToNumber(`${GAME_HASH_PREFIX}_${gameID}`);
  const lockForGameSearch = await acquireTxnScopeAdvisoryLock(lockKey, txn);
  if (!lockForGameSearch) {
    throw new GameUpdateInProgress(gameID);
  }

  const isTurnComplete = MoveService.isTurnComplete(
    game.users,
    game.currentTurnID
  );
  const isTurnExpired = game.turnExpired;

  // users still have pending time to make a move
  if (!isTurnComplete && !isTurnExpired) {
    return;
  }

  if (!isTurnComplete && isTurnExpired) {
    // has anyone of them made there turn?
    const userWithCurrentTurnCompleted =
      MoveService.getUserWithCurrentTurnComplete(
        game.users,
        game.currentTurnID
      );

    // game is abandoned since no one made a move
    if (!userWithCurrentTurnCompleted) {
      return await abandonGame(game.gameID, game.version, txn);
    } else {
      // user who made the move won, even if they had less of a score
      return await finishGameDueTurnExpiry(
        userWithCurrentTurnCompleted,
        game.gameID,
        game.version,
        txn
      );
    }
  }

  // scores need to be calculated and game might move to next turn
  const isGameOver = Object.values(game.users)
    .map((moves) => moves[game.currentTurnID - 1].selection)
    .every((value, _, arr) => value === arr[0]);

  // TODO update the attributes column accordingly
  const payload = isGameOver
    ? {
        version: sql`${gameTable.version} + 1`,
        status: GameStatus.FINISHED,
        endedAt: new Date(),
      }
    : {
        version: sql`${gameTable.version} + 1`,
        currentTurnID: sql`${gameTable.currentTurnID} + 1`,
        currentTurnExpiresAt: sql`now() + interval '${GAME_TURN_EXPIRY_MILLISECONDS} milliseconds'`,
      };

  const rows = await txn
    .update(gameTable)
    .set(payload)
    .where(
      and(
        eq(gameTable.gameID, game.gameID),
        eq(gameTable.version, game.version)
      )
    )
    .returning();

  if (!rows.length) {
    throw new GameVersionMismatchError();
  }

  // update score
  if (!isGameOver) {
    for (const user in game.users) {
      await txn
        .update(gameUserMapTable)
        .set({
          score: sql`${gameUserMapTable.score} + ${
            game.users[user][game.currentTurnID - 1].selection
          }`,
        })
        .where(
          and(
            eq(gameUserMapTable.gameID, game.gameID),
            eq(gameUserMapTable.userID, Number(user))
          )
        );
    }
  }
}

async function searchWaitingGames(userID: number, txn: DbTransaction) {
  // TODO - work on picking random games logic
  const games = await txn
    .select({ gameID: gameTable.gameID, version: gameTable.version })
    .from(gameTable)
    .where(eq(gameTable.status, GameStatus.WAITING))
    .orderBy(sql`random()`)
    .limit(5);

  for (const game of games) {
    try {
      return await tryJoinExistingGame(userID, game, txn);
    } catch (err) {
      if (err instanceof UserActiveGameExistsError) {
        const ongoingGame = await getOngoingGameForUser(userID, txn);
        if (!ongoingGame) {
          throw new DataInconsistencyError(userID);
        }

        return ongoingGame.gameID;
      }

      if (err instanceof GameVersionMismatchError) {
        console.log("game was already updated");
        continue;
      }

      console.error("unknown error occured", err);
    }
  }

  return null;
}

async function tryJoinExistingGame(
  userID: number,
  gameVersion: GameVersion,
  txn: DbTransaction
): Promise<number> {
  return await txn.transaction(async (nestedTxn) => {
    const results = await Promise.allSettled([
      insertActiveGameQuery(gameVersion.gameID, userID, nestedTxn),
      insertGameUserMapQuery(gameVersion.gameID, userID, nestedTxn),
      updateGameToInProgressQuery(
        gameVersion.gameID,
        gameVersion.version,
        nestedTxn
      ),
    ]);

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        throw new Error(result.reason);
      }

      const isActiveGameConflict = index === 0 && result.value.length === 0;
      if (isActiveGameConflict) {
        throw new UserActiveGameExistsError(userID);
      }

      const isGameUpdateStale = index === 2 && result.value.length === 0;
      if (isGameUpdateStale) {
        throw new GameVersionMismatchError();
      }
    });

    return gameVersion.gameID;
  });
}

async function createNewGame(userID: number, txn: DbTransaction) {
  return await txn.transaction(async (nestedTxn) => {
    const [{ gameID }] = await nestedTxn
      .insert(gameTable)
      .values({ status: GameStatus.WAITING })
      .returning({ gameID: gameTable.gameID });

    const results = await Promise.allSettled([
      insertActiveGameQuery(gameID, userID, nestedTxn),
      insertGameUserMapQuery(gameID, userID, nestedTxn),
    ]);

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        throw new Error(result.reason);
      }

      const isActiveGameConflict = index === 0 && result.value.length === 0;
      if (isActiveGameConflict) {
        throw new UserActiveGameExistsError(userID);
      }
    });

    return gameID;
  });
}

async function abandonGame(
  gameID: number,
  version: number,
  txn: DbTransaction
): Promise<void> {
  const rows = await txn
    .update(gameTable)
    .set({
      status: GameStatus.ABANDONED,
      attributes: sql`${gameTable.attributes} || '{"reason": ${GAME_ABANDONED_TURN_EXPIRED_REASON}}::jsonb'`,
    })
    .where(and(eq(gameTable.gameID, gameID), eq(gameTable.version, version)))
    .returning();

  if (!rows) {
    throw new GameVersionMismatchError();
  }

  await txn.delete(activeGameTable).where(eq(activeGameTable.gameID, gameID));
}

async function finishGameDueTurnExpiry(
  winnerID: number,
  gameID: number,
  version: number,
  txn: DbTransaction
) {
  const rows = await txn
    .update(gameTable)
    .set({
      status: GameStatus.FINISHED,
      attributes: sql`${gameTable.attributes} || 
        '{
          "reason": ${GAME_FINISHED_TURN_EXPIRED_REASON}, 
          "winnerID": ${winnerID}
        }'`,
    })
    .where(and(eq(gameTable.gameID, gameID), eq(gameTable.version, version)))
    .returning();

  if (!rows) {
    throw new GameVersionMismatchError();
  }

  await txn.delete(activeGameTable).where(eq(activeGameTable.gameID, gameID));
}

// query wrappers

function insertActiveGameQuery(
  gameID: number,
  userID: number,
  txn: DbTransaction
) {
  return txn
    .insert(activeGameTable)
    .values({ gameID, userID })
    .onConflictDoNothing({ target: activeGameTable.userID })
    .returning();
}

function insertGameUserMapQuery(
  gameID: number,
  userID: number,
  txn: DbTransaction
) {
  return txn.insert(gameUserMapTable).values({ gameID, userID });
}

function updateGameToInProgressQuery(
  gameID: number,
  version: number,
  txn: DbTransaction
) {
  return txn
    .update(gameTable)
    .set({
      status: GameStatus.INPROGRESS,
      currentTurnExpiresAt: new Date(
        Date.now() + GAME_TURN_EXPIRY_MILLISECONDS
      ),
      version: sql`${gameTable.version} + 1`,
    })
    .where(and(eq(gameTable.gameID, gameID), eq(gameTable.version, version)))
    .returning({ version: gameTable.version, gameID: gameTable.gameID });
}

/** NOTE - Another way to load game details
  select 
    gum.user_id,
    g.current_turn_id,
    g.status,
    jsonb_agg(
      json_build_object( 
        'turn_id', m.turn_id, 
        'selection', m.selection
      ) order by m.turn_id
    ) as moves
  from
    games g
  inner join game_user_map gum on
    g.game_id = gum.game_id
  left join moves m on
    g.game_id = m.game_id 
    and gum.user_id = m.user_id 
  where g.game_id = 1
  group by g.game_id, gum.user_id;
*/
