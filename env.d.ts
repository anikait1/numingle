declare module "bun" {
    interface Env {
        SQLITE_DB_FILENAME: string;
        WEBSOCKET_PORT: 3001
    }
}