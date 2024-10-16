import Router from "koa-router"
import pool from "./db.js"
const router = new Router()

router.post("/", async (ctx) => {
  const client = await pool.connect()
  await client.query("BEGIN")
  try {
    await client.query(`
      REFRESH MATERIALIZED VIEW CONCURRENTLY dx_intl_scores_stats;
      REFRESH MATERIALIZED VIEW CONCURRENTLY dx_intl_scores_rates;
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
