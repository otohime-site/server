import Router from "koa-router"
import sql from "./db.js"

const router = new Router()

router.post("/", async (ctx) => {
  await sql.begin(async (tx) => {
    await tx`REFRESH MATERIALIZED VIEW CONCURRENTLY dx_intl_scores_stats;`
    await tx`REFRESH MATERIALIZED VIEW CONCURRENTLY dx_intl_scores_rates;`
  })
  ctx.body = "ok!"
})

export default router
