// Hit the locally-running netlify dev /functions/define for each argv term.
const terms = process.argv.slice(2);
if (terms.length === 0) {
  console.error('usage: node scripts/probe-define.mjs <term> [term...]');
  process.exit(1);
}
for (const term of terms) {
  const r = await fetch(`http://localhost:8888/functions/define?term=${encodeURIComponent(term)}`);
  const body = await r.text();
  console.log(`\n=== ${term} (${r.status}) ===`);
  console.log(body);
}
