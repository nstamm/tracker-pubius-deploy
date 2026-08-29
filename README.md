# Pubius Tracker

Self-hosted financial operations tracker for a single account. One Node.js process serves the React PWA, exposes the private API, and stores data in SQLite.

## Architecture

| Component | Responsibility |
|---|---|
| React and Vite | Dashboard, expenses, Binance P2P, and voice input |
| Fastify | Authentication, CRUD API, Binance proxy, and OpenAI transcription |
| SQLite | Local operations and expenses in `/data/pubius.sqlite` |
| Docker Compose | Persistent storage, backups, health checks, and proxy networking |

Supabase and Lovable are not required.

## Local Development

Requirements: Node.js 24.15 or newer and npm.

1. Install dependencies.

   ```sh
   npm ci
   ```

2. Create the local configuration.

   ```sh
   cp .env.example .env
   npm run auth:hash -- "choose-a-strong-password"
   ```

3. Paste the generated hash into `AUTH_PASSWORD_HASH` using single quotes and set `COOKIE_SECURE=false` for HTTP development.

4. Start the frontend and API.

   ```sh
   npm run dev
   ```

The web app runs at `http://localhost:8080`; Vite proxies `/api` to port `3000`.

## VPS Deployment

1. Copy `.env.example` to `.env`.
2. Set `AUTH_EMAIL`, `AUTH_PASSWORD_HASH`, and a random `SESSION_SECRET` of at least 32 characters.
3. Set `APP_DOMAIN` to the HTTPS hostname routed by Traefik.
4. Optionally set `OPENAI_API_KEY`; text-based voice input still works without it.
5. Build and start the service.

   ```sh
   docker compose up -d --build
   docker compose ps
   curl "https://${APP_DOMAIN}/api/health"
   ```

The Compose labels configure the VPS Traefik instance to route HTTPS traffic to port `3000` and provision a Let's Encrypt certificate. HTTPS is required because production authentication uses a `Secure` cookie.

No host port is published. Traefik reaches the container through Docker networking, and the database is never exposed over the network.

## Monthly Email Report

At 08:00 (America/Argentina/Buenos_Aires by default) on the 1st of each month the server emails a report of the previous calendar month's operations, including totals and a detail per operation. The report is sent to `REPORT_RECIPIENT`; the subject and sender come from `REPORT_FROM`. If the service was down on the 1st, the pending report is sent the next time the server starts. Each reported month is recorded in SQLite, so a month is never emailed twice.

Set all of these to enable the report (leave them empty to disable):

| Variable | Purpose |
|---|---|
| `SMTP_HOST` | SMTP server (Hostinger: `smtp.hostinger.com`) |
| `SMTP_PORT` | Default `465` (implicit TLS) |
| `SMTP_USER` | Mailbox address used to authenticate |
| `SMTP_PASSWORD` | SMTP password for that mailbox |
| `REPORT_RECIPIENT` | Where the report is sent |
| `REPORT_FROM` | Optional sender address (defaults to `SMTP_USER`) |
| `REPORT_TIMEZONE` | Optional IANA zone (default `America/Argentina/Buenos_Aires`) |
| `REPORT_HOUR` | Optional hour of day on the 1st (default `8`) |

## Backups

The server creates a consistent SQLite backup at startup and every `BACKUP_INTERVAL_HOURS`. Backups are written to the persistent `pubius_backups` Docker volume, and only the newest `BACKUP_RETENTION` files are kept.

Create an additional backup manually:

```sh
docker compose exec pubius-tracker npm run db:backup
```

Restore a backup:

```sh
docker compose stop pubius-tracker
docker compose run --rm --no-deps --entrypoint sh pubius-tracker -c 'cp /backups/BACKUP_FILE.sqlite /data/pubius.sqlite && rm -f /data/pubius.sqlite-wal /data/pubius.sqlite-shm'
docker compose start pubius-tracker
```

Keep at least one backup copy outside the VPS.

## Operations

| Command | Purpose |
|---|---|
| `npm run test` | Run API behavior tests |
| `npm run typecheck` | Check frontend and backend TypeScript |
| `npm run lint` | Run ESLint |
| `npm run build` | Build the PWA and server bundles |
| `npm run auth:hash -- "password"` | Generate a password hash |
| `npm run db:backup` | Create an online SQLite backup |

The application intentionally runs as one instance. Do not scale it horizontally while using the same SQLite volume.
