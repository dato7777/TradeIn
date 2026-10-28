export type CspOptions = {
  nonce: string;
  isDev: boolean;
  supabaseUrl?: string;
};

export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function buildCsp({ nonce, isDev, supabaseUrl }: CspOptions): string {
  const supabaseOrigin = originOf(supabaseUrl);
  const connectSrc = ["'self'", supabaseOrigin].filter(Boolean).join(" ");

  const directives: Record<string, string> = {
    "default-src": "'self'",
    "script-src": `'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src": isDev ? "'self' 'unsafe-inline'" : `'self' 'nonce-${nonce}'`,
    // React and Radix set style attributes; nonces cannot cover attributes.
    "style-src-attr": "'unsafe-inline'",
    "img-src": "'self' blob: data:",
    "font-src": "'self'",
    "connect-src": connectSrc,
    "frame-src": "'none'",
    "object-src": "'none'",
    "base-uri": "'self'",
    "form-action": "'self'",
    "frame-ancestors": "'none'",
    "manifest-src": "'self'",
    "worker-src": "'self' blob:",
  };

  const policy = Object.entries(directives).map(
    ([name, value]) => `${name} ${value}`,
  );
  if (!isDev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}
