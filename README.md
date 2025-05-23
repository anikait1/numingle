# Numingle

A multiplayer number game where players take turns selecting numbers from 1-9. If players select different numbers, they score points and continue playing. If they select the same number, the game ends.

## Game Rules

1. Each turn, players select a number from 1-9
2. Some numbers will be unavailable each turn (shown as disabled)
3. If players select different numbers, the number value is added to their score
4. If players select the same number, the game ends
5. The player with the highest score at the end wins

## Setup and Running

### Prerequisites

- [Bun](https://bun.sh/) - Fast JavaScript runtime and package manager

### Installation

```bash
# Install dependencies
bun install

# Generate database migrations
bun run generate-migration

# Run migrations
bun run migrate
```

### Running the Application

```bash
bun run src/server.ts
```

Then open your browser to [http://localhost:3000](http://localhost:3000)

## How to Play

1. First player creates a game and receives a join code
2. Second player uses the join code to join the game
3. First player clicks "Start Game" when both players have joined
4. Players take turns selecting numbers
5. Game continues until players select the same number or all numbers have been played

## Technologies Used

- Bun - JavaScript runtime
- Hono - Lightweight web framework
- Drizzle ORM - Database toolkit
- WebSockets - Real-time communication
- SQLite - Database