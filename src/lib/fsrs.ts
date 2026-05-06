import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  Rating,
  type Grade,
  type Card as FSRSCard,
} from 'ts-fsrs';

export const scheduler = fsrs(generatorParameters({ enable_fuzz: true }));

export { createEmptyCard, Rating };
export type { FSRSCard, Grade };

// Cards round-trip through JSON (localStorage and API), so Date fields come
// back as strings. Rehydrate before handing to ts-fsrs which expects Date.
export function hydrate(state: FSRSCard): FSRSCard {
  return {
    ...state,
    due: new Date(state.due),
    last_review: state.last_review ? new Date(state.last_review) : undefined,
  };
}

export function dueAt(state: FSRSCard): number {
  return new Date(state.due).getTime();
}
