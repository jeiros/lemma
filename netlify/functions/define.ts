import type { Context } from '@netlify/functions';

// Wiktionary REST returns nested HTML in definition strings; we strip it,
// drop noise, and group by part of speech. dictionaryapi.dev gives clean IPA
// for common modern English, so we call it in parallel just for phonetics.

type WiktionaryDef = { definition?: string };
type WiktionaryEntry = { partOfSpeech?: string; definitions?: WiktionaryDef[] };
type WiktionaryResponse = Record<string, WiktionaryEntry[]>;
type DictApiEntry = {
  phonetics?: Array<{ text?: string }>;
  meanings?: Array<{ definitions?: Array<{ definition?: string }> }>;
};

export type Sense = { partOfSpeech: string; definition: string };
export type Resolved = { term: string; inflection: string };
export type DefineResult = {
  senses: Sense[];
  ipa?: string;
  resolvedFrom?: Resolved;
};

const WIKT_UA = 'lemma-personal-vocab/0.1 (https://github.com/; personal use)';
const SENSE_CAP = 6;
const PER_POS_CAP = 2;

const json = (status: number, data: unknown): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripHtml(html: string): string {
  return decodeEntities(
    html
      // Wiktionary nests sub-senses as <ol><li>…</li></ol> inside the parent
      // definition; those sub-senses also appear as their own list entries,
      // so drop the nested block to avoid duplicating them in the parent.
      // Sometimes the closing </ol> isn't in the same string, so also strip
      // from any unclosed <ol/<ul to the end.
      .replace(/<ol[\s\S]*?<\/ol>/gi, '')
      .replace(/<ul[\s\S]*?<\/ul>/gi, '')
      .replace(/<ol[\s\S]*$/i, '')
      .replace(/<ul[\s\S]*$/i, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:?!])/g, '$1')
    .trim();
}

// Patterns Wiktionary uses for inflected/alternative forms. Order matters —
// longer phrases first so we don't truncate the inflection label.
const INFLECTION_RE = new RegExp(
  '^(' +
    [
      'present participle and gerund',
      'present participle',
      'past participle',
      'simple past tense and past participle',
      'simple past and past participle',
      'simple past tense',
      'simple past',
      'past tense',
      'present tense',
      'gerund',
      'plural',
      'singular',
      'comparative',
      'superlative',
      'inflection',
      'alternative form',
      'alternative spelling',
      'obsolete form',
      'obsolete spelling',
      'archaic form',
      'misspelling',
      'eye dialect',
      'abbreviation',
      'initialism',
      'acronym',
    ].join('|') +
    ')(?: form)? of ([\\p{L}][\\p{L}\\-\']*?)\\.?$',
  'iu',
);

function detectInflection(definition: string): { inflection: string; base: string } | null {
  const m = definition.match(INFLECTION_RE);
  if (!m) return null;
  return { inflection: m[1].toLowerCase(), base: m[2] };
}

