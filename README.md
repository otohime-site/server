### Otohime Server

It contains:

- A Docker Compose project, featuring Hasura 2 GraphQL Server and PostgreSQL database
- Hooks written with TypeScript / Hono / Postgres.js to serve JWT/long-lived tokens auth, song list fetching, database cleanups, etc.

#### Get Started

1. Setup Necessary Credentials in `.env` (example in `.env.example`.)

   - Firebase ID, with Google Auth connected in the Firebase project
     It should be the same project used in the front-end, as it will be used
     to authenticate the JWT from the front-end.
   - SEGA ID with password to fetch the recent song list.
     Once the site is up, the song list will update daily through Hasura Cron Jobs.
   - Postgres user password

2. Start the development services

   ```sh
   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
   ```

   The development override enables admin-secret authentication with the
   development-only secret already configured in `config.yaml`. The base
   Compose file disables admin-secret authentication.

3. Initialize databases

   - Install [Hasura CLI](https://hasura.io/docs/2.0/hasura-cli/overview/) in your machine.
   - Run the following commands in the project root to run database migration and initialize Hasura metadata (for GraphQL mapping, cron jobs, etc.):

    ```sh
    hasura migrate apply --all-databases
    hasura metadata apply
    ```

4. Update the song list as the score updater won't allow songs not included in song list. Use the following command to update it:

   ```sh
   docker compose -f docker-compose.yml -f docker-compose.dev.yml run hooks node /app/src/fetch-cli.ts
   ```

   As it will call the real SEGA server for this, it won't work if the server is under maintenance (4:00 - 7:00 UTC+9 Daily)

#### Deployment and Maintenance Concerns

The base Hasura service disables `x-hasura-admin-secret` authentication. Apply
migrations and metadata through the isolated maintenance profile, which starts
a temporary Hasura instance with a newly generated secret and does not publish
its port:

```sh
./scripts/hasura-maintenance migrate apply --all-databases
./scripts/hasura-maintenance metadata apply --disallow-inconsistent-metadata
```

The wrapper accepts any Hasura CLI arguments, including development rollback
commands:

```sh
./scripts/hasura-maintenance migrate apply --database-name default --down 1
./scripts/hasura-maintenance migrate status --database-name default
```

The temporary secret exists only in the wrapper and maintenance-container
environments. The wrapper removes the maintenance Hasura container on exit.
The wrapper also prevents concurrent maintenance commands from replacing each
other's temporary instance.

Score history (system versioning) is kept by plain PL/pgSQL triggers (see `migrations/default/1795241435242_replace_periods_with_triggers`), which replaced the [PERIODs](https://github.com/xocolatl/periods) extension:
* Every change to `dx_intl_records` / `dx_intl_scores` moves the old version into `*_history`. `start` / `end` are always set by the database.
* History rows cannot be updated. Deleting a player removes its history when the transaction commits.
* A full `pg_dump` / `pg_restore` is safe, as triggers are created after the data. A data-only restore needs `--disable-triggers` (or `session_replication_role = replica`), otherwise the triggers would reset every `start` / `end`.
* PERIODs is still installed by `docker-db/`, only so that the migration's `down.sql` can work. It goes away with the PostgreSQL 19 upgrade.


#### Version upgrades

When a new maimai version is released, update:

* The Internal Lv JSON in `hooks/src/internal_lvs/`, and `CURRENT_VERSION` in `hooks/src/fetch.ts`
* A migration raising the `dx_intl_variants_version_check1` constraint and updating
  `dx_intl_constants` — see the comments in the latest `*_version_upgrade` migration

`hooks/src/versions.json` (where the array index is the version number) should be
updated *before* the next version is released, so it still describes the version
that is about to be superseded. Songs missing from it fall back to `CURRENT_VERSION`,
which is how newly added songs get auto-filled as the latest version — so the entry
for the new version itself is only added once that version is in turn superseded.


#### Data sources

* The maimai Internal Lv JSONs in `hooks/src` before `23_prism.json` are using sources from spreadsheet made by
Japan player groups (`@maiLv_Chihooooo` on X, previously known as Twitter),
which stated the data can be used freely.

  (after `24_prism_plus.json`, it is automatically aggregated with [Data Tools](https://github.com/otohime-site/data-tools/))
