/**
 * select * from game_user_map where game_id = $1 and user_id = $2
 * select turn_count from moves where game_id = $1 and user_id = $2
 * insert into moves values (turn_count, user_id, game_id, selection)
 */

import Postgres from "postgres";
import { db } from "./database/db";
import { userTable } from "./database/schema";
import { sql } from "drizzle-orm";
import { abandonGame, finishGameDueTurnExpiry, getGameDetails, getOngoingGameForUser, searchGameForUser, updateGameState, updateGameToInProgressQuery, } from "./game/service";

const result = await db.transaction(async txn => {
    return await updateGameState(31, txn);
})

/**
 * are you part of the game?
 * is the game in progress?
 * is there time to make move?
 * has the user already made the move for current turn?
 *
 * insert move -> if insert fails, move already done
 *
 *
 * update the game
 * have both the users made there turn?
 *  -> yes
 *      -> update turnExpiry
 *      -> update current turn
 *      -> is the game finished?
 *
 * merge two waiting games
 * user_id, game_id
 * 1, 2
 * 4, 3
 *
 * delete from active_games where user_id in (1,4)
 * mark the game as merged
 * add a new game
 * update the mapping tables
 */
