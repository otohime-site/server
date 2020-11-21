
import Koa from 'koa'
import Router from 'koa-router'
import authRouter from './auth'

const app = new Koa()
const router = new Router()
router.use('/auth', authRouter.routes())

app.use(router.routes()).use(router.allowedMethods())
app.listen(8787)
