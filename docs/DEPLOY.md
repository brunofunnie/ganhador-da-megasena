# Deploy — stack `loterias`

Production runs on the home VPS (`jiban.lan` / `192.168.3.40`), managed by
**Dockhand** (`fnsys/dockhand`) as a *git stack*: Dockhand clones this repo on
the VPS and builds the image there.

| | |
|---|---|
| Stack name | `loterias` |
| Environment | `Jiban` (`environmentId: 1`) |
| Repo | `git@github.com:brunofunnie/ganhador-da-megasena.git`, branch `main` |
| Compose path | `compose.prod.yaml` |
| Container / network alias | `loterias` on external network `jiban-shared` |
| Public URL | https://loteria.funnie.dev |
| Tunnel ingress | `loteria.funnie.dev` → `http://loterias:3001` |

## Architecture

One container. A multi-stage `Dockerfile` builds the React SPA with Vite, then
the Express backend serves both `/api` and the built SPA from the same process
and port, so the frontend's relative `/api` calls need no reverse proxy.

The server is started with `tsx` rather than `node dist/index.js`: the backend
`tsconfig.json` uses `moduleResolution: bundler`, so `tsc` emits extensionless
ESM specifiers that plain Node cannot resolve. (`npm start` in `backend/` is
broken for the same reason; `npm run start:prod` is the working equivalent.)

## Database

SQLite, **outside** the image, on a host bind mount:

```
${LOTERIAS_DATA_DIR}  ->  /data          (DB_PATH=/data/megasena.db)
```

`LOTERIAS_DATA_DIR` is stored in Dockhand as a **secret** env override. Dockhand
injects secret overrides into the compose shell at deploy time, which is what
lets `compose.prod.yaml` interpolate `${LOTERIAS_DATA_DIR}` while keeping the
real host path out of this repository. Non-secret overrides would instead be
written to `.env.dockhand` on disk and would not be available for interpolation.

Redeploys never touch the data directory. To (re)seed it from the local
database, use `./bin/copy-db.sh` — it stops the container, copies
`megasena.db`, `megasena.db-wal` and `megasena.db-shm`, then restarts it.

## Local config

`./bin/*.sh` read the git-ignored root `.env` (see `.env.example`):

```
DOCKHAND_API_TOKEN=   DOCKHAND_URL=   DOCKHAND_ENV_ID=
VPS_USER=             VPS_HOST=
LOTERIAS_DATA_DIR=
```

## Scripts

| Script | Purpose |
|---|---|
| `./bin/bootstrap-dockhand.sh` | One-time, idempotent: host data dir, GitHub key check, Dockhand credential lookup, git-stack creation with the secret env override. |
| `./bin/copy-db.sh` | Copy the local SQLite database to `$LOTERIAS_DATA_DIR` on the VPS. Overwrites the remote DB. |
| `./bin/deploy.sh [--no-push]` | `git push` → Dockhand sync → Dockhand deploy (build + `compose up`). Non-destructive. |

## First deploy

```bash
cp .env.example .env      # fill it in
./bin/bootstrap-dockhand.sh
./bin/copy-db.sh
./bin/deploy.sh
```

Then, in the Cloudflare dashboard (the tunnel is remote-managed via token, so
there is no local ingress file), point `loteria.funnie.dev` at
`http://loterias:3001`.

## Notes

- Dockhand git-stack create uses `stackName` (not `name`); `envVars` entries are
  `{key, value, isSecret}`.
- The VPS SSH key (`~/.ssh/id_ed25519` on jiban, = Dockhand credential
  `jiban-deploy-key`, id 2) is registered as an **account-level** GitHub SSH key,
  so it already reaches this repo. GitHub refuses to accept a key that is
  already in use as a per-repo deploy key, which is why bootstrap skips that
  step instead of adding one.
- A `502` on the public URL with the container healthy means the tunnel has no
  ingress rule for the hostname. Verify with:
  `ssh bruno@jiban.lan 'docker logs cloudflared 2>&1 | grep -o "config=.*" | tail -1'`
  and check reachability inside the network with:
  `ssh bruno@jiban.lan 'docker run --rm --network jiban-shared loterias:latest \
   node -e "fetch(\"http://loterias:3001/api/status\").then(r=>console.log(r.status))"'`
- Dockhand copies the repo to `/app/data/stacks/Jiban/loterias` inside its own
  container and runs compose there against the host `docker.sock`; bind-mount
  sources are therefore resolved on the **host**.
- The container runs as uid/gid `1000` (the `node` user), matching `bruno` on
  the VPS, so files written into the bind mount stay owned by `bruno`.
- On boot the backend syncs new draws from the Caixa API; failure there is
  non-fatal and the existing database is used.
