import Koa from "koa"
import Router from "koa-router"
import authRouter from "./auth.js"
import fetchRouter from "./fetch.js"
import cleanupRouter from "./cleanup.js"
import refreshRouter from "./refresh.js"

const app = new Koa()
const router = new Router()
router.use("/auth", authRouter.routes())
router.use("/fetch", fetchRouter.routes())
router.use("/cleanup", cleanupRouter.routes())
router.use("/refresh", refreshRouter.routes())

app.use(router.routes()).use(router.allowedMethods())
app.listen(8787)
