import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import {
  createLink,
  listRecentLinks,
  findActiveLink,
} from '../services/links.service.js';
import { BASE62_PATTERN } from '../utils/base62.js';
import { HttpError } from '../middleware/error.js';
import { loadEnv } from '../config/env.js';

const shortenSchema = z.object({
  longUrl: z.string().min(1, 'longUrl is required'),
  customAlias: z.string().optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});

const listLinksSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const CUSTOM_ALIAS_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,29}$/;
const SHORT_CODE_PATTERN = new RegExp(
  `(?:${BASE62_PATTERN.source.slice(1, -1)})|(?:${CUSTOM_ALIAS_PATTERN.source.slice(1, -1)})`,
);

function isPlausibleShortCode(code: string): boolean {
  if (code.length === 0 || code.length > 30) return false;
  return SHORT_CODE_PATTERN.test(code);
}

export const apiRouter: Router = Router();

apiRouter.post(
  '/shorten',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = shortenSchema.parse(req.body);
      const created = await createLink({
        longUrl: body.longUrl,
        customAlias: body.customAlias,
        expiresAt: body.expiresAt,
      });
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },
);

apiRouter.get(
  '/links',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = listLinksSchema.parse(req.query);
      const result = await listRecentLinks({
        limit: params.limit,
        offset: params.offset,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

apiRouter.get(
  '/qr/:code',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const code = req.params.code ?? '';
      if (!isPlausibleShortCode(code)) {
        throw new HttpError(404, 'not_found', 'Short link not found');
      }
      const link = await findActiveLink(code);
      if (!link) {
        throw new HttpError(404, 'not_found', 'Short link not found');
      }
      const env = loadEnv();
      const shortUrl = `${env.SHORT_BASE_URL}/${link.shortCode}`;
      const svg = await QRCode.toString(shortUrl, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 256,
      });
      res.set('Content-Type', 'image/svg+xml; charset=utf-8');
      res.set('Cache-Control', 'public, max-age=3600');
      res.send(svg);
    } catch (err) {
      next(err);
    }
  },
);
