import assert from "node:assert/strict"
import { beforeEach, mock, test } from "node:test"

const OLD_TOKEN = "0123456789abcdef0123456789abcdef"

let queries: string[] = []
let params: unknown[][] = []
let tokenRows: { id: string; user_id: string }[] = []
let transferUsed = false
let dbDown = false

const tx = async (strings: TemplateStringsArray, ...values: unknown[]) => {
  const query = strings.join("?")
  queries.push(query)
  params.push(values)
  if (dbDown) throw new Error("connect ECONNREFUSED")
  if (query.includes("FROM tokens")) return tokenRows
  if (query.includes("dx_intl_players_count")) {
    return [{ dx_intl_players_count: "2", finale_players_count: "1" }]
  }
  if (query.includes("INSERT INTO token_transfers") && transferUsed) {
    throw new Error("duplicate key value violates unique constraint")
  }
  if (query.includes("INSERT INTO tokens")) return [{ id: "new-token" }]
  return []
}

mock.module(import.meta.resolve("../src/db.ts"), {
  exports: {
    default: {
      begin: async <T>(callback: (t: typeof tx) => Promise<T>) => callback(tx),
    },
  },
})

const { default: app } = await import("../src/token-transfer.ts")

const transfer = (token: string, userId?: string) =>
  app.request("/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: { name: "tokenTransfer" },
      input: { token },
      request_query: "",
      session_variables: userId ? { "x-hasura-user-id": userId } : {},
    }),
  })

const writes = () => queries.filter((q) => /^\s*(INSERT|UPDATE)/.test(q))

const paramsOf = (pattern: string) =>
  params.filter((_, i) => queries[i].includes(pattern))

beforeEach(() => {
  queries = []
  params = []
  tokenRows = [{ id: OLD_TOKEN, user_id: "old-user" }]
  transferUsed = false
  dbDown = false
})

test("returns the new token and transferred counts", async () => {
  const resp = await transfer(OLD_TOKEN, "new-user")

  assert.equal(resp.status, 200)
  assert.deepEqual(await resp.json(), {
    token: "new-token",
    dx_intl_players_count: 2,
    finale_players_count: 1,
  })
  assert.equal(writes().length, 4)
  assert.deepEqual(paramsOf("INSERT INTO token_transfers"), [
    [OLD_TOKEN, "old-user", "new-user"],
  ])
  assert.deepEqual(paramsOf("UPDATE dx_intl_players"), [
    ["new-user", "old-user"],
  ])
  assert.deepEqual(paramsOf("UPDATE finale_players"), [
    ["new-user", "old-user"],
  ])
  assert.deepEqual(paramsOf("INSERT INTO tokens"), [["new-user"]])
})

test("rejects a request without a user", async () => {
  const resp = await transfer(OLD_TOKEN)

  assert.equal(resp.status, 400)
  assert.deepEqual(await resp.json(), { message: "not_allowed" })
  assert.deepEqual(queries, [])
})

test("rejects a malformed token before querying", async () => {
  const resp = await transfer("x", "new-user")

  assert.equal(resp.status, 400)
  assert.deepEqual(await resp.json(), { message: "bad_token" })
  assert.deepEqual(queries, [])
})

test("rejects an unknown token without writing", async () => {
  tokenRows = []
  const resp = await transfer(OLD_TOKEN, "new-user")

  assert.equal(resp.status, 400)
  assert.deepEqual(await resp.json(), { message: "bad_token" })
  assert.deepEqual(writes(), [])
})

test("rejects a token that was already transferred", async () => {
  transferUsed = true
  const resp = await transfer(OLD_TOKEN, "new-user")

  assert.equal(resp.status, 400)
  assert.deepEqual(await resp.json(), { message: "transfer_used" })
  assert.deepEqual(paramsOf("UPDATE"), [])
})

test("reports unexpected errors as JSON", async (t) => {
  t.mock.method(console, "error", () => {})
  dbDown = true
  const resp = await transfer(OLD_TOKEN, "new-user")

  assert.equal(resp.status, 500)
  assert.deepEqual(await resp.json(), { message: "internal_error" })
})
