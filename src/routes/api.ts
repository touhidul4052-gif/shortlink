import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { createLink } from '../services/links.service.js';

const shortenSchema = z.object({
  longUrl: z.string().min(1, 'longUrl is required'),
  customAlias: z.string().optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});

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
