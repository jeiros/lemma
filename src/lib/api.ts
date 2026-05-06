import type { LemmaCard, DefineResult } from './types';
import { migrateCard } from './types';

const BASE = '/functions';

export async function listCards(): Promise<LemmaCard[]> {
  const r = await fetch(`${BASE}/cards`);
  if (!r.ok) throw new Error(`list failed: ${r.status}`);
  const raw = (await r.json()) as unknown[];
  return raw.map(migrateCard);
}

export async function upsertCard(card: LemmaCard): Promise<LemmaCard> {
  const r = await fetch(`${BASE}/cards`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(card),
  });
  if (!r.ok) throw new Error(`upsert failed: ${r.status}`);
  return r.json();
}

export async function deleteCard(id: string): Promise<void> {
  const r = await fetch(`${BASE}/cards?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) throw new Error(`delete failed: ${r.status}`);
}

export async function defineTerm(term: string): Promise<DefineResult> {
  const r = await fetch(`${BASE}/define?term=${encodeURIComponent(term)}`);
  if (!r.ok) return { senses: [] };
  return r.json();
}
