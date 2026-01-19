import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import sql from "./db.js"

const app = new Hono()

interface TokenTransferPayload {
  action: { name: string }
  input: { token: string }
  request_query: string
  session_variables: {
    "x-hasura-user-id"?: string
  }
}

app.post("/", async (c) => {
  const body = await c.req.json<TokenTransferPayload>()
  const newUserId = body.session_variables["x-hasura-user-id"]
  if (!newUserId) {
    throw new HTTPException(400, { message: "not_allowed" })
  }
  const validToken = /^[0-9a-f]{32}$/
  if (!validToken.test(body.input.token)) {
    throw new HTTPException(400, { message: "bad_token" })
  }
  await sql.begin(async (tx) => {
    // @ts-expect-error https://github.com/porsager/postgres/issues/1143
    const results = await tx<
      { id: string; user_id: string }[]
    >`SELECT id, user_id FROM tokens WHERE id = ${body.input.token} AND user_id != ${newUserId};`
    if (results.length === 0) {
      throw new HTTPException(400, { message: "bad_token" })
    }
    const oldToken = results[0].id
    const oldUserId = results[0].user_id
    // @ts-expect-error https://github.com/porsager/postgres/issues/1143
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
      // @ts-expect-error https://github.com/porsager/postgres/issues/1143
      await tx`
        INSERT INTO token_transfers (token_id, old_user_id, new_user_id)
        VALUES (${oldToken}, ${oldUserId}, ${newUserId});
      `
    } catch {
      throw new HTTPException(400, { message: "transfer_used" })
    }
    // @ts-expect-error https://github.com/porsager/postgres/issues/1143
    await tx`UPDATE dx_intl_players SET user_id = ${newUserId} WHERE user_id = ${oldUserId};`
    // @ts-expect-error https://github.com/porsager/postgres/issues/1143
    await tx`UPDATE finale_players SET user_id = ${newUserId} WHERE user_id = ${oldUserId};`

    // @ts-expect-error https://github.com/porsager/postgres/issues/1143
    const tokenResult = await tx`
      INSERT INTO tokens (user_id) values (${newUserId}) ON CONFLICT (user_id) 
      DO UPDATE SET id = gen_random_uuid() RETURNING id;
      `
    return c.json({
      token: tokenResult[0].id,
      dx_intl_players_count: parseInt(countRes[0].dx_intl_players_count, 10),
      finale_players_count: parseInt(countRes[0].finale_players_count, 10),
    })
  })
})

export default app
