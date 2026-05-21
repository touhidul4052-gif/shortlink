# shortlink

Phase 1 implementation of a custom URL shortener:

- **Base62 short-code engine** with configurable padding and ID offset
- **POST `/api/shorten`** — accepts a long URL, optional custom alias, and
  optional `expiresAt`; validates, canonicalizes, persists, and returns the
  short URL
- **GET `/:short_code`** — fast lookup with expiration check, asynchronous
  click logging, bot filtering, and configurable 301/302 redirect
- **Postgres schema** (`links`, `link_analytics`) with `node-pg-migrate`
  migrations and partial unique index on `short_code`
- **Analytics** — async click events capturing referrer, user agent, device
  classification, and IP; bot user agents are skipped so totals stay clean
- **Tests** — Vitest unit tests for the Base62, URL, slug, and analytics
  utilities; Supertest integration tests covering the shorten + redirect
  flows against a real Postgres database

## Quick start

### Option A — Run everything with Docker (no Node toolchain required)

```bash
docker compose up -d --build
```

This builds the app image, starts Postgres, runs migrations, and serves the API on `http://localhost:3000`.

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

## Configuration

| Variable                | Default                                                 | Notes |
| ----------------------- | ------------------------------------------------------- | ----- |
| `PORT`                  | `3000`                                                  | HTTP listen port |
| `SHORT_BASE_URL`        | `http://localhost:3000`                                 | Used to build `shortUrl` in responses |
| `REDIRECT_STATUS`       | `302`                                                   | `301` for cacheable permanent redirects |
| `DATABASE_URL`          | `postgres://shortlink:shortlink@127.0.0.1:5432/shortlink` | Postgres DSN |
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
  routes/api.ts          # POST /api/shorten
  routes/redirect.ts     # GET /:short_code
  routes/health.ts       # GET /health, GET /health/ready
  services/links.service.ts
  services/analytics.service.ts
  utils/base62.ts        # encode/decode + alphabet
  utils/url.ts           # canonicalize + validate
  utils/slug.ts          # custom alias validation + reserved words
  middleware/error.ts    # centralized error mapper
  app.ts                 # Express app factory
  server.ts              # entrypoint
migrations/
  1700000000000_init.cjs # links + link_analytics tables and indexes
tests/
  unit/                  # base62, url, slug, analytics helpers
  integration/api.test.ts
```

## Roadmap

This PR ships **Phase 1** (engine + redirect). Subsequent phases will add:

- Phase 2: Custom-alias dashboard UI, QR codes, link-in-bio
- Phase 3: Developer API with bearer-token auth + per-key rate limits
- Phase 4: Granular analytics dashboards, geolocation, security hardening

## License

MIT
