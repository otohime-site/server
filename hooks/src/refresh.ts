import { Hono } from "hono"
import sql from "./db.js"

const app = new Hono()

app.post("/", async (c) => {
  await sql.begin(async (tx) => {
    // @ts-expect-error https://github.com/porsager/postgres/issues/1143
    await tx`REFRESH MATERIALIZED VIEW CONCURRENTLY dx_intl_scores_stats;`
    // @ts-expect-error https://github.com/porsager/postgres/issues/1143
    await tx`REFRESH MATERIALIZED VIEW CONCURRENTLY dx_intl_scores_rates;`
  })
  return c.text("ok!")
})

export default app
