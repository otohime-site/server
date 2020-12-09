### Otohime Server

It contains:

* Hasura running with `docker-compose`
* Hooks written with TypeScript / Koa to serve JWT/long-lived tokens auth, song list fetching, database cleanups, etc.

#### Get Started

You need a Firebase ID, with Facebook Auth connected in the Firebase project.
And a SEGA ID with password to fetch the recent song list.
Please fill those with database passwords in `.env` (example in `.env.example`.)

Then run:
```
docker-compose up
```

You need to append `sudo` if your docker requires `root`.

Everything should be set up except the song list. Use the following command to update it:
```
docker-compose run db wget --post-data '' http://hooks:8787/fetch
```