// Run every GraphQL query found in otohime-web against two Hasura endpoints
// (old DB + current metadata, new DB + renamed metadata) and compare responses.
// The web sources are only READ as text; nothing from that repo is executed.
//
//   OLD_URL=http://localhost:8580 NEW_URL=http://localhost:8590 ADMIN_SECRET=... \
//   FIXTURES='{"nickname":"someplayer","userId":"<firebase uid>","songId":"<sha>"}' \
//   node scripts/pg19-upgrade/web-compare.mjs ~/git/otohime-web/src
//
// Queries only; mutations are listed but not run (point a mutation test at copies).
// Output: same | ORDR (same rows, different order; the query has no order_by) | DIFF
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const [root] = process.argv.slice(2)
const { OLD_URL, NEW_URL, ADMIN_SECRET } = process.env
if (!root || !OLD_URL || !NEW_URL || !ADMIN_SECRET) {
  console.error("usage: OLD_URL=… NEW_URL=… ADMIN_SECRET=… [FIXTURES=json] node web-compare.mjs <otohime-web/src>")
  process.exit(2)
}
const fixtures = {
  nickname: "player", userId: "user", nickname_like: "%a%", ratingTarget: 15000,
  rating_target: 15000, songId: "", pk: 0, private: false,
  ...JSON.parse(process.env.FIXTURES ?? "{}"),
}
// new-schema names; responses from NEW are mapped back before comparing
const toNew = (s) => s.replace(/\b(dx_intl|finale)_notes\b/g, "$1_charts").replace(/\b(dx_intl|finale)_note\b/g, "$1_chart")
const toOld = (s) => s.replace(/\b(dx_intl|finale)_charts\b/g, "$1_notes").replace(/\b(dx_intl|finale)_chart\b/g, "$1_note")

// --- extract documents -------------------------------------------------------
const files = []
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(ts|tsx)$/.test(p) && !p.endsWith("graphql-env.d.ts")) files.push(p)
  }
}
walk(root)
const docs = files.flatMap((f) =>
  [...readFileSync(f, "utf8").matchAll(/graphql\(\s*`([\s\S]*?)`/g)].map((m) => m[1].trim()))
const fragments = {}
for (const d of docs) for (const m of d.matchAll(/fragment\s+(\w+)\s+on\s+\w+\s*\{/g)) fragments[m[1]] = d
const ops = []
for (const d of docs) {
  const m = d.match(/^(query|mutation)\s+(\w+)\s*(\(([^)]*)\))?/)
  if (!m) continue
  const need = new Set(), queue = [d]
  while (queue.length)
    for (const s of queue.pop().matchAll(/\.\.\.(\w+)/g))
      if (!need.has(s[1])) { need.add(s[1]); queue.push(fragments[s[1]]) }
  ops.push({
    kind: m[1], name: m[2],
    vars: [...(m[4] ?? "").matchAll(/\$(\w+)\s*:/g)].map((v) => v[1]),
    query: [d, ...[...need].map((n) => fragments[n])].join("\n"),
  })
}

// --- run -----------------------------------------------------------------------
const gql = async (url, role, query, variables) => {
  const r = await fetch(`${url}/v1/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-hasura-admin-secret": ADMIN_SECRET,
      "x-hasura-role": role, "x-hasura-user-id": fixtures.userId },
    body: JSON.stringify({ query, variables }),
  })
  return r.text()
}
const canon = (v) => Array.isArray(v)
  ? v.map(canon).map((x) => JSON.stringify(x)).sort().map((x) => JSON.parse(x))
  : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v
const parse = (s) => { try { return JSON.parse(s) } catch { return undefined } }
const summary = (s) => {
  const j = parse(s)
  if (j === undefined) return `not JSON: ${s.slice(0, 70)}`
  return j.errors ? `error: ${j.errors[0].message.slice(0, 70)}` : `${s.length} bytes`
}

let n = 0, bad = 0
for (const op of ops) {
  if (op.kind === "mutation") { console.log(`skip  ${op.name} (mutation)`); continue }
  const varSets = []
  if (op.vars.includes("time")) {
    const prefix = op.name.startsWith("finale") ? "finale" : "dx_intl"
    const tl = parse(await gql(OLD_URL, "anonymous",
      `query($n:String!){ t: ${prefix}_players_timelines(where:{nickname:{_eq:$n}}){ timelines } }`, { n: fixtures.nickname }))
    for (const time of tl?.data?.t?.[0]?.timelines?.slice(0, 5) ?? []) varSets.push({ ...fixtures, time })
  } else varSets.push(fixtures)
  for (const role of ["anonymous", "user"]) for (const vs of varSets) {
    const variables = Object.fromEntries(op.vars.map((v) => [v, vs[v]]))
    const o = await gql(OLD_URL, role, op.query, variables)
    const w = toOld(await gql(NEW_URL, role, toNew(op.query), variables))
    n++
    const same = o === w
    const [po, pw] = [parse(o), parse(w)]
    const ordr = !same && po !== undefined && pw !== undefined
      && JSON.stringify(canon(po)) === JSON.stringify(canon(pw))
    if (!same && !ordr) bad++
    console.log(`${same ? "same" : ordr ? "ORDR" : "DIFF"}  ${op.name.padEnd(34)} ${role.padEnd(9)} ${summary(o)}${same ? "" : `  | new: ${summary(w)}`}`)
  }
}
console.log(`${n} calls, ${bad} with different content`)
// Known: dxIntlRatingTargetStats may DIFF because dx_intl_rating_target_stats breaks
// ties at its top-15/35 cutoff arbitrarily (the old database does the same between refreshes).
process.exit(bad ? 1 : 0)
