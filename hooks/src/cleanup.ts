import { Hono } from "hono"
import sql from "./db.js"

const app = new Hono()

app.post("/", async (c) => {
  await sql.begin(async (tx) => {
    // Use `simple()` to allow multiple statements
    // @ts-expect-error https://github.com/porsager/postgres/issues/1143
    await tx`
      SELECT periods.drop_system_versioning('dx_intl_records');
      SELECT periods.drop_system_versioning('dx_intl_scores');
      GRANT DELETE ON TABLE dx_intl_records_history TO CURRENT_USER;
      GRANT DELETE ON TABLE dx_intl_scores_history TO CURRENT_USER;
      DELETE FROM dx_intl_records_history WHERE player_id NOT IN (SELECT id FROM dx_intl_players);
      DELETE FROM dx_intl_scores_history WHERE player_id  NOT IN (SELECT id FROM dx_intl_players);
      SELECT periods.add_system_versioning('dx_intl_records');
      SELECT periods.add_system_versioning('dx_intl_scores');
    `.simple()
  })
  return c.text("ok!")
})

app.post("/daily", async (c) => {
  const resultCron = await sql`
    DELETE FROM hdb_catalog.hdb_cron_events
    WHERE status IN ('delivered', 'error', 'dead')
    AND scheduled_time < now() - interval '3 months';
  `
  console.log(`hdb_cron_events: ${resultCron.length} rows affected `)
  const resultTransfers = await sql`
    DELETE FROM token_transfers
    WHERE created_at < now() - interval '3 months';
  `
  console.log(`token_transfers: ${resultTransfers.length} rows affected `)
  return c.json({
    affected: {
      cron: resultCron.length,
      transfers: resultTransfers.length,
    },
  })
})

export default app
