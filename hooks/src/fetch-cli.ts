import { fetch } from "./fetch.js"
fetch()
  .then(() => console.log("ok!"))
  .catch((e) => {
    throw e
  })
