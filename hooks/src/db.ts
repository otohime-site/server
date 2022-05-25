import pg from "pg" // SyntaxError on named exports

export default new pg.Pool()
