// One-off: probe Wiktionary REST for terms passed as argv to verify coverage + shape.
const UA = 'lemma-personal-vocab/0.1 (probe)';
const terms = process.argv.slice(2);
if (terms.length === 0) {
  console.error('usage: node probe-wiktionary.mjs <term> [term...]');
  process.exit(1);
}
for (const term of terms) {
  const slug = encodeURIComponent(term.replace(/\s+/g, '_'));
  const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${slug}`;
  const r = await fetch(url, { headers: { 'User-Agent': UA, accept: 'application/json' } });
  console.log(`\n=== ${term} (${r.status}) ===`);
  if (!r.ok) continue;
  const data = await r.json();
  const en = data.en;
  if (!en) {
    console.log('no en entries; languages:', Object.keys(data));
    continue;
  }
  for (const entry of en) {
    console.log('partOfSpeech:', entry.partOfSpeech);
    for (const def of entry.definitions ?? []) {
      console.log('  -', JSON.stringify(def.definition));
    }
  }
}
