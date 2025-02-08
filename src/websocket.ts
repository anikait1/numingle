import { parse } from "valibot";
import { GameEventSchema, type GameEvent } from "./game/schema";
import {
  BROADCASE_EVENT,
  DUPLICATE_EVENT,
  EVENT_BUS,
  handleEvent,
} from "./game";
import { db } from "./database/db";
import { file } from "bun";

type WebSocketData = {
  connectionID: string;
  userID: number;
  gameID: number;
};

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
    },
    message(ws, message) {
      try {
        console.log("Raw Event", { message, data: ws.data });
        const rawMessage = JSON.parse(message.toString());
        const event: GameEvent = parse(GameEventSchema, rawMessage);

        const duplicateEvent = db.transaction((txn) =>
          handleEvent(txn, ws.data.gameID, event),
        );
        if (duplicateEvent) {
          console.log("[Duplicate Event]", { event });
        }
      } catch (err) {
        console.error("Something went wrong err", err);
      }
    },
    close(ws, code, reason) {},
  },
});

console.log(`Websocket server running on port: ${websocketServer.port}`);
EVENT_BUS.on(
  BROADCASE_EVENT,
  function broadcastEvent(payload: { gameID: number; event: GameEvent }) {
    const data = JSON.stringify(payload.event);

    websocketServer.publish(`game-id-${payload.gameID}`, data);
  },
);
