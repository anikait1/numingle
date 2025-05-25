import { db } from "./src/database/db";
import { userTable } from "./src/database/schema";
import {
  GameEventType,
  GameNotificationType,
  type GameNotification,
  type PlayerTurnEvent,
} from "./src/game/events";
import * as Game from "./src/game";
import WebSocket from "ws";

type SimulatedUser = {
  id: number;
  username: string;
  ws: WebSocket | null;
};

type SimulatedGame = {
  id: number;
  users: SimulatedUser[];
  gameState: Game.Game | null;
};

function createUsers(numUsers: number): SimulatedUser[] {
  const users: SimulatedUser[] = [];
  const BATCH_SIZE = 100;

  console.log("Creating users", {
    numUsers,
    batchSize: BATCH_SIZE,
    totalBatches: Math.ceil(numUsers / BATCH_SIZE),
  });

  for (let i = 0; i < numUsers; i += BATCH_SIZE) {
    const batchSize = Math.min(BATCH_SIZE, numUsers - i);
    const batchUsers = Array.from({ length: batchSize }, (_, index) => ({
      username: `sim_user_${i + index + 1}_${Math.random()
        .toString(36)
        .substring(2, 8)}`,
    }));

    const createdUsers = db
      .insert(userTable)
      .values(batchUsers)
      .returning()
      .all();

    users.push(
      ...createdUsers.map((user) => ({
        id: user.userID,
        username: user.username,
        ws: null,
      }))
    );

    console.log(
      `Created batch of ${batchSize} users (${users.length}/${numUsers} total)`
    );
  }

  console.log("Users created successfully!");
  return users;
}

function createGames(numGames: number): SimulatedGame[] {
  console.log("Creating games", { numGames });
  const games: SimulatedGame[] = [];

  for (let i = 0; i < numGames; i++) {
    const joinCode = `GAME${i + 1}_${Math.random()
      .toString(36)
      .substring(2, 8)}`;

    const game = db.transaction((txn) => {
      const created = Game.createGame(joinCode, txn);
      return Game.getGame(created.id, txn);
    });

    console.log("Game created", {
      id: game.id,
      joinCode,
    });

    games.push({
      id: game.id,
      users: [],
      gameState: game,
    });
  }

  console.log("Games created successfully!");
  return games;
}

function joinGames(games: SimulatedGame[], users: SimulatedUser[]): void {
  console.log("Joining users to games...");
  const usedUserIDs = new Set<number>();

  for (const game of games) {
    const availableUsers = users.filter((u) => !usedUserIDs.has(u.id));
    if (availableUsers.length < 2) {
      console.log("Not enough users to join games!");
      break;
    }

    const user1 = availableUsers[0];
    const user2 = availableUsers[1];

    game.gameState = db.transaction((txn) => {
      const g = Game.getGame(game.id, txn);
      Game.handlePlayerJoinEvent(
        g,
        {
          type: GameEventType.PLAYER_JOINED,
          data: { player_id: user1.id },
        },
        txn
      );
      const updatedG = Game.handlePlayerJoinEvent(
        g,
        {
          type: GameEventType.PLAYER_JOINED,
          data: { player_id: user2.id },
        },
        txn
      );

      return updatedG.game;
    });

    game.users = [user1, user2];
    usedUserIDs.add(user1.id);
    usedUserIDs.add(user2.id);

    console.log("Users joined game", {
      gameID: game.id,
      users: [user1.id, user2.id],
    });
  }

  console.log("Users joined games successfully!");
}

async function connectUsersToGame(game: SimulatedGame): Promise<void> {
  for (const user of game.users) {
    const address = `ws://localhost:3001?userID=${user.id}&gameID=${game.id}`;
    const ws = new WebSocket(address);

    ws.on("open", function connectionOpenHandler() {
      console.log(
        `User(${user.id}) ${user.username} connected to game ${game.id}`
      );
    });

    ws.on("message", function messageReceivedHandler(data) {
      try {
        const parsedData: {
          game: Game.Game;
          notifications: GameNotification[];
        } = JSON.parse(data.toString());

        game.gameState = parsedData.game;
        console.log('event receieved', parsedData.notifications)

        for (const notification of parsedData.notifications) {
          switch (notification.type) {
            case GameNotificationType.TURN_STARTED: {
              const playerTurnEvent: PlayerTurnEvent = {
                type: GameEventType.PLAYER_TURN,
                data: {
                  player_id: notification.data.player_id,
                  selection: makePlayerSelection(
                    parsedData.game,
                    parsedData.game.players[notification.data.player_id]
                  ),
                  turn_id: notification.data.turn_id,
                },
              };

              setTimeout(() => {
                ws.send(JSON.stringify(playerTurnEvent));
              }, 10 * Math.random());
              break;
            }
            case GameNotificationType.GAME_FINISHED: {
              console.log("closing connection", user.id, game.gameState.id);
              ws.close();
              break;
            }
            default: {
              console.log("not handling noitification event", notification);
            }
          }
        }
      } catch (err) {
        console.error(
          "Something went wrong while handling message from server",
          err,
          data
        );
      }
    });

    user.ws = ws;
  }
}

function startSimulation(game: SimulatedGame) {
  for (const user of game.users) {
    if (!user.ws) continue;

    const gameState = game.gameState;
    if (!gameState || gameState.status !== Game.GameStatus.STARTED) continue;

    const playerTurnEvent = {
      type: GameEventType.PLAYER_TURN,
      data: {
        player_id: user.id,
        selection: makePlayerSelection(gameState, gameState.players[user.id]),
        turn_id: gameState.currentTurn,
      },
    };

    console.log(
      "Kicking of player turn event for simulation",
      playerTurnEvent,
      user.ws.readyState
    );
    user.ws.send(JSON.stringify(playerTurnEvent));
  }
}

function makePlayerSelection(game: Game.Game, player: Game.Player) {
  const unavailableSelections = player.unavailableSelections;
  const availableSelections = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
    (n) => !unavailableSelections.includes(n)
  );

  return availableSelections[
    Math.floor(Math.random() * availableSelections.length)
  ];
}

let games: SimulatedGame[];
async function runSimulation(
  numUsers: number,
  numGames: number
): Promise<void> {
  console.log("Starting simulator...");

  games = createGames(numGames);
  const users = createUsers(numUsers);
  joinGames(games, users);

  console.log("Simulating...");
  await Promise.all(games.map(connectUsersToGame));
  games.forEach((game) =>
    setTimeout(() => {
      startSimulation(game);
    }, 1000 + Math.random() * 1000)
  );
}

runSimulation(10_000, 5_000).catch(console.error);

setTimeout(() => {
  console.log({
    log: "Game status log",
    pending_games: games.filter(
      (game) => game.gameState?.status !== Game.GameStatus.FINISHED
    ).length,
    over_games: games.filter(
      (game) => game.gameState?.status === Game.GameStatus.FINISHED
    ).length,
  });
  setInterval(() => {
    console.log({
      log: "Game status log",
      pending_games: games.filter(
        (game) => game.gameState?.status !== Game.GameStatus.FINISHED
      ).length,
      over_games: games.filter(
        (game) => game.gameState?.status === Game.GameStatus.FINISHED
      ).length,
    });
  }, 1000);
}, 20_000);
