import { getPool } from '../db/pool.js';
import { logger } from '../utils/logger.js';

export interface ClickEvent {
  linkId: string;
  ipAddress: string | null;
  userAgent: string | null;
  referrer: string | null;
  deviceType: string | null;
  country: string | null;
}

const BOT_PATTERNS = [
  /bot/i,
  /crawl/i,
  /spider/i,
  /slurp/i,
  /facebookexternalhit/i,
  /headlesschrome/i,
  /lighthouse/i,
  /pingdom/i,
  /uptimerobot/i,
];

export function isLikelyBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return BOT_PATTERNS.some((re) => re.test(userAgent));
}

export function classifyDevice(
  userAgent: string | null | undefined,
): string | null {
  if (!userAgent) return null;
  if (/tablet|ipad/i.test(userAgent)) return 'tablet';
  if (/mobi|android|iphone|ipod/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

/**
 * Record a click asynchronously. Errors are logged but never thrown:
 * analytics must never break the redirect path.
 */
export function recordClick(event: ClickEvent): void {
  void persistClick(event).catch((err) => {
    logger.error({ err, linkId: event.linkId }, 'failed to persist click');
  });
}

async function persistClick(event: ClickEvent): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO link_analytics
       (link_id, ip_address, user_agent, referrer, device_type, country)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      event.linkId,
      event.ipAddress,
      event.userAgent,
      event.referrer,
      event.deviceType,
      event.country,
    ],
  );
}
