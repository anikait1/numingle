import { db } from "./src/database/db";
import { getGame } from "./src/game";

db.transaction(txn => {
    const game = getGame(5096, txn);
    console.log(game)
})