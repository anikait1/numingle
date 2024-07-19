export class GameSearchInProgressError extends Error {
  userID: number;
  constructor(userID: number, message?: string) {
    if (!message) {
      message = GameSearchInProgressError.errorMessage;
    }

    super(message);
    this.userID = userID;
    this.name = GameSearchInProgressError.name;
  }

  static errorMessage = "game search is already in progress for this user";
}

export class GameUpdateInProgress extends Error {
  gameID: number;
  constructor(gameID: number, message?: string) {
    if (!message) {
      message = GameUpdateInProgress.errorMessage;
    }

    super(message);
    this.gameID = gameID;
    this.name = GameUpdateInProgress.name;
  }

  static errorMessage = "game update is already in progress";
}

export class UserActiveGameExistsError extends Error {
  userID: number;
  constructor(userID: number, message?: string) {
    if (!message) {
      message = UserActiveGameExistsError.errorMessage;
    }

    super(message);
    this.userID = userID;
    this.name = UserActiveGameExistsError.name;
  }

  static errorMessage = "user is already part of an active game";
}

export class NoActiveGameError extends Error {}

export class NoGameFoundError extends Error {
  static errrorMessage = "no game found with the given gameID"
}

export class NotEnoughPlayersError extends Error {
  static errorMessage = "game does not has enough players to start"
}

export class GameVersionMismatchError extends Error {}

export class DataInconsistencyError extends Error {
  userID: number;
  constructor(userID: number, message?: string) {
    super(message);
    this.userID = userID;
  }
}

export class GameNotInProgressError extends Error {
  static errorMessage = "game is currently not in progress"
}
