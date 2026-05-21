---
name: testing-shortlink
description: End-to-end test the shortlink shorten + redirect + analytics flow against a local Postgres. Use when verifying any change to src/routes/api.ts, src/routes/redirect.ts, src/services/links.service.ts, src/services/analytics.service.ts, or the migrations under ./migrations.
---

# Testing shortlink end-to-end

The app is a Node.js + Express + Postgres URL shortener. Phase 1 exposes `POST /api/shorten` and `GET /:short_code`. The most useful test is a curl + psql shell test against a locally running dev server — there is no GUI, so do not start a recording.

## Boot the stack

The environment blueprint installs Postgres and creates the `shortlink` user + `shortlink` / `shortlink_test` databases. After session boot, run:

```bash
sudo pg_ctlcluster 14 main start || true   # snapshot does not auto-start system services
cd /home/ubuntu/repos/shortlink
npm install                                  # idempotent; only re-fetches changed deps
npm run migrate:up                           # apply node-pg-migrate migrations
DATABASE_URL=postgres://shortlink:shortlink@127.0.0.1:5432/shortlink \
  SHORT_BASE_URL=http://localhost:3000 PORT=3000 \
  npm run dev                                # listens on :3000
```

Verify with `curl -sf http://localhost:3000/health/ready` — expect `{"status":"ready"}`.

## Reset the DB between tests

The Vitest integration suite truncates tables between cases. Do the same when scripting manual tests so row counts are unambiguous:

```bash
PGPASSWORD=shortlink psql -h 127.0.0.1 -U shortlink -d shortlink -tAc \
  'TRUNCATE TABLE link_analytics, links RESTART IDENTITY CASCADE;'
```

## Primary flow (curl)

```bash
# Create with query string — assert the query is preserved through the redirect
RESP=$(curl -s -X POST http://localhost:3000/api/shorten \
  -H 'content-type: application/json' \
  -d '{"longUrl":"https://example.com/path?utm=launch&id=42"}')
SHORT_CODE=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["shortCode"])')

# Expect 302 + Location with the full query string preserved
curl -s -i "http://localhost:3000/$SHORT_CODE" | head -5
```

## Analytics + bot filter — the gotcha

The bot filter is in `src/services/analytics.service.ts` (`isLikelyBot`). It matches `bot|crawl|spider|slurp|facebookexternalhit|headlesschrome|lighthouse|pingdom|uptimerobot` against the UA, case-insensitive.

**curl's default UA (`curl/8.x`) is NOT a bot,** so it WILL create an analytics row. If you want to assert "a Googlebot hit creates zero analytics rows," you must either:

- Truncate the analytics table immediately before the Googlebot hit, then assert `COUNT(*) = 0`, OR
- Snapshot the row count before and after the Googlebot hit and assert the delta is 0.

Analytics writes are asynchronous — `recordClick` returns void and fires a promise. Settle ~100–300 ms before querying the table.

## Configuration toggles to verify

| Variable                | What it controls                                                       |
| ----------------------- | ---------------------------------------------------------------------- |
| `REDIRECT_STATUS`       | `301` vs `302`. Default `302`. Tests should hit both if both matter.   |
| `SHORT_CODE_MIN_LENGTH` | Minimum generated short code length (default 6). Padded with leading `0`. |
| `SHORT_CODE_ID_OFFSET`  | Numeric offset added to the row id before Base62-encoding (default 1000). |

Change these by restarting `npm run dev` with the env var set inline.

## Devin Secrets Needed

None. Local Postgres uses the `shortlink/shortlink` dev password baked into `.env.example` and `docker-compose.yml`. No production secrets are required for testing.

## When NOT to use this skill

- Pure unit-test changes (just run `npm test`).
- Lint/typecheck-only changes (`npm run lint && npm run typecheck`).
- Schema migrations that don't touch the routes — run `npm run migrate:up` then `npm test` instead.
