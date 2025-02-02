import { fetchSongs } from "./fetch.js"
import sql from "./db.js"

fetchSongs()
  .then(() => console.log("ok!"))
  .catch((e) => {
    throw e
  })
  .finally(() => {sql.end()})
