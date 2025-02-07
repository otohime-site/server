import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { jwk } from "hono/jwk"
import { JwtVariables } from "hono/jwt"
import sql from "./db.js"

const firebaseProjectId = process.env.FIREBASE_ID
if (firebaseProjectId === undefined) {
  throw new Error("Please assign FIREBASE_ID to use /auth")
}

// As we need to support both JWT and long-lived token,
// it is better to be served with a webhook. :(

const app = new Hono<{ Variables: JwtVariables }>()
app.use(
  jwk({
    jwks_uri:
      "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  }),
)
app.get("/", async (c) => {
  const jwtPayload = c.get("jwtPayload")
  if (jwtPayload) {
    // If JWT verification is successful
    const userId = jwtPayload.sub
    if (
      jwtPayload.aud !== firebaseProjectId ||
      jwtPayload.iss !==
        `https://securetoken.google.com/${firebaseProjectId}` ||
      !userId ||
      typeof userId !== "string"
    ) {
      throw new HTTPException(403, { message: "Wrong token" })
    }
    // Create new database entry once logged in
    await sql`INSERT INTO users (id) VALUES (${userId}) ON CONFLICT DO NOTHING`
    return c.json({
      "X-Hasura-User-Id": userId,
      "X-Hasura-Role": "user",
    })
  }
  const authHeader = c.req.header("Authorization")
  // Allow anonymous access
  if (!authHeader) {
    return c.json({
      "X-Hasura-Role": "anonymous",
    })
  }
  // Switch to test long-lived token
  const authVal = authHeader.trim().split(" ")
  if (
    authVal.length !== 2 ||
    !/^Bearer$/i.test(authVal[0]) ||
    /[^0-9a-z]/i.test(authVal[1])
  ) {
    throw new HTTPException(401, { message: "Bad Auth" })
  }
  const results = await sql<
    { id: string; user_id: string }[]
  >`SELECT id, user_id FROM tokens WHERE id = ${authVal[1]};`
  if (results.length === 0) {
    throw new HTTPException(401, { message: "Bad Token" })
  }
  return c.json({
    "X-Hasura-User-Id": results[0].user_id,
    "X-Hasura-Role": "importer",
  })
})

export default app
