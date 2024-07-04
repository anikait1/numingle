import { eq, sql } from "drizzle-orm";
import { DbTransaction } from "../database/db";
import { gameTable, moveTable } from "../database/schema";
import * as GameService from "../game/service";
import { GameStatus, UserMoveMapping } from "../game/constants";
import { GameNotInProgressError, NoActiveGameError } from "../game/errors";
import { MoveAlreadyExistsError, TurnTimeLimitExceededError } from "./error";

export async function makeMove(
  userID: number,
  selection: number,
  txn: DbTransaction
) {
  const game = await GameService.getOngoingGameForUser(userID, txn);
  if (!game) {
    throw new NoActiveGameError();
  }

  if (game.status !== GameStatus.INPROGRESS) {
    throw new GameNotInProgressError();
  }

  if (game.turnExpired) {
    throw new TurnTimeLimitExceededError();
  }

  const currentTurnIDSubQuery = txn
    .select({ currentTurnID: gameTable.currentTurnID })
    .from(gameTable)
    .where(eq(gameTable.gameID, game.gameID));

  const rows = await txn
    .insert(moveTable)
    .values({
      selection,
      turnID: sql`${currentTurnIDSubQuery}`,
      userID,
      gameID: game.gameID,
    })
    .onConflictDoNothing({
      target: [moveTable.gameID, moveTable.userID, moveTable.turnID],
    })
    .returning();

  if (!rows.length) {
    throw new MoveAlreadyExistsError();
  }

  return rows[0];
}

export function isTurnComplete(
  usersMoves: UserMoveMapping,
  currentTurnID: number
): boolean {
  for (const user in usersMoves) {
    const moves = usersMoves[user];
    if (moves.length !== currentTurnID) {
      return false;
    }
  }

  return true;
}

// identify the first user which has made a move
export function getUserWithCurrentTurnComplete(
  userMoves: UserMoveMapping,
  currentTurnID: number
): number | null {
  for (const user in userMoves) {
    const moves = userMoves[user];
    if (
      moves.length === currentTurnID &&
      moves[currentTurnID - 1]?.turnID === currentTurnID
    ) {
      return Number(user);
    }
  }

  return null;
}
