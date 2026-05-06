import { getStore } from '@netlify/blobs';
import type { Config } from '@netlify/functions';
import { Resend } from 'resend';

type FSRSCard = { due: string | Date };
type Sense = { partOfSpeech: string; definition: string };
type Resolved = { term: string; inflection: string };
type LemmaCard = {
  id: string;
  term: string;
  context?: string;
  senses?: Sense[];
  resolvedFrom?: Resolved;
  ipa?: string;
  // legacy field on older blobs
  definition?: string;
  fsrs: FSRSCard;
};
type CardIndex = { ids: string[]; updatedAt: number };

// 05:00 UTC ≈ 07:00 Madrid (summer CEST). Winter (CET) it fires at 06:00 local
// — a known DST quirk; cron in Netlify is always UTC.
export const config: Config = { schedule: '0 5 * * *' };

export default async (): Promise<Response> => {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.DIGEST_TO_EMAIL;
  const from = process.env.DIGEST_FROM_EMAIL;
  const siteUrl = process.env.URL ?? '';

  if (!apiKey || !to || !from) {
    console.log('digest: env vars missing, skipping');
    return new Response('skipped: env vars missing', { status: 200 });
  }

  const store = getStore({ name: 'cards' });
  const idx = ((await store.get('index', { type: 'json' })) as CardIndex | null) ?? {
    ids: [],
    updatedAt: 0,
  };
  const all = (
    await Promise.all(idx.ids.map((i) => store.get(`card:${i}`, { type: 'json' })))
  ).filter(Boolean) as LemmaCard[];

  const now = Date.now();
  const due = all
    .filter((c) => new Date(c.fsrs.due).getTime() <= now)
    .sort((a, b) => new Date(a.fsrs.due).getTime() - new Date(b.fsrs.due).getTime())
    .slice(0, 10);

  if (due.length === 0) {
    console.log('digest: no cards due');
    return new Response('no cards due', { status: 200 });
  }

  const subject = `Lemma — ${due.length} card${due.length === 1 ? '' : 's'} due`;
  const html = renderEmail(due, siteUrl);
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({ from, to, subject, html });
  console.log('digest sent', JSON.stringify(result));
  return new Response('sent', { status: 200 });
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sensesFor(c: LemmaCard): Sense[] {
  if (c.senses && c.senses.length > 0) return c.senses;
  if (c.definition) return [{ partOfSpeech: '', definition: c.definition }];
  return [];
}

function renderEmail(cards: LemmaCard[], siteUrl: string): string {
  const reviewUrl = `${siteUrl}/review`;
  const items = cards
    .map((c) => {
      const term = `<div style="font-size:18px;font-weight:600;color:#1a1a1a">${escapeHtml(c.term)}</div>`;
      const ipa = c.ipa
        ? `<div style="color:#6b6b66;font-style:italic;font-size:13px">${escapeHtml(c.ipa)}</div>`
        : '';
      const resolved = c.resolvedFrom
        ? `<div style="color:#6b6b66;font-size:13px;margin-top:2px">${escapeHtml(c.resolvedFrom.inflection)} of <em>${escapeHtml(c.resolvedFrom.term)}</em></div>`
        : '';
      const senses = sensesFor(c)
        .map((s) => {
          const pos = s.partOfSpeech
            ? `<span style="font-size:11px;font-weight:600;text-transform:uppercase;color:#1d3557;background:rgba(29,53,87,0.08);padding:1px 6px;border-radius:4px;margin-right:6px">${escapeHtml(s.partOfSpeech)}</span>`
            : '';
          return `<li style="margin:6px 0;font-size:14px;color:#333">${pos}${escapeHtml(s.definition)}</li>`;
        })
        .join('');
      const senseList = senses
        ? `<ol style="margin:6px 0 0;padding-left:20px">${senses}</ol>`
        : '';
      const ctx = c.context
        ? `<div style="color:#6b6b66;font-style:italic;font-size:13px;margin-top:6px">&ldquo;${escapeHtml(c.context)}&rdquo;</div>`
        : '';
      return `<li style="margin:0 0 16px;padding:12px;background:#ffffff;border:1px solid #e5e5e0;border-radius:8px;list-style:none">${term}${ipa}${resolved}${senseList}${ctx}</li>`;
    })
    .join('');

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#fafaf7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a">
  <div style="max-width:560px;margin:0 auto">
    <h1 style="font-size:20px;margin:0 0 16px">Today's lemmas</h1>
    <ul style="margin:0;padding:0">${items}</ul>
    <p style="text-align:center;margin:24px 0">
      <a href="${escapeHtml(reviewUrl)}" style="display:inline-block;background:#1d3557;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Review now</a>
    </p>
  </div>
</body></html>`;
}
