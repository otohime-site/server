import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { JwtVariables } from "hono/jwt"
import { createRemoteJWKSet, jwtVerify } from "jose"
import sql from "./db.js"

const firebaseProjectId = process.env.FIREBASE_ID
if (firebaseProjectId === undefined) {
  throw new Error("Please assign FIREBASE_ID to use /auth")
}

// As we need to support both JWT and long-lived token,
// it is better to be served with a webhook. :(
// Also jose is used as JWK support in Hono does not implement key caches.

const JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
)

const app = new Hono<{ Variables: JwtVariables }>()

app.get("/", async (c) => {
  const authHeader = c.req.raw.headers.get("Authorization")
  // Allow anonymous access
  if (!authHeader) {
    return c.json({
      "X-Hasura-Role": "anonymous",
    })
  }
  const authVal = authHeader.trim().split(" ")
  if (authVal.length !== 2 || !/^Bearer$/i.test(authVal[0])) {
    throw new HTTPException(401, { message: "Bad Auth" })
  }
  // There may be two token: JWT and long-lived token
  // We test for JWT first if pattern matched
  const token = authVal[1]
  if (token.startsWith("eyJ") && token.includes(".")) {
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `https://securetoken.google.com/${firebaseProjectId}`,
        audience: firebaseProjectId,
      })
      // If JWT verification is successful
      const userId = payload.sub
      if (!userId) {
        throw new HTTPException(401, { message: "Bad JWT" })
      }
      // Create new database entry once logged in
      await sql`INSERT INTO users (id) VALUES (${userId}) ON CONFLICT DO NOTHING`
      return c.json({
        "X-Hasura-User-Id": userId,
        "X-Hasura-Role": "user",
      })
    } catch {
      throw new HTTPException(401, { message: "Bad JWT" })
    }
  }
  // Switch to test long-lived token
  if (/[^0-9a-z]/i.test(token)) {
    throw new HTTPException(401, { message: "Bad Auth" })
  }
  const results = await sql<
    { id: string; user_id: string }[]
  >`SELECT id, user_id FROM tokens WHERE id = ${token};`
  if (results.length === 0) {
    throw new HTTPException(401, { message: "Bad Token" })
  }
  return c.json({
    "X-Hasura-User-Id": results[0].user_id,
    "X-Hasura-Role": "importer",
  })
})

export default app