async function fetchWiktionary(term: string): Promise<WiktionaryEntry[] | undefined> {
  const slug = encodeURIComponent(term.trim().replace(/\s+/g, '_'));
  try {
    const r = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${slug}`, {
      headers: { 'User-Agent': WIKT_UA, accept: 'application/json' },
    });
    if (!r.ok) return undefined;
    const data = (await r.json()) as WiktionaryResponse;
    return data.en;
  } catch {
    return undefined;
  }
}

function collectSenses(entries: WiktionaryEntry[]): Sense[] {
  const senses: Sense[] = [];
  for (const entry of entries) {
    const pos = entry.partOfSpeech ?? '';
    for (const def of entry.definitions ?? []) {
      if (!def.definition) continue;
      const cleaned = stripHtml(def.definition);
      if (!cleaned || cleaned.length < 2) continue;
      senses.push({ partOfSpeech: pos, definition: cleaned });
    }
  }
  return senses;
}

// Dedup, then cap to PER_POS_CAP per part-of-speech and SENSE_CAP overall.
function trimSenses(senses: Sense[]): Sense[] {
  const seen = new Set<string>();
  const perPos = new Map<string, number>();
  const out: Sense[] = [];
  for (const s of senses) {
    const key = `${s.partOfSpeech}::${s.definition.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const n = perPos.get(s.partOfSpeech) ?? 0;
    if (n >= PER_POS_CAP) continue;
    perPos.set(s.partOfSpeech, n + 1);
    out.push(s);
    if (out.length >= SENSE_CAP) break;
  }
  return out;
}

async function fromDictionaryApi(term: string): Promise<{ definition?: string; ipa?: string }> {
  try {
    const r = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term.trim())}`,
    );
    if (!r.ok) return {};
    const data = (await r.json()) as DictApiEntry[];
    const first = data?.[0];
    return {
      definition: first?.meanings?.[0]?.definitions?.[0]?.definition,
      ipa: first?.phonetics?.find((p) => p.text)?.text,
    };
  } catch {
    return {};
  }
}

async function lookup(term: string): Promise<{ senses: Sense[]; resolvedFrom?: Resolved }> {
  const entries = await fetchWiktionary(term);
  if (!entries) return { senses: [] };

  const raw = collectSenses(entries);
  if (raw.length === 0) return { senses: [] };

  const tagged = raw.map((s) => ({ sense: s, inf: detectInflection(s.definition) }));
  const formOfs = tagged.filter((t) => t.inf);
  const concretes = tagged.filter((t) => !t.inf);

  // If form-of pointers dominate over concrete senses, the term is primarily
  // an inflected form — follow the most-cited base and use its definitions.
  if (formOfs.length > 0 && formOfs.length >= concretes.length) {
    const baseCount = new Map<string, { count: number; sample: { base: string; inflection: string } }>();
    for (const t of formOfs) {
      const key = t.inf!.base.toLowerCase();
      const cur = baseCount.get(key);
      if (cur) cur.count++;
      else baseCount.set(key, { count: 1, sample: t.inf! });
    }
    let top: { count: number; sample: { base: string; inflection: string } } | undefined;
    for (const v of baseCount.values()) {
      if (!top || v.count > top.count) top = v;
    }
    if (top && top.sample.base.toLowerCase() !== term.trim().toLowerCase()) {
      const baseEntries = await fetchWiktionary(top.sample.base);
      if (baseEntries) {
        const baseSenses = trimSenses(collectSenses(baseEntries).filter((s) => detectInflection(s.definition) === null));
        if (baseSenses.length > 0) {
          return {
            senses: baseSenses,
            resolvedFrom: { term: top.sample.base, inflection: top.sample.inflection },
          };
        }
      }
    }
  }

  // Term has its own concrete meaning(s) — drop form-of noise, return concretes.
  if (concretes.length > 0) {
    return { senses: trimSenses(concretes.map((t) => t.sense)) };
  }

  // No concretes and resolution failed: just return what we have.
  return { senses: trimSenses(raw) };
}

export default async (req: Request, _ctx: Context): Promise<Response> => {
  const url = new URL(req.url);
  const term = url.searchParams.get('term')?.trim();
  if (!term) return json(400, { error: 'term required' });

  const [wikt, dapi] = await Promise.all([lookup(term), fromDictionaryApi(term)]);

  let senses = wikt.senses;
  // Last-ditch fallback: if Wiktionary had nothing, use whatever dictionaryapi.dev returned.
  if (senses.length === 0 && dapi.definition) {
    senses = [{ partOfSpeech: '', definition: dapi.definition }];
  }

  const result: DefineResult = { senses };
  if (wikt.resolvedFrom) result.resolvedFrom = wikt.resolvedFrom;
  if (dapi.ipa) result.ipa = dapi.ipa;
  return json(200, result);
};
