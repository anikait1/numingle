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
    id: number(),
    join_code: string(),
  }),
});

export const PlayerJoinedEventSchema = object({
  type: literal(GameEventType.PLAYER_JOINED),
  data: object({
    player_id: number(),
  }),
});

export const GameStartedEventSchema = object({
  type: literal(GameEventType.STARTED),
  data: object({}),
});

export const GameTurnStartedEventSchema = object({
  type: literal(GameEventType.TURN_STARTED),
  data: object({
    turn_id: number(),
    /**
     * Each player during a turn may not be allowed
     * certain numbers to be picked from, this map
     * contains that data
     */
    unavailable_selections: record(
      pipe(string(), regex(/^\d+$/)),
      pipe(array(pipe(number())), minLength(0), maxLength(3))
    ),
  }),
});

export const PlayerTurnEventSchema = object({
  type: literal(GameEventType.PLAYER_TURN),
  data: object({
    player_id: number(),
    selection: pipe(number(), toMinValue(1), toMaxValue(9)),
    turn_id: number(),
  }),
});

export const GameTurnCompleteEventSchema = object({
  type: literal(GameEventType.TURN_COMPLETE),
  data: object({
    turn_id: number(),
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
    players: record(pipe(string(), regex(/^\d+$/)), number()),
  }),
  object({
    status: literal("result"),
    players: record(pipe(string(), regex(/^\d+$/)), number()),
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

export const GameNotificationType = {
  PLAYER_JOINED: "player-joined",
  GAME_STARTED: "game-started",
  TURN_STARTED: "game-turn-started",
  GAME_FINISHED: "game-finished",
} as const;

export const GameStartedNotificationSchema = object({
  type: literal(GameNotificationType.GAME_STARTED),
  data: object({
    game_id: number(),
  }),
});

export const GamePlayerJoinedNotificaionSchema = object({
  type: literal(GameNotificationType.PLAYER_JOINED),
  data: object({
    game_id: number(),
    player_id: number(),
  }),
});

export const GameTurnStartedNotificationSchema = object({
  type: literal(GameNotificationType.TURN_STARTED),
  data: object({
    game_id: number(),
    player_id: number(),
    turn_id: number(),
    unavailable_selections: pipe(
      array(pipe(number())),
      minLength(0),
      maxLength(3)
    ),
  }),
});

export const GameFinishedNotificationSchema = object({
  type: literal(GameNotificationType.GAME_FINISHED),
  data: object({
    game_id: number(),
  }),
});

export const GameNotificationSchema = union([
  GameStartedNotificationSchema,
  GamePlayerJoinedNotificaionSchema,
  GameTurnStartedNotificationSchema,
  GameFinishedNotificationSchema,
]);

export type GameNotification = InferOutput<typeof GameNotificationSchema>;
export type GameStartedNotification = InferOutput<
  typeof GameStartedNotificationSchema
>;
export type GameTurnStartedNotification = InferOutput<
  typeof GameTurnStartedNotificationSchema
>;
export type GameFinishedNotification = InferOutput<
  typeof GameFinishedNotificationSchema
>;

export const BroadcastNotificationTypes: (typeof GameNotificationType)[keyof typeof GameNotificationType][] =
  [GameNotificationType.GAME_STARTED, GameNotificationType.GAME_FINISHED];

export const NonBroadcastNotificationTypes: (typeof GameNotificationType)[keyof typeof GameNotificationType][] =
  [GameNotificationType.PLAYER_JOINED, GameNotificationType.TURN_STARTED];
