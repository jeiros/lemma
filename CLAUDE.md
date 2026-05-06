Phase 1 — Scaffold
  Vite + React + TS, plain CSS (no framework), mobile-first.
  Routes: /capture (default), /review, /list. netlify.toml with functions dir.

Phase 2 — Storage
  Netlify Function `cards` (GET/POST/PUT/DELETE) backed by Netlify Blobs.
  Maintain `index` blob on every write.
  Client data layer mirrors to localStorage for instant reads.

Phase 3 — Capture
  Form, autofocus, Save. After save, async call to /functions/define?term=…
  which proxies dictionaryapi.dev and patches the card with definition + IPA.

Phase 4 — FSRS review
  Install ts-fsrs. New cards init with defaults.
  Review screen queries due cards (due <= now). Rating → fsrs.next() → persist.
  Big tap targets; 1/2/3/4 keyboard shortcuts for desktop.

Phase 5 — Auth
  Edge Function on / gates with HTTP Basic Auth from BASIC_AUTH_USER /
  BASIC_AUTH_PASS env vars. Set in Netlify dashboard before first deploy.

Phase 6 — PWA (optional)
  manifest.json + icon for Add to Home Screen.
  Service worker with offline capture queue, sync on reconnect.
Phase 7 — Daily review email
  Netlify Scheduled Function (cron in netlify.toml, e.g. "0 6 * * *" for 7am Madrid).
  On run: query due cards, pick up to 10, render HTML email, send via Resend.
  Email contains: count in subject, each card as term + context + definition,
  CTA button linking to /review on the deployed site.
  Sign up at resend.com, verify a domain you own (or use resend.dev for testing
  to your own address only), add API key as env var.

  Env vars to add in Netlify dashboard:
    RESEND_API_KEY
    DIGEST_TO_EMAIL      (your inbox)
    DIGEST_FROM_EMAIL    (must be on a Resend-verified domain)
