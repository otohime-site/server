import Router from "koa-router"
import pool from "./db.js"
const router = new Router()

router.post("/", async (ctx, next) => {
  const client = await pool.connect()
  await client.query("BEGIN")
  try {
    await client.query(`
      SELECT periods.drop_system_versioning('dx_intl_records');
      SELECT periods.drop_system_versioning('dx_intl_scores');
      GRANT DELETE ON TABLE dx_intl_records_history TO CURRENT_USER;
      GRANT DELETE ON TABLE dx_intl_scores_history TO CURRENT_USER;
      DELETE FROM dx_intl_records_history WHERE player_id NOT IN (SELECT id FROM dx_intl_players);
      DELETE FROM dx_intl_scores_history WHERE player_id  NOT IN (SELECT id FROM dx_intl_players);
      SELECT periods.add_system_versioning('dx_intl_records');
      SELECT periods.add_system_versioning('dx_intl_scores');
      COMMIT;
    `)
  } catch (e) {
    await client.query("ROLLBACK")
    throw e
  } finally {
    client.release()
  }
  ctx.body = "ok!"
})

export default router
