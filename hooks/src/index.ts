
import Koa from 'koa'
import Router from 'koa-router'
import authRouter from './auth'
import fetchRouter from './fetch'
import cleanupRouter from './cleanup'

const app = new Koa()
const router = new Router()
router.use('/auth', authRouter.routes())
router.use('/fetch', fetchRouter.routes())
router.use('/cleanup', cleanupRouter.routes())

app.use(router.routes()).use(router.allowedMethods())
app.listen(8787)
