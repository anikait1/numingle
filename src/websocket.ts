import { parse } from "valibot";
import { db } from "./database/db";
import { file, type ServerWebSocket } from "bun";
import { PlayerTurnEventSchema, type PlayerTurnEvent } from "./game/events";
import * as Game from "./game/index";

type WebSocketData = {
  connectionID: string;
  userID: number;
  gameID: number;
};

const connections = new Map<number, ServerWebSocket<WebSocketData>>();
const websocketServer = Bun.serve<WebSocketData>({
  port: 3001,
  async fetch(req, server) {
    const url = new URL(req.url);

    // Serve static files for the game UI
    if (
      req.method === "GET" &&
      url.pathname === "/" &&
      req.headers.get("upgrade") !== "websocket"
    ) {
      return new Response(file("public/index.html"));
    }

    // Handle websocket upgrade
    const gameID = Number(url.searchParams.get("gameID"));
    const userID = Number(url.searchParams.get("userID"));

    const success = server.upgrade(req, {
      data: {
        connectionID: Bun.randomUUIDv7("hex"),
        userID,
        gameID,
      },
    });
    return success
      ? undefined
      : new Response("Websocket upgrade failed", { status: 400 });
  },
  websocket: {
    open(ws) {
      console.log(`Connection opened`, ws.data);
      ws.subscribe(`game-id-${ws.data.gameID}`);
      connections.set(ws.data.userID, ws);

      const game = db.transaction(txn => {
        const currentGameState = Game.getGame(ws.data.gameID, txn);
        return currentGameState;
      })

      ws.send(JSON.stringify(game));
    },
    message(ws, message) {
      try {
        
        const rawMessage = JSON.parse(message.toString());
        const event: PlayerTurnEvent = parse(PlayerTurnEventSchema, rawMessage);

        const game = db.transaction(txn => {
          const currentGameState = Game.getGame(ws.data.gameID, txn);
          const updatedGameState = Game.handlePlayerTurnEvent(currentGameState, event, txn);
          return updatedGameState;
        })

        websocketServer.publish(`game-id-${game.id}`, JSON.stringify(game));
        
      } catch (err) {
        console.log("Erro occured while processing event", { message, data: ws.data });
        console.dir(err, { depth: null });
      }
    },
    close(ws, code, reason) {},
  },
});

console.log(`Websocket server running on port: ${websocketServer.port}`);