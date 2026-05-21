import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { closePool, getPool } from '../../src/db/pool.js';
import { createApp } from '../../src/app.js';

const app = createApp();

async function resetSchema(): Promise<void> {
  const pool = getPool();
  await pool.query('TRUNCATE TABLE link_analytics, links RESTART IDENTITY CASCADE');
}

beforeAll(async () => {
  // Confirm migrations have been applied; the test runner is expected to
  // execute `npm run migrate:up` against DATABASE_URL before tests run.
  const pool = getPool();
  await pool.query('SELECT 1 FROM links LIMIT 1');
});

afterAll(async () => {
  await closePool();
});

beforeEach(async () => {
  await resetSchema();
});

describe('POST /api/shorten', () => {
  it('returns 201 with a generated short code for a fresh URL', async () => {
    const res = await request(app)
      .post('/api/shorten')
      .send({ longUrl: 'https://example.com/hello' });

    expect(res.status).toBe(201);
    expect(res.body.shortCode).toMatch(/^[0-9a-zA-Z]{6,}$/);
    expect(res.body.longUrl).toBe('https://example.com/hello');
    expect(res.body.shortUrl).toContain(res.body.shortCode);
    expect(res.body.customAlias).toBeNull();
    expect(res.body.expiresAt).toBeNull();
  });

  it('honors a valid custom alias', async () => {
    const res = await request(app)
      .post('/api/shorten')
      .send({ longUrl: 'https://example.com', customAlias: 'my-promo' });

    expect(res.status).toBe(201);
    expect(res.body.shortCode).toBe('my-promo');
    expect(res.body.customAlias).toBe('my-promo');
  });

  it('returns 409 when a custom alias collides', async () => {
    await request(app)
      .post('/api/shorten')
      .send({ longUrl: 'https://example.com', customAlias: 'dup-alias' })
      .expect(201);

    const conflict = await request(app)
      .post('/api/shorten')
      .send({ longUrl: 'https://example.org', customAlias: 'dup-alias' });

    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('alias_taken');
  });

  it('rejects invalid URLs with 400', async () => {
    const res = await request(app)
      .post('/api/shorten')
      .send({ longUrl: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_url');
  });

  it('rejects custom aliases that look dangerous', async () => {
    const res = await request(app)
      .post('/api/shorten')
      .send({ longUrl: 'https://example.com', customAlias: "'or 1=1--" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_alias');
  });

  it('rejects expiration timestamps in the past', async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const res = await request(app)
      .post('/api/shorten')
      .send({ longUrl: 'https://example.com', expiresAt: past });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('expiration_in_past');
  });
});

describe('GET /:short_code', () => {
  it('redirects to the original URL on hit', async () => {
    const created = await request(app)
      .post('/api/shorten')
      .send({ longUrl: 'https://example.com/landing' });

    const res = await request(app)
      .get(`/${created.body.shortCode}`)
      .set('user-agent', 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0');

    expect([301, 302]).toContain(res.status);
    expect(res.headers.location).toBe('https://example.com/landing');
  });

  it('returns 404 for an unknown code', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });

  it('returns 404 once the link has expired', async () => {
    const future = new Date(Date.now() + 1_500).toISOString();
    const created = await request(app)
      .post('/api/shorten')
      .send({ longUrl: 'https://example.com/ttl', expiresAt: future });

    await new Promise((r) => setTimeout(r, 1_700));

    const res = await request(app).get(`/${created.body.shortCode}`);
    expect(res.status).toBe(404);
  });

  it('does not record analytics for known bot user agents', async () => {
    const created = await request(app)
      .post('/api/shorten')
      .send({ longUrl: 'https://example.com/bot' });

    await request(app)
      .get(`/${created.body.shortCode}`)
      .set('user-agent', 'Googlebot/2.1');

    const pool = getPool();
    const { rows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM link_analytics WHERE link_id = $1`,
      [created.body.id],
    );
    expect(rows[0]?.count).toBe('0');
  });

  it('records analytics for a normal browser', async () => {
    const created = await request(app)
      .post('/api/shorten')
      .send({ longUrl: 'https://example.com/ok' });

    await request(app)
      .get(`/${created.body.shortCode}`)
      .set(
        'user-agent',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0',
      )
      .set('referer', 'https://twitter.com/');

    // Analytics is logged asynchronously; give it a moment to flush.
    await new Promise((r) => setTimeout(r, 100));

    const pool = getPool();
    const { rows } = await pool.query<{
      device_type: string | null;
      referrer: string | null;
    }>(
      `SELECT device_type, referrer FROM link_analytics WHERE link_id = $1`,
      [created.body.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.device_type).toBe('desktop');
    expect(rows[0]?.referrer).toBe('https://twitter.com/');
  });
});

describe('GET /api/links', () => {
  it('returns recent links newest-first with pagination metadata', async () => {
    const a = await request(app)
      .post('/api/shorten')
      .send({ longUrl: 'https://example.com/a' });
    const b = await request(app)
      .post('/api/shorten')
      .send({ longUrl: 'https://example.com/b' });
    const c = await request(app)
      .post('/api/shorten')
      .send({ longUrl: 'https://example.com/c' });

    const res = await request(app).get('/api/links');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.limit).toBe(20);
    expect(res.body.offset).toBe(0);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.items[0].shortCode).toBe(c.body.shortCode);
    expect(res.body.items[1].shortCode).toBe(b.body.shortCode);
    expect(res.body.items[2].shortCode).toBe(a.body.shortCode);
    expect(res.body.items[0].clicks).toBe(0);
    expect(res.body.items[0].shortUrl).toContain(c.body.shortCode);
  });

  it('honors limit and offset', async () => {
    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post('/api/shorten')
        .send({ longUrl: `https://example.com/p${i}` });
    }

    const page1 = await request(app).get('/api/links?limit=2&offset=0');
    expect(page1.status).toBe(200);
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.limit).toBe(2);
    expect(page1.body.offset).toBe(0);
    expect(page1.body.total).toBe(5);

    const page2 = await request(app).get('/api/links?limit=2&offset=2');
    expect(page2.status).toBe(200);
    expect(page2.body.items).toHaveLength(2);
    expect(page2.body.items[0].shortCode).not.toBe(page1.body.items[0].shortCode);
  });

  it('rejects invalid pagination params with 400', async () => {
    const res = await request(app).get('/api/links?limit=0');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });
});

describe('GET /api/qr/:code', () => {
  it('returns an SVG QR code for a known short link', async () => {
    const created = await request(app)
      .post('/api/shorten')
      .send({ longUrl: 'https://example.com/qr' });

    const res = await request(app)
      .get(`/api/qr/${created.body.shortCode}`)
      .buffer(true)
      .parse((response, callback) => {
        let data = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => callback(null, data));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/svg\+xml/);
    const body = res.body as unknown as string;
    expect(body).toContain('<svg');
    expect(body).toContain('</svg>');
  });

  it('returns 404 for an unknown short code', async () => {
    const res = await request(app).get('/api/qr/nope-nope-nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });

  it('returns 404 for a malformed short code', async () => {
    const res = await request(app).get('/api/qr/%21%21');
    expect(res.status).toBe(404);
  });
});

describe('GET /', () => {
  it('serves the dashboard HTML at the root', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('shortlink');
    expect(res.text).toContain('/api/shorten');
  });
});
