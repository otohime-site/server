### Otohime Server

It contains:

- A Docker Compose project, featuring Hasura 2 GraphQL Server and PostgreSQL database with [PERIODs](https://github.com/xocolatl/periods) extension
- Hooks written with TypeScript / Hono / Postgres.js to serve JWT/long-lived tokens auth, song list fetching, database cleanups, etc.

#### Get Started

1. Setup Necessary Credentials in `.env` (example in `.env.example`.)
  - Firebase ID, with Google Auth connected in the Firebase project
    It should be the same project used in the front-end, as it will be used
    to authenticate the JWT from the front-end.
  - SEGA ID with password to fetch the recent song list.
    Once the site is up, the song list will update daily through Hasura Cron Jobs.
  - Postgres user password
2. Initialize databases
  - Install [Hasura CLI](https://hasura.io/docs/2.0/hasura-cli/overview/) in your machine.
  - After `docker compose up` (Add `sudo` if you have to), run the following commands in the project root to run database migration and initialize Hasura metadata (for GraphQL mapping, cron jobs, etc.):
```
hasura migrate apply --all-databases
hasura metadata apply
```
3. Update the song list as the score updater won't allow songs not included in song list. Use the following command to update it:
```
docker compose run hooks node /app/build/fetch-cli.js
```
As it will call the real SEGA server for this, it won't work if the server is under maintenance (4:00 - 7:00 UTC+9 Daily)

#### Deployment and Maintenance Concerns

The PostgreSQL database uses [PERIODs](https://github.com/xocolatl/periods) extension to store the score history, several concerns are needed:
* It cannot be used by most of managed PostgreSQL services, where the PERIODs extension is mostly missing
* As it uses trigger to implement system versioning, it can be tricky when you need to mutate tables or restore the data from the SQL dump.
  You need to call `periods.drop_system_versioning` for such operation, see `src/cleanup.ts` for a example.
* If you need any hint to upgrade the PostgreSQL with `pg_upgrade`, [See this commit](https://github.com/otohime-site/server/commit/f6bac9ebbbdcf1623449dcea1a85cfd838387b03).


#### Data sources

* The maimai Internal Lv JSONs in `hooks/src` are using sources from spreadsheet made by
Japan player groups (`@maiLv_Chihooooo` on X, previously known as Twitter),
which stated the data can be used freely.