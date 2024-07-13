import { bodyParser } from "@koa/bodyparser"
import Router from "koa-router"
import pool from "./db.js"

const router = new Router()
router.use(bodyParser())
router.use(async (ctx, next) => {
  try {
    await next()
  } catch (err: any) {
    ctx.status = err.status || err.statusCode || 500
    ctx.body = { message: err.message }
    ctx.app.emit("error", err, ctx)
  }
})

interface TokenTransferPayload {
  action: { name: string }
  input: { token: string }
  request_query: string
  session_variables: {
    "x-hasura-user-id"?: string
  }
}

router.post("/", async (ctx, next) => {
  const body: TokenTransferPayload = ctx.request.body
  const client = await pool.connect()
  await client.query("BEGIN")
  try {
    const newUserId = body.session_variables["x-hasura-user-id"]
    if (!newUserId) {
      ctx.throw(400, "not_allowed")
      return // make TypeScript understands
    }
    const validToken = /^[0-9a-f]{32}$/
    if (!validToken.test(body.input.token)) {
      ctx.throw(400, body.input.token)
    }
    const res = await client.query(
      "SELECT id, user_id FROM tokens WHERE id = $1 AND user_id != $2;",
      [body.input.token, newUserId],
    )
    if (res.rowCount === 0) {
      ctx.throw(400, "bad_token")
    }
    const oldToken = res.rows[0].id
    const oldUserId = res.rows[0].user_id
    const countRes = await client.query(
      `
      SELECT (
          SELECT COUNT(*) FROM dx_intl_players WHERE user_id = $1
        ) AS dx_intl_players_count,
        (
          SELECT count(*) FROM finale_players WHERE user_id = $1
        ) AS finale_players_count
      `,
      [oldUserId],
    )
    // Abandon the old token and generate a new one instead.
    try {
      await client.query(
        `
        INSERT INTO token_transfers (token_id, old_user_id, new_user_id)
        VALUES ($1, $2, $3);
      `,
        [oldToken, oldUserId, newUserId],
      )
    } catch (e: any) {
      ctx.throw(400, "transfer_used")
    }
    await client.query(
      `UPDATE dx_intl_players SET user_id = $1 WHERE user_id = $2;`,
      [newUserId, oldUserId],
    )
    await client.query(
      `UPDATE finale_players SET user_id = $1 WHERE user_id = $2;`,
      [newUserId, oldUserId],
    )

    const tokenResult = await client.query(
      `
      INSERT INTO tokens (user_id) values ($1) ON CONFLICT (user_id) 
      DO UPDATE SET id = gen_random_uuid() RETURNING id;
      `,
      [newUserId],
    )
    await client.query("COMMIT")
    ctx.body = {
      token: tokenResult.rows[0].id,
      dx_intl_players_count: parseInt(
        countRes.rows[0].dx_intl_players_count,
        10,
      ),
      finale_players_count: parseInt(countRes.rows[0].finale_players_count, 10),
    }
  } catch (e) {
    await client.query("ROLLBACK")
    throw e
  } finally {
    client.release()
  }
})

export default router
