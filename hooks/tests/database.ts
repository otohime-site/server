// Throwaway databases for tests that need a real PostgreSQL.
//
// TEST_DATABASE_URL must point at a superuser on a server built from docker-db/
// (it has the extensions the migrations expect). Without it, database tests are
// skipped, so `pnpm test` still runs everywhere.
//
// Each database is created from migrations/default/*/up.sql in order, one
// transaction per migration (as `hasura migrate apply` does), by a NOSUPERUSER
// owner role like production's: a superuser would bypass the privilege checks
// under test.
import { readdirSync, readFileSync } from "node:fs"
import postgres, { type Sql } from "postgres"

export const adminUrl = process.env.TEST_DATABASE_URL
export const skip = adminUrl ? false : "TEST_DATABASE_URL is not set"

const MIGRATIONS = new URL("../../migrations/default/", import.meta.url)
const quiet = { onnotice: () => {} }

export interface TestDatabase {
  /** Connection as the owner role (what Hasura and hooks use). */
  sql: Sql
  drop: () => Promise<void>
}

export const createDatabase = async (): Promise<TestDatabase> => {
  const name = `otohime_test_${process.pid}_${Date.now()}`
  const password = "test"
  const admin = postgres(adminUrl!, { ...quiet, max: 1 })
  await admin.unsafe(
    `CREATE ROLE ${name} NOSUPERUSER LOGIN PASSWORD '${password}'`,
  )
  await admin.unsafe(`CREATE DATABASE ${name}`)

  // Same setup as docker-db/init.sh.
  const su = postgres(adminUrl!, { ...quiet, max: 1, database: name })
  await su.unsafe(`
    GRANT ALL PRIVILEGES ON DATABASE ${name} TO ${name};
    GRANT USAGE, CREATE ON SCHEMA public TO ${name};
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  `)
  const [{ periods }] = await su`
    SELECT count(*) > 0 AS periods FROM pg_available_extensions WHERE name = 'periods'`
  if (periods) {
    await su.unsafe(
      `CREATE EXTENSION IF NOT EXISTS btree_gist; CREATE EXTENSION IF NOT EXISTS periods;`,
    )
  }
  await su.end()

  const sql = postgres(adminUrl!, {
    ...quiet,
    database: name,
    username: name,
    password,
  })
  const drop = async () => {
    await sql.end()
    await admin.unsafe(`DROP DATABASE ${name} WITH (FORCE)`)
    await admin.unsafe(`DROP ROLE ${name}`)
    await admin.end()
  }
  for (const dir of readdirSync(MIGRATIONS).sort()) {
    const text = readFileSync(new URL(`${dir}/up.sql`, MIGRATIONS), "utf8")
    try {
      await sql.begin((tx) => tx.unsafe(text))
    } catch (e) {
      // Open connections would keep the test process from exiting.
      await drop()
      throw new Error(`migration ${dir} failed: ${(e as Error).message}`, {
        cause: e,
      })
    }
  }

  return { sql, drop }
}
