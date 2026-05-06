import { useSyncExternalStore } from 'react';
import type { LemmaCard, OutboxItem } from './types';
import { migrateCard } from './types';
import { createEmptyCard } from './fsrs';
import * as api from './api';

const CACHE_KEY = 'lemma:cards';
const OUTBOX_KEY = 'lemma:outbox';

class Store {
  private cards = new Map<string, LemmaCard>();
  private snap: LemmaCard[] = [];
  private listeners = new Set<() => void>();

  constructor() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as unknown[];
        for (const item of arr) {
          const c = migrateCard(item);
          this.cards.set(c.id, c);
        }
      }
    } catch {}
    this.rebuildSnap();
  }

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  snapshot = (): LemmaCard[] => this.snap;

  get(id: string): LemmaCard | undefined {
    return this.cards.get(id);
  }

  async hydrate(): Promise<void> {
    try {
      const remote = await api.listCards();
      this.cards.clear();
      for (const c of remote) this.cards.set(c.id, c);
      this.emit();
    } catch {
      // network down or first run with no functions; keep local cache
    }
  }

  async create(input: { term: string; context?: string }): Promise<LemmaCard> {
    const card: LemmaCard = {
      id: crypto.randomUUID(),
      term: input.term.trim(),
      context: input.context?.trim() || undefined,
      createdAt: Date.now(),
      fsrs: createEmptyCard(new Date()),
    };
    this.cards.set(card.id, card);
    this.emit();
    try {
      await api.upsertCard(card);
    } catch {
      pushOutbox({ kind: 'upsert', card });
    }
    return card;
  }

  async update(card: LemmaCard): Promise<void> {
    this.cards.set(card.id, card);
    this.emit();
    try {
      await api.upsertCard(card);
    } catch {
      pushOutbox({ kind: 'upsert', card });
    }
  }

  async remove(id: string): Promise<void> {
    this.cards.delete(id);
    this.emit();
    try {
      await api.deleteCard(id);
    } catch {
      pushOutbox({ kind: 'delete', id });
    }
  }

  async enrich(id: string): Promise<void> {
    const card = this.cards.get(id);
    if (!card || (card.senses && card.senses.length > 0)) return;
    try {
      const def = await api.defineTerm(card.term);
      if (def.senses.length === 0 && !def.ipa) return;
      const fresh = this.cards.get(id);
      if (!fresh) return;
      await this.update({
        ...fresh,
        senses: def.senses.length > 0 ? def.senses : fresh.senses,
        resolvedFrom: def.resolvedFrom,
        ipa: def.ipa ?? fresh.ipa,
      });
    } catch {
      // dictionary is best-effort; ignore failures
    }
  }

  async enrichMissing(): Promise<void> {
    const missing = this.snap.filter((c) => !c.senses || c.senses.length === 0);
    for (const c of missing) {
      await this.enrich(c.id);
    }
  }

  private rebuildSnap(): void {
    this.snap = Array.from(this.cards.values());
  }

  private emit(): void {
    this.rebuildSnap();
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(this.snap));
    } catch {}
    for (const fn of this.listeners) fn();
  }
}

export const store = new Store();

export function useStore(): LemmaCard[] {
  return useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
}

function readOutbox(): OutboxItem[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    return raw ? (JSON.parse(raw) as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

function writeOutbox(items: OutboxItem[]): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  } catch {}
}

function pushOutbox(item: OutboxItem): void {
  const items = readOutbox();
  items.push(item);
  writeOutbox(items);
}

export async function flushOutbox(): Promise<void> {
  const items = readOutbox();
  if (items.length === 0) return;
  const remaining: OutboxItem[] = [];
  for (const item of items) {
    try {
      if (item.kind === 'upsert') await api.upsertCard(item.card);
      else await api.deleteCard(item.id);
    } catch {
      remaining.push(item);
    }
  }
  writeOutbox(remaining);
}
