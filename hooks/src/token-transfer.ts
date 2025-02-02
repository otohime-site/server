import { bodyParser } from "@koa/bodyparser"
import Router from "koa-router"
import sql from "./db.js"

const router = new Router()
router.use(bodyParser())
router.use(async (ctx, next) => {
  try {
    await next()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

router.post("/", async (ctx) => {
  const body: TokenTransferPayload = ctx.request.body
  const newUserId = body.session_variables["x-hasura-user-id"]
  if (!newUserId) {
    ctx.throw(400, "not_allowed")
    return // make TypeScript understands
  }
  const validToken = /^[0-9a-f]{32}$/
  if (!validToken.test(body.input.token)) {
    ctx.throw(400, "bad_token")
  }
  await sql.begin(async (tx) => {
    const results = await tx<
      { id: string; user_id: string }[]
    >`SELECT id, user_id FROM tokens WHERE id = ${body.input.token} AND user_id != ${newUserId};`
    if (results.length === 0) {
      ctx.throw(400, "bad_token")
    }
    const oldToken = results[0].id
    const oldUserId = results[0].user_id
    const countRes = await tx`
      SELECT (
          SELECT COUNT(*) FROM dx_intl_players WHERE user_id = ${oldUserId}
        ) AS dx_intl_players_count,
        (
          SELECT count(*) FROM finale_players WHERE user_id = ${oldUserId}
        ) AS finale_players_count
      `
    // Abandon the old token and generate a new one instead.
    try {
      await tx`
        INSERT INTO token_transfers (token_id, old_user_id, new_user_id)
        VALUES (${oldToken}, ${oldUserId}, ${newUserId});
      `
    } catch {
      ctx.throw(400, "transfer_used")
    }
    await tx`UPDATE dx_intl_players SET user_id = ${newUserId} WHERE user_id = ${oldUserId};`
    await tx`UPDATE finale_players SET user_id = ${newUserId} WHERE user_id = ${oldUserId};`

    const tokenResult = await tx`
      INSERT INTO tokens (user_id) values (${newUserId}) ON CONFLICT (user_id) 
      DO UPDATE SET id = gen_random_uuid() RETURNING id;
      `
    ctx.body = {
      token: tokenResult[0].id,
      dx_intl_players_count: parseInt(countRes[0].dx_intl_players_count, 10),
      finale_players_count: parseInt(countRes[0].finale_players_count, 10),
    }
  })
})

export default router
