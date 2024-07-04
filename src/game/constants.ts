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

export const USER_HASH_PREFIX = "user";
export const GAME_HASH_PREFIX = "game";
export const GAME_TURN_EXPIRY_MILLISECONDS = 500_000;
export const GAME_ABANDONED_TURN_EXPIRED_REASON = 'no user made a move in the given time'
export const GAME_FINISHED_TURN_EXPIRED_REASON = 'user did not make there move in the given time'

export type UserMoveMapping = { [key: string]: { turnID: number; selection: number }[] }

export type GameDetails = {
  gameID: number;
  status: GameStatusEnum;
  currentTurnID: number;
  turnExpired: boolean;
  users: UserMoveMapping;
  version: number;
};


export type OngoingGameStatus = {
  gameID: number;
  status: GameStatusEnum;
  turnExpired: boolean;
};

export type GameVersion = {
  gameID: number;
  version: number;
};
