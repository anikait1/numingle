
export class GameInProgressError extends Error {
  static userErrorMessage(): string {
    return "Game already stated. Try another one!";
  }
}
export class InvalidGameJoinCodeError extends Error {
  static userErrorMessage(): string {
    return "Entered join code is invalid";
  }
}

export class PlayerAlreadyInGameError extends Error {
  static userErrorMessage(): string {
    return `You have already joined the game`;
  }
}

export class GameVersionMismatchError extends Error {
  static userErrorMessage(): string {
    return "You have an older version of the game";
  }
}

export class GameNotFoundError extends Error {}
export class GameAlreadyCreatedError extends Error {}
export class GameAlreadyStartedError extends Error {}
export class TurnExpiredError extends Error {}

export class DuplicateEventError extends Error {}
