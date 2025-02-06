# numingle

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.2.1. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.


## Migrations

To generate the migration file
```bash
bunx drizzle-kit generate --dialect sqlite --schema ./src/database/schema.ts
```

To run the migration
```bash
bun run src/database/migrate.ts
```