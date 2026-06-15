// Question provider for duels. Reuses the game's validated 5,000+ question bank
// (exported from BrainKingdom.tsx) so duel content matches single-player.
//
// IMPORTANT (anti-cheat): the *creator* of a match picks the questions once and
// stores them in the match row; every client renders that exact array in that
// exact order. This module only produces the initial selection.
import { RAW_BANK, CATEGORIES } from "../BrainKingdom";
import type { Question } from "./types";

export interface CategoryMeta {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export const CATEGORY_LIST: CategoryMeta[] = (CATEGORIES as CategoryMeta[]).map(
  (c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color })
);

const BANK = RAW_BANK as Record<string, Question[]>;

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Normalize one raw question and shuffle its options so the answer position
 *  is not always first (the raw bank lists the answer as opts[0]). */
function normalize(raw: Question): Question {
  const opts = shuffle(raw.opts);
  return { q: raw.q, a: raw.a, opts, d: raw.d };
}

/**
 * Pick `count` questions. `categoryId === null` mixes all categories.
 * Returns fully-formed, option-shuffled questions ready to store in the match.
 */
export function pickQuestions(categoryId: string | null, count: number): Question[] {
  let pool: Question[];
  if (categoryId && BANK[categoryId]) {
    pool = BANK[categoryId];
  } else {
    pool = ([] as Question[]).concat(...Object.values(BANK));
  }
  const picked = shuffle(pool).slice(0, Math.max(1, count));
  return picked.map(normalize);
}
