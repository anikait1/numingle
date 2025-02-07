import {
  object,
  string,
  number,
  record,
  union,
  literal,
  type InferOutput,
} from "valibot";

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

// Player Score Schema
const PlayerScoreSchema = object({
  score: number(),
});

// Event Schemas
export const GameCreatedEventSchema = object({
  type: literal(GameEventType.CREATED),
  data: object({
    id: number(),
    joinCode: string(),
  }),
});

export const GameStartedEventSchema = object({
  type: literal(GameEventType.STARTED),
  data: object({}),
});

export const PlayerJoinedEventSchema = object({
  type: literal(GameEventType.PLAYER_JOINED),
  data: object({
    player_id: number(),
  }),
});

export const PlayerLeftEventSchema = object({
  type: literal(GameEventType.PLAYER_LEFT),
  data: object({
    player_id: number(),
  }),
});

export const PlayerTurnEventSchema = object({
  type: literal(GameEventType.PLAYER_TURN),
  data: object({
    player_id: number(),
    selection: number(),
    turn_id: number(),
  }),
});

export const GameTurnStartedEventSchema = object({
  type: literal(GameEventType.TURN_STARTED),
  data: object({
    turn_id: number(),
    expiry: number(),
  }),
});

export const GameTurnCompleteEventSchema = object({
  type: literal(GameEventType.TURN_COMPLETE),
  data: object({
    turn_id: number(),
    player_scores: record(string(), number()),
  }),
});

export const GameTurnExpiredEventSchema = object({
  type: literal(GameEventType.TURN_EXPIRED),
  data: object({
    turn_id: number(),
  }),
});

const GameSummarySchema = union([
  object({
    status: literal("draw"),
    players: record(string(), PlayerScoreSchema),
  }),
  object({
    status: literal("result"),
    players: record(string(), PlayerScoreSchema),
    winner: number(),
    reason: string(),
  }),
]);

const GameFinishedEventSchema = object({
  type: literal(GameEventType.FINISHED),
  data: object({
    summary: GameSummarySchema,
  }),
});

export const GameAbandonedEventSchema = object({
  type: literal(GameEventType.ABANDONED),
  data: object({
    summary: GameSummarySchema,
  }),
});

// Combined Game Event Schema
export const GameEventSchema = union([
  GameCreatedEventSchema,
  GameStartedEventSchema,
  PlayerJoinedEventSchema,
  PlayerLeftEventSchema,
  PlayerTurnEventSchema,
  GameTurnStartedEventSchema,
  GameTurnCompleteEventSchema,
  GameTurnExpiredEventSchema,
  GameFinishedEventSchema,
  GameAbandonedEventSchema,
]);

// Type inference from schemas
export type GameEvent = InferOutput<typeof GameEventSchema>;
export type GameCreatedEvent = InferOutput<typeof GameCreatedEventSchema>;
export type GameStartedEvent = InferOutput<typeof GameStartedEventSchema>;
export type PlayerJoinedEvent = InferOutput<typeof PlayerJoinedEventSchema>;
export type PlayerLeftEvent = InferOutput<typeof PlayerLeftEventSchema>;
export type PlayerTurnEvent = InferOutput<typeof PlayerTurnEventSchema>;
export type GameTurnStartedEvent = InferOutput<
  typeof GameTurnStartedEventSchema
>;
export type GameTurnCompleteEvent = InferOutput<
  typeof GameTurnCompleteEventSchema
>;
export type GameTurnExpiredEvent = InferOutput<
  typeof GameTurnExpiredEventSchema
>;
export type GameFinishedEvent = InferOutput<typeof GameFinishedEventSchema>;
export type GameAbandonedEvent = InferOutput<typeof GameAbandonedEventSchema>;
