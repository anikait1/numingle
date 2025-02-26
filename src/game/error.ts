import type { GameEventType } from "./schema";

export class GameNotFoundError extends Error {}
export class GameAlreadyCreatedError extends Error {}
export class GameAlreadyStartedError extends Error {}
export class TurnExpiredError extends Error {}

export class DuplicateEventError extends Error {}

export class GameEventOutOfOrderError extends Error {
  constructor(
    currentEvent: GameEventType,
    requiredPriorEvents: GameEventType[],
  ) {
    const message = `Event "${currentEvent}" cannot be processed. It requires these events to occur first: ${requiredPriorEvents.join(", ")}`;
    super(message);
  }
}
