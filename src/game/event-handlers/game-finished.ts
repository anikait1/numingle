import type { DbTransaction } from "../../database/db";
import type { GameFinishedEvent } from "../types";

export function validate(
  txn: DbTransaction,
  gameID: number,
  event: GameFinishedEvent,
): string {
  return "";
}
