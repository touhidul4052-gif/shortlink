import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  SHORT_BASE_URL: z
    .string()
    .url()
    .default('http://localhost:3000')
    .transform((v) => v.replace(/\/+$/, '')),

  REDIRECT_STATUS: z
    .union([z.literal('301'), z.literal('302')])
    .default('302')
    .transform((v) => Number(v) as 301 | 302),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  SHORT_CODE_MIN_LENGTH: z.coerce.number().int().min(1).max(20).default(6),
  SHORT_CODE_ID_OFFSET: z.coerce.number().int().nonnegative().default(1000),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | undefined;

export function loadEnv(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvCacheForTests(): void {
  cached = undefined;
}
