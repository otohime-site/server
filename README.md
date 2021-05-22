### Otohime Server

It contains:

- Hasura running with `docker-compose`
- Hooks written with TypeScript / Koa to serve JWT/long-lived tokens auth, song list fetching, database cleanups, etc.

#### Get Started

You need a Firebase ID, with Facebook Auth connected in the Firebase project.
And a SEGA ID with password to fetch the recent song list.
Please fill those with database passwords in `.env` (example in `.env.example`.)

Then run:

```
docker-compose up
```

You need to append `sudo` if your docker requires `root`.

Then you need to set up the Hasura migration and metadata.

Install the Hasura CLI by following [the official docs](https://hasura.io/docs/1.0/graphql/core/hasura-cli/install-hasura-cli.html). Then run the following commmand:

```
hasura migrate apply
hasura metadata apply
```

Finally we need to update the song list. Use the following command to update it:

```
docker-compose run db wget --post-data '' http://hooks:8787/fetch
```
