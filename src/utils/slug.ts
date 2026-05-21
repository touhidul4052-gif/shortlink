const RESERVED_SLUGS = new Set([
  'api',
  'health',
  'admin',
  'dashboard',
  'login',
  'logout',
  'register',
  'static',
  'assets',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  '_next',
]);

const CUSTOM_SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,29}$/;

export class InvalidSlugError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSlugError';
  }
}

/**
 * Validate a user-provided custom alias.
 *
 * Rules:
 *   - 3..30 characters
 *   - must start with [A-Za-z0-9]
 *   - remaining characters may include `_` or `-`
 *   - cannot be a reserved word (e.g. "api", "health")
 *
 * Returns the slug unchanged when valid; throws otherwise.
 */
export function validateCustomSlug(slug: string): string {
  if (typeof slug !== 'string') {
    throw new InvalidSlugError('Custom slug must be a string');
  }
  const trimmed = slug.trim();
  if (!CUSTOM_SLUG_PATTERN.test(trimmed)) {
    throw new InvalidSlugError(
      'Custom slug must be 3-30 characters, start with a letter or digit, and contain only letters, digits, hyphens, or underscores',
    );
  }
  if (RESERVED_SLUGS.has(trimmed.toLowerCase())) {
    throw new InvalidSlugError(`Custom slug "${trimmed}" is reserved`);
  }
  return trimmed;
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}
