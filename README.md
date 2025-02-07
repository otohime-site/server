### Otohime Server

It contains:

- Hasura running with `docker-compose`
- Hooks written with TypeScript / Hono / Postgres.js to serve JWT/long-lived tokens auth, song list fetching, database cleanups, etc.

#### Get Started

You need a Firebase ID, with Facebook Auth connected in the Firebase project.
And a SEGA ID with password to fetch the recent song list.
Please fill those with database passwords in `.env` (example in `.env.example`.)

Then run:

```
docker-compose up
```

You need to append `sudo` if your docker requires `root`.

Finally we need to update the song list. Use the following command to update it:

```
docker compose run hooks node /app/build/fetch-cli.js
```

#### Data sources

* The maimai Internal Lv JSONs in `hooks/src` are using sources from spreadsheet made by
Japan player groups (`@maiLv_Chihooooo` on X, previously known as Twitter),
which stated the data can be used freely.