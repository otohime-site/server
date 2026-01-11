import node from '@elysiajs/node'
import {Elysia} from 'elysia'

new Elysia({adapter: node()}).listen(8765, ({hostname, port}) => {
    console.log(`Server running at http://${hostname}:${port}`)
})