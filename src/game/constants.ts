// Remember to keep this in sync with schema. Ideally having the schema values being
// generated from this would be even better, but getting it right seems to be an issue
// with typescript
export const GameStatus = {
  WAITING: "WAITING",
  INPROGRESS: "INPROGRESS",
  MERGED: "MERGED",
  ABANDONED: "ABANDONED",
  FINISHED: "FINISHED",
} as const;
export type GameStatusEnum = (typeof GameStatus)[keyof typeof GameStatus];

export const USER_HASH_PREFIX = 'user'
export const GAME_HASH_PREFIX = 'game'
export const GAME_TURN_EXPIRY_MILLISECONDS = 500_000