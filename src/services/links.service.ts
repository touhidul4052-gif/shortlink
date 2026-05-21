import type { PoolClient } from 'pg';
import { getPool } from '../db/pool.js';
import { loadEnv } from '../config/env.js';
import { encode } from '../utils/base62.js';
import { canonicalizeUrl } from '../utils/url.js';
import { validateCustomSlug } from '../utils/slug.js';

export interface LinkRow {
  id: string;
  long_url: string;
  short_code: string;
  custom_alias: string | null;
  user_id: string | null;
  expires_at: Date | null;
  created_at: Date;
  clicks: number;
}

export interface CreatedLink {
  id: string;
  longUrl: string;
  shortCode: string;
  customAlias: string | null;
  expiresAt: string | null;
  createdAt: string;
  shortUrl: string;
}

export interface CreateLinkInput {
  longUrl: string;
  customAlias?: string | undefined;
  expiresAt?: string | undefined;
  userId?: string | undefined;
}

export class SlugTakenError extends Error {
  constructor(slug: string) {
    super(`Custom alias "${slug}" is already in use`);
    this.name = 'SlugTakenError';
  }
}

export class ExpirationInPastError extends Error {
  constructor() {
    super('expiresAt must be in the future');
    this.name = 'ExpirationInPastError';
  }
}

function rowToCreated(row: LinkRow): CreatedLink {
  const env = loadEnv();
  return {
    id: row.id,
    longUrl: row.long_url,
    shortCode: row.short_code,
    customAlias: row.custom_alias,
    expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    shortUrl: `${env.SHORT_BASE_URL}/${row.short_code}`,
  };
}

async function reserveAlias(
  client: PoolClient,
  alias: string,
  longUrl: string,
  userId: string | null,
  expiresAt: Date | null,
): Promise<LinkRow> {
  // Insert with short_code === custom_alias up front; rely on unique
  // constraint to surface conflicts as a known error.
  const { rows } = await client.query<LinkRow>(
    `INSERT INTO links (long_url, short_code, custom_alias, user_id, expires_at)
     VALUES ($1, $2, $2, $3, $4)
     RETURNING id, long_url, short_code, custom_alias, user_id, expires_at, created_at, clicks`,
    [longUrl, alias, userId, expiresAt],
  );
  return rows[0]!;
}

async function reserveGenerated(
  client: PoolClient,
  longUrl: string,
  userId: string | null,
  expiresAt: Date | null,
): Promise<LinkRow> {
  const env = loadEnv();

  const inserted = await client.query<{ id: string }>(
    `INSERT INTO links (long_url, short_code, user_id, expires_at)
     VALUES ($1, '', $2, $3)
     RETURNING id`,
    [longUrl, userId, expiresAt],
  );
  const insertedRow = inserted.rows[0];
  if (!insertedRow) {
    throw new Error('Failed to insert link row');
  }

  const numericId = BigInt(insertedRow.id) + BigInt(env.SHORT_CODE_ID_OFFSET);
  const code = encode(numericId, env.SHORT_CODE_MIN_LENGTH);

  const updated = await client.query<LinkRow>(
    `UPDATE links
       SET short_code = $1
     WHERE id = $2
     RETURNING id, long_url, short_code, custom_alias, user_id, expires_at, created_at, clicks`,
    [code, insertedRow.id],
  );
  const updatedRow = updated.rows[0];
  if (!updatedRow) {
    throw new Error('Failed to assign short_code to link row');
  }
  return updatedRow;
}

export async function createLink(input: CreateLinkInput): Promise<CreatedLink> {
  const longUrl = canonicalizeUrl(input.longUrl);

  let expiresAt: Date | null = null;
  if (input.expiresAt) {
    const parsed = new Date(input.expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      throw new RangeError('expiresAt must be a valid ISO-8601 timestamp');
    }
    if (parsed.getTime() <= Date.now()) {
      throw new ExpirationInPastError();
    }
    expiresAt = parsed;
  }

  const userId = input.userId ?? null;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let row: LinkRow;
    if (input.customAlias !== undefined && input.customAlias !== '') {
      const alias = validateCustomSlug(input.customAlias);
      try {
        row = await reserveAlias(client, alias, longUrl, userId, expiresAt);
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new SlugTakenError(alias);
        }
        throw err;
      }
    } else {
      row = await reserveGenerated(client, longUrl, userId, expiresAt);
    }
    await client.query('COMMIT');
    return rowToCreated(row);
  } catch (err) {
    await safeRollback(client);
    throw err;
  } finally {
    client.release();
  }
}

export interface LookupResult {
  id: string;
  longUrl: string;
  shortCode: string;
  expiresAt: Date | null;
}

export async function findActiveLink(
  shortCode: string,
): Promise<LookupResult | null> {
  const pool = getPool();
  const { rows } = await pool.query<LinkRow>(
    `SELECT id, long_url, short_code, custom_alias, user_id, expires_at, created_at, clicks
       FROM links
      WHERE short_code = $1
      LIMIT 1`,
    [shortCode],
  );
  const row = rows[0];
  if (!row) return null;
  if (row.expires_at && row.expires_at.getTime() <= Date.now()) {
    return null;
  }
  return {
    id: row.id,
    longUrl: row.long_url,
    shortCode: row.short_code,
    expiresAt: row.expires_at,
  };
}

export async function incrementClickCount(linkId: string): Promise<void> {
  const pool = getPool();
  await pool.query(`UPDATE links SET clicks = clicks + 1 WHERE id = $1`, [
    linkId,
  ]);
}

export interface ListedLink {
  id: string;
  longUrl: string;
  shortCode: string;
  customAlias: string | null;
  expiresAt: string | null;
  createdAt: string;
  clicks: number;
  shortUrl: string;
}

export interface ListLinksOptions {
  limit?: number;
  offset?: number;
}

export interface ListLinksResult {
  items: ListedLink[];
  total: number;
  limit: number;
  offset: number;
}

const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 20;

export async function listRecentLinks(
  options: ListLinksOptions = {},
): Promise<ListLinksResult> {
  const env = loadEnv();
  const limit = Math.min(
    Math.max(1, Math.floor(options.limit ?? DEFAULT_LIST_LIMIT)),
    MAX_LIST_LIMIT,
  );
  const offset = Math.max(0, Math.floor(options.offset ?? 0));

  const pool = getPool();
  const { rows } = await pool.query<LinkRow>(
    `SELECT id, long_url, short_code, custom_alias, user_id, expires_at, created_at, clicks
       FROM links
      WHERE short_code <> ''
      ORDER BY created_at DESC, id DESC
      LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  const { rows: countRows } = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM links WHERE short_code <> ''`,
  );
  const total = Number(countRows[0]?.total ?? '0');

  return {
    items: rows.map((row) => ({
      id: row.id,
      longUrl: row.long_url,
      shortCode: row.short_code,
      customAlias: row.custom_alias,
      expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
      createdAt: row.created_at.toISOString(),
      clicks: Number(row.clicks),
      shortUrl: `${env.SHORT_BASE_URL}/${row.short_code}`,
    })),
    total,
    limit,
    offset,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  );
}

async function safeRollback(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // ignored: connection may already be broken
  }
}
