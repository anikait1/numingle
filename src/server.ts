import type { ServerWebSocket } from "bun";
import { Hono } from "hono";
import { createBunWebSocket } from 'hono/bun';
import type { WSContext } from "hono/ws";
import { addUser, createGame, GameStatus, InProgressGames, WaitingGames } from "./app";

// Create WebSocket utilities
const { upgradeWebSocket, websocket } = createBunWebSocket();

// Initialize Hono app
const app = new Hono();

// Define WebSocket types
type WebSocketData = {
  gameID: number;
  userID: number;
};

app.get('/', upgradeWebSocket((c) => {
  return {
    onOpen(_, ws) {
      try {
        const userID = Number(c.req.query('userID'));
        
        if (isNaN(userID)) {
          ws.send(JSON.stringify({ error: 'Invalid userID provided' }));
          return;
        }

        // Find existing game or create new one
        const game = InProgressGames.find(game => game.users.has(userID)) ?? 
          addUser(createGame(), userID);

        const socket = ws.raw as ServerWebSocket<WebSocketData>;
        socket.data = {
          gameID: game.id,
          userID
        };

        const gameTopic = `game-${game.id}`;
        socket.subscribe(gameTopic);
        socket.send(JSON.stringify(game));

      } catch (error) {
        console.error('Error in WebSocket connection:', error);
        ws.send(JSON.stringify({ error: 'Failed to initialize game connection' }));
      }
    },

    onMessage(message, ws) {
      try {
        const data = message.toString();
        console.log('Received message:', data);
        ws.send('Message received');
      } catch (error) {
        console.error('Error processing message:', error);
        ws.send(JSON.stringify({ error: 'Failed to process message' }));
      }
    },

    onClose(_, ws) {
      const socket = ws.raw as ServerWebSocket<WebSocketData>;
      console.log(`User ${socket.data?.userID} disconnected from game ${socket.data?.gameID}`);
    }
  };
}));

export default {
  port: 3000,
  fetch: app.fetch,
  websocket
};