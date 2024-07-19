import { Hono } from "hono";
import { cors } from 'hono/cors'
import { decode, sign, verify } from "hono/jwt";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import * as GameService from "./game/service";
import * as MoveService from "./moves/service";
import { db } from "./database/db";
import { GameNotInProgressError, NoActiveGameError } from "./game/errors";
import {
  TurnTimeLimitExceededError,
  MoveAlreadyExistsError,
} from "./moves/error";

const app = new Hono();
app.use(cors())
app.get("/", (c) => c.text("Hello bun!"));

app.get("/token", async (c) => {
  const userID = Number(c.req.query("userID"));
  const token = await sign({ userID }, "secret");

  return c.json(token);
});

app.get("/game/search", async (c) => {
  const userID = Number(c.req.query("userID")); // TODO - read from jwt
  const gameID = await db.transaction((txn) =>
    GameService.searchGameForUser(userID, txn),
  );
  if (!gameID) {
    return c.notFound();
  }

  const gameDetails = await db.transaction((txn) =>
    GameService.getGameDetails(gameID, txn),
  );
  if (!gameDetails) {
    return c.notFound();
  }

  return c.json(gameDetails);
});

app.get(
  "/game/:gameID",
  zValidator("param", z.object({ gameID: z.string().pipe(z.coerce.number()) })),
  async (c) => {
    const userID = Number(c.req.query("userID"));
    const { gameID } = c.req.valid("param");
    const gameDetails = await db.transaction((txn) =>
      GameService.getGameDetails(gameID, txn),
    );

    if (!gameDetails) {
      return c.notFound();
    }

    // if (!(userID in gameDetails.users)) {
    //   return c.notFound();
    // }

    return c.json(gameDetails);
  },
);

app.post(
  "/moves",
  zValidator("json", z.object({ selection: z.number().min(1).max(9) })),
  async (c) => {
    const userID = Number(c.req.query("userID")); // TODO - read from cookie/jwt
    const { selection } = c.req.valid("json");

    try {
      const game = await db.transaction(async (txn) => {
        const move = await MoveService.makeMove(userID, selection, txn);
        return await GameService.getGameDetails(move.gameID, txn);
      });

      setTimeout(() =>
        db.transaction((txn) => GameService.updateGameState(game!.gameID, txn)),
      );
      return c.json(game);
    } catch (err) {
      // return appropriate error
      if (err instanceof NoActiveGameError) {
        return c.json({err: 'no active game'})
      } else if (err instanceof GameNotInProgressError) {
        return c.json({err: 'game not in progress'})
      } else if (err instanceof TurnTimeLimitExceededError) {
        return c.json({err: 'move is late'})
      } else if (err instanceof MoveAlreadyExistsError) {
        return c.json({err: 'move is done'})
      }

      console.error(`Unknown error`, err);
      return c.json({err})
      // throw err;
    }
  },
);

export default {
  port: 3000,
  fetch: app.fetch,
};
