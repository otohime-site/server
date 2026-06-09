import { serve } from "@hono/node-server"
import { Hono } from "hono"
import authRouter from "./auth.ts"
import cleanupRouter from "./cleanup.ts"
import fetchRouter from "./fetch.ts"
import refreshRouter from "./refresh.ts"
import tokenTransferRouter from "./token-transfer.ts"

const app = new Hono()
app.route("/auth", authRouter)
app.route("/fetch", fetchRouter)
app.route("/cleanup", cleanupRouter)
app.route("/refresh", refreshRouter)
app.route("/token-transfer", tokenTransferRouter)

serve({ fetch: app.fetch, port: 8787 })
