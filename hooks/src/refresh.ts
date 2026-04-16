import { Hono } from "hono"
import sql from "./db.js"

const app = new Hono()

app.post("/", async (c) => {
  await sql.begin(async (tx) => {
    await tx`REFRESH MATERIALIZED VIEW CONCURRENTLY dx_intl_scores_stats;`
    await tx`REFRESH MATERIALIZED VIEW CONCURRENTLY dx_intl_scores_rates;`
  })
  return c.text("ok!")
})

export default app
