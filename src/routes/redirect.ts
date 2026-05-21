import { Router, type Request, type Response, type NextFunction } from 'express';
import { loadEnv } from '../config/env.js';
import { BASE62_PATTERN } from '../utils/base62.js';
import { findActiveLink, incrementClickCount } from '../services/links.service.js';
import {
  classifyDevice,
  isLikelyBot,
  recordClick,
} from '../services/analytics.service.js';
import { HttpError } from '../middleware/error.js';

const CUSTOM_ALIAS_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,29}$/;
const SHORT_CODE_PATTERN = new RegExp(
  `(?:${BASE62_PATTERN.source.slice(1, -1)})|(?:${CUSTOM_ALIAS_PATTERN.source.slice(1, -1)})`,
);

function isPlausibleShortCode(code: string): boolean {
  if (code.length === 0 || code.length > 30) return false;
  return SHORT_CODE_PATTERN.test(code);
}

export const redirectRouter: Router = Router();

redirectRouter.get(
  '/:code',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const env = loadEnv();
      const code = req.params.code ?? '';
      if (!isPlausibleShortCode(code)) {
        throw new HttpError(404, 'not_found', 'Short link not found');
      }

      const link = await findActiveLink(code);
      if (!link) {
        throw new HttpError(404, 'not_found', 'Short link not found');
      }

      const userAgent = req.get('user-agent') ?? null;
      if (!isLikelyBot(userAgent)) {
        recordClick({
          linkId: link.id,
          ipAddress: req.ip ?? null,
          userAgent,
          referrer: req.get('referer') ?? null,
          deviceType: classifyDevice(userAgent),
          country: null,
        });
        void incrementClickCount(link.id).catch(() => {
          // best-effort; analytics path already logs failures
        });
      }

      res.redirect(env.REDIRECT_STATUS, link.longUrl);
    } catch (err) {
      next(err);
    }
  },
);
