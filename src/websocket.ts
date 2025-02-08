import { parse } from "valibot";
import { GameEventSchema, GameEventType, type GameEvent } from "./game/schema";
import {
  BROADCAST_EVENT,
  DIRECT_EVENT,
  DUPLICATE_EVENT,
  EVENT_BUS,
  handleEvent,
} from "./game";
import { db } from "./database/db";
import { file, type ServerWebSocket } from "bun";

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
  BROADCAST_EVENT,
  function broadcastEvent(payload: { gameID: number; event: GameEvent }) {
    const data = JSON.stringify(payload.event);
    websocketServer.publish(`game-id-${payload.gameID}`, data);
  },
);

EVENT_BUS.on(
  DIRECT_EVENT,
  function sendDirectEvent(payload: {
    gameID: number;
    event: GameEvent;
    userID: number;
  }) {
    switch (payload.event.type) {
      case GameEventType.TURN_STARTED: {
        const playerIDs = Object.keys(
          payload.event.data.unavailable_selections,
        );
        for (const playerID of playerIDs) {
          const playerWS = connections.get(Number(playerID));
          if (!playerWS) {
            console.log("[DISCONNECTED]", { playerID, payload });
            connections.delete(Number(playerID));
            continue;
          }

          const playerEvent = {
            ...payload.event,
            data: {
              ...payload.event.data,
              unavailable_selections: {
                [playerID]: payload.event.data.unavailable_selections[playerID],
              },
            },
          };

          playerWS.send(JSON.stringify(playerEvent));
        }
        return;
      }
    }

    console.log("[NOT CONFIGURED]", payload);
  },
);
