const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const MAX_URL_LENGTH = 2048;

export class InvalidUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUrlError';
  }
}

/**
 * Canonicalize a destination URL:
 *   - trims whitespace
 *   - rejects empty / over-long inputs
 *   - enforces http(s) protocol
 *   - lowercases protocol + host
 *   - removes default ports (80/443)
 *   - normalizes empty path to "/"
 *   - drops trailing fragment if empty
 *
 * Query strings and fragments are preserved verbatim — they often
 * carry tracking parameters that the user explicitly wants kept.
 */
export function canonicalizeUrl(raw: string): string {
  if (typeof raw !== 'string') {
    throw new InvalidUrlError('URL must be a string');
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new InvalidUrlError('URL is required');
  }
  if (trimmed.length > MAX_URL_LENGTH) {
    throw new InvalidUrlError(
      `URL exceeds maximum length of ${MAX_URL_LENGTH} characters`,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new InvalidUrlError('URL is malformed');
  }

  const protocol = parsed.protocol.toLowerCase();
  if (!ALLOWED_PROTOCOLS.has(protocol)) {
    throw new InvalidUrlError(
      `Protocol "${protocol.replace(/:$/, '')}" is not allowed; use http or https`,
    );
  }

  if (!parsed.hostname) {
    throw new InvalidUrlError('URL must include a host');
  }

  parsed.protocol = protocol;
  parsed.hostname = parsed.hostname.toLowerCase();

  if (
    (protocol === 'http:' && parsed.port === '80') ||
    (protocol === 'https:' && parsed.port === '443')
  ) {
    parsed.port = '';
  }

  if (parsed.pathname === '') {
    parsed.pathname = '/';
  }

  let serialized = parsed.toString();
  if (serialized.endsWith('#')) {
    serialized = serialized.slice(0, -1);
  }
  return serialized;
}
