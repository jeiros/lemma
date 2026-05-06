/// <reference lib="dom" />
// Edge Functions run on Deno on Netlify. `Netlify.env` is provided by the
// runtime; this file isn't part of the Node tsconfig (see tsconfig.functions.json)
// so we don't need npm-installed type declarations here.
declare const Netlify: { env: { get(key: string): string | undefined } };

export default async (request: Request): Promise<Response | void> => {
  const user = Netlify.env.get('BASIC_AUTH_USER');
  const pass = Netlify.env.get('BASIC_AUTH_PASS');

  // No-op when env vars aren't set so local dev and pre-config deploys stay open.
  if (!user || !pass) return;

  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Basic ')) {
    try {
      const [u, p] = atob(auth.slice(6)).split(':');
      if (u === user && p === pass) return;
    } catch {
      // fall through to 401
    }
  }

  return new Response('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="lemma"' },
  });
};
