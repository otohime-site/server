import { fetchSongs } from "./fetch.ts"
import sql from "./db.ts"

fetchSongs()
  .then(() => console.log("ok!"))
  .catch((e) => {
    throw e
  })
  .finally(() => {sql.end()})
