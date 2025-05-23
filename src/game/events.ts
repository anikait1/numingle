import {
  array,
  literal,
  maxLength,
  minLength,
  number,
  object,
  pipe,
  record,
  regex,
  string,
  toMaxValue,
  toMinValue,
  union,
  type InferOutput,
} from "valibot";

export const GameEventType = {
  CREATED: "game-created",
  STARTED: "game-started",
  PLAYER_JOINED: "player-joined",
  PLAYER_TURN: "player-turn",
  TURN_STARTED: "game-turn-started",
  TURN_COMPLETE: "game-turn-complete",
  FINISHED: "game-finished",
} as const;

export const GameCreatedEventSchema = object({
  type: literal(GameEventType.CREATED),
  data: object({
    id: pipe(number(), toMinValue(1)),
    joinCode: string(),
  }),
});

export const PlayerJoinedEventSchema = object({
  type: literal(GameEventType.PLAYER_JOINED),
  data: object({
    player_id: pipe(number(), toMinValue(1)),
  }),
});

export const GameStartedEventSchema = object({
  type: literal(GameEventType.STARTED),
  data: object({}),
});

export const GameTurnStartedEventSchema = object({
  type: literal(GameEventType.TURN_STARTED),
  data: object({
    turn_id: pipe(number(), toMinValue(1)),
    /**
     * Each player during a turn may not be allowed
     * certain numbers to be picked from, this map
     * contains that data
     */
    unavailable_selections: record(
      pipe(string(), regex(/^\d+$/)),
      pipe(
        array(pipe(number(), toMinValue(1), toMaxValue(9))),
        minLength(3),
        maxLength(3)
      )
    ),
  }),
});

export const PlayerTurnEventSchema = object({
  type: literal(GameEventType.PLAYER_TURN),
  data: object({
    player_id: pipe(number(), toMinValue(1)),
    selection: pipe(number(), toMinValue(1), toMaxValue(9)),
    turn_id: pipe(number(), toMinValue(1)),
  }),
});

export const GameTurnCompleteEventSchema = object({
  type: literal(GameEventType.TURN_COMPLETE),
  data: object({
    turn_id: pipe(number(), toMinValue(1)),
    player_game_data: record(
      pipe(string(), regex(/^\d+$/)),
      object({
        selection: pipe(number(), toMinValue(1), toMaxValue(9)),
      })
    ),
  }),
});

const GameSummarySchema = union([
  object({
    status: literal("draw"),
    players: record(
      pipe(string(), regex(/^\d+$/)),
      pipe(number(), toMinValue(1))
    ),
  }),
  object({
    status: literal("result"),
    players: record(
      pipe(string(), regex(/^\d+$/)),
      pipe(number(), toMinValue(1))
    ),
    winner: number(),
    reason: string(),
  }),
]);

export const GameFinishedEventSchema = object({
  type: literal(GameEventType.FINISHED),
  data: object({
    summary: GameSummarySchema,
  }),
});

export const GameEventSchema = union([
  GameCreatedEventSchema,
  GameStartedEventSchema,
  PlayerJoinedEventSchema,
  PlayerTurnEventSchema,
  GameTurnStartedEventSchema,
  GameTurnCompleteEventSchema,
  GameFinishedEventSchema,
]);

export type GameEvent = InferOutput<typeof GameEventSchema>;
export type GameCreatedEvent = InferOutput<typeof GameCreatedEventSchema>;
export type GameStartedEvent = InferOutput<typeof GameStartedEventSchema>;
export type PlayerJoinedEvent = InferOutput<typeof PlayerJoinedEventSchema>;
export type PlayerTurnEvent = InferOutput<typeof PlayerTurnEventSchema>;
export type GameTurnStartedEvent = InferOutput<
  typeof GameTurnStartedEventSchema
>;
export type GameTurnCompleteEvent = InferOutput<
  typeof GameTurnCompleteEventSchema
>;
export type GameFinishedEvent = InferOutput<typeof GameFinishedEventSchema>;