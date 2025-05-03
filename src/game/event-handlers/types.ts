import type { DbTransaction } from "../../database/db";
import type { GameEvent } from "../schema";

export const DUPLICATE_EVENT = Symbol("duplicate-event");
export const BROADCAST_EVENT = Symbol("broadcast-event");
export const DIRECT_EVENT = Symbol("direct-event");
export type DuplicateEventType = typeof DUPLICATE_EVENT;
export type BroadcastEventType = typeof BROADCAST_EVENT;
export type DirectEventType = typeof DIRECT_EVENT;

export interface GameEventHandler<T extends GameEvent> {
  validate(txn: DbTransaction, gameID: number, event: T): string;
  process(txn: DbTransaction, gameID: number, event: T): GameEvent | null;
  broadcastType(): BroadcastEventType | DirectEventType | null;
}
