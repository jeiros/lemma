/// <reference lib="dom" />
// Edge Function runs on Deno. Auth flow:
//   1. If a valid signed cookie is present → pass through.
//   2. Else require HTTP Basic Auth. On success, mint a long-lived signed
//      cookie so subsequent requests skip the prompt (fixes the iOS Safari
//      home-screen webclip quirk where Basic credentials don't survive
//      cold launches).
// Without `AUTH_COOKIE_SECRET` set, falls back to plain Basic Auth (every
// request prompts). Without `BASIC_AUTH_USER`/`BASIC_AUTH_PASS`, no-op.
declare const Netlify: { env: { get(key: string): string | undefined } };
type EdgeContext = { next: () => Promise<Response> };

const COOKIE_NAME = 'lemma_auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const REALM = 'lemma';

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function mintCookie(secret: string): Promise<string> {
  const expiry = Date.now() + COOKIE_MAX_AGE * 1000;
  const payload = String(expiry);
  return `${payload}.${await hmac(secret, payload)}`;
}

async function verifyCookie(secret: string, value: string): Promise<boolean> {
  const dot = value.lastIndexOf('.');
  if (dot < 0) return false;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expiry = parseInt(payload, 10);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;
  return sig === (await hmac(secret, payload));
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

export default async (request: Request, context: EdgeContext): Promise<Response | void> => {
  const user = Netlify.env.get('BASIC_AUTH_USER');
  const pass = Netlify.env.get('BASIC_AUTH_PASS');
  const secret = Netlify.env.get('AUTH_COOKIE_SECRET');

  // No-op when basic auth isn't configured — keeps local dev and unconfigured
  // deploys open.
  if (!user || !pass) return;

  // 1. Cookie fast path: skip the Basic prompt on subsequent requests.
  if (secret) {
    const cookie = readCookie(request, COOKIE_NAME);
    if (cookie && (await verifyCookie(secret, cookie))) return;
  }

  // 2. Basic Auth check.
  const auth = request.headers.get('authorization');
  let basicOk = false;
  if (auth?.startsWith('Basic ')) {
    try {
      const [u, p] = atob(auth.slice(6)).split(':');
      if (u === user && p === pass) basicOk = true;
    } catch {
      // fall through to 401
    }
  }

  if (basicOk) {
    if (!secret) return; // legacy mode: every request prompts
    // Pass through to origin, then attach Set-Cookie so future requests skip.
    const response = await context.next();
    const value = await mintCookie(secret);
    response.headers.append(
      'Set-Cookie',
      `${COOKIE_NAME}=${value}; Max-Age=${COOKIE_MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`,
    );
    return response;
  }

  return new Response('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': `Basic realm="${REALM}"` },
  });
};
