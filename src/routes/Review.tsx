import { useEffect, useMemo, useState } from 'react';
import { store, useStore } from '../lib/store';
import { Rating, dueAt, hydrate, scheduler, type Grade } from '../lib/fsrs';

const RATINGS: Array<{ rating: Grade; label: string; key: string }> = [
  { rating: Rating.Again, label: 'Again', key: '1' },
  { rating: Rating.Hard, label: 'Hard', key: '2' },
  { rating: Rating.Good, label: 'Good', key: '3' },
  { rating: Rating.Easy, label: 'Easy', key: '4' },
];

export default function Review() {
  const cards = useStore();
  const [revealed, setRevealed] = useState(false);

  const due = useMemo(() => {
    const now = Date.now();
    return cards
      .filter((c) => dueAt(c.fsrs) <= now)
      .sort((a, b) => dueAt(a.fsrs) - dueAt(b.fsrs));
  }, [cards]);

  const card = due[0];

  async function rate(rating: Grade) {
    if (!card) return;
    const result = scheduler.next(hydrate(card.fsrs), new Date(), rating);
    setRevealed(false);
    await store.update({ ...card, fsrs: result.card });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!card) return;
      if (e.key === ' ' || e.key === 'Enter') {
        if (!revealed) {
          e.preventDefault();
          setRevealed(true);
        }
        return;
      }
      if (!revealed) return;
      const match = RATINGS.find((r) => r.key === e.key);
      if (match) rate(match.rating);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!card) {
    return (
      <div className="review">
        <h1>Review</h1>
        <p className="hint">Nothing due. Capture something or come back later.</p>
      </div>
    );
  }

  return (
    <div className="review">
      <header className="review-header">
        <span className="muted">{due.length} due</span>
      </header>
      <div className="card" onClick={() => !revealed && setRevealed(true)}>
        <div className="term">{card.term}</div>
        {revealed && (
          <div className="back">
            {card.ipa && <div className="ipa">{card.ipa}</div>}
            {card.resolvedFrom && (
              <div className="resolved muted">
                {card.resolvedFrom.inflection} of <em>{card.resolvedFrom.term}</em>
              </div>
            )}
            {card.senses && card.senses.length > 0 ? (
              <ol className="senses">
                {card.senses.map((s, i) => (
                  <li key={i} className="sense">
                    {s.partOfSpeech && <span className="pos">{s.partOfSpeech}</span>}
                    <span className="sense-text">{s.definition}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="muted">(no definition yet)</div>
            )}
            {card.context && <div className="context">&ldquo;{card.context}&rdquo;</div>}
          </div>
        )}
      </div>
      {!revealed ? (
        <button className="btn primary" onClick={() => setRevealed(true)}>
          Reveal
        </button>
      ) : (
        <div className="rating-grid">
          {RATINGS.map((r) => (
            <button
              key={r.key}
              className={`btn rating rating-${r.label.toLowerCase()}`}
              onClick={() => rate(r.rating)}
            >
              <span className="rating-label">{r.label}</span>
              <span className="rating-key">{r.key}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
