type WebSocketData = {
  connectionID: string;
  userID: number;
  gameID: number;
};

const websocketServer = Bun.serve<WebSocketData>({
  port: 3001,
  async fetch(req, server) {
    const url = new URL(req.url);
    // TODO - use valibot or zod for parsing and fetch the userID from headers
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
    async open(ws) {},
    message(ws, message) {
      if (typeof message !== "string") message = message.toString();

      const data = JSON.parse(message);
      switch (data.type) {
        case "turn": {
          const payload = data.payload;
          const game = data.game;
        }
      }
    },
    close(ws, code, reason) {},
  },
});

console.log(`Websocket server running on port: ${websocketServer.port}`);
