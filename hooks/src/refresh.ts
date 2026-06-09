import { Hono } from "hono"
import sql from "./db.ts"

const app = new Hono()

app.post("/", async (c) => {
  await sql.begin(async (tx) => {
    await tx`REFRESH MATERIALIZED VIEW CONCURRENTLY dx_intl_scores_stats;`
    await tx`REFRESH MATERIALIZED VIEW CONCURRENTLY dx_intl_scores_rates;`
    await tx`REFRESH MATERIALIZED VIEW CONCURRENTLY dx_intl_rating_target_stats;`
  })
  return c.text("ok!")
})

export default app
