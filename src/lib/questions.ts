import raw from "@/data/questions.json";

export type Question = { id: string; question: string; options: [string, string]; correct: 0 | 1; explanation: string };

export const QUESTIONS = raw as Question[];
export const QUESTION_BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

export type Dealt = Question & { order: [0 | 1, 0 | 1] };

/** Pick n random questions and randomize option order. */
export function deal(n: number, rand: () => number = Math.random): Dealt[] {
  const a = [...QUESTIONS];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(n, a.length)).map((q) => ({ ...q, order: rand() < 0.5 ? [0, 1] : [1, 0] }));
}
