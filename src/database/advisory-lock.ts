import { sql } from "drizzle-orm";
import { DbTransaction } from "./db";

type PgAvisoryXactLock = {
  pg_try_advisory_xact_lock: boolean;
};

export async function acquireTxnScopeAdvisoryLock(
  key: number,
  txn: DbTransaction
): Promise<boolean> {
  const [{ pg_try_advisory_xact_lock }] = await txn.execute<PgAvisoryXactLock>(
    sql`select pg_try_advisory_xact_lock(${key})`
  );
  return pg_try_advisory_xact_lock
}