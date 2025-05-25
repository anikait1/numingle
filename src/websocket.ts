import { parse } from "valibot";
import { db } from "./database/db";
import { file, type ServerWebSocket } from "bun";
import {
  GameNotificationType,
  PlayerTurnEventSchema,
  type PlayerTurnEvent,
} from "./game/events";
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

      const game = db.transaction((txn) => {
        const currentGameState = Game.getGame(ws.data.gameID, txn);
        return currentGameState;
      });

      // TODO - handle the game not found case
      if (game.status === Game.GameStatus.STALE) {
        ws.close(4000, "game not found");
        return;
      }

      /** Subscribe the user to the game room */
      ws.subscribe(`game-id-${ws.data.gameID}`);

      /** store a reference for the connection against the user's id */
      connections.set(ws.data.userID, ws);

      const clientBroadcastPayload = {
        game,
        notifications: [],
      };

      ws.send(JSON.stringify(clientBroadcastPayload));
    },
    message(ws, message) {
      try {
        const rawMessage = JSON.parse(message.toString());
        const event: PlayerTurnEvent = parse(PlayerTurnEventSchema, rawMessage);

        const { game, notifications } = db.transaction((txn) => {
          const currentGameState = Game.getGame(ws.data.gameID, txn);
          const updatedGameState = Game.handlePlayerTurnEvent(
            currentGameState,
            event,
            txn
          );
          return updatedGameState;
        });

        console.log('server sent notifications', {
          notifications,
          gameID: game.id,
          connection: ws.data
        })

        /**
         * since no game state has taken place, we can just notify the user who made a
         * move about their move being recorded
         */
        if (notifications.length === 0) {
          const connection = connections.get(event.data.player_id);
          if (!connection) {
            console.error("Player got disconnected", {
              gameID: game.id,
              playerID: event.data.player_id,
            });

            return;
          }

          connection.send(
            JSON.stringify({
              game,
              notifications: [],
            })
          );
          return;
        }

        /**
         * At this point, two possible situations can exist
         * 1. Turn has progressed, notify the users individually
         * 2. Game has finished, broadcast the notifications to everyone
         */

        switch (game.status) {
          /** broadcast the notification */
          case Game.GameStatus.FINISHED: {
            websocketServer.publish(
              `game-id-${game.id}`,
              JSON.stringify({
                game,
                notifications,
              })
            );

            break;
          }
          /**
           * Notifications would have an entry for each player, safe to iterate
           * and send the updated game state
           */
          case Game.GameStatus.STARTED: {
            for (const notification of notifications) {
              if (notification.type !== GameNotificationType.TURN_STARTED)
                continue;

              const connection = connections.get(notification.data.player_id);
              if (!connection) {
                console.log(
                  "Connection not found, failed to deliver notification",
                  {
                    gameID: game.id,
                    playerID: notification.data.player_id,
                    notification,
                  }
                );

                continue;
              }

              connection.send(
                JSON.stringify({
                  game,
                  notifications: [notification],
                })
              );
            }

            break;
          }
        }
      } catch (err) {
        console.log("Error occured while processing event", {
          message,
          data: ws.data,
        });

        console.dir(
          db.transaction((txn) => Game.getGame(ws.data.gameID, txn)),
          { depth: null }
        );
        console.dir(err, { depth: null });
      }
    },
    close(ws, code, reason) {},
  },
});

console.log(`Websocket server running on port: ${websocketServer.port}`);
