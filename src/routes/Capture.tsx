import { useRef, useState } from 'react';
import { store } from '../lib/store';

export default function Capture() {
  const [term, setTerm] = useState('');
  const [context, setContext] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedTerm, setSavedTerm] = useState<string | null>(null);
  const termRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!term.trim() || saving) return;
    setSaving(true);
    const created = await store.create({ term, context });
    setSavedTerm(created.term);
    setTerm('');
    setContext('');
    setSaving(false);
    termRef.current?.focus();
    store.enrich(created.id);
  }

  return (
    <form className="capture" onSubmit={onSubmit}>
      <h1>Capture</h1>
      <label className="field">
        <span>Term</span>
        <input
          ref={termRef}
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="word or phrase"
        />
      </label>
      <label className="field">
        <span>Context</span>
        <textarea
          rows={3}
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="optional sentence where you saw it"
        />
      </label>
      <button type="submit" className="btn primary" disabled={!term.trim() || saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>
      {savedTerm && <p className="hint">Saved &ldquo;{savedTerm}&rdquo;.</p>}
    </form>
  );
}
