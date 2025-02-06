export const GameEventType = {
  CREATED: "game-created",
  STARTED: "game-started",
  PLAYER_JOINED: "player-joined",
  PLAYER_LEFT: "player-left",
  PLAYER_TURN: "player-turn",
  TURN_STARTED: "game-turn-started",
  TURN_COMPLETE: "game-turn-complete",
  TURN_EXPIRED: "game-turn-expired",
  FINISHED: "game-finished",
  ABANDONED: "game-abandoned",
} as const;
export type GameEventType = (typeof GameEventType)[keyof typeof GameEventType];

type GameSummary = {
  players: {
    [playerID: string]: { score: number };
  }
}

export type GameEventRecord<T extends GameEventType, D> = {
  type: T;
  data: D;
};

export type GameCreatedEvent = GameEventRecord<
  typeof GameEventType.CREATED,
  { id: number; joinCode: string }
>;
export type GameStartedEvent = GameEventRecord<
  typeof GameEventType.STARTED,
  {}
>;
export type PlayerJoinedEvent = GameEventRecord<
  typeof GameEventType.PLAYER_JOINED,
  { player_id: number }
>;
export type PlayerLeftEvent = GameEventRecord<
  typeof GameEventType.PLAYER_LEFT,
  { player_id: number }
>;
export type PlayerTurnEvent = GameEventRecord<
  typeof GameEventType.PLAYER_TURN,
  { player_id: number; selection: number; turn_id: number }
>;
export type GameTurnStartedEvent = GameEventRecord<
  typeof GameEventType.TURN_STARTED,
  { turn_id: number, expiry: number }
>;
export type GameTurnCompleteEvent = GameEventRecord<
  typeof GameEventType.TURN_COMPLETE,
  { turn_id: number, player_scores: {[player_id: string]: number} }
>;
export type GameTurnExpiredEvent = GameEventRecord<
  typeof GameEventType.TURN_EXPIRED,
  { turn_id: number }
>;
export type GameFinishedEvent = GameEventRecord<
  typeof GameEventType.FINISHED,
  {
    summary: GameSummary &
      (
        | { status: "result"; winner: number; reason: string }
        | { status: "draw" }
      );
  }
>;
export type GameAbandonedEvent = GameEventRecord<
  typeof GameEventType.ABANDONED,
  { summary: GameSummary }
>;

export type GameEvent =
  | GameCreatedEvent
  | GameStartedEvent
  | PlayerJoinedEvent
  | PlayerLeftEvent
  | PlayerTurnEvent
  | GameTurnExpiredEvent
  | GameTurnStartedEvent
  | GameTurnCompleteEvent
  | GameTurnExpiredEvent
  | GameFinishedEvent
  | GameAbandonedEvent;