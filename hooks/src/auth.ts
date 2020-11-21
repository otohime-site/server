import pool from './db'
import Router from 'koa-router'
import jwt from 'koa-jwt'
import jwksRsa from 'jwks-rsa'

const firebaseProjectId = process.env.FIREBASE_ID
if (firebaseProjectId === undefined) {
  console.log('Please assign FIREBASE_ID')
  process.exit(1)
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
      jwksUri: 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
    }),
    audience: firebaseProjectId,
    issuer: `https://securetoken.google.com/${firebaseProjectId}`,
    passthrough: true
  })
)
router.get('/', async (ctx, next) => {
  if ('user' in ctx.state) {
    // If JWT verification is successful
    const userId = ctx.state?.user?.sub ?? ''
    if (userId.length === 0) {
      ctx.throw(403, 'Wrong token')
    }
    ctx.body = {
      'X-Hasura-User-Id': userId,
      'X-Hasura-Role': 'user'
    }
    // Create new database entry once logged in
    await pool.query(
      'INSERT INTO users (id) VALUES ($1) ON CONFLICT DO NOTHING',
      [userId]
    )
    return await next()
  }
  // Allow anonymous access
  if (!('authorization' in ctx.header)) {
    ctx.body = {
      'X-Hasura-Role': 'anonymous'
    }
    return
  }
  // Switch to test long-lived token
  const authVal = (ctx.header.authorization ?? '').trim().split(' ')
  if (authVal.length !== 2 || !/^Bearer$/i.test(authVal[0]) || /[^0-9a-z]/i.test(authVal[1])) {
    ctx.throw(401, 'Bad Auth')
  }
  const res = await pool.query('SELECT id, user_id FROM tokens WHERE id = $1;', [authVal[1]])
  if (res.rowCount === 0) {
    ctx.throw(401, 'Bad Token')
  }
  ctx.body = {
    'X-Hasura-User-Id': res.rows[0].user_id,
    'X-Hasura-Role': 'importer'
  }
})

export default router
