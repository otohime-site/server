import { fetchSongs } from "./fetch.js"
fetchSongs()
  .then(() => console.log("ok!"))
  .catch((e) => {
    throw e
  })
