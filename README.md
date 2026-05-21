# shortlink

A tiny, fast URL shortener built with Node.js + Express + Postgres.

- **Web dashboard** — paste a long URL, get a short one, see the QR, browse recent links
- **Base62 short-code engine** with configurable padding and ID offset
- **POST `/api/shorten`** — long URL → short URL with optional custom alias and `expiresAt`
- **GET `/:short_code`** — fast lookup with expiration check, asynchronous
  click logging, bot filtering, and configurable 301/302 redirect
- **GET `/api/links`** — paginated list of recent links with click counts
- **GET `/api/qr/:code`** — downloadable SVG QR code for any short link
- **Postgres schema** (`links`, `link_analytics`) with `node-pg-migrate`
  migrations and partial unique index on `short_code`
- **Analytics** — async click events capturing referrer, user agent, device
  classification, and IP; bot user agents are skipped so totals stay clean
- **Tests** — Vitest unit tests + Supertest integration tests against a real
  Postgres database (46 tests, run on every push via GitHub Actions)

![Dashboard](docs/dashboard.png)

## Quick start

### Option A — Run everything with Docker (no Node toolchain required)

```bash
docker compose up -d --build
```

This builds the app image, starts Postgres, runs migrations, and serves the API on `http://localhost:3000`.

> Postgres is published on host port **5433** (not the default 5432) to avoid clashing with a system-installed Postgres. The app container reaches Postgres internally over the docker network, so this only matters if you want to connect from your host machine (e.g. with `psql`).

Useful follow-ups:

```bash
docker compose logs -f app      # tail the server logs
docker compose down             # stop both containers (keeps the DB volume)
docker compose down -v          # stop AND wipe the Postgres volume
```

### Option B — Local dev (hot reload via `tsx watch`)

```bash
docker compose up -d postgres   # Postgres only
cp .env.example .env
npm install
npm run migrate:up
npm run dev
```

The server listens on `http://localhost:3000` by default.

### Create a short link

```bash
curl -sX POST http://localhost:3000/api/shorten \
  -H 'content-type: application/json' \
  -d '{"longUrl":"https://example.com/some/long/path?utm=launch"}'
```

Response:

```json
{
  "id": "1",
  "longUrl": "https://example.com/some/long/path?utm=launch",
  "shortCode": "0003e9",
  "customAlias": null,
  "expiresAt": null,
  "createdAt": "2025-05-21T09:50:00.000Z",
  "shortUrl": "http://localhost:3000/0003e9"
}
```

### Follow a short link

```bash
curl -I http://localhost:3000/0003e9
# HTTP/1.1 302 Found
# Location: https://example.com/some/long/path?utm=launch
```

### Or just use the dashboard

Open `http://localhost:3000/` in a browser. You get a single-page dashboard
(Tailwind + Alpine.js, no build pipeline) that wraps the API:

- Paste a long URL → click **Shorten** → copy the result or download its QR
- Optional custom alias (3–30 chars, `^[A-Za-z0-9][A-Za-z0-9_-]*$`)
- Optional expiration timestamp (`datetime-local`, stored as ISO-8601)
- "Your recent links" table with click counts, auto-refreshing on each new shorten

### List recent links + grab a QR code

```bash
curl http://localhost:3000/api/links?limit=10&offset=0
curl http://localhost:3000/api/qr/0003e9 > qr.svg
```

## Configuration

| Variable                | Default                                                 | Notes |
| ----------------------- | ------------------------------------------------------- | ----- |
| `PORT`                  | `3000`                                                  | HTTP listen port |
| `SHORT_BASE_URL`        | `http://localhost:3000`                                 | Used to build `shortUrl` in responses |
| `REDIRECT_STATUS`       | `302`                                                   | `301` for cacheable permanent redirects |
| `DATABASE_URL`          | `postgres://shortlink:shortlink@127.0.0.1:5433/shortlink` | Postgres DSN (matches docker-compose host port) |
| `SHORT_CODE_MIN_LENGTH` | `6`                                                     | Pads generated codes with leading `0`s |
| `SHORT_CODE_ID_OFFSET`  | `1000`                                                  | Skips the first N IDs so codes start at ≥3 distinct chars |
| `LOG_LEVEL`             | `info`                                                  | pino log level |

## Scripts

| Script               | Purpose                              |
| -------------------- | ------------------------------------ |
| `npm run dev`        | Hot-reload dev server (`tsx watch`)  |
| `npm run build`      | Compile TypeScript to `dist/`        |
| `npm start`          | Run compiled server                  |
| `npm test`           | Vitest unit + integration tests      |
| `npm run lint`       | ESLint                               |
| `npm run typecheck`  | `tsc --noEmit`                       |
| `npm run migrate:up` | Apply pending migrations             |
| `npm run migrate:down` | Roll back last migration           |

## Project layout

```
src/
  config/env.ts          # zod-validated env loader
  db/pool.ts             # pg.Pool singleton
  routes/api.ts          # POST /api/shorten, GET /api/links, GET /api/qr/:code
  routes/redirect.ts     # GET /:short_code
  routes/health.ts       # GET /health, GET /health/ready
  services/links.service.ts
  services/analytics.service.ts
  utils/base62.ts        # encode/decode + alphabet
  utils/url.ts           # canonicalize + validate
  utils/slug.ts          # custom alias validation + reserved words
  middleware/error.ts    # centralized error mapper
  app.ts                 # Express app factory (serves /api + static /)
  server.ts              # entrypoint
public/
  index.html             # dashboard (Tailwind via CDN + Alpine.js)
migrations/
  1700000000000_init.cjs # links + link_analytics tables and indexes
tests/
  unit/                  # base62, url, slug, analytics helpers
  integration/api.test.ts
```

## Roadmap

Phases 1 + 2 are shipped (engine + redirect + dashboard UI). Future phases:

- Phase 3: Developer API with bearer-token auth + per-key rate limits
- Phase 4: Granular analytics dashboards, geolocation, security hardening

## License

MIT
