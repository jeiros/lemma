import type { Card as FSRSCard } from 'ts-fsrs';

export type Sense = { partOfSpeech: string; definition: string };
export type Resolved = { term: string; inflection: string };

export type LemmaCard = {
  id: string;
  term: string;
  context?: string;
  senses?: Sense[];
  resolvedFrom?: Resolved;
  ipa?: string;
  createdAt: number;
  fsrs: FSRSCard;
};

export type DefineResult = {
  senses: Sense[];
  ipa?: string;
  resolvedFrom?: Resolved;
};

export type OutboxItem =
  | { kind: 'upsert'; card: LemmaCard }
  | { kind: 'delete'; id: string };

// Older cards in localStorage / Blobs may have a single `definition: string`
// field instead of `senses[]`. Normalize on read.
export function migrateCard(raw: any): LemmaCard {
  if (raw?.definition && !raw.senses) {
    const { definition, ...rest } = raw;
    return { ...rest, senses: [{ partOfSpeech: '', definition }] };
  }
  return raw as LemmaCard;
}
