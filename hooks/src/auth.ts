import jwksRsa from "jwks-rsa"
import jwt from "koa-jwt"
import Router from "koa-router"
import sql from "./db.js"

const firebaseProjectId = process.env.FIREBASE_ID
if (firebaseProjectId === undefined) {
  throw new Error("Please assign FIREBASE_ID to use /auth")
}

// As we need to support both JWT and long-lived token,
// it is better to be served with a webhook. :(

const router = new Router()
router.use(
  jwt({
    secret: jwksRsa.koaJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 2,
      jwksUri:
        "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
    }),
    audience: firebaseProjectId,
    issuer: `https://securetoken.google.com/${firebaseProjectId}`,
    passthrough: true,
  }),
)
router.get("/", async (ctx, next) => {
  if ("user" in ctx.state) {
    // If JWT verification is successful
    const userId = ctx.state?.user?.sub ?? ""
    if (userId.length === 0) {
      ctx.throw(403, "Wrong token")
    }
    ctx.body = {
      "X-Hasura-User-Id": userId,
      "X-Hasura-Role": "user",
    }
    // Create new database entry once logged in
    await sql`INSERT INTO users (id) VALUES (${userId}) ON CONFLICT DO NOTHING`
    return await next()
  }
  // Allow anonymous access
  if (!("authorization" in ctx.header)) {
    ctx.body = {
      "X-Hasura-Role": "anonymous",
    }
    return
  }
  // Switch to test long-lived token
  const authVal = (ctx.header.authorization ?? "").trim().split(" ")
  if (
    authVal.length !== 2 ||
    !/^Bearer$/i.test(authVal[0]) ||
    /[^0-9a-z]/i.test(authVal[1])
  ) {
    ctx.throw(401, "Bad Auth")
  }
  const results = await sql<
    { id: string; user_id: string }[]
  >`SELECT id, user_id FROM tokens WHERE id = ${authVal[1]};`
  if (results.length === 0) {
    ctx.throw(401, "Bad Token")
  }
  ctx.body = {
    "X-Hasura-User-Id": results[0].user_id,
    "X-Hasura-Role": "importer",
  }
})

export default router
