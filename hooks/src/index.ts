import { serve } from "@hono/node-server"
import { Hono } from "hono"
import authRouter from "./auth.js"
import cleanupRouter from "./cleanup.js"
import fetchRouter from "./fetch.js"
import refreshRouter from "./refresh.js"
import tokenTransferRouter from "./token-transfer.js"

const app = new Hono()
app.route("/auth", authRouter)
app.route("/fetch", fetchRouter)
app.route("/cleanup", cleanupRouter)
app.route("/refresh", refreshRouter)
app.route("/token-transfer", tokenTransferRouter)

serve({ fetch: app.fetch, port: 8787 })
