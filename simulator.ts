import { db } from "./src/database/db";
import { userTable } from "./src/database/schema";
import { GameEventType } from "./src/game/events";
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
      username: `sim_user_${i + index + 1}_${Math.random().toString(36).substring(2, 8)}`,
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

    console.log(`Created batch of ${batchSize} users (${users.length}/${numUsers} total)`);
  }

  console.log("Users created successfully!");
  return users;
}

function createGames(numGames: number): SimulatedGame[] {
  console.log("Creating games", { numGames });
  const games: SimulatedGame[] = [];

  for (let i = 0; i < numGames; i++) {
    const joinCode = `GAME${i + 1}_${Math.random().toString(36).substring(2, 8)}`;

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

    db.transaction((txn) => {
      const g = Game.getGame(game.id, txn);
      Game.handlePlayerJoinEvent(g, {
        type: GameEventType.PLAYER_JOINED,
        data: { player_id: user1.id },
      }, txn);
      Game.handlePlayerJoinEvent(g, {
        type: GameEventType.PLAYER_JOINED,
        data: { player_id: user2.id },
      }, txn);
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
  await Promise.all(game.users.map(user => {
    return new Promise<void>((resolve) => {
      const ws = new WebSocket(
        `ws://localhost:3001?userID=${user.id}&gameID=${game.id}`
      );

      ws.on("open", () => {
        console.log(`User ${user.username} connected to game ${game.id}`);
        resolve();
      });

      ws.on("message", (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          game.gameState = parsed;
          if (parsed.status === Game.GameStatus.FINISHED) {
            console.log(`Game ${game.id} finished`, parsed);
          }
        } catch (err) {
          console.error("Bad game state from server:", data.toString());
        }
      });

      user.ws = ws;
    });
  }));
}

async function simulateGameTurns(game: SimulatedGame): Promise<void> {
  while (game.gameState?.status === Game.GameStatus.STARTED) {
    for (const user of game.users) {
      const player = game.gameState.players[user.id];
      if (!player || (player.lastMove && player.lastMove !== 0)) continue;

      const unavailable = player.unavailableSelections ?? [];
      const available = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
        n => !unavailable.includes(n)
      );

      if (available.length === 0) continue;

      const choice = available[Math.floor(Math.random() * available.length)];
      const turnEvent = {
        type: "player-turn",
        data: {
          player_id: user.id,
          turn_id: game.gameState.currentTurn,
          selection: choice,
        },
      };

      user.ws?.send(JSON.stringify(turnEvent));
    }

    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 500 + 100)
    );
  }
}

async function cleanupGames(games: SimulatedGame[]): Promise<void> {
  console.log("Cleaning up simulator...");
  for (const game of games) {
    for (const user of game.users) {
      user.ws?.close();
    }
  }
  console.log("Cleanup complete!");
}

async function runSimulation(numUsers: number, numGames: number): Promise<void> {
  console.log("Starting simulator...");

  const users = createUsers(numUsers);
  const games = createGames(numGames);
  joinGames(games, users);

  console.log("Simulating...");
  await Promise.all(games.map(connectUsersToGame));
  await Promise.all(games.map(simulateGameTurns));

  await cleanupGames(games);
}

runSimulation(5000, 2500).catch(console.error);
