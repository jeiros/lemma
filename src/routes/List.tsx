import { store, useStore } from '../lib/store';
import { dueAt } from '../lib/fsrs';

export default function List() {
  const cards = useStore();
  const sorted = [...cards].sort((a, b) => b.createdAt - a.createdAt);

  async function onDelete(id: string, term: string) {
    if (!confirm(`Delete "${term}"?`)) return;
    await store.remove(id);
  }

  return (
    <div className="list">
      <h1>
        Cards <span className="muted">({sorted.length})</span>
      </h1>
      {sorted.length === 0 && <p className="hint">No cards yet. Go capture some.</p>}
      <ul className="card-list">
        {sorted.map((c) => (
          <li key={c.id} className="card-row">
            <div className="card-row-main">
              <div className="term-small">{c.term}</div>
              {c.ipa && <div className="ipa-small">{c.ipa}</div>}
              {c.resolvedFrom && (
                <div className="resolved-small muted">
                  {c.resolvedFrom.inflection} of <em>{c.resolvedFrom.term}</em>
                </div>
              )}
              {c.senses?.map((s, i) => (
                <div key={i} className="def-small">
                  {s.partOfSpeech && <span className="pos-small">{s.partOfSpeech}</span>}
                  {s.definition}
                </div>
              ))}
              {c.context && <div className="context-small">&ldquo;{c.context}&rdquo;</div>}
              <div className="meta-small muted">due {timeUntil(dueAt(c.fsrs))}</div>
            </div>
            <button
              className="btn small danger"
              onClick={() => onDelete(c.id, c.term)}
              aria-label={`Delete ${c.term}`}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function timeUntil(ts: number): string {
  const diff = ts - Date.now();
  if (diff <= 0) return 'now';
  const d = Math.round(diff / 86400000);
  if (d > 0) return `in ${d}d`;
  const h = Math.round(diff / 3600000);
  if (h > 0) return `in ${h}h`;
  const m = Math.round(diff / 60000);
  return `in ${Math.max(1, m)}m`;
}
